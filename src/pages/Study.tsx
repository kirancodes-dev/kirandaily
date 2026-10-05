import { useMemo, useState } from 'react';
import { PencilLine, Trash2 } from 'lucide-react';
import { useAppData } from '../hooks/useAppData';
import { useToday } from '../hooks/useToday';
import { useStudySessions } from '../hooks/useStudySessions';
import { useCategories } from '../hooks/useCategories';
import { StudyTimer } from '../components/timer/StudyTimer';
import { SessionDialog } from '../components/study/SessionDialog';
import { CategoryBreakdown } from '../components/study/CategoryBreakdown';
import { Card } from '../components/common/Card';
import { Button, IconButton } from '../components/common/Button';
import { PageHeader, EmptyState } from '../components/common/Feedback';
import { ProgressBar } from '../components/common/Progress';
import { Tabs } from '../components/common/Tabs';
import { ConfirmDialog } from '../components/common/Modal';
import { studyByCategory, studyMinutesInRange, studyTargetInRange } from '../utils/calculations';
import { formatMinutes, formatShortDate, monthDates, weekDates } from '../utils/date';

type Period = 'today' | 'week' | 'month';

interface Pending {
  minutes: number;
  source: 'timer' | 'pomodoro' | 'manual';
  startedAt?: string;
}

export default function Study() {
  const today = useToday();
  const { data, stats } = useAppData();
  const { sessions, addSession, removeSession } = useStudySessions();
  const { get } = useCategories();
  const [pending, setPending] = useState<Pending | null>(null);
  const [period, setPeriod] = useState<Period>('week');
  const [deleting, setDeleting] = useState<string | null>(null);

  // Full periods (for targets) and the part up to today (for time studied).
  const periods = useMemo(() => {
    const [y, m] = today.split('-').map(Number);
    return { today: [today], week: weekDates(today), month: monthDates(y, m) };
  }, [today]);
  const ranges = useMemo(
    () => ({
      today: periods.today,
      week: periods.week.filter((d) => d <= today),
      month: periods.month.filter((d) => d <= today),
    }),
    [periods, today],
  );

  const totals = useMemo(
    () =>
      (['today', 'week', 'month'] as Period[]).map((p) => ({
        id: p,
        label: p === 'today' ? 'Today' : p === 'week' ? 'This week' : 'This month',
        done: studyMinutesInRange(stats, ranges[p]),
        target: studyTargetInRange(data.settings, periods[p].filter((d) => d >= data.settings.planStartDate), stats.index.dayAs),
      })),
    [stats, ranges, periods, data.settings],
  );
  const breakdown = useMemo(() => studyByCategory(stats, ranges[period]), [stats, ranges, period]);
  const recent = useMemo(() => [...sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 15), [sessions]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Study"
        subtitle="Time from finished study tasks and timer sessions."
        actions={
          <Button icon={<PencilLine size={18} aria-hidden />} onClick={() => setPending({ minutes: 30, source: 'manual' })}>
            Log time
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <StudyTimer
          onFinish={(minutes, source, startedAt) =>
            setPending({ minutes, source, startedAt: startedAt ? new Date(startedAt).toISOString() : undefined })
          }
        />
        <Card title="Target vs completed">
          <ul className="space-y-4">
            {totals.map((t) => (
              <li key={t.id}>
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{t.label}</span>
                  <span className="tabular-nums">
                    <span className="text-lg font-semibold">{formatMinutes(t.done)}</span>
                    <span className="text-slate-600 dark:text-slate-400"> / {formatMinutes(t.target)}</span>
                  </span>
                </div>
                <div className="mt-1">
                  <ProgressBar value={t.target ? (t.done / t.target) * 100 : 0} label={`${t.label} study progress`} showValue={false} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Category breakdown">
        <div className="mb-3">
          <Tabs
            label="Breakdown period"
            value={period}
            onChange={setPeriod}
            tabs={[
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'Week' },
              { id: 'month', label: 'Month' },
            ]}
          />
        </div>
        <CategoryBreakdown minutesByCategory={breakdown} />
      </Card>

      <Card title="Recent sessions">
        {recent.length === 0 ? (
          <EmptyState title="No sessions yet">Start a study session or log time manually.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {recent.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {get(s.category).label}
                    {s.topic && <span className="font-normal text-slate-600 dark:text-slate-400"> · {s.topic}</span>}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {formatShortDate(s.date)} · {s.source === 'manual' ? 'Logged' : s.source === 'pomodoro' ? 'Pomodoro' : 'Timer'}
                    {s.subjectId && ` · ${data.subjects.find((x) => x.id === s.subjectId)?.name ?? ''}`}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{formatMinutes(s.minutes)}</span>
                <IconButton label={`Delete session ${get(s.category).label} ${s.topic}`} onClick={() => setDeleting(s.id)}>
                  <Trash2 size={18} aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {pending && (
        <SessionDialog
          title={pending.source === 'manual' ? 'Log study time' : 'Save study session'}
          initialMinutes={pending.minutes}
          date={today}
          manual={pending.source === 'manual'}
          startedAt={pending.startedAt}
          source={pending.source}
          onClose={() => setPending(null)}
          onSave={(s, taskId) => {
            addSession(s, taskId);
            setPending(null);
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        danger
        title="Delete session?"
        message="Its time will be removed from your statistics."
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) removeSession(deleting);
          setDeleting(null);
        }}
      />
    </div>
  );
}
