import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, Flame, Trophy } from 'lucide-react';
import { IconButton } from '../common/Button';
import { activitySummary, buildGraph, countsByDate, plural, type DayCount, type Level } from '../../utils/integrations/contrib';
import { addDays, formatShortDate, WEEKDAY_SHORT, dayOfWeek } from '../../utils/date';

/**
 * GitHub-style activity graph for any { date, count } series (GitHub contributions,
 * LeetCode submissions). On phones it scrolls sideways and starts at the latest week.
 * Tap or hover a square for its day (a tap snaps to the nearest square), step with the
 * previous/next-day buttons, or focus the graph and use the arrow keys.
 */

interface ContribGraphProps {
  days: DayCount[];
  /** Last day shown (today). */
  endDate: string;
  /** Number of week columns (53 ≈ one year). */
  weeks?: number;
  /** First day with data; earlier squares are drawn as outlines (unknown, not zero). */
  from?: string;
  /** Last day with data when it's an older copy; later squares are outlines too. */
  until?: string;
  /** e.g. "GitHub contributions" – names the graph for screen readers. */
  label: string;
  unit: [singular: string, plural: string];
}

const CELL = 13;
const GAP = 3;
const PITCH = CELL + GAP;
const TOP = 18;

// Full class names so Tailwind keeps them. GitHub's greens; dark mode uses GitHub's dark palette.
const LEVEL_FILL: Record<Level, string> = {
  0: 'fill-slate-200 dark:fill-slate-800',
  1: 'fill-[#9be9a8] dark:fill-[#0e4429]',
  2: 'fill-[#40c463] dark:fill-[#006d32]',
  3: 'fill-[#30a14e] dark:fill-[#26a641]',
  4: 'fill-[#216e39] dark:fill-[#39d353]',
};
const LEVEL_BG: Record<Level, string> = {
  0: 'bg-slate-200 dark:bg-slate-800',
  1: 'bg-[#9be9a8] dark:bg-[#0e4429]',
  2: 'bg-[#40c463] dark:bg-[#006d32]',
  3: 'bg-[#30a14e] dark:bg-[#26a641]',
  4: 'bg-[#216e39] dark:bg-[#39d353]',
};

function dayLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  return `${WEEKDAY_SHORT[dayOfWeek(date)]}, ${formatShortDate(date)}`;
}

export function ContribGraph({ days, endDate, weeks = 53, from, label, unit, until }: ContribGraphProps) {
  const lastKnown = until && until < endDate ? until : undefined;
  const graph = useMemo(() => buildGraph(days, endDate, weeks, from, lastKnown), [days, endDate, weeks, from, lastKnown]);
  // Streaks run up to the last day the data knows about (an unknown day isn't a zero).
  const summary = useMemo(() => activitySummary(days, lastKnown ?? endDate), [days, endDate, lastKnown]);
  const counts = useMemo(() => countsByDate(days), [days]);
  const [selected, setSelected] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const captionId = useId();

  const firstDate = useMemo(() => {
    const first = graph.weeks[0][0]!.date;
    return from && from > first ? from : first;
  }, [graph, from]);

  // Start scrolled to the newest week (phones show only part of the year).
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [graph]);

  const gridWidth = graph.weeks.length * PITCH - GAP;
  // Room for a month label that starts in the last columns ("Oct" is wider than one square).
  const lastLabel = graph.months[graph.months.length - 1];
  const width = Math.max(gridWidth, lastLabel ? lastLabel.col * PITCH + 22 : 0);
  const height = TOP + 7 * PITCH - GAP;
  const shown = selected ?? endDate;
  const shownCount = counts.get(shown) ?? 0;
  const shownNoData = shown < firstDate || (!!lastKnown && shown > lastKnown);

  const select = (date: string) => {
    const clamped = date > endDate ? endDate : date < firstDate ? firstDate : date;
    setSelected(clamped);
    // Keep the chosen square in view.
    const el = scroller.current;
    const col = graph.weeks.findIndex((w) => w.some((c) => c?.date === clamped));
    if (el && col >= 0) {
      const x = col * PITCH;
      if (x < el.scrollLeft) el.scrollLeft = x - PITCH;
      else if (x + CELL > el.scrollLeft + el.clientWidth) el.scrollLeft = x + CELL - el.clientWidth + PITCH;
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 };
    if (e.key in step) select(addDays(shown, step[e.key]));
    else if (e.key === 'Home') select(firstDate);
    else if (e.key === 'End') select(endDate);
    else if (e.key === 'Escape') setSelected(null);
    else return;
    e.preventDefault();
  };

  const summaryText = `${plural(summary.total, unit)}, ${plural(summary.activeDays, ['active day', 'active days'])}, current streak ${plural(summary.currentStreak, ['day', 'days'])}`;

  return (
    <figure className="min-w-0">
      <div className="flex">
        {/* Weekday labels stay put while the weeks scroll. */}
        <div aria-hidden className="relative w-8 shrink-0 text-[10px] leading-none text-slate-500 dark:text-slate-400" style={{ height }}>
          {[0, 2, 4].map((row) => (
            <span key={row} className="absolute left-0" style={{ top: TOP + row * PITCH + 2 }}>
              {['Mon', '', 'Wed', '', 'Fri'][row]}
            </span>
          ))}
        </div>
        <div
          ref={scroller}
          tabIndex={0}
          role="group"
          aria-label={`${label}: ${summaryText}. Use the arrow keys to move between days.`}
          aria-describedby={captionId}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain rounded-md pb-1"
          data-testid="contrib-graph"
        >
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden
            className="block"
            onClick={(e) => {
              // The square under the finger, counting the gap around it (squares are small on phones).
              const box = e.currentTarget.getBoundingClientRect();
              const scale = box.width > 0 ? width / box.width : 1;
              const col = Math.floor(((e.clientX - box.left) * scale + GAP / 2) / PITCH);
              const row = Math.floor(((e.clientY - box.top) * scale - TOP + GAP / 2) / PITCH);
              const cell = row >= 0 && row < 7 ? graph.weeks[col]?.[row] : null;
              if (cell) setSelected(cell.date === selected ? null : cell.date);
            }}
          >
            {graph.months.map((m) => (
              <text key={`${m.col}-${m.label}`} x={m.col * PITCH} y={11} className="fill-slate-500 text-[10px] dark:fill-slate-400">
                {m.label}
              </text>
            ))}
            {graph.weeks.map((col, c) =>
              col.map((cell, r) => {
                if (!cell) return null;
                const isSelected = cell.date === selected;
                const isToday = cell.date === endDate;
                const cls = cell.noData
                  ? 'fill-transparent stroke-slate-300 dark:stroke-slate-700'
                  : `${LEVEL_FILL[cell.level]} ${isSelected ? 'stroke-slate-900 dark:stroke-white' : isToday ? 'stroke-brand-500 dark:stroke-brand-400' : 'stroke-transparent'}`;
                return (
                  <rect
                    key={cell.date}
                    data-date={cell.date}
                    data-count={cell.noData ? undefined : cell.count}
                    x={c * PITCH + 0.5}
                    y={TOP + r * PITCH + 0.5}
                    width={CELL - 1}
                    height={CELL - 1}
                    rx={2.5}
                    strokeWidth={isSelected ? 2 : 1.5}
                    strokeDasharray={cell.noData ? '2 2' : undefined}
                    className={`cursor-pointer ${cls}`}
                  >
                    <title>{cell.noData ? `${formatShortDate(cell.date)}: no data` : `${plural(cell.count, unit)} on ${formatShortDate(cell.date)}`}</title>
                  </rect>
                );
              }),
            )}
          </svg>
        </div>
      </div>

      <figcaption className="mt-1 flex items-center justify-between gap-2 text-sm">
        <p id={captionId} aria-live="polite" className="min-w-0 text-slate-700 dark:text-slate-300">
          <span className="font-medium">{dayLabel(shown, endDate)}</span>
          {' · '}
          {shownNoData ? 'no data' : plural(shownCount, unit)}
        </p>
        <div className="-mr-2 flex shrink-0">
          <IconButton label="Previous day" onClick={() => select(addDays(shown, -1))} disabled={shown <= firstDate}>
            <ChevronLeft size={18} aria-hidden />
          </IconButton>
          <IconButton label="Next day" onClick={() => select(addDays(shown, 1))} disabled={shown >= endDate}>
            <ChevronRight size={18} aria-hidden />
          </IconButton>
        </div>
      </figcaption>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
          <li className="flex items-center gap-1">
            <Flame size={16} className="text-orange-500" aria-hidden />
            Current streak <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{plural(summary.currentStreak, ['day', 'days'])}</span>
          </li>
          <li className="flex items-center gap-1">
            <Trophy size={16} className="text-amber-500" aria-hidden />
            Longest <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{plural(summary.longestStreak, ['day', 'days'])}</span>
          </li>
          <li>
            <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{summary.activeDays.toLocaleString('en-US')}</span> active day
            {summary.activeDays === 1 ? '' : 's'}
          </li>
        </ul>
        <div className="ml-auto flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400" aria-hidden>
          <span className="mr-1">Less</span>
          {([0, 1, 2, 3, 4] as Level[]).map((l) => (
            <span key={l} className={`h-3 w-3 rounded-[3px] ${LEVEL_BG[l]}`} />
          ))}
          <span className="ml-1">More</span>
        </div>
      </div>
    </figure>
  );
}
