import { Link } from 'react-router-dom';
import { CalendarRange, ChevronRight, Star } from 'lucide-react';
import { useExtras } from '../../hooks/useExtras';
import { formatShortDate, parseISODate, WEEKDAY_SHORT } from '../../utils/date';
import { countdownText, eventTiming, KIND_LABELS, occursOn, relevantOn, timeText, upcoming } from '../../utils/events';
import type { CalendarEvent } from '../../types/extras';
import { KIND_META } from './kindMeta';

/** Countdowns are shown when something important starts within this many days. */
const HORIZON_DAYS = 30;
const MAX_COUNTDOWNS = 3;

/** "Holiday – Gandhi Jayanthi", "IA-1 test today", "IA-1 test · day 3 of 8", "GIS course starts today". */
function dayText(e: CalendarEvent, date: string, isToday: boolean): string {
  if (e.kind === 'holiday') return `Holiday – ${e.title}`;
  if (isToday && (e.kind === 'test' || e.kind === 'exam' || e.important)) return countdownText(e, date);
  const t = eventTiming(e, date);
  if (t.phase !== 'ongoing') return e.title;
  if (t.dayIndex === 1) return isToday ? `${e.title} starts today` : `${e.title} · first day`;
  return `${e.title} · day ${t.dayIndex} of ${t.totalDays}`;
}

/** On Today: the day's calendar events, plus countdowns to the next important dates. */
export function TodayUpcoming({ date, today }: { date: string; today: string }) {
  const { events } = useExtras();
  const onDay = relevantOn(events, date);
  const next = date === today ? upcoming(events.filter((e) => e.important && !occursOn(e, today)), today, MAX_COUNTDOWNS) : [];
  const soon = next.some((e) => eventTiming(e, today).days <= HORIZON_DAYS);
  if (onDay.length === 0 && !soon) return null;
  const countdowns = soon ? next : [];

  return (
    <section aria-labelledby="upcoming-heading" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="upcoming-heading" className="flex items-center gap-2 text-lg font-semibold">
          <CalendarRange size={20} aria-hidden className="text-brand-600 dark:text-brand-300" />
          {/* Avoid "Calendar" here: forms on Today are found by label text such as "End". */}
          {date === today ? 'Coming up' : `On ${formatShortDate(date)}`}
        </h2>
        <Link
          to="/calendar"
          className="-mr-2 inline-flex min-h-touch items-center gap-0.5 rounded-xl px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
        >
          All dates
          <ChevronRight size={16} aria-hidden />
        </Link>
      </div>

      {onDay.length > 0 && (
        <ul className="space-y-2" aria-label={date === today ? 'Happening today' : `Happening on ${formatShortDate(date)}`}>
          {onDay.map((e) => {
            const meta = KIND_META[e.kind];
            const Icon = meta.icon;
            const time = timeText(e);
            return (
              <li key={e.id} className={`flex items-center gap-3 rounded-xl p-3 ${meta.block} ring-1 ring-inset`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70 dark:bg-slate-950/40">
                  <Icon size={20} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-semibold leading-snug">{dayText(e, date, date === today)}</span>
                  <span className="text-sm opacity-90">
                    {KIND_LABELS[e.kind]}
                    {time && ` · ${time}`}
                    {e.important && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle">
                        <Star size={13} aria-hidden className="fill-current" /> Important
                      </span>
                    )}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {countdowns.length > 0 && (
        <ul className={`grid gap-2 sm:grid-cols-3 ${onDay.length > 0 ? 'mt-3' : ''}`} aria-label="Next important dates">
          {countdowns.map((e) => {
            const days = eventTiming(e, today).days;
            const d = parseISODate(e.date);
            return (
              <li key={e.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <span aria-hidden className="flex w-12 shrink-0 flex-col items-center leading-none text-brand-700 dark:text-brand-300">
                  <span className="text-2xl font-bold tabular-nums">{days}</span>
                  <span className="mt-0.5 text-xs font-medium">{days === 1 ? 'day' : 'days'}</span>
                </span>
                <span className="min-w-0">
                  <span className="block break-words font-medium leading-snug">{countdownText(e, today)}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {WEEKDAY_SHORT[d.getDay()]}, {formatShortDate(e.date)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
