import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarClock, Check, ChevronDown, ChevronUp, SkipForward, Timer } from 'lucide-react';
import type { Task } from '../../types/task';
import { useAppData } from '../../hooks/useAppData';
import { useTasks } from '../../hooks/useTasks';
import { useNow } from '../../hooks/useNow';
import { useCategories } from '../../hooks/useCategories';
import { useStudyTimer } from '../../hooks/useStudyTimer';
import { useToast } from '../../hooks/useToast';
import { useTaskDialogs } from '../tasks/TaskDialogs';
import { Button } from '../common/Button';
import { ProgressBar } from '../common/Progress';
import { getDayTasks } from '../../utils/calculations';
import { addDays, formatMinutes, formatTime12 } from '../../utils/date';
import { currentTasks, overdueTasks, withOvernight } from '../../utils/reminders';
import { minutesLeft, taskEnd, taskStart } from '../../utils/timeGate';

/** Overdue rows shown before "Show all". */
const COLLAPSED = 3;

// The card is a size container: buttons get their text labels when the card (not the window) is wide
// enough, so the narrow overview column of the Mac two-column Today keeps room for the titles.
const small =
  'inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl text-sm font-semibold ring-1 ring-inset transition-colors [@container(min-width:34rem)]:px-3';
const label = 'hidden [@container(min-width:34rem)]:inline';
const plain =
  'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-700';

interface OverdueRowProps {
  task: Task;
  now: Date;
  /** Started yesterday (ran past midnight, e.g. last night's sleep). */
  overnight: boolean;
  onDone: () => void;
  onMove: () => void;
  onSkip: () => void;
}

/** One overdue task. Narrow cards (phones) get compact icon buttons (labelled for screen readers), wider cards text too. */
function OverdueRow({ task, now, overnight, onDone, onMove, onSkip }: OverdueRowProps) {
  const ago = Math.max(1, Math.round((now.getTime() - taskEnd(task).getTime()) / 60_000));
  return (
    <li className="flex items-center gap-2 py-2.5 first:pt-0 last:pb-0 [@container(min-width:34rem)]:gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{task.title}</p>
        <p className={`text-sm text-slate-600 dark:text-slate-400 ${overnight ? '' : 'truncate'}`}>
          {overnight ? 'Last night · ended ' : 'Ended '}
          <span className="hidden [@container(min-width:24rem)]:inline">{formatTime12(task.endTime)} · </span>
          {formatMinutes(ago)} ago
        </p>
      </div>
      <button
        type="button"
        onClick={onDone}
        aria-label={`Mark ${task.title} done`}
        title="Mark done"
        className={`${small} bg-emerald-600 text-white ring-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-500`}
      >
        <Check size={18} strokeWidth={3} aria-hidden />
        <span className={label}>Mark done</span>
      </button>
      <button type="button" onClick={onMove} aria-label={`Move ${task.title}`} title="Move / reschedule" className={`${small} ${plain}`}>
        <CalendarClock size={18} aria-hidden />
        <span className={label}>Move</span>
      </button>
      <button type="button" onClick={onSkip} aria-label={`Skip ${task.title}`} title="Skip today" className={`${small} ${plain}`}>
        <SkipForward size={18} aria-hidden />
        <span className={label}>Skip</span>
      </button>
    </li>
  );
}

/**
 * Today only: tasks that ended without a tick ("Needs attention", with quick
 * Done / Move / Skip) and the task happening right now with its time left.
 * Last night's tasks that ran past midnight (sleep) count too.
 * Renders nothing when there is nothing to show.
 */
export function TodayAttention({ date, today }: { date: string; today: string }) {
  const now = useNow();
  const { stats } = useAppData();
  const { tasks: todays, skip } = useTasks(today);
  const tasks = useMemo(() => withOvernight(getDayTasks(stats, addDays(today, -1)), todays, today), [stats, todays, today]);
  const dialogs = useTaskDialogs();
  const { get } = useCategories();
  const timer = useStudyTimer();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  // Keyboard focus after "Mark done" / "Skip" removed a row: the next row, else the next thing on the card, else the page.
  const listRef = useRef<HTMLUListElement>(null);
  const nowRef = useRef<HTMLDivElement>(null);
  const refocus = useRef<number | null>(null);
  useEffect(() => {
    const index = refocus.current;
    if (index === null) return;
    refocus.current = null;
    const rows = listRef.current?.querySelectorAll('li');
    const target =
      (rows?.length ? rows[Math.min(index, rows.length - 1)].querySelector('button') : null) ??
      nowRef.current?.querySelector('button') ??
      nowRef.current?.querySelector<HTMLElement>('[tabindex="-1"]') ??
      document.getElementById('main');
    target?.focus();
  });

  if (date !== today) return dialogs.element;

  // Most recently ended first: those are the ones you can still remember.
  const overdue = overdueTasks(tasks, now).reverse();
  const current = currentTasks(tasks, now)[0];
  if (overdue.length === 0 && !current) return dialogs.element;

  const shown = expanded ? overdue : overdue.slice(0, COLLAPSED);
  const timerBusy = timer.state.status !== 'idle';

  const onDone = (task: Task, index: number) => {
    refocus.current = index;
    dialogs.toggle(task);
  };

  const onSkip = (task: Task, index: number) => {
    refocus.current = index;
    skip(task, true);
    toast({
      id: `skip-${task.id}`,
      tone: 'info',
      title: `Skipped ${task.title}`,
      body: 'It won’t count against today’s completion.',
      action: { label: 'Undo', onClick: () => skip({ ...task, skipped: true }, false) },
    });
  };

  let nowBlock: JSX.Element | null = null;
  if (current) {
    const start = taskStart(current).getTime();
    const end = taskEnd(current).getTime();
    const pct = ((now.getTime() - start) / Math.max(1, end - start)) * 100;
    const left = minutesLeft(current, now);
    const isStudy = get(current.category).isStudy;
    nowBlock = (
      <div ref={nowRef} className="flex flex-wrap items-center gap-3">
        <span className="relative flex h-3 w-3 shrink-0" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-brand-600 dark:bg-brand-400" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="now-heading" tabIndex={-1} className="text-xs font-semibold uppercase tracking-wide text-brand-700 outline-none dark:text-brand-300">
            Happening now
          </h2>
          <p className="truncate text-base font-semibold">{current.title}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {formatMinutes(left)} left · until {formatTime12(current.endTime)}
          </p>
          <div className="mt-2">
            <ProgressBar value={pct} label={`${current.title}: time passed`} showValue={false} size="sm" />
          </div>
        </div>
        {isStudy && (
          <Button
            variant="primary"
            icon={<Timer size={18} aria-hidden />}
            onClick={() => navigate('/study')}
            className="w-full sm:w-auto"
          >
            {timerBusy ? 'Open timer' : 'Start timer'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <section
        aria-labelledby={overdue.length ? 'attention-heading' : 'now-heading'}
        className={`rounded-2xl border bg-white p-4 shadow-sm [container-type:inline-size] dark:bg-slate-900 ${
          overdue.length ? 'border-amber-300 dark:border-amber-700/70' : 'border-brand-200 dark:border-brand-800'
        }`}
      >
        {overdue.length > 0 && (
          <>
            <div className="mb-3 flex items-start gap-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                <AlertTriangle size={18} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="attention-heading" className="flex items-center gap-2 text-lg font-semibold">
                  Needs attention
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm font-semibold tabular-nums text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                    {overdue.length}
                    <span className="sr-only"> {overdue.length === 1 ? 'task' : 'tasks'}</span>
                  </span>
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">Ended without a tick. Did them? Mark them done — if not, move or skip.</p>
              </div>
            </div>
            <ul ref={listRef} aria-label="Tasks that need attention" className="divide-y divide-slate-100 dark:divide-slate-800">
              {shown.map((t, i) => (
                <OverdueRow
                  key={t.id}
                  task={t}
                  now={now}
                  overnight={t.date !== today}
                  onDone={() => onDone(t, i)}
                  onMove={() => dialogs.openMove(t)}
                  onSkip={() => onSkip(t, i)}
                />
              ))}
            </ul>
            {overdue.length > COLLAPSED && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}
                className="mt-2 inline-flex min-h-touch items-center gap-1 rounded-xl px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
              >
                {expanded ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
                {expanded ? 'Show less' : `Show all ${overdue.length}`}
              </button>
            )}
          </>
        )}
        {nowBlock && (
          <div className={overdue.length ? 'mt-3 border-t border-slate-100 pt-3 dark:border-slate-800' : ''}>{nowBlock}</div>
        )}
      </section>
      {dialogs.element}
    </>
  );
}
