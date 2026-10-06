import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { useAppData } from '../../hooks/useAppData';
import { useRoadmapProgress, useWeekSummary } from '../../hooks/useProgress';
import { addDays, formatHours, formatLongDate, formatShortDate, startOfWeek } from '../../utils/date';
import { uid } from '../../utils/id';
import { Card, StatTile } from '../common/Card';
import { Button, IconButton } from '../common/Button';
import { TextArea } from '../common/Fields';
import { Banner } from '../common/Feedback';
import { ProgressBar } from '../common/Progress';
import { CategoryBreakdown } from '../study/CategoryBreakdown';
import type { WeeklyReview as WeeklyReviewType } from '../../types/review';

export function WeeklyReview({ date, today, onDateChange }: { date: string; today: string; onDateChange: (d: string) => void }) {
  const { data, update } = useAppData();
  const weekStart = startOfWeek(date);
  const week = useWeekSummary(weekStart, today);
  const progress = useRoadmapProgress();
  const saved = useMemo(() => data.weeklyReviews.find((r) => r.weekStart === weekStart), [data.weeklyReviews, weekStart]);
  const s = week.summary;
  const save = (form: Reflection) =>
    update((d) => {
      const existing = d.weeklyReviews.find((r) => r.weekStart === weekStart);
      const review = { id: existing?.id ?? uid('rev'), weekStart, ...form, savedAt: new Date().toISOString() };
      return { ...d, weeklyReviews: existing ? d.weeklyReviews.map((r) => (r.id === existing.id ? review : r)) : [...d.weeklyReviews, review] };
    });

  const sunday = addDays(weekStart, 6);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1">
        <IconButton label="Previous week" onClick={() => onDateChange(addDays(weekStart, -7))}>
          <ChevronLeft size={22} aria-hidden />
        </IconButton>
        <h2 className="text-center font-semibold" aria-live="polite">
          Week of {formatShortDate(weekStart)} – {formatShortDate(sunday)}
        </h2>
        <IconButton label="Next week" onClick={() => onDateChange(addDays(weekStart, 7))}>
          <ChevronRight size={22} aria-hidden />
        </IconButton>
      </div>
      {today < sunday && today >= weekStart && (
        <Banner tone="info">The week is still running. The full review is ready on {formatLongDate(sunday)}.</Banner>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Weekly study hours" value={`${formatHours(s.studyMinutes)} h`} hint={`of ${formatHours(s.targetMinutes)} h so far`} />
        <StatTile label="Target study hours" value={`${formatHours(week.weekTarget)} h`} hint="Whole week" />
        <StatTile label="Completion" value={s.completionPct === null ? '—' : `${s.completionPct}%`} />
        <StatTile label="Gym days" value={`${s.gymDays} / 7`} />
        <StatTile label="Tasks completed" value={s.tasksCompleted} />
        <StatTile label="Tasks not done" value={s.tasksNotDone} hint="Past days only" />
        <StatTile label="Tasks skipped" value={s.tasksSkipped} />
        <StatTile label="DSA problems" value={week.problems} />
      </div>

      <Card title="Progress">
        <div className="grid gap-3 sm:grid-cols-2">
          <ProgressBar value={progress.java.pct} label={`Java · +${week.topicsDone.java} topic(s) this week`} />
          <ProgressBar value={progress.dsa.pct} label={`DSA · +${week.topicsDone.dsa} topic(s) this week`} />
          <ProgressBar value={progress.german.pct} label={`German · +${week.topicsDone.german} topic(s) this week`} />
          <ProgressBar value={progress.college} label="College" />
          <ProgressBar value={progress.projects ?? 0} label={progress.projects === null ? 'Projects (none yet)' : 'Projects'} />
        </div>
      </Card>

      <Card title="Study by category">
        <CategoryBreakdown minutesByCategory={week.categories} />
      </Card>

      <ReflectionForm key={weekStart} saved={saved} onSave={save} />

      {data.weeklyReviews.length > 0 && (
        <Card title="Past reviews">
          <ul className="flex flex-wrap gap-2">
            {[...data.weeklyReviews]
              .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
              .map((r) => (
                <li key={r.id}>
                  <Button variant={r.weekStart === weekStart ? 'primary' : 'secondary'} onClick={() => onDateChange(r.weekStart)}>
                    {formatShortDate(r.weekStart)}
                  </Button>
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

type Reflection = Pick<WeeklyReviewType, 'wentWell' | 'improve' | 'nextPriority'>;

/** Keyed by week so switching weeks loads that week's saved answers. */
function ReflectionForm({ saved, onSave }: { saved?: WeeklyReviewType; onSave: (r: Reflection) => void }) {
  const [form, setForm] = useState<Reflection>({ wentWell: saved?.wentWell ?? '', improve: saved?.improve ?? '', nextPriority: saved?.nextPriority ?? '' });
  const [status, setStatus] = useState<string | null>(null);
  const change = (k: keyof Reflection, v: string) => {
    setForm({ ...form, [k]: v });
    setStatus(null);
  };
  return (
    <Card title="Reflection">
      <div className="space-y-3">
        <TextArea label="What went well?" value={form.wentWell} onChange={(e) => change('wentWell', e.target.value)} />
        <TextArea label="What needs improvement?" value={form.improve} onChange={(e) => change('improve', e.target.value)} />
        <TextArea label="Next week’s priority" value={form.nextPriority} onChange={(e) => change('nextPriority', e.target.value)} />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            icon={<Save size={18} aria-hidden />}
            onClick={() => {
              onSave(form);
              setStatus('Weekly review saved.');
            }}
          >
            Save weekly review
          </Button>
          <span role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
            {status ?? (saved ? `Saved ${new Date(saved.savedAt).toLocaleString()}` : '')}
          </span>
        </div>
      </div>
    </Card>
  );
}
