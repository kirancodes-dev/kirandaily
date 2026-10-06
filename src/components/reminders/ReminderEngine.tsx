import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppData } from '../../hooks/useAppData';
import { useSync } from '../../hooks/useSync';
import { useToast } from '../../hooks/useToast';
import { useTaskToggle } from '../tasks/TaskDialogs';
import { START_TIMER_STATE } from '../timer/StudyTimer';
import { getDayTasks, type StatsContext } from '../../utils/calculations';
import { addDays, todayISO } from '../../utils/date';
import {
  loadAlerted,
  noticeTasks,
  noticeText,
  overdueTasks,
  planReminders,
  pruneAlerted,
  refreshDue,
  saveAlerted,
  supersededAlerts,
  toNotices,
  waitForSync,
  withOvernight,
  type DueReminder,
  type ReminderNotice,
  type SyncView,
  type TaskRef,
} from '../../utils/reminders';
import {
  closeSystemNotification,
  notificationPermission,
  pageInBackground,
  playBeep,
  setAppBadge,
  showSystemNotification,
  unlockAudio,
} from './alerts';

const CHECK_MS = 20_000;
/** Give data (and cloud sync) a moment to load before the first check. */
const FIRST_CHECK_MS = 2_000;
/** Back in front with cloud sync on: let changes made on the other device arrive first. */
const RESUME_SETTLE_MS = 5_000;
/** Never hold reminders back for sync longer than this (slow network, offline…). */
const MAX_SYNC_WAIT_MS = 60_000;
const TOAST_MS = 12_000;

/** Sets the app-icon badge when the count changed. */
function syncBadge(last: { current: number }, count: number) {
  if (count === last.current) return;
  setAppBadge(count);
  last.current = count;
}

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function pageHidden(): boolean {
  try {
    return document.visibilityState === 'hidden';
  } catch {
    return false;
  }
}

/** A sheet or dialog is open: the page behind it (toasts too) can't be seen properly or tapped. */
function dialogOpen(): boolean {
  try {
    return document.querySelector('dialog[open]') !== null;
  } catch {
    return false;
  }
}

/**
 * "Show list" on Today: brings Needs attention (else Happening now) into view and moves focus
 * there. Returns false when neither is on the page (another day is shown).
 */
function showAttention(): boolean {
  const heading = document.getElementById('attention-heading') ?? document.getElementById('now-heading');
  if (!heading) return false;
  heading.focus();
  return true;
}

/** Today's tasks plus last night's that are still running or just ended (sleep). */
function todaysTasks(stats: StatsContext, today: string): ReturnType<typeof getDayTasks> {
  return withOvernight(getDayTasks(stats, addDays(today, -1)), getDayTasks(stats, today), today);
}

const remindersOf = (n: ReminderNotice): DueReminder[] => (n.type === 'single' ? [n.reminder] : n.reminders);

/**
 * Background reminders, mounted once in AppLayout (renders nothing).
 * Every 20 s — and when the app comes back to the front — it alerts tasks that
 * are starting and tasks that ended without a tick: a toast in the app, a beep,
 * a system notification while the app is in the background (if allowed) and
 * the number of overdue tasks on the app icon.
 *
 * Nothing gets lost in the background: while the page is hidden a reminder is
 * only "used up" when a system notification delivered it; otherwise it beeps
 * (once) and waits, and shows as a toast when you come back. With cloud sync,
 * checks wait for the other device's changes, and an alert closes itself when
 * its task gets ticked or skipped (here or on another device).
 */
export function ReminderEngine() {
  const { stats, data } = useAppData();
  const { toast, dismiss, linger } = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const toggle = useTaskToggle();
  const { configured, ready, user, status } = useSync();
  const sync: SyncView = { configured, ready, signedIn: !!user, state: status.state };

  // The interval below reads the latest values through this ref.
  const latest = useRef({ stats, prefs: data.prefs, categories: data.categories, toast, dismiss, linger, navigate, pathname, toggle, sync });
  useEffect(() => {
    latest.current = { stats, prefs: data.prefs, categories: data.categories, toast, dismiss, linger, navigate, pathname, toggle, sync };
  });

  /** The last check made while the app was in front. */
  const lastCheck = useRef<Date | null>(null);
  const lastBadge = useRef(-1);
  /** Reminders delivered by a system notification while hidden; shown in the app on return. */
  const backlog = useRef<DueReminder[]>([]);
  /** Keys already announced by a beep or a system notification (not repeated). */
  const announced = useRef(new Set<string>());
  /**
   * Reminder toasts on screen → their tasks, so a toast closes once its tasks are ticked or skipped
   * (or a newer alert about them shows). `sticky`: shown while another window was in front.
   */
  const shown = useRef(new Map<string, { tag: string; at: number; tasks: TaskRef[]; sticky: boolean }>());
  const holdUntil = useRef(0);
  const waitingSince = useRef<number | null>(null);
  const runCheck = useRef<() => void>(() => undefined);

  // The badge follows every change right away (ticking, skipping…), not only the timed checks,
  // and alerts about tasks that are now ticked or skipped (e.g. synced from the Mac) close.
  const remindersOn = data.prefs.reminders;
  useEffect(() => {
    const now = new Date();
    syncBadge(lastBadge, remindersOn ? overdueTasks(todaysTasks(stats, todayISO(now)), now).length : 0);
    for (const [id, entry] of shown.current) {
      const settled = entry.tasks.every(({ id: taskId, date }) => {
        const t = getDayTasks(stats, date).find((x) => x.id === taskId);
        return !t || t.completed || t.skipped;
      });
      if (settled) {
        latest.current.dismiss(id);
        closeSystemNotification(entry.tag);
        shown.current.delete(id);
      }
    }
  }, [stats, remindersOn]);

  // Cloud data arrived (or sync turned out to be off): check right away instead of at the next tick.
  const waiting = waitForSync(sync);
  useEffect(() => {
    if (!waiting) runCheck.current();
  }, [waiting]);

  useEffect(() => {
    const show = (notice: ReminderNotice, now: Date) => {
      const { toast, navigate, prefs, categories } = latest.current;
      const { title, body } = noticeText(notice, now);
      const reminders = remindersOf(notice);
      const tag = notice.type === 'single' ? notice.reminder.key : `summary-${now.getTime()}`;
      let action: { label: string; onClick: () => void };
      let tone: 'info' | 'warning' = 'warning';
      if (notice.type === 'summary') {
        // Already on Today: the list is right there (Needs attention), so point to it.
        const toList = () => (latest.current.pathname === '/' && showAttention()) || navigate('/');
        action = { label: latest.current.pathname === '/' ? 'Show list' : 'Open Today', onClick: toList };
      } else if (notice.reminder.kind === 'starting') {
        tone = 'info';
        const isStudy = categories.find((c) => c.id === notice.reminder.task.category)?.isStudy ?? false;
        action = isStudy
          ? { label: 'Start timer', onClick: () => navigate('/study', { state: START_TIMER_STATE }) }
          : { label: 'Open', onClick: () => navigate('/') };
      } else {
        const { id, date } = notice.reminder.task;
        action = {
          label: 'Mark done',
          onClick: () => {
            // Use the task as it is now (it may have been edited since the alert).
            const fresh = getDayTasks(latest.current.stats, date).find((t) => t.id === id);
            if (fresh && !fresh.completed) latest.current.toggle(fresh);
          },
        };
      }
      // Visible but another window in front (Mac): keep it until you're back.
      const away = pageInBackground();
      const toastId = `reminder-${tag}`;
      const tasks = noticeTasks(notice);
      // One alert per task: an older one about the same task is out of date ("starts now" → "ended").
      for (const id of supersededAlerts(shown.current, tasks, toastId)) {
        latest.current.dismiss(id);
        shown.current.delete(id);
      }
      toast({ id: toastId, title, body, tone, action, duration: away ? 0 : TOAST_MS });
      shown.current.set(toastId, { tag, at: now.getTime(), tasks, sticky: away });

      // Announce each reminder once: a system notification (with its own sound) while away, else a beep.
      if (reminders.every((r) => announced.current.has(r.key))) return;
      reminders.forEach((r) => announced.current.add(r.key));
      const notify = away && notificationPermission() === 'granted';
      if (notify) void showSystemNotification(title, body, tag);
      if (prefs.reminderSound && !notify) playBeep(tone);
    };

    /** Hidden page: deliver by system notification if allowed, otherwise beep once and keep it due. */
    const announceHidden = (due: DueReminder[], now: Date, today: string) => {
      const fresh = due.filter((d) => !announced.current.has(d.key));
      if (fresh.length === 0) return;
      if (notificationPermission() === 'granted') {
        // Delivered: remember it (other tabs won't repeat it) and show it in the app on return.
        saveAlerted(storage(), today, fresh.map((d) => d.key));
        backlog.current.push(...fresh);
        toNotices(fresh).forEach((n) => {
          const { title, body } = noticeText(n, now);
          void showSystemNotification(title, body, n.type === 'single' ? n.reminder.key : `summary-${now.getTime()}`);
        });
      } else if (latest.current.prefs.reminderSound) {
        playBeep(fresh.some((d) => d.kind === 'overdue') ? 'warning' : 'info');
      }
      fresh.forEach((d) => announced.current.add(d.key));
    };

    const check = () => {
      const { stats, prefs, sync } = latest.current;
      const now = new Date();
      const today = todayISO(now);
      const yesterday = addDays(today, -1);

      syncBadge(lastBadge, prefs.reminders ? overdueTasks(todaysTasks(stats, today), now).length : 0);

      if (!prefs.reminders) {
        lastCheck.current = now;
        backlog.current = [];
        return;
      }
      // Just back in front: give cloud sync a moment.
      if (now.getTime() < holdUntil.current) return;
      if (waitForSync(sync)) {
        waitingSince.current ??= now.getTime();
        if (now.getTime() - waitingSince.current < MAX_SYNC_WAIT_MS) return;
      } else {
        waitingSince.current = null;
      }

      // Yesterday's and tomorrow's tasks too: late tasks end after midnight, early ones are reminded before it.
      const tasks = [...getDayTasks(stats, yesterday), ...getDayTasks(stats, today), ...getDayTasks(stats, addDays(today, 1))];
      const store = storage();
      const plan = planReminders({
        tasks,
        now,
        lastCheck: lastCheck.current,
        alerted: new Set([...loadAlerted(store, yesterday), ...loadAlerted(store, today)]),
        remindBeforeMinutes: prefs.remindBeforeMinutes,
      });

      if (pageHidden()) {
        // The last check "in front" stays put, so what wasn't delivered is still due on return.
        announceHidden(plan.due, now, today);
        return;
      }
      if (dialogOpen()) {
        // A toast would sit behind the sheet, where it can't be tapped. Beep once now; the
        // reminders stay due (not saved as alerted) and show as soon as the sheet closes.
        const fresh = plan.due.filter((d) => !announced.current.has(d.key));
        if (fresh.length && prefs.reminderSound) playBeep(fresh.some((d) => d.kind === 'overdue') ? 'warning' : 'info');
        fresh.forEach((d) => announced.current.add(d.key));
        if (plan.due.length || backlog.current.length) afterDialog();
        return;
      }

      // In front: what is due now plus what was notified while away, re-checked against the latest data.
      const due = refreshDue([...backlog.current, ...plan.due], tasks, now);
      backlog.current = [];
      lastCheck.current = now;
      for (const [id, entry] of shown.current) if (now.getTime() - entry.at > 2 * 3_600_000) shown.current.delete(id);
      if (due.length === 0) return;
      // Remember first, so another open tab doesn't repeat them.
      saveAlerted(store, today, due.map((d) => d.key));
      toNotices(due).forEach((n) => show(n, now));
    };
    runCheck.current = check;

    let dialogPoll: number | undefined;
    const afterDialog = () => {
      window.clearTimeout(dialogPoll);
      dialogPoll = window.setTimeout(() => (dialogOpen() ? afterDialog() : check()), 1_000);
    };

    // Back from another window (Mac): alerts kept on screen meanwhile now fade like any other.
    const onFocus = () => {
      for (const [id, entry] of shown.current) {
        if (!entry.sticky) continue;
        latest.current.linger(id, TOAST_MS);
        entry.sticky = false;
      }
    };

    let settle: number | undefined;
    const wake = () => {
      if (pageHidden()) return;
      const { sync } = latest.current;
      if (sync.configured && sync.signedIn) {
        // Phones pause web apps: changes from the other device arrive a moment after resuming.
        holdUntil.current = Date.now() + RESUME_SETTLE_MS;
        window.clearTimeout(settle);
        settle = window.setTimeout(check, RESUME_SETTLE_MS + 100);
      } else {
        check();
      }
    };

    pruneAlerted(storage(), [todayISO(), addDays(todayISO(), -1)]);
    const first = window.setTimeout(check, FIRST_CHECK_MS);
    const interval = window.setInterval(check, CHECK_MS);
    // Sound needs one tap on iPhone before it may play.
    const onFirstTouch = () => unlockAudio();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pointerdown', onFirstTouch, { once: true });
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(settle);
      window.clearTimeout(dialogPoll);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pointerdown', onFirstTouch);
      runCheck.current = () => undefined;
    };
  }, []);

  return null;
}
