import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppData } from '../../hooks/useAppData';
import { useMonthSummary, useRoadmapProgress } from '../../hooks/useProgress';
import { formatHours, formatMinutes, formatMonthYear, monthDates } from '../../utils/date';
import { CHART_COLORS } from '../../utils/categoryStyles';
import { Card, StatTile } from '../common/Card';
import { IconButton } from '../common/Button';
import { Banner } from '../common/Feedback';
import { ProgressBar } from '../common/Progress';
import { ChartCard, DonutChart, SimpleBarChart } from '../charts/Charts';

interface Props {
  year: number;
  month: number;
  today: string;
  onChange: (year: number, month: number) => void;
}

export function MonthlyReview({ year, month, today, onChange }: Props) {
  const { data } = useAppData();
  const m = useMonthSummary(year, month, today);
  const progress = useRoadmapProgress();
  const s = m.summary;
  const shift = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    onChange(d.getFullYear(), d.getMonth() + 1);
  };
  const dates = monthDates(year, month);
  const ongoing = today >= dates[0] && today < dates[dates.length - 1];
  const gymPct = s.gymPlannedDays ? Math.round((s.gymDays / s.gymPlannedDays) * 100) : null;
  const distribution = [...m.categories.entries()]
    .filter(([, mins]) => mins > 0)
    .map(([id, mins]) => {
      const c = data.categories.find((x) => x.id === id);
      return { name: c?.label ?? id, value: Math.round((mins / 60) * 10) / 10, color: CHART_COLORS[c?.color ?? 'slate'] };
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        <IconButton label="Previous month" onClick={() => shift(-1)}>
          <ChevronLeft size={22} aria-hidden />
        </IconButton>
        <h2 className="min-w-[10rem] text-center font-semibold" aria-live="polite">
          {formatMonthYear(year, month)}
        </h2>
        <IconButton label="Next month" onClick={() => shift(1)}>
          <ChevronRight size={22} aria-hidden />
        </IconButton>
      </div>
      {ongoing && <Banner tone="info">This month is still running — numbers cover the days so far.</Banner>}
      {s.daysCounted === 0 && <Banner tone="info">No tracked days in this month yet.</Banner>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Total study" value={`${formatHours(s.studyMinutes)} h`} hint={`Target ${formatHours(s.targetMinutes)} h`} />
        <StatTile label="Average daily study" value={formatMinutes(m.averageDailyMinutes)} />
        <StatTile label="Gym consistency" value={gymPct === null ? '—' : `${gymPct}%`} hint={`${s.gymDays} of ${s.gymPlannedDays} days`} />
        <StatTile label="Task completion" value={s.completionPct === null ? '—' : `${s.completionPct}%`} hint={`${s.tasksCompleted} done`} />
      </div>

      <Card title="Progress">
        <div className="grid gap-3 sm:grid-cols-2">
          <ProgressBar value={progress.java.pct} label={`Java · +${m.topicsDone.java} topic(s) this month`} />
          <ProgressBar value={progress.dsa.pct} label={`DSA · +${m.topicsDone.dsa} topic(s) this month`} />
          <ProgressBar value={progress.german.pct} label={`German · +${m.topicsDone.german} topic(s) this month`} />
          <ProgressBar value={progress.college} label="College" />
          <ProgressBar value={progress.projects ?? 0} label={progress.projects === null ? 'Projects (none yet)' : 'Projects'} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Daily study hours"
          summary={m.daily.filter((d) => d.hours > 0).map((d) => `${d.date}: ${d.hours} hours`).join('. ') || 'No study yet'}
          empty={!m.daily.some((d) => d.hours > 0)}
        >
          <SimpleBarChart data={m.daily} xKey="label" bars={[{ key: 'hours', name: 'Hours', color: '#4f46e5' }]} />
        </ChartCard>
        <ChartCard
          title="Study by category"
          summary={distribution.map((d) => `${d.name}: ${d.value} hours`).join('. ') || 'No study yet'}
          empty={!distribution.length}
          height={260}
        >
          <DonutChart data={distribution} />
        </ChartCard>
      </div>
    </div>
  );
}
