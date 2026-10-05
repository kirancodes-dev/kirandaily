import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../../hooks/useAppData';
import { useToast } from '../../hooks/useToast';
import { useTaskToggle } from '../tasks/TaskDialogs';
import { getDayTasks } from '../../utils/calculations';
import { addDays, todayISO } from '../../utils/date';
import {
  loadAlerted,
  noticeText,
  overdueTasks,
  planReminders,
  pruneAlerted,
  saveAlerted,
  type ReminderNotice,
} from '../../utils/reminders';
import { notificationPermission, pageInBackground, playBeep, setAppBadge, showSystemNotification, unlockAudio } from './alerts';

const CHECK_MS = 20_000;
/** Give data (and cloud sync) a moment to load before the first check. */
const FIRST_CHECK_MS = 2_000;
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

/**
 * Background reminders, mounted once in AppLayout (renders nothing).
 * Every 20 s — and when the app comes back to the front — it alerts tasks that
 * are starting and tasks that ended without a tick: a toast in the app, a beep,
 * a system notification while the app is in the background (if allowed) and
 * the number of overdue tasks on the app icon.
 */
export function ReminderEngine() {
  const { stats, data } = useAppData();
  const { toast } = useToast();
  const navigate = useNavigate();
  const toggle = useTaskToggle();

  // The interval below reads the latest values through this ref.
  const latest = useRef({ stats, prefs: data.prefs, categories: data.categories, toast, navigate, toggle });
  useEffect(() => {
    latest.current = { stats, prefs: data.prefs, categories: data.categories, toast, navigate, toggle };
  });

  const lastCheck = useRef<Date | null>(null);
  const lastBadge = useRef(-1);

  // The badge follows every change right away (ticking, skipping…), not only the timed checks.
  const remindersOn = data.prefs.reminders;
  useEffect(() => {
    const now = new Date();
    syncBadge(lastBadge, remindersOn ? overdueTasks(getDayTasks(stats, todayISO(now)), now).length : 0);
  }, [stats, remindersOn]);

  useEffect(() => {
    const show = (notice: ReminderNotice, now: Date) => {
      const { toast, navigate, prefs, categories } = latest.current;
      const { title, body } = noticeText(notice, now);
      const tag = notice.type === 'single' ? notice.reminder.key : `summary-${now.getTime()}`;
      let action: { label: string; onClick: () => void };
      let tone: 'info' | 'warning' = 'warning';
      if (notice.type === 'summary') {
        action = { label: 'Open Today', onClick: () => navigate('/') };
      } else if (notice.reminder.kind === 'starting') {
        tone = 'info';
        const isStudy = categories.find((c) => c.id === notice.reminder.task.category)?.isStudy ?? false;
        action = isStudy ? { label: 'Start timer', onClick: () => navigate('/study') } : { label: 'Open', onClick: () => navigate('/') };
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
      toast({ id: `reminder-${tag}`, title, body, tone, action, duration: TOAST_MS });

      // In the background a system notification (with its own sound) reaches you; in front, a beep.
      const notify = pageInBackground() && notificationPermission() === 'granted';
      if (notify) void showSystemNotification(title, body, tag);
      if (prefs.reminderSound && !notify) playBeep(tone);
    };

    const check = () => {
      const { stats, prefs } = latest.current;
      const now = new Date();
      const today = todayISO(now);
      const tasks = getDayTasks(stats, today);

      syncBadge(lastBadge, prefs.reminders ? overdueTasks(tasks, now).length : 0);

      const previous = lastCheck.current;
      lastCheck.current = now;
      if (!prefs.reminders) return;

      const store = storage();
      const plan = planReminders({
        tasks,
        now,
        lastCheck: previous,
        alerted: loadAlerted(store, today),
        remindBeforeMinutes: prefs.remindBeforeMinutes,
      });
      if (plan.due.length === 0) return;
      // Remember first, so another open tab doesn't repeat them.
      saveAlerted(store, today, plan.due.map((d) => d.key));
      plan.notices.forEach((n) => show(n, now));
    };

    pruneAlerted(storage(), [todayISO(), addDays(todayISO(), -1)]);
    const first = window.setTimeout(check, FIRST_CHECK_MS);
    const interval = window.setInterval(check, CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    // Sound needs one tap on iPhone before it may play.
    const onFirstTouch = () => unlockAudio();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    window.addEventListener('pointerdown', onFirstTouch, { once: true });
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
      window.removeEventListener('pointerdown', onFirstTouch);
    };
  }, []);

  return null;
}
