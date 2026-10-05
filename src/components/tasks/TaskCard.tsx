import { Check, Clock, MoreVertical, Flag, SkipForward, Repeat } from 'lucide-react';
import type { Task } from '../../types/task';
import { formatMinutes, formatTime12, todayISO } from '../../utils/date';
import { BORDER_CLASSES } from '../../utils/categoryStyles';
import { availableFrom, canMarkDone, isHappening, isLate, LATE_GRACE_MINUTES, minutesLeft, timeUntilStart } from '../../utils/timeGate';
import { useCategories, useSubjectName } from '../../hooks/useCategories';
import { useExtras } from '../../hooks/useExtras';
import { useNow } from '../../hooks/useNow';
import { CategoryChip } from '../common/Chips';

interface TaskCardProps {
  task: Task;
  onToggle: (task: Task) => void;
  onOpenActions: (task: Task) => void;
}

/** "Starts in 2h 5m" when it is close, otherwise "Starts at 7:30 PM". */
function startsLabel(task: Task, now: Date): string {
  const wait = timeUntilStart(task, now);
  return wait <= 180 ? `Starts in ${formatMinutes(wait)}` : `Starts at ${formatTime12(task.startTime)}`;
}

/**
 * Timeline card: checkbox, title, category, time range, duration and state.
 * Before a task starts (time-lock on) its checkbox looks locked but still
 * explains itself when tapped (the toggle shows a "Not yet" alert).
 */
export function TaskCard({ task, onToggle, onOpenActions }: TaskCardProps) {
  const { get } = useCategories();
  const subjectName = useSubjectName();
  const { prefs } = useExtras();
  const now = useNow();
  const cat = get(task.category);
  const subject = subjectName(task.subjectId);
  const done = task.completed && !task.skipped;
  const locked = !task.completed && !task.skipped && !canMarkDone(task, now, prefs.timeGate);
  const late = done && isLate(task, LATE_GRACE_MINUTES);
  const live = !task.completed && !task.skipped && isHappening(task, now);
  const from = locked ? availableFrom(task, now) : '';
  const state = task.skipped
    ? 'Skipped'
    : done
      ? late
        ? 'Completed late'
        : 'Completed'
      : live
        ? 'Happening now, not done yet'
        : locked
          ? `Not done yet, can be ticked from ${from}`
          : 'Not done yet';

  return (
    <article
      className={`flex items-stretch gap-1 rounded-2xl border border-l-4 bg-white shadow-sm dark:bg-slate-900 ${BORDER_CLASSES[cat.color]} ${
        done || task.skipped
          ? 'border-slate-200 opacity-70 dark:border-slate-800'
          : live
            ? 'border-slate-200 ring-2 ring-brand-500/40 dark:border-slate-800 dark:ring-brand-400/40'
            : 'border-slate-200 dark:border-slate-800'
      }`}
      aria-label={`${task.title}, ${formatTime12(task.startTime)} to ${formatTime12(task.endTime)}, ${state}`}
    >
      <label className="relative flex min-w-[52px] cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          className={`h-7 w-7 cursor-pointer appearance-none rounded-lg border-2 checked:border-emerald-600 checked:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 dark:checked:bg-emerald-600 ${
            // Slate-500 outlines keep ≥ 3:1 contrast (WCAG 1.4.11); locked = dashed, grey and a clock.
            locked
              ? 'border-dashed border-slate-500 bg-slate-100 dark:border-slate-500 dark:bg-slate-800'
              : 'border-slate-500 bg-white dark:border-slate-500 dark:bg-slate-900'
          }`}
          checked={done}
          disabled={task.skipped}
          onChange={() => onToggle(task)}
          aria-label={`Mark ${task.title} ${done ? 'not done' : 'done'}${locked ? ` (available from ${from})` : ''}`}
        />
        {done && <Check size={18} strokeWidth={3} aria-hidden className="pointer-events-none absolute text-white" />}
        {locked && <Clock size={14} strokeWidth={2.5} aria-hidden className="pointer-events-none absolute text-slate-500 dark:text-slate-400" />}
      </label>

      <div className="min-w-0 flex-1 py-3">
        <div className="flex items-center gap-2 text-sm tabular-nums text-slate-600 dark:text-slate-400">
          <span>
            {formatTime12(task.startTime)} – {formatTime12(task.endTime)}
          </span>
          <span aria-hidden>·</span>
          <span>{formatMinutes(task.duration)}</span>
        </div>
        <h3 className={`mt-0.5 text-base font-semibold leading-snug ${done ? 'line-through decoration-2' : ''}`}>{task.title}</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <CategoryChip id={task.category} />
          {subject && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {subject}
            </span>
          )}
          {task.priority === 'high' && (
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-rose-700 dark:text-rose-300">
              <Flag size={12} aria-hidden /> High
            </span>
          )}
          {task.recurring && <Repeat size={13} className="text-slate-400" aria-label="Repeating" />}
          {live && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600 motion-safe:animate-pulse dark:bg-brand-300" aria-hidden />
              Now · {formatMinutes(minutesLeft(task, now))} left
            </span>
          )}
          {locked && task.date === todayISO(now) && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Clock size={12} aria-hidden /> {startsLabel(task, now)}
            </span>
          )}
          {done && <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Done</span>}
          {late && (
            <span
              className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
              title={task.completedAt ? `Ticked at ${new Date(task.completedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}, after it ended at ${formatTime12(task.endTime)}` : undefined}
            >
              <Clock size={12} aria-hidden /> late
            </span>
          )}
          {task.skipped && (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <SkipForward size={12} aria-hidden /> Skipped
            </span>
          )}
        </div>
        {task.notes && <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{task.notes}</p>}
      </div>

      <button
        type="button"
        onClick={() => onOpenActions(task)}
        aria-label={`Options for ${task.title}`}
        className="flex min-w-touch items-center justify-center rounded-r-2xl text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        <MoreVertical size={20} aria-hidden />
      </button>
    </article>
  );
}
