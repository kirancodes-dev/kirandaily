import { Fragment, useId, useState } from 'react';
import { ArrowDown, Clock, Info } from 'lucide-react';
import type { CalendarEvent } from '../../types/extras';
import { formatShortDate, parseISODate, WEEKDAY_SHORT } from '../../utils/date';
import { eventEnd, eventTiming, groupByMonth, rangeText, timeText, timingLabel } from '../../utils/events';
import { Button } from '../common/Button';
import { DateBlock, KindChip, StarButton } from './EventBits';

interface RowProps {
  event: CalendarEvent;
  today: string;
  onEdit: (e: CalendarEvent) => void;
  onToggleImportant: (e: CalendarEvent) => void;
}

const TIMING_TONE = {
  today: 'bg-brand-600 text-white',
  ongoing: 'bg-brand-600 text-white',
  upcoming: 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100',
  past: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

/** One date: tap to edit, star to mark important. */
export function EventRow({ event: e, today, onEdit, onToggleImportant }: RowProps) {
  const metaId = useId();
  const timing = eventTiming(e, today);
  const past = timing.phase === 'past';
  const current = timing.phase === 'today' || timing.phase === 'ongoing';
  const range = rangeText(e);
  const time = timeText(e);
  const d = parseISODate(e.date);
  return (
    <li
      className={`flex items-start gap-1 rounded-2xl border bg-white shadow-sm dark:bg-slate-900 ${
        current ? 'border-brand-400 ring-1 ring-brand-400 dark:border-brand-500 dark:ring-brand-500' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <button
        type="button"
        onClick={() => onEdit(e)}
        aria-label={`Edit ${e.title}`}
        data-event-id={e.id}
        aria-describedby={metaId}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-2xl p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
      >
        <span className={past ? 'opacity-60' : undefined}>
          <DateBlock date={e.date} kind={e.kind} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block break-words font-semibold leading-snug ${past ? 'text-slate-500 dark:text-slate-400' : ''}`}>{e.title}</span>
          <span id={metaId} className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
            <span className="sr-only">
              {WEEKDAY_SHORT[d.getDay()]}, {formatShortDate(e.date)}
              {eventEnd(e) !== e.date ? ` to ${formatShortDate(eventEnd(e))}` : ''}.
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TIMING_TONE[timing.phase]}`}>{timingLabel(e, today)}</span>
            <KindChip kind={e.kind} />
            {range && <span>{range}</span>}
            {time && (
              <span className="inline-flex items-center gap-1">
                <Clock size={14} aria-hidden />
                {time}
              </span>
            )}
          </span>
          {e.notes && (
            <span className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-600 dark:text-slate-400">
              <Info size={14} aria-hidden className="mt-0.5 shrink-0" />
              <span className="line-clamp-3 break-words">{e.notes}</span>
            </span>
          )}
        </span>
      </button>
      <div className="p-1 pt-2">
        <StarButton title={e.title} important={e.important} onToggle={() => onToggleImportant(e)} />
      </div>
    </li>
  );
}

interface ListProps extends Omit<RowProps, 'event'> {
  events: CalendarEvent[];
  /** Group under this date's month when an event started earlier (Upcoming). */
  from?: string;
  /** Draw a "Today" line between past and coming dates. */
  todayLine?: boolean;
  /** Show this many, then a "Show all" button. */
  initialLimit?: number;
}

/** Events grouped by month. */
export function EventList({ events, from, todayLine, initialLimit = Infinity, ...row }: ListProps) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? events : events.slice(0, initialLimit);
  const groups = groupByMonth(shown, from);
  // The first event that isn't over yet gets the "Today" line above it.
  const firstCurrent = todayLine ? shown.find((e) => eventEnd(e) >= row.today) : undefined;
  const allPast = todayLine && !firstCurrent && shown.length > 0;
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.key} aria-label={g.label}>
          <h3 className="mb-2 flex items-baseline justify-between px-1 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
            {g.label}
            <span className="text-xs font-medium normal-case tracking-normal">
              {g.events.length} {g.events.length === 1 ? 'date' : 'dates'}
            </span>
          </h3>
          <ul className="grid gap-2 lg:grid-cols-2">
            {g.events.map((e) => (
              <Fragment key={e.id}>
                {e === firstCurrent && <TodayLine today={row.today} />}
                <EventRow event={e} {...row} />
              </Fragment>
            ))}
          </ul>
        </section>
      ))}
      {allPast && (
        <ul>
          <TodayLine today={row.today} />
        </ul>
      )}
      {!showAll && events.length > shown.length && (
        <Button block onClick={() => setShowAll(true)}>
          Show all {events.length} dates
        </Button>
      )}
    </div>
  );
}

const TODAY_LINE_ID = 'calendar-today-line';

/** Scrolls the "Today" line of the list on screen into view. */
export function JumpToToday() {
  return (
    <button
      type="button"
      onClick={() =>
        document
          .getElementById(TODAY_LINE_ID)
          ?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      }
      className="inline-flex min-h-touch items-center gap-1 rounded-xl px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
    >
      <ArrowDown size={16} aria-hidden />
      Jump to today
    </button>
  );
}

function TodayLine({ today }: { today: string }) {
  const d = parseISODate(today);
  return (
    <li id={TODAY_LINE_ID} className="flex scroll-mt-24 items-center gap-2 py-1 text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300 lg:col-span-2">
      <span aria-hidden className="h-0.5 flex-1 rounded bg-brand-500" />
      Today · {WEEKDAY_SHORT[d.getDay()]}, {formatShortDate(today)}
      <span aria-hidden className="h-0.5 flex-1 rounded bg-brand-500" />
    </li>
  );
}
