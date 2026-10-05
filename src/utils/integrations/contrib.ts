import { z } from 'zod';
import { addDays, daysBetween, isValidISODate, parseISODate, startOfWeek } from '../date';

/**
 * GitHub-style activity graph: one column per week (Monday first), one square
 * per day, coloured by how much happened that day. Pure logic, used by
 * components/integrations/ContribGraph for both GitHub and LeetCode.
 */

export interface DayCount {
  /** Local date, YYYY-MM-DD. */
  date: string;
  count: number;
}

export const dayCountSchema = z.object({
  date: z.string().refine(isValidISODate, 'Invalid date'),
  count: z.number().int().min(0),
});

export type Level = 0 | 1 | 2 | 3 | 4;

export interface GraphCell {
  date: string;
  count: number;
  level: Level;
  /** Before the data starts: drawn as an empty outline (unknown, not zero). */
  noData: boolean;
}

export interface GraphData {
  /** Columns of 7 cells (Mon…Sun). null = after the end date (not drawn). */
  weeks: (GraphCell | null)[][];
  /** Column index where each month label goes. */
  months: { col: number; label: string }[];
}

/** Adds up counts per date and drops anything malformed. */
export function countsByDate(days: DayCount[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const d of days) {
    if (!isValidISODate(d.date) || !Number.isFinite(d.count) || d.count <= 0) continue;
    map.set(d.date, (map.get(d.date) ?? 0) + Math.round(d.count));
  }
  return map;
}

/**
 * Count that maps to the darkest square. Uses the 90th percentile of active
 * days (so one huge day doesn't wash everything else out), at least 4 –
 * so 1, 2, 3, 4+ map straight to levels 1–4 for light activity.
 */
export function levelScale(counts: number[]): number {
  const active = counts.filter((c) => c > 0).sort((a, b) => a - b);
  if (active.length === 0) return 4;
  const p90 = active[Math.min(active.length - 1, Math.floor(active.length * 0.9))];
  return Math.max(4, p90);
}

export function levelFor(count: number, scale: number): Level {
  if (!(count > 0)) return 0;
  return Math.min(4, Math.max(1, Math.ceil((4 * count) / scale))) as Level;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Builds `weeks` columns ending with the week that contains `endDate`.
 * Days after `endDate` are null; days before `from` (when given) are marked noData.
 */
export function buildGraph(days: DayCount[], endDate: string, weeks: number, from?: string): GraphData {
  const counts = countsByDate(days);
  const scale = levelScale([...counts.values()]);
  const first = addDays(startOfWeek(endDate), -7 * (Math.max(1, weeks) - 1));
  const cols: (GraphCell | null)[][] = [];
  for (let c = 0; c < Math.max(1, weeks); c++) {
    const col: (GraphCell | null)[] = [];
    for (let r = 0; r < 7; r++) {
      const date = addDays(first, c * 7 + r);
      if (date > endDate) {
        col.push(null);
        continue;
      }
      const count = counts.get(date) ?? 0;
      col.push({ date, count, level: levelFor(count, scale), noData: !!from && date < from });
    }
    cols.push(col);
  }

  // A label where a new month starts; drop one that would collide with the next.
  const candidates: { col: number; label: string }[] = [];
  let prevMonth = -1;
  cols.forEach((col, i) => {
    const m = parseISODate(col[0]!.date).getMonth();
    if (m !== prevMonth) candidates.push({ col: i, label: MONTHS[m] });
    prevMonth = m;
  });
  const months = candidates.filter((m, i) => {
    const next = candidates[i + 1];
    return !next || next.col - m.col >= 3;
  });
  return { weeks: cols, months };
}

export interface ActivitySummary {
  total: number;
  activeDays: number;
  /** Days in a row with activity, ending today (or yesterday while today is still open). */
  currentStreak: number;
  longestStreak: number;
  today: number;
}

/** Totals and streaks. Today without activity yet doesn't break the streak – the day isn't over. */
export function activitySummary(days: DayCount[], today: string): ActivitySummary {
  const counts = countsByDate(days.filter((d) => d.date <= today));
  const dates = [...counts.keys()].sort();
  let total = 0;
  for (const c of counts.values()) total += c;

  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of dates) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  let current = 0;
  let cursor = counts.has(today) ? today : addDays(today, -1);
  while (counts.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { total, activeDays: dates.length, currentStreak: current, longestStreak: longest, today: counts.get(today) ?? 0 };
}

/** "1 contribution", "3 contributions" */
export function plural(n: number, unit: [string, string]): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? unit[0] : unit[1]}`;
}
