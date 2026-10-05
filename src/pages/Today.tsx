import { useEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart3, CalendarHeart, CalendarPlus, ClipboardCheck, Plus } from 'lucide-react';
import { useAppData } from '../hooks/useAppData';
import { useToday } from '../hooks/useToday';
import { useTasks } from '../hooks/useTasks';
import { useDayStats, useStreaks } from '../hooks/useProgress';
import { useDayLog } from '../hooks/useDayLog';
import { DateNavigator } from '../components/dashboard/DateNavigator';
import { TodayStats } from '../components/dashboard/TodayStats';
import { SleepDialog, SpecialDayDialog } from '../components/dashboard/DayLogDialogs';
import { SPECIAL_LABELS } from '../utils/labels';
import { TaskCard } from '../components/tasks/TaskCard';
import { useTaskDialogs } from '../components/tasks/TaskDialogs';
import { Button } from '../components/common/Button';
import { Banner, EmptyState } from '../components/common/Feedback';
import { addDays, dayOfWeek, durationMinutes, formatLongDate, greeting, isValidISODate, parseISODate } from '../utils/date';
import { activeTemplateByKey } from '../utils/schedule';
import { TodayAttention } from '../components/reminders/TodayAttention';
import { TodayUpcoming } from '../components/calendar/TodayUpcoming';
import { TodayMotivation } from '../components/profile/TodayMotivation';
import { DAY_EVENT, NEW_TASK_EVENT, NEW_TASK_STATE } from '../components/layout/shortcuts';
import { useHeightVar } from '../components/layout/useHeightVar';

/**
 * Mac two-column Today: the "Schedule" header is pinned under the top bar, and browsers only keep
 * keyboard focus clear of the top bar. A task reached with Tab / Shift+Tab that would stop under the
 * header is nudged into view below it. (Clicks are left alone; on phones the header is not pinned.)
 */
function keepFocusBelow(header: HTMLElement | null, e: FocusEvent<HTMLElement>) {
  const target = e.target;
  if (!header || getComputedStyle(header).position !== 'sticky' || !target.matches(':focus-visible')) return;
  const overlap = header.getBoundingClientRect().bottom + 8 - target.getBoundingClientRect().top;
  if (overlap > 0) window.scrollBy({ top: -overlap, behavior: 'auto' });
}

export default function Today() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const requested = params.get('date');
  const date = requested && isValidISODate(requested) ? requested : today;
  const invalidDate = !!requested && !isValidISODate(requested);

  const { data } = useAppData();
  const { tasks } = useTasks(date);
  const stats = useDayStats(date);
  const streaks = useStreaks(today);
  const { log, save } = useDayLog(date);
  const dialogs = useTaskDialogs();
  const overviewRef = useHeightVar<HTMLDivElement>('--kp-side-h');
  const scheduleHeaderRef = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<'none' | 'sleep' | 'special'>('none');

  const sleepTarget = useMemo(() => {
    const tpl = activeTemplateByKey(data.templates, 'sleep', date);
    return tpl ? durationMinutes(tpl.startTime, tpl.endTime) : 420;
  }, [data.templates, date]);

  const setDate = (d: string) => setParams(d === today ? {} : { date: d }, { replace: true });
  const isSunday = dayOfWeek(date) === 0;
  const isMonthEnd = addDays(date, 1).slice(8) === '01';

  // Keyboard shortcuts (see hooks/useKeyboardShortcuts): N = new task, [ / ] = previous / next day.
  // The listeners are added once and call the latest handlers through `keys`. `shown` moves with
  // each key press right away, so fast presses (or a held key) step one day each before re-rendering.
  const shown = useRef(date);
  shown.current = date;
  const handlers = {
    newTask: () => dialogs.openAdd(shown.current),
    shiftDay: (delta: number) => {
      shown.current = addDays(shown.current, delta);
      setDate(shown.current);
    },
  };
  const keys = useRef(handlers);
  keys.current = handlers;
  useEffect(() => {
    const onNewTask = () => keys.current.newTask();
    const onDay = (e: Event) => keys.current.shiftDay(Number((e as CustomEvent<number>).detail) || 0);
    window.addEventListener(NEW_TASK_EVENT, onNewTask);
    window.addEventListener(DAY_EVENT, onDay);
    return () => {
      window.removeEventListener(NEW_TASK_EVENT, onNewTask);
      window.removeEventListener(DAY_EVENT, onDay);
    };
  }, []);

  // "N" pressed on another page navigates here with a request to open Add task.
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (location.state !== NEW_TASK_STATE) return;
    keys.current.newTask();
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
  }, [location.state, location.pathname, location.search, navigate]);

  return (
    <>
      {/* Phones and narrow windows: one column, in this order. Mac-size screens (1280px+): the day
        overview on the left, kept in view while the timeline scrolls (see .kp-today-side in index.css),
        and the schedule timeline on the right with its header, and the day shown, pinned under the top
        bar. (Below 1280 the sidebar leaves too little room for two readable columns.)
        From 1400px the overview gets a little more of the width, so "Needs attention" has room for its
        button labels; at 1280 the schedule keeps enough to fit its header on one line. */}
      <div className="space-y-4 xl:grid xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] min-[1400px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:items-start xl:gap-8 xl:space-y-0">
        <div ref={overviewRef} className="kp-today-side min-w-0 space-y-4" data-testid="today-overview">
          <header>
            {date !== today && (
              <p className="text-sm font-medium text-brand-700 dark:text-brand-300">{date < today ? 'Looking back' : 'Planning ahead'}</p>
            )}
            <h1 className="text-2xl font-bold tracking-tight">
              {date === today ? `${greeting()}, ${data.profile.name}` : `${data.profile.name}’s day`}
            </h1>
            <p className="mt-0.5 text-lg text-slate-700 dark:text-slate-300">{formatLongDate(date)}</p>
            <div className="mt-2">
              <DateNavigator date={date} today={today} onChange={setDate} />
            </div>
          </header>

          {invalidDate && <Banner tone="warning">That date link was not valid, so today is shown instead.</Banner>}

          <TodayMotivation date={date} today={today} />
          <TodayAttention date={date} today={today} />

          {log?.special ? (
            <Banner tone="info">
              <span className="font-semibold">{SPECIAL_LABELS[log.special.kind]}</span>
              {log.special.note && ` — ${log.special.note}`}. Streaks are paused for this day.{' '}
              <button type="button" className="font-semibold underline" onClick={() => setDialog('special')}>
                Edit
              </button>
            </Banner>
          ) : null}

          {isSunday && date <= today && (
            <Link
              to={`/progress?tab=weekly&date=${date}`}
              className="flex min-h-touch items-center gap-3 rounded-2xl bg-brand-600 p-4 font-medium text-white shadow-sm hover:bg-brand-700"
            >
              <ClipboardCheck size={22} aria-hidden />
              It’s Sunday — open your weekly review
            </Link>
          )}

          {isMonthEnd && date <= today && (
            <Link
              to={`/progress?tab=monthly&date=${date}`}
              className="flex min-h-touch items-center gap-3 rounded-2xl border border-brand-300 bg-brand-50 p-4 font-medium text-brand-800 hover:bg-brand-100 dark:border-brand-700 dark:bg-brand-500/15 dark:text-brand-100"
            >
              <BarChart3 size={22} aria-hidden />
              Last day of the month — see your monthly review
            </Link>
          )}

          <TodayStats
            stats={stats}
            sleepTargetMinutes={sleepTarget}
            sleepHours={log?.sleepHours}
            onLogSleep={() => setDialog('sleep')}
            streak={date === today ? streaks.overall : undefined}
            isToday={date === today}
          />

          <TodayUpcoming date={date} today={today} />
        </div>

        <section aria-labelledby="schedule-heading" className="min-w-0 space-y-3 xl:space-y-2" data-testid="today-schedule">
          <div
            ref={scheduleHeaderRef}
            className="flex flex-wrap items-center justify-between gap-2 xl:sticky xl:top-[var(--kp-topbar-h)] xl:z-10 xl:-mx-2 xl:rounded-b-2xl xl:bg-slate-50/95 xl:px-2 xl:py-2 xl:backdrop-blur-xl xl:dark:bg-slate-950/95"
          >
            <div>
              <h2 id="schedule-heading" className="text-xl font-semibold">
                Schedule
              </h2>
              {/* Mac: the day being shown stays in view with the pinned header, also after [ / ]. */}
              <p className="hidden text-sm font-medium text-slate-600 dark:text-slate-400 xl:block" data-testid="schedule-day">
                {parseISODate(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
            </div>
            <div className="flex gap-2">
              {!log?.special && (
                <Button variant="ghost" icon={<CalendarHeart size={18} aria-hidden />} onClick={() => setDialog('special')}>
                  Special day
                </Button>
              )}
              <Button variant="primary" icon={<Plus size={18} aria-hidden />} onClick={() => dialogs.openAdd(date)}>
                Add task
              </Button>
            </div>
          </div>
          {tasks.length === 0 ? (
            <EmptyState icon={<CalendarPlus size={32} aria-hidden />} title="Nothing planned for this day">
              {date < data.settings.planStartDate
                ? `Your plan starts on ${formatLongDate(data.settings.planStartDate)}.`
                : 'Add a task to get started.'}
            </EmptyState>
          ) : (
            // Mac: a task reached with Tab / Shift+Tab stops below the pinned "Schedule" header, not under it
            // (scroll-margin when the browser scrolls to it, keepFocusBelow when it thinks no scroll is needed).
            <ol className="space-y-2 xl:[&_*]:scroll-mt-[4.5rem]" onFocus={(e) => keepFocusBelow(scheduleHeaderRef.current, e)}>
              {tasks.map((t) => (
                <li key={t.id}>
                  <TaskCard task={t} onToggle={dialogs.toggle} onOpenActions={dialogs.openActions} />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {dialogs.element}
      {dialog === 'sleep' && (
        <SleepDialog
          initial={log?.sleepHours}
          onClose={() => setDialog('none')}
          onSave={(h) => {
            save({ sleepHours: h });
            setDialog('none');
          }}
        />
      )}
      {dialog === 'special' && (
        <SpecialDayDialog
          initial={log?.special}
          onClose={() => setDialog('none')}
          onSave={(s) => {
            save({ special: s });
            setDialog('none');
          }}
        />
      )}
    </>
  );
}
