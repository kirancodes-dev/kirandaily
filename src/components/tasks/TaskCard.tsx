import { Check, MoreVertical, Flag, SkipForward, Repeat } from 'lucide-react';
import type { Task } from '../../types/task';
import { formatMinutes, formatTime12 } from '../../utils/date';
import { BORDER_CLASSES } from '../../utils/categoryStyles';
import { useCategories, useSubjectName } from '../../hooks/useCategories';
import { CategoryChip } from '../common/Chips';

interface TaskCardProps {
  task: Task;
  onToggle: (task: Task) => void;
  onOpenActions: (task: Task) => void;
}

/** Timeline card: checkbox, title, category, time range, duration and state. */
export function TaskCard({ task, onToggle, onOpenActions }: TaskCardProps) {
  const { get } = useCategories();
  const subjectName = useSubjectName();
  const cat = get(task.category);
  const subject = subjectName(task.subjectId);
  const done = task.completed && !task.skipped;
  const state = task.skipped ? 'Skipped' : done ? 'Completed' : 'Not done yet';

  return (
    <article
      className={`flex items-stretch gap-1 rounded-2xl border border-l-4 bg-white shadow-sm dark:bg-slate-900 ${BORDER_CLASSES[cat.color]} ${
        done || task.skipped ? 'border-slate-200 opacity-70 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800'
      }`}
      aria-label={`${task.title}, ${formatTime12(task.startTime)} to ${formatTime12(task.endTime)}, ${state}`}
    >
      <label className="relative flex min-w-[52px] cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          className="h-7 w-7 cursor-pointer appearance-none rounded-lg border-2 border-slate-400 bg-white checked:border-emerald-600 checked:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-500 dark:bg-slate-900 dark:checked:bg-emerald-600"
          checked={done}
          disabled={task.skipped}
          onChange={() => onToggle(task)}
          aria-label={`Mark ${task.title} ${done ? 'not done' : 'done'}`}
        />
        {done && <Check size={18} strokeWidth={3} aria-hidden className="pointer-events-none absolute text-white" />}
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
          {done && <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Done</span>}
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
