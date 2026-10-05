import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Dumbbell, Flame, PartyPopper, Star, TreePalm } from 'lucide-react';
import { useAppData } from '../../hooks/useAppData';
import { dayStats } from '../../utils/calculations';
import { formatHours, formatMonthYear, monthDates, monthGrid, WEEKDAY_SHORT, WEEK_ORDER } from '../../utils/date';
import { eventsByDate, isNotableOn, shortTitle } from '../../utils/events';
import type { CalendarEvent } from '../../types/extras';
import { Button, IconButton } from '../common/Button';
import { isStreakDay } from '../../utils/streaks';
import { scheduleConfig } from '../../config/schedule';

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

/** Holidays first, then important dates, then the rest. */
function rankEvents(list: CalendarEvent[]): CalendarEvent[] {
  const rank = (e: CalendarEvent) => (e.kind === 'holiday' ? 0 : e.important ? 1 : 2);
  return [...list].sort((a, b) => rank(a) - rank(b));
}

/**
 * Small marker for a day's calendar events: palm (holiday) and/or star
 * (important), or a dot (other). Holidays are never green: on this grid green
 * means "tasks done".
 */
function EventMarker({ events }: { events: CalendarEvent[] }) {
  const top = events[0];
  const important = events.some((e) => e.important);
  const holiday = events.some((e) => e.kind === 'holiday');
  return (
    <span className="flex w-full min-w-0 items-center gap-px text-[10px] font-medium leading-tight text-slate-700 dark:text-slate-300 sm:gap-1 sm:text-xs">
      {holiday && <TreePalm size={11} aria-hidden className="shrink-0 text-slate-600 dark:text-slate-300" />}
      {important && <Star size={11} aria-hidden className="shrink-0 fill-amber-400 text-amber-500 dark:fill-amber-300 dark:text-amber-300" />}
      {!holiday && !important && <span aria-hidden className="mx-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />}
      <span className="hidden min-w-0 truncate sm:inline">{shortTitle(top)}</span>
      {events.length > 1 && <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">+{events.length - 1}</span>}
    </span>
  );
}

/**
 * Month grid. Each day shows completion %, study hours, gym status and
 * completed tasks, plus markers for calendar events (holidays, tests, important dates).
 */
export function MonthCalendar({ year, month, today, onChange }: Props) {
  const { stats, data } = useAppData();
  const navigate = useNavigate();
  const weeks = monthGrid(year, month);
  const shift = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    onChange(d.getFullYear(), d.getMonth() + 1);
  };
  const [ty, tm] = today.split('-').map(Number);
  const eventMap = useMemo(() => {
    const dates = monthDates(year, month);
    return eventsByDate(data.events, dates[0], dates[dates.length - 1]);
  }, [data.events, year, month]);

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
                const streakDay = past && !beforePlan && isStreakDay(s);
                const evs = rankEvents((eventMap.get(d) ?? []).filter((e) => isNotableOn(e, d)));
                const holiday = evs.some((e) => e.kind === 'holiday');
                const label = [
                  d,
                  beforePlan ? 'before plan start' : null,
                  past && s.completionPct !== null ? `${s.completionPct}% complete` : null,
                  past ? `${formatHours(s.studyMinutes)} hours study` : null,
                  s.gymPlanned ? (s.gymDone ? 'gym done' : past ? 'gym not done' : 'gym planned') : null,
                  past ? `${s.completed} tasks completed` : `${s.total} tasks planned`,
                  streakDay ? 'streak day' : null,
                  s.special ? 'special day' : null,
                  evs.length > 0
                    ? `${evs.length === 1 ? 'event' : 'events'}: ${evs
                        .map((e) => `${e.title}${e.kind === 'holiday' ? ' (holiday)' : ''}${e.important ? ' (important)' : ''}`)
                        .join('; ')}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(', ');
                return (
                  <td key={di} className="align-top">
                    <button
                      type="button"
                      onClick={() => navigate(`/?date=${d}`)}
                      aria-label={`Open ${label}`}
                      className={`flex h-[100px] w-full flex-col overflow-hidden rounded-xl border p-1 text-left sm:h-[110px] sm:p-1.5 ${
                        d === today
                          ? 'border-brand-600 ring-1 ring-brand-600'
                          : holiday
                            ? 'border-dashed border-slate-400 dark:border-slate-500'
                            : 'border-slate-200 dark:border-slate-800'
                      } ${beforePlan ? 'opacity-50' : ''} ${
                        holiday
                          ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700'
                          : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex w-full items-center justify-between">
                        <span className={`text-sm font-semibold ${d === today ? 'text-brand-700 dark:text-brand-300' : ''}`}>{Number(d.slice(8))}</span>
                        <span className="flex items-center gap-0.5">
                          {streakDay && <Flame size={13} aria-hidden className="text-orange-500" />}
                          {s.special && <PartyPopper size={12} aria-hidden className="text-fuchsia-600" />}
                        </span>
                      </span>
                      {!beforePlan && past && (
                        <>
                          <span className="text-[11px] font-semibold tabular-nums sm:text-xs">{pct === null ? '—' : `${pct}%`}</span>
                          <span className={`my-0.5 h-1 w-full rounded-full ${pctTone(pct)}`} aria-hidden />
                          <span className="text-[11px] tabular-nums text-slate-600 dark:text-slate-400 sm:text-xs">{formatHours(s.studyMinutes)}h</span>
                          <span className="flex w-full min-w-0 items-center overflow-hidden text-[10px] leading-tight text-slate-600 dark:text-slate-400 sm:gap-0.5 sm:text-xs">
                            {s.gymPlanned && (
                              <span className={`inline-flex items-center ${s.gymDone ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}`}>
                                <Dumbbell size={10} aria-hidden className="shrink-0" />
                                {s.gymDone ? '✓' : '–'}
                              </span>
                            )}
                            <span className="ml-auto tabular-nums">
                              {s.completed}
                              <span className="hidden sm:inline">✓</span>
                            </span>
                          </span>
                        </>
                      )}
                      <span className="mt-auto flex w-full min-w-0 flex-col">
                        {evs.length > 0 && <EventMarker events={evs} />}
                        {!beforePlan && !past && s.total > 0 && <span className="hidden text-xs text-slate-500 sm:inline">{s.total} planned</span>}
                      </span>
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
        <span>last number = tasks completed</span>
        <span className="inline-flex items-center gap-1">
          <Flame size={14} aria-hidden className="text-orange-500" /> {scheduleConfig.streakDayThreshold}%+ day (streak)
        </span>
        <span className="inline-flex items-center gap-1">
          <PartyPopper size={14} aria-hidden /> special day
        </span>
        <span className="inline-flex items-center gap-1">
          <Star size={14} aria-hidden className="fill-amber-400 text-amber-500" /> important date
        </span>
        <span className="inline-flex items-center gap-1">
          <TreePalm size={14} aria-hidden className="text-slate-600 dark:text-slate-300" /> holiday (grey day, dashed border)
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="h-2 w-2 rounded-full bg-sky-500" /> other calendar event
        </span>
      </div>
    </div>
  );
}
