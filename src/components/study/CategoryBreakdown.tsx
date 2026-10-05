import { useCategories } from '../../hooks/useCategories';
import { formatMinutes } from '../../utils/date';
import { CHART_COLORS } from '../../utils/categoryStyles';
import { EmptyState } from '../common/Feedback';

/** Category → time list with bars (labels and values are always written out). */
export function CategoryBreakdown({ minutesByCategory }: { minutesByCategory: Map<string, number> }) {
  const { get } = useCategories();
  const rows = [...minutesByCategory.entries()].filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, m]) => m));
  if (!rows.length) return <EmptyState title="No study time yet">Complete a study task or finish a session to see it here.</EmptyState>;
  return (
    <ul className="space-y-2.5">
      {rows.map(([id, mins]) => {
        const c = get(id);
        return (
          <li key={id}>
            <div className="flex justify-between text-sm">
              <span className="font-medium">{c.label}</span>
              <span className="tabular-nums">{formatMinutes(mins)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700" aria-hidden>
              <div className="h-full rounded-full" style={{ width: `${(mins / max) * 100}%`, background: CHART_COLORS[c.color] }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
