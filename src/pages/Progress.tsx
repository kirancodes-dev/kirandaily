import { useSearchParams } from 'react-router-dom';
import { useToday } from '../hooks/useToday';
import { Tabs } from '../components/common/Tabs';
import { PageHeader } from '../components/common/Feedback';
import { ProgressOverview } from '../components/progress/ProgressOverview';
import { WeeklyReview } from '../components/progress/WeeklyReview';
import { MonthlyReview } from '../components/progress/MonthlyReview';
import { isValidISODate } from '../utils/date';

type Tab = 'overview' | 'weekly' | 'monthly';

export default function Progress() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const tab = (['overview', 'weekly', 'monthly'].includes(params.get('tab') ?? '') ? params.get('tab') : 'overview') as Tab;
  const dateParam = params.get('date');
  const date = dateParam && isValidISODate(dateParam) ? dateParam : today;
  const [y, m] = date.split('-').map(Number);
  const set = (next: Record<string, string>) => setParams({ tab, ...(date !== today ? { date } : {}), ...next }, { replace: true });

  return (
    <div className="space-y-4">
      <PageHeader title="Progress" subtitle="Streaks, charts and your weekly and monthly reviews." />
      <Tabs
        label="Progress views"
        value={tab}
        onChange={(t) => set({ tab: t })}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'weekly', label: 'Weekly review' },
          { id: 'monthly', label: 'Monthly' },
        ]}
      />
      {tab === 'overview' && <ProgressOverview today={today} />}
      {tab === 'weekly' && <WeeklyReview date={date} today={today} onDateChange={(d) => set({ date: d })} />}
      {tab === 'monthly' && (
        <MonthlyReview year={y} month={m} today={today} onChange={(yy, mm) => set({ date: `${yy}-${String(mm).padStart(2, '0')}-01` })} />
      )}
    </div>
  );
}
