import { useSearchParams } from 'react-router-dom';
import { useToday } from '../hooks/useToday';
import { Tabs } from '../components/common/Tabs';
import { PageHeader } from '../components/common/Feedback';
import { WeekView } from '../components/schedule/WeekView';
import { MonthCalendar } from '../components/schedule/MonthCalendar';
import { RoutineEditor } from '../components/schedule/RoutineEditor';
import { isValidISODate } from '../utils/date';

type View = 'week' | 'month' | 'routine';

export default function Schedule() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const view = (['week', 'month', 'routine'].includes(params.get('view') ?? '') ? params.get('view') : 'week') as View;
  const dateParam = params.get('date');
  const date = dateParam && isValidISODate(dateParam) ? dateParam : today;
  const [y, m] = date.split('-').map(Number);

  const set = (next: Record<string, string>) => setParams({ view, ...(date !== today ? { date } : {}), ...next }, { replace: true });

  return (
    <div className="space-y-4">
      <PageHeader title="Schedule" subtitle="Weekly timetable, monthly calendar and your repeating routine." />
      <Tabs
        label="Schedule views"
        value={view}
        onChange={(v) => set({ view: v })}
        tabs={[
          { id: 'week', label: 'Week' },
          { id: 'month', label: 'Month' },
          { id: 'routine', label: 'Routine' },
        ]}
      />
      {view === 'week' && <WeekView date={date} today={today} onDateChange={(d) => set({ date: d })} />}
      {view === 'month' && (
        <MonthCalendar year={y} month={m} today={today} onChange={(yy, mm) => set({ date: `${yy}-${String(mm).padStart(2, '0')}-01` })} />
      )}
      {view === 'routine' && <RoutineEditor today={today} />}
    </div>
  );
}
