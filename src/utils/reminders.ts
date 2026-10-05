/**
 * Reminder planning (pure): which "starting" / "overdue" alerts should fire
 * at a check, and the text they show. The browser side (toasts, sound,
 * system notifications, app badge) lives in components/reminders.
 */
import type { Task } from '../types/task';
import type { SyncState } from '../sync/engine';
import { formatTime12, todayISO } from './date';
import { isHappening, minutesLeft, taskEnd, taskStart } from './timeGate';

export type ReminderKind = 'starting' | 'overdue';

export interface DueReminder {
  /** Unique per task, kind and time slot, e.g. "starting:tpl-java@2026-10-05|2026-10-05T19:30". */
  key: string;
  kind: ReminderKind;
  task: Task;
  /** The moment it became due. */
  at: Date;
}

export type ReminderNotice =
  | { type: 'single'; reminder: DueReminder }
  | { type: 'summary'; reminders: DueReminder[]; overdue: number; starting: number };

export interface ReminderPlanInput {
  /** The tasks to look at (the engine passes yesterday's, today's and tomorrow's: times decide what fires). */
  tasks: Task[];
  now: Date;
  /** The previous check. Only things that became due after it fire (null = first check). */
  lastCheck: Date | null;
  /** Keys already alerted (from this or another tab / an earlier visit). */
  alerted: ReadonlySet<string>;
  /** "Starting" alerts fire this many minutes before the start (0 = at the start). */
  remindBeforeMinutes: number;
  /** Anything that became due longer ago than this is ignored (no ancient alerts). */
  maxAgeMinutes?: number;
  /** This many (or more) alerts at once are collapsed into one summary. */
  collapseAt?: number;
}

export interface ReminderPlan {
  /** Every reminder that is now due (all of them should be remembered as alerted). */
  due: DueReminder[];
  /** What to show: one notice per reminder, or a single summary when there are many. */
  notices: ReminderNotice[];
}

export const REMINDER_MAX_AGE_MINUTES = 120;
export const REMINDER_COLLAPSE_AT = 3;

/** "2026-10-05T19:30" (local time). */
function stamp(d: Date): string {
  return `${todayISO(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Unique per task, kind and time slot: "starting" uses the start, "overdue"
 * the end. A task moved to another time gets new keys, so its new start and
 * end are alerted again.
 */
export function reminderKey(kind: ReminderKind, task: Pick<Task, 'id' | 'date' | 'startTime' | 'endTime'>): string {
  return `${kind}:${task.id}|${stamp(kind === 'starting' ? taskStart(task) : taskEnd(task))}`;
}

const open = (t: Task) => !t.completed && !t.skipped;
const byTime = (a: DueReminder, b: DueReminder) =>
  a.at.getTime() - b.at.getTime() || (a.kind === b.kind ? 0 : a.kind === 'overdue' ? -1 : 1);

/** One notice per reminder, or a single summary when there are many (e.g. the app was closed for hours). */
export function toNotices(due: DueReminder[], collapseAt = REMINDER_COLLAPSE_AT): ReminderNotice[] {
  if (due.length === 0) return [];
  if (due.length >= collapseAt) {
    const overdue = due.filter((d) => d.kind === 'overdue').length;
    return [{ type: 'summary', reminders: due, overdue, starting: due.length - overdue }];
  }
  return due.map((reminder) => ({ type: 'single', reminder }));
}

/** Decide which reminders fire at `now`. */
export function planReminders(input: ReminderPlanInput): ReminderPlan {
  const { tasks, now, lastCheck, alerted } = input;
  const before = Math.max(0, input.remindBeforeMinutes || 0);
  const maxAge = input.maxAgeMinutes ?? REMINDER_MAX_AGE_MINUTES;
  const collapseAt = input.collapseAt ?? REMINDER_COLLAPSE_AT;
  const nowMs = now.getTime();
  const floor = Math.max(lastCheck ? lastCheck.getTime() : -Infinity, nowMs - maxAge * 60_000);
  const inWindow = (ms: number) => ms > floor && ms <= nowMs;

  const due: DueReminder[] = [];
  for (const task of tasks) {
    if (!open(task)) continue;
    const start = taskStart(task).getTime();
    const end = taskEnd(task).getTime();
    const remindAt = start - before * 60_000;
    const startKey = reminderKey('starting', task);
    // A task that already ended gets the "overdue" alert instead of "starting".
    if (nowMs < end && inWindow(remindAt) && !alerted.has(startKey)) {
      due.push({ key: startKey, kind: 'starting', task, at: new Date(remindAt) });
    }
    const overKey = reminderKey('overdue', task);
    if (end > start && inWindow(end) && !alerted.has(overKey)) {
      due.push({ key: overKey, kind: 'overdue', task, at: new Date(end) });
    }
  }
  due.sort(byTime);
  return { due, notices: toNotices(due, collapseAt) };
}

/**
 * Re-checks reminders against the latest data right before they are shown
 * (after a while in the background, or once cloud sync brought changes):
 * drops tasks that were ticked, skipped, deleted or moved since, "starting"
 * reminders of tasks that already ended (the "overdue" one covers them),
 * duplicates and anything too old.
 */
export function refreshDue(
  due: DueReminder[],
  tasks: Task[],
  now: Date,
  maxAgeMinutes = REMINDER_MAX_AGE_MINUTES,
): DueReminder[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const out: DueReminder[] = [];
  for (const d of due) {
    const task = byId.get(d.task.id);
    if (!task || !open(task) || seen.has(d.key) || reminderKey(d.kind, task) !== d.key) continue;
    if (d.kind === 'starting' && now.getTime() >= taskEnd(task).getTime()) continue;
    if (now.getTime() - d.at.getTime() >= maxAgeMinutes * 60_000) continue;
    seen.add(d.key);
    out.push({ ...d, task });
  }
  return out.sort(byTime);
}

/**
 * The tasks "today" is about: today's plus yesterday's that run past midnight
 * (last night's sleep, a late study block), so after midnight they can still
 * be shown as happening now or as overdue.
 */
export function withOvernight(yesterday: Task[], today: Task[], todayDate: string): Task[] {
  const midnight = taskStart({ date: todayDate, startTime: '00:00' }).getTime();
  return [...yesterday.filter((t) => taskEnd(t).getTime() >= midnight), ...today];
}

/** What reminders need to know about cloud sync. */
export interface SyncView {
  /** Cloud sync is set up for this build. */
  configured: boolean;
  /** Firebase loaded and the sign-in state is known. */
  ready: boolean;
  signedIn: boolean;
  state: SyncState;
}

/**
 * True while the other devices' changes may still be on their way (app start
 * with cloud sync): reminders wait, so a task ticked on the Mac isn't reported
 * as "did you do it?" on the iPhone.
 */
export function waitForSync(sync: SyncView): boolean {
  if (!sync.configured) return false;
  if (!sync.ready) return true;
  return sync.signedIn && (sync.state === 'connecting' || sync.state === 'needs-choice');
}

/** Tasks that ended without being ticked or skipped (oldest first). */
export function overdueTasks(tasks: Task[], now: Date): Task[] {
  return tasks
    .filter((t) => open(t) && taskEnd(t).getTime() > taskStart(t).getTime() && taskEnd(t).getTime() <= now.getTime())
    .sort((a, b) => taskEnd(a).getTime() - taskEnd(b).getTime());
}

/** Open tasks running right now (latest start first). */
export function currentTasks(tasks: Task[], now: Date): Task[] {
  return tasks
    .filter((t) => open(t) && isHappening(t, now))
    .sort((a, b) => taskStart(b).getTime() - taskStart(a).getTime());
}

/** "25 min" / "2 h 5 min" ago or left, rounded to whole minutes. */
function span(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

/** Title and body for a notice (used for toasts and system notifications). */
export function noticeText(notice: ReminderNotice, now: Date): { title: string; body: string } {
  if (notice.type === 'summary') {
    const parts: string[] = [];
    if (notice.overdue) parts.push(`${notice.overdue} overdue`);
    if (notice.starting) parts.push(`${notice.starting} starting`);
    const names = notice.reminders.map((r) => r.task.title);
    const unique = [...new Set(names)];
    const list = unique.length > 3 ? `${unique.slice(0, 3).join(', ')} +${unique.length - 3} more` : unique.join(', ');
    return { title: `${notice.reminders.length} tasks are waiting`, body: `${parts.join(' · ')}: ${list}.` };
  }
  const { task, kind } = notice.reminder;
  const start = taskStart(task);
  const range = `${formatTime12(task.startTime)} – ${formatTime12(task.endTime)}`;
  if (kind === 'overdue') {
    return {
      title: `${task.title} ended — did you do it?`,
      body: `It ended at ${formatTime12(task.endTime)} and isn’t ticked yet. Tick it if you did, or move / skip it.`,
    };
  }
  const diff = (start.getTime() - now.getTime()) / 60_000;
  if (diff >= 1) return { title: `${task.title} starts in ${span(diff)}`, body: `${range} · get ready.` };
  if (diff > -2) return { title: `${task.title} starts now`, body: `${range} · ${span(minutesLeft(task, now))} planned.` };
  return { title: `${task.title} started ${span(-diff)} ago`, body: `${range} · ${span(minutesLeft(task, now))} left.` };
}

/* ───────────── remembered alerts (device-only, per day) ───────────── */

export const ALERTED_PREFIX = 'kiran-planner:ui:alerted:';

export function alertedStorageKey(date: string): string {
  return `${ALERTED_PREFIX}${date}`;
}

type KeyStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

/** Keys already alerted on `date`. Never throws (private mode, blocked storage…). */
export function loadAlerted(storage: KeyStore | undefined, date: string): Set<string> {
  try {
    const raw = storage?.getItem(alertedStorageKey(date));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Adds keys to the day's alerted list (merging with what other tabs saved). */
export function saveAlerted(storage: KeyStore | undefined, date: string, keys: Iterable<string>): void {
  try {
    if (!storage) return;
    const merged = loadAlerted(storage, date);
    for (const k of keys) merged.add(k);
    storage.setItem(alertedStorageKey(date), JSON.stringify([...merged]));
  } catch {
    // Storage full or blocked: reminders may repeat after a reload, nothing worse.
  }
}

/** Removes alerted lists of days other than `keep`. */
export function pruneAlerted(storage: KeyStore | undefined, keep: string[]): void {
  try {
    if (!storage) return;
    const stale: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(ALERTED_PREFIX) && !keep.includes(k.slice(ALERTED_PREFIX.length))) stale.push(k);
    }
    stale.forEach((k) => storage.removeItem(k));
  } catch {
    // ignore
  }
}
