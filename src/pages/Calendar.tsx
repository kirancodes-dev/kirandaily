import { PageHeader } from '../components/common/Feedback';
import { useExtras } from '../hooks/useExtras';
import { formatLongDate } from '../utils/date';

/** Feature: calendar (semester calendar + important dates). Replaced by the calendar feature. */
export default function Calendar() {
  const { events, semesterInfo } = useExtras();
  return (
    <div className="space-y-4">
      <PageHeader title="Calendar" subtitle={semesterInfo.title} />
      <ul className="space-y-2">
        {[...events]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((e) => (
            <li key={e.id} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="font-medium">{e.title}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{formatLongDate(e.date)}</p>
            </li>
          ))}
      </ul>
    </div>
  );
}
