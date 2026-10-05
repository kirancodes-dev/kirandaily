import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';
import { useAppData } from '../../hooks/useAppData';
import { buildHeatmap, type HeatCell, type HeatLevel, type HeatmapData } from '../../utils/gamification';
import { addDays, formatLongDate } from '../../utils/date';
import { Card } from '../common/Card';
import { scheduleConfig } from '../../config/schedule';

/** GitHub's contribution-graph greens (light / dark). */
const HEAT_CLASSES: Record<HeatLevel, string> = {
  0: 'bg-slate-200 dark:bg-slate-800',
  1: 'bg-[#9be9a8] dark:bg-[#0e4429]',
  2: 'bg-[#40c463] dark:bg-[#006d32]',
  3: 'bg-[#30a14e] dark:bg-[#26a641]',
  4: 'bg-[#216e39] dark:bg-[#39d353]',
};

const LEVEL_TEXT: Record<HeatLevel, string> = {
  0: 'nothing done',
  1: 'under 40%',
  2: '40–59%',
  3: '60–79%',
  4: `${scheduleConfig.streakDayThreshold}%+ (streak day)`,
};

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];
const KEY_STEP: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };

interface Props {
  today: string;
  weeks?: number;
  title?: string;
}

/**
 * GitHub-style activity graph: one square per day (Mon–Sun rows, one column
 * per week), greener the more of that day's tasks were done. Tap/click a day
 * to open it. Arrow keys move between days.
 */
export const ActivityHeatmap = memo(function ActivityHeatmap({ today, weeks = 52, title = 'Activity' }: Props) {
  const { stats, data } = useAppData();
  const navigate = useNavigate();
  const hm = useMemo(() => buildHeatmap(stats, today, weeks), [stats, today, weeks]);
  const [hovered, setHovered] = useState<HeatCell | null>(null);
  const planStart = data.settings.planStartDate;
  const firstShown = hm.columns[0][0].date;

  const open = useCallback((date: string) => navigate(`/?date=${date}`), [navigate]);

  return (
    <Card
      title={title}
      icon={<CalendarCheck size={20} className="text-emerald-600 dark:text-emerald-400" aria-hidden />}
      actions={
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {hm.activeDays} active day{hm.activeDays === 1 ? '' : 's'}
        </span>
      }
    >
      <HeatGrid hm={hm} today={today} weeks={weeks} onOpen={open} onHover={setHovered} />

      <p className="mt-2 min-h-[1.25rem] text-sm text-slate-700 dark:text-slate-300" aria-hidden>
        {hovered?.label ?? 'Tap a day to open it.'}
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        <p className="font-medium">
          <span className="tabular-nums">{hm.streakDays}</span> streak day{hm.streakDays === 1 ? '' : 's'} in the last year
        </p>
        <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
          <span>Less</span>
          <ul className="flex gap-[3px]" aria-label="Colour legend">
            {([0, 1, 2, 3, 4] as const).map((l) => (
              <li key={l} title={LEVEL_TEXT[l]} className={`h-3 w-3 rounded-[3px] ${HEAT_CLASSES[l]}`}>
                <span className="sr-only">{LEVEL_TEXT[l]}</span>
              </li>
            ))}
          </ul>
          <span>More</span>
        </div>
      </div>
      {planStart > firstShown && planStart <= today && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Your plan started on {formatLongDate(planStart)} — the graph fills in from there. Days are only counted once they’re done.
        </p>
      )}
    </Card>
  );
});

interface GridProps {
  hm: HeatmapData;
  today: string;
  weeks: number;
  onOpen: (date: string) => void;
  onHover: (cell: HeatCell | null) => void;
}

/** The grid itself (memoised so hovering doesn't re-render ~370 buttons). */
const HeatGrid = memo(function HeatGrid({ hm, today, weeks, onOpen, onHover }: GridProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const days = useMemo(() => {
    const map = new Map<string, HeatCell>();
    for (const col of hm.columns) for (const c of col) if (c.kind === 'day') map.set(c.date, c);
    return map;
  }, [hm]);
  const dayList = useMemo(() => [...days.keys()], [days]);
  const [focusDate, setFocusDate] = useState<string | null>(null);
  // The one cell reachable with Tab (roving tab index): last focused, else today.
  const active = focusDate && days.has(focusDate) ? focusDate : days.has(today) ? today : dayList[dayList.length - 1];

  // Phones: start scrolled to the latest week.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [today, weeks]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!active) return;
    let target: string | undefined;
    if (KEY_STEP[e.key]) target = addDays(active, KEY_STEP[e.key]);
    else if (e.key === 'Home') target = dayList[0];
    else if (e.key === 'End') target = dayList[dayList.length - 1];
    else return;
    e.preventDefault();
    if (!target || !days.has(target)) return;
    setFocusDate(target);
    cellRefs.current.get(target)?.focus();
  };

  const cells: ReactNode[] = [];
  // Row 0: month names.
  cells.push(<div key="corner" aria-hidden className="sticky left-0 z-10 bg-white dark:bg-slate-900" />);
  const monthAt = new Map(hm.months.map((m) => [m.col, m.label]));
  for (let w = 0; w < weeks; w++) {
    const label = monthAt.get(w);
    cells.push(
      <div key={`m${w}`} aria-hidden className="relative h-4">
        {label && <span className="absolute left-0 top-0 whitespace-nowrap text-xs leading-4 text-slate-600 dark:text-slate-400">{label}</span>}
      </div>,
    );
  }
  // Rows 1–7: Monday … Sunday.
  for (let d = 0; d < 7; d++) {
    cells.push(
      <div key={`d${d}`} aria-hidden className="sticky left-0 z-10 flex items-center justify-end bg-white pr-1 text-xs leading-none text-slate-600 dark:bg-slate-900 dark:text-slate-400">
        {DAY_LABELS[d]}
      </div>,
    );
    for (let w = 0; w < weeks; w++) {
      const c = hm.columns[w][d];
      if (c.kind === 'future') {
        cells.push(<div key={c.date} aria-hidden />);
      } else if (c.kind === 'before') {
        cells.push(<div key={c.date} aria-hidden className="aspect-square rounded-[3px] bg-slate-100 dark:bg-slate-800/40" />);
      } else {
        cells.push(
          <button
            key={c.date}
            ref={(el) => {
              if (el) cellRefs.current.set(c.date, el);
              else cellRefs.current.delete(c.date);
            }}
            type="button"
            tabIndex={c.date === active ? 0 : -1}
            aria-label={c.label}
            aria-current={c.isToday ? 'date' : undefined}
            onClick={() => onOpen(c.date)}
            onFocus={() => {
              setFocusDate(c.date);
              onHover(c);
            }}
            onBlur={() => onHover(null)}
            onMouseEnter={() => onHover(c)}
            onMouseLeave={() => onHover(null)}
            className={`block aspect-square w-full rounded-[3px] ${HEAT_CLASSES[c.level]} ${
              c.isToday ? 'ring-2 ring-slate-900/60 ring-offset-1 ring-offset-white dark:ring-white/70 dark:ring-offset-slate-900' : ''
            } hover:ring-2 hover:ring-brand-500`}
          />,
        );
      }
    }
  }

  return (
    <div ref={scroller} className="overflow-x-auto overscroll-x-contain pb-2 pr-1 pt-1 [scrollbar-width:thin]">
      <div
        role="group"
        aria-label={`Daily activity for the last ${weeks} weeks. Use the arrow keys to move between days and Enter to open one.`}
        onKeyDown={onKeyDown}
        className="grid w-max min-w-full gap-[3px] [--cell:18px] sm:[--cell:13px]"
        style={{ gridTemplateColumns: `2rem repeat(${weeks}, minmax(var(--cell), 1fr))` }}
      >
        {cells}
      </div>
    </div>
  );
});
