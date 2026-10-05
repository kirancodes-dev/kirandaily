import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Dumbbell, PartyPopper } from 'lucide-react';
import { useAppData } from '../../hooks/useAppData';
import { dayStats } from '../../utils/calculations';
import { formatHours, formatMonthYear, monthGrid, WEEKDAY_SHORT, WEEK_ORDER } from '../../utils/date';
import { Button, IconButton } from '../common/Button';

interface Props {
  year: number;
  month: number;
  today: string;
  onChange: (year: number, month: number) => void;
}

function pctTone(pct: number | null) {
  if (pct === null) return 'bg-slate-200 dark:bg-slate-700';
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-400';
  if (pct > 0) return 'bg-orange-400';
  return 'bg-slate-300 dark:bg-slate-600';
}

/** Month grid. Each day shows completion %, study hours, gym status and completed tasks. */
export function MonthCalendar({ year, month, today, onChange }: Props) {
  const { stats, data } = useAppData();
  const navigate = useNavigate();
  const weeks = monthGrid(year, month);
  const shift = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    onChange(d.getFullYear(), d.getMonth() + 1);
  };
  const [ty, tm] = today.split('-').map(Number);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        <IconButton label="Previous month" onClick={() => shift(-1)}>
          <ChevronLeft size={22} aria-hidden />
        </IconButton>
        <h2 className="min-w-[10rem] text-center text-lg font-semibold" aria-live="polite">
          {formatMonthYear(year, month)}
        </h2>
        <IconButton label="Next month" onClick={() => shift(1)}>
          <ChevronRight size={22} aria-hidden />
        </IconButton>
        {(ty !== year || tm !== month) && (
          <Button variant="ghost" onClick={() => onChange(ty, tm)}>
            This month
          </Button>
        )}
      </div>

      <table className="w-full table-fixed border-separate border-spacing-1" aria-label={`Calendar for ${formatMonthYear(year, month)}`}>
        <thead>
          <tr>
            {WEEK_ORDER.map((d) => (
              <th key={d} scope="col" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {WEEKDAY_SHORT[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((d, di) => {
                if (!d) return <td key={di} />;
                const s = dayStats(stats, d);
                const past = d <= today;
                const beforePlan = d < data.settings.planStartDate;
                const pct = past && !beforePlan ? s.completionPct : null;
                const label = [
                  d,
                  beforePlan ? 'before plan start' : null,
                  past && s.completionPct !== null ? `${s.completionPct}% complete` : null,
                  past ? `${formatHours(s.studyMinutes)} hours study` : null,
                  s.gymPlanned ? (s.gymDone ? 'gym done' : past ? 'gym not done' : 'gym planned') : null,
                  past ? `${s.completed} tasks completed` : `${s.total} tasks planned`,
                  s.special ? 'special day' : null,
                ]
                  .filter(Boolean)
                  .join(', ');
                return (
                  <td key={di} className="align-top">
                    <button
                      type="button"
                      onClick={() => navigate(`/?date=${d}`)}
                      aria-label={`Open ${label}`}
                      className={`flex h-[84px] w-full flex-col rounded-xl border p-1 text-left sm:h-24 sm:p-1.5 ${
                        d === today
                          ? 'border-brand-600 ring-1 ring-brand-600'
                          : 'border-slate-200 dark:border-slate-800'
                      } ${beforePlan ? 'opacity-50' : ''} bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800`}
                    >
                      <span className="flex w-full items-center justify-between">
                        <span className={`text-sm font-semibold ${d === today ? 'text-brand-700 dark:text-brand-300' : ''}`}>{Number(d.slice(8))}</span>
                        {s.special && <PartyPopper size={12} aria-hidden className="text-fuchsia-600" />}
                      </span>
                      {!beforePlan && past && (
                        <>
                          <span className="text-[11px] font-semibold tabular-nums sm:text-xs">{pct === null ? '—' : `${pct}%`}</span>
                          <span className={`my-0.5 h-1 w-full rounded-full ${pctTone(pct)}`} aria-hidden />
                          <span className="text-[11px] tabular-nums text-slate-600 dark:text-slate-400 sm:text-xs">{formatHours(s.studyMinutes)}h</span>
                          <span className="flex items-center gap-0.5 text-[11px] text-slate-600 dark:text-slate-400 sm:text-xs">
                            {s.gymPlanned && (
                              <span className={`inline-flex items-center ${s.gymDone ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}`}>
                                <Dumbbell size={11} aria-hidden />
                                {s.gymDone ? '✓' : '–'}
                              </span>
                            )}
                            <span className="ml-auto tabular-nums">{s.completed}✓</span>
                          </span>
                        </>
                      )}
                      {!beforePlan && !past && s.total > 0 && (
                        <span className="mt-auto hidden text-xs text-slate-500 sm:inline">{s.total} planned</span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400" aria-label="Legend">
        <span>% = tasks done</span>
        <span>h = study hours</span>
        <span className="inline-flex items-center gap-1">
          <Dumbbell size={14} aria-hidden />✓ gym done, – not done
        </span>
        <span>n✓ = tasks completed</span>
        <span className="inline-flex items-center gap-1">
          <PartyPopper size={14} aria-hidden /> special day
        </span>
      </div>
    </div>
  );
}
