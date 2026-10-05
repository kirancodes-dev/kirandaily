import { useMemo } from 'react';
import { useAppData } from '../../hooks/useAppData';
import { useRoadmapProgress } from '../../hooks/useProgress';
import { completionSeries, monthlyStudySeries, studyByCategory, weeklyStudySeries } from '../../utils/calculations';
import { monthDates } from '../../utils/date';
import { CHART_COLORS } from '../../utils/categoryStyles';
import { ChartCard, DonutChart, SimpleBarChart, SimpleLineChart } from '../charts/Charts';
import { StreaksPanel } from './StreaksPanel';
import { Card } from '../common/Card';
import { ProgressBar } from '../common/Progress';
import { roadmapProgress } from '../../utils/calculations';

export function ProgressOverview({ today }: { today: string }) {
  const { stats, data } = useAppData();
  const progress = useRoadmapProgress();

  const series = useMemo(() => {
    const [y, m] = today.split('-').map(Number);
    const weekly = weeklyStudySeries(stats, today, 8);
    const monthly = monthlyStudySeries(stats, today, 6);
    const completion = completionSeries(stats, today, 14).filter((d) => d.date >= data.settings.planStartDate);
    const cats = studyByCategory(stats, monthDates(y, m).filter((d) => d <= today));
    const distribution = [...cats.entries()]
      .filter(([, mins]) => mins > 0)
      .map(([id, mins]) => {
        const c = data.categories.find((x) => x.id === id);
        return { name: c?.label ?? id, value: Math.round((mins / 60) * 10) / 10, color: CHART_COLORS[c?.color ?? 'slate'] };
      });
    return { weekly, monthly, completion, distribution };
  }, [stats, today, data.categories, data.settings.planStartDate]);

  const roadmapBars = (['java', 'dsa', 'german'] as const).map((id) => ({
    id,
    sections: data.roadmaps[id].sections.map((s) => ({
      name: s.title.split('–')[0].trim(),
      pct: roadmapProgress({ ...data.roadmaps[id], sections: [s] }).pct,
    })),
  }));

  const anyStudy = series.weekly.some((w) => w.hours > 0);
  return (
    <div className="space-y-4">
      <StreaksPanel today={today} />

      <Card title="Overall progress">
        <div className="grid gap-3 sm:grid-cols-2">
          <ProgressBar value={progress.java.pct} label={`Java (${progress.java.completed}/${progress.java.total} topics)`} />
          <ProgressBar value={progress.dsa.pct} label={`DSA (${progress.dsa.completed}/${progress.dsa.total} topics)`} />
          <ProgressBar value={progress.german.pct} label={`German (${progress.german.completed}/${progress.german.total} topics)`} />
          <ProgressBar value={progress.college} label="College subjects" />
          <ProgressBar value={progress.projects ?? 0} label={progress.projects === null ? 'Projects (none yet)' : 'Projects'} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Weekly study hours"
          summary={series.weekly.map((w) => `Week of ${w.label}: ${w.hours} of ${w.target} hours`).join('. ')}
          empty={!anyStudy}
        >
          <SimpleBarChart
            data={series.weekly}
            xKey="label"
            bars={[
              { key: 'hours', name: 'Studied', color: '#4f46e5' },
              { key: 'target', name: 'Target', color: '#cbd5e1' },
            ]}
          />
        </ChartCard>
        <ChartCard
          title="Monthly study hours"
          summary={series.monthly.map((m) => `${m.label}: ${m.hours} hours`).join('. ')}
          empty={!series.monthly.some((m) => m.hours > 0)}
        >
          <SimpleBarChart data={series.monthly} xKey="label" bars={[{ key: 'hours', name: 'Hours', color: '#4f46e5' }]} />
        </ChartCard>
        <ChartCard
          title="Category distribution (this month)"
          summary={series.distribution.map((d) => `${d.name}: ${d.value} hours`).join('. ') || 'No study yet'}
          empty={!series.distribution.length}
          height={260}
        >
          <DonutChart data={series.distribution} />
        </ChartCard>
        <ChartCard
          title="Task completion (last 14 days)"
          summary={series.completion.map((d) => `${d.date}: ${d.pct}%`).join('. ')}
          empty={!series.completion.some((d) => d.pct > 0)}
        >
          <SimpleLineChart data={series.completion} xKey="label" yKey="pct" name="Completed %" color="#059669" />
        </ChartCard>
        <ChartCard
          title="Gym consistency (days per week)"
          summary={series.weekly.map((w) => `Week of ${w.label}: ${w.gymDays} of 7 days`).join('. ')}
          empty={!series.weekly.some((w) => w.gymDays > 0)}
        >
          <SimpleBarChart data={series.weekly} xKey="label" bars={[{ key: 'gymDays', name: 'Gym days', color: '#ef4444' }]} domainMax={7} />
        </ChartCard>
        {roadmapBars.map((r) => (
          <ChartCard
            key={r.id}
            title={`${data.roadmaps[r.id].title} progress by section`}
            summary={r.sections.map((s) => `${s.name}: ${s.pct}%`).join('. ')}
            empty={!r.sections.some((s) => s.pct > 0)}
          >
            <SimpleBarChart
              data={r.sections}
              xKey="name"
              unit="%"
              domainMax={100}
              bars={[{ key: 'pct', name: 'Completed %', color: r.id === 'java' ? '#f97316' : r.id === 'dsa' ? '#10b981' : '#f59e0b' }]}
            />
          </ChartCard>
        ))}
      </div>
    </div>
  );
}
