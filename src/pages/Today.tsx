import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart3, CalendarHeart, ClipboardCheck, Plus } from 'lucide-react';
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
import { addDays, dayOfWeek, durationMinutes, formatLongDate, greeting, isValidISODate } from '../utils/date';
import { activeTemplateByKey } from '../utils/schedule';
import { TodayAttention } from '../components/reminders/TodayAttention';
import { TodayUpcoming } from '../components/calendar/TodayUpcoming';
import { TodayMotivation } from '../components/profile/TodayMotivation';

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
  const [dialog, setDialog] = useState<'none' | 'sleep' | 'special'>('none');

  const sleepTarget = useMemo(() => {
    const tpl = activeTemplateByKey(data.templates, 'sleep', date);
    return tpl ? durationMinutes(tpl.startTime, tpl.endTime) : 420;
  }, [data.templates, date]);

  const setDate = (d: string) => setParams(d === today ? {} : { date: d }, { replace: true });
  const isSunday = dayOfWeek(date) === 0;
  const isMonthEnd = addDays(date, 1).slice(8) === '01';

  return (
    <div className="space-y-4">
      <header>
        {date !== today && <p className="text-sm font-medium text-brand-700 dark:text-brand-300">{date < today ? 'Looking back' : 'Planning ahead'}</p>}
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

      <section aria-labelledby="schedule-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="schedule-heading" className="text-xl font-semibold">
            Schedule
          </h2>
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
          <EmptyState title="Nothing planned for this day">
            {date < data.settings.planStartDate
              ? `Your plan starts on ${formatLongDate(data.settings.planStartDate)}.`
              : 'Add a task to get started.'}
          </EmptyState>
        ) : (
          <ol className="space-y-2">
            {tasks.map((t) => (
              <li key={t.id}>
                <TaskCard task={t} onToggle={dialogs.toggle} onOpenActions={dialogs.openActions} />
              </li>
            ))}
          </ol>
        )}
      </section>

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
    </div>
  );
}
