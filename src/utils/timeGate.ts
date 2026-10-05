/**
 * Time-lock ("honest ticks"): a task can only be marked done once its start
 * time has arrived. Un-ticking and skipping are always allowed.
 * Pure helpers used by the tick toggle, task cards, the study dialog and reminders.
 */
import type { Task } from '../types/task';
import {
  addDays,
  dayOfWeek,
  formatShortDate,
  formatTime12,
  isValidISODate,
  isValidTime,
  parseISODate,
  timeToMinutes,
  todayISO,
  WEEKDAY_SHORT,
} from './date';

type Timed = Pick<Task, 'date' | 'startTime' | 'endTime'>;

/** Ticking within this many minutes after the end still counts as on time. */
export const LATE_GRACE_MINUTES = 10;

/** Local Date for "YYYY-MM-DD" + "HH:mm" (an invalid time counts as midnight). */
function localDateTime(date: string, time: string): Date {
  const d = parseISODate(date);
  const mins = isValidTime(time) ? timeToMinutes(time) : 0;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(mins / 60), mins % 60);
}

/** When the task starts (its date + start time, local time). */
export function taskStart(task: Pick<Task, 'date' | 'startTime'>): Date {
  return localDateTime(task.date, task.startTime);
}

/** When the task ends. An end at or before the start is on the next day (sleep 22:00 → 05:00). */
export function taskEnd(task: Timed): Date {
  const start = taskStart(task);
  if (!isValidTime(task.endTime)) return start;
  const end = localDateTime(task.date, task.endTime);
  if (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1);
  return end;
}

/**
 * True when the task may be ticked now: its start time has arrived.
 * Past dates are always allowed, future dates never. `gateOn = false` (prefs.timeGate off) allows everything.
 */
export function canMarkDone(task: Pick<Task, 'date' | 'startTime'>, now: Date, gateOn = true): boolean {
  if (!gateOn || !isValidISODate(task.date)) return true;
  const today = todayISO(now);
  if (task.date < today) return true;
  if (task.date > today) return false;
  return now.getTime() >= taskStart(task).getTime();
}

/**
 * Keeps a tick honest after a task is moved or edited: a ticked task whose new
 * slot hasn't started yet loses its tick (it can be ticked again once it starts).
 * Returns the same object when nothing has to change.
 */
export function dropEarlyTick<T extends Pick<Task, 'date' | 'startTime' | 'completed' | 'skipped' | 'completedAt'>>(
  task: T,
  now: Date,
  gateOn = true,
): T {
  if (!task.completed || task.skipped || canMarkDone(task, now, gateOn)) return task;
  return { ...task, completed: false, completedAt: undefined };
}

/** Whole minutes until the task starts (rounded up), 0 once it has started. */
export function timeUntilStart(task: Pick<Task, 'date' | 'startTime'>, now: Date): number {
  return Math.max(0, Math.ceil((taskStart(task).getTime() - now.getTime()) / 60_000));
}

/** Ticked after its end time (plus an optional grace period). */
export function isLate(task: Timed & Pick<Task, 'completed' | 'skipped' | 'completedAt'>, graceMinutes = 0): boolean {
  if (!task.completed || task.skipped || !task.completedAt || !isValidISODate(task.date)) return false;
  const done = Date.parse(task.completedAt);
  if (Number.isNaN(done)) return false;
  return done > taskEnd(task).getTime() + graceMinutes * 60_000;
}

/** Started and not yet ended. */
export function isHappening(task: Timed, now: Date): boolean {
  if (!isValidISODate(task.date)) return false;
  const t = now.getTime();
  return t >= taskStart(task).getTime() && t < taskEnd(task).getTime();
}

/** Minutes left until the end (rounded up), 0 once ended. */
export function minutesLeft(task: Timed, now: Date): number {
  return Math.max(0, Math.ceil((taskEnd(task).getTime() - now.getTime()) / 60_000));
}

/** Friendly wait for messages: 25 → "25 min", 125 → "2 h 5 min", 2000 → "1 day 9 h". */
export function formatWait(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  if (m < 60) return `${m} min`;
  if (m < 1440) {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? `${h} h ${rest} min` : `${h} h`;
  }
  const days = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return `${days} ${days === 1 ? 'day' : 'days'}${h ? ` ${h} h` : ''}`;
}

/** "Tue, Oct 6" */
function dayLabel(date: string): string {
  return `${WEEKDAY_SHORT[dayOfWeek(date)]}, ${formatShortDate(date)}`;
}

/** When ticking becomes possible, for labels: "7:30 PM" or "Tue, Oct 6, 7:30 PM". */
export function availableFrom(task: Pick<Task, 'date' | 'startTime'>, now: Date): string {
  if (!isValidISODate(task.date) || task.date === todayISO(now)) return formatTime12(task.startTime);
  return `${dayLabel(task.date)}, ${formatTime12(task.startTime)}`;
}

/** "at 7:30 PM" (today), "tomorrow at 7:30 PM" or "on Tue, Oct 6 at 7:30 PM". */
function whenLabel(task: Pick<Task, 'date' | 'startTime'>, now: Date): string {
  const today = todayISO(now);
  const time = formatTime12(task.startTime);
  if (task.date === today) return `at ${time}`;
  if (task.date === addDays(today, 1)) return `tomorrow at ${time}`;
  return `on ${dayLabel(task.date)} at ${time}`;
}

/**
 * The alert shown when someone tries to tick a task too early, e.g.
 * "Not yet — Java starts at 7:30 PM" / "You can tick it once it starts (in 2 h 5 min).".
 */
export function gateMessage(task: Pick<Task, 'title' | 'date' | 'startTime'>, now: Date): { title: string; body: string } {
  const when = whenLabel(task, now);
  return {
    title: `Not yet — ${task.title} ${task.date === todayISO(now) ? 'starts' : 'is'} ${when}`,
    body: `You can tick it once it starts (in ${formatWait(timeUntilStart(task, now))}).`,
  };
}

/** The note shown when moving / editing a ticked task took its tick away (see dropEarlyTick). */
export function tickRemovedMessage(task: Pick<Task, 'title' | 'date' | 'startTime'>, now: Date): { title: string; body: string } {
  return {
    title: `Tick removed — ${task.title} now starts ${whenLabel(task, now).replace(/^on /, '')}`,
    body: 'A task can only be ticked once it starts. Tick it again then.',
  };
}
