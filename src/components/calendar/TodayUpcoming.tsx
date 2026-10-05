import { Link } from 'react-router-dom';
import { CalendarRange, ChevronRight, Sparkles, Star } from 'lucide-react';
import { useExtras } from '../../hooks/useExtras';
import { formatShortDate, parseISODate, WEEKDAY_SHORT } from '../../utils/date';
import { alsoText, countdownText, eventTiming, importantSoon, KIND_LABELS, relevantOn, splitHighlights, timeText } from '../../utils/events';
import type { CalendarEvent } from '../../types/extras';
import { KIND_META } from './kindMeta';

/** Countdowns only for starred dates within this many days, so far-off ones don't take space on Today every day. */
const HORIZON_DAYS = 30;
const MAX_COUNTDOWNS = 3;

/** "Holiday – Gandhi Jayanthi", "IA-1 test today", "IA-1 test · day 3 of 8", "Hackathon starts today". */
function dayText(e: CalendarEvent, date: string, isToday: boolean): string {
  if (e.kind === 'holiday') return `Holiday – ${e.title}`;
  if (isToday && (e.kind === 'test' || e.kind === 'exam' || e.important)) return countdownText(e, date);
  const t = eventTiming(e, date);
  if (t.phase !== 'ongoing') return e.title;
  if (t.dayIndex === 1) return isToday ? `${e.title} starts today` : `${e.title} · first day`;
  return `${e.title} · day ${t.dayIndex} of ${t.totalDays}`;
}

/**
 * On Today: the day's holidays, tests and starred dates (one row each), the
 * other events on one short line, and countdowns to starred dates in the next
 * 30 days. Kept compact so the day's tasks stay near the top on a phone.
 */
export function TodayUpcoming({ date, today }: { date: string; today: string }) {
  const { events } = useExtras();
  const isToday = date === today;
  const { highlights, others } = splitHighlights(relevantOn(events, date));
  const countdowns = isToday ? importantSoon(events, today, HORIZON_DAYS, MAX_COUNTDOWNS) : [];
  if (highlights.length === 0 && others.length === 0 && countdowns.length === 0) return null;

  return (
    <section aria-labelledby="upcoming-heading" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="upcoming-heading" className="flex items-center gap-2 text-lg font-semibold">
          <CalendarRange size={20} aria-hidden className="text-brand-600 dark:text-brand-300" />
          {/* Avoid "Calendar" here: forms on Today are found by label text such as "End". */}
          {isToday ? 'Coming up' : `On ${formatShortDate(date)}`}
        </h2>
        <Link
          to="/calendar"
          className="-mr-2 inline-flex min-h-touch items-center gap-0.5 rounded-xl px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
        >
          All dates
          <ChevronRight size={16} aria-hidden />
        </Link>
      </div>

      {highlights.length > 0 && (
        <ul className="space-y-2" aria-label={isToday ? 'Happening today' : `Happening on ${formatShortDate(date)}`}>
          {highlights.map((e) => {
            const meta = KIND_META[e.kind];
            const Icon = meta.icon;
            const time = timeText(e);
            return (
              <li key={e.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${meta.block} ring-1 ring-inset`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70 dark:bg-slate-950/40">
                  <Icon size={20} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-semibold leading-snug">{dayText(e, date, isToday)}</span>
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

      {others.length > 0 && (
        <p className={`flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 ${highlights.length > 0 ? 'mt-2' : ''}`}>
          <Sparkles size={16} aria-hidden className="mt-0.5 shrink-0 text-sky-600 dark:text-sky-400" />
          <span className="line-clamp-2 min-w-0 break-words">
            <span className="font-semibold">{isToday ? 'Also today:' : 'Also on this day:'}</span> {others.map((e) => alsoText(e, date)).join(' · ')}
          </span>
        </p>
      )}

      {countdowns.length > 0 && (
        <ul
          className={`sm:grid sm:grid-cols-3 sm:gap-2 ${highlights.length + others.length > 0 ? 'mt-2' : ''}`}
          aria-label="Next important dates"
        >
          {countdowns.map((e) => {
            const days = eventTiming(e, today).days;
            const d = parseISODate(e.date);
            return (
              <li
                key={e.id}
                className="flex items-center gap-3 border-slate-200 py-2 dark:border-slate-800 [&:not(:first-child)]:border-t sm:rounded-xl sm:border sm:p-3 sm:dark:border-slate-700"
              >
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 leading-none text-brand-700 dark:bg-brand-500/15 dark:text-brand-200"
                >
                  <span className="text-lg font-bold tabular-nums">{days}</span>
                  <span className="text-[11px] font-medium">{days === 1 ? 'day' : 'days'}</span>
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
