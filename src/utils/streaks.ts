import { eachDate } from './date';
import { scheduleConfig } from '../config/schedule';
import { dayStats, getDayTasks, studyByCategoryOnDate, type DayStats, type StatsContext } from './calculations';

/**
 * hit     – the habit was done that day
 * miss    – planned but not done
 * neutral – nothing planned, or a special day (birthday/party/outing)
 * pending – today, not done yet (never breaks a streak)
 */
export type DayMark = 'hit' | 'miss' | 'neutral' | 'pending';

export interface StreakResult {
  current: number;
  longest: number;
}

/**
 * Forgiving streak: a single missed day is a "grace day" and does not break
 * the streak (it just doesn't add to it). Two misses in a row reset it.
 * Marks must be in chronological order.
 */
export function computeStreak(marks: DayMark[]): StreakResult {
  let current = 0;
  let longest = 0;
  let missRun = 0;
  for (const mark of marks) {
    if (mark === 'hit') {
      current++;
      missRun = 0;
      longest = Math.max(longest, current);
    } else if (mark === 'miss') {
      missRun++;
      if (missRun >= 2) current = 0;
    }
  }
  return { current, longest };
}

export type StreakKind = 'gym' | 'study' | 'java' | 'dsa' | 'german' | 'overall';

export const STREAK_LABELS: Record<StreakKind, string> = {
  gym: 'Gym',
  study: 'Study',
  java: 'Java',
  dsa: 'DSA',
  german: 'German',
  overall: 'Day streak',
};

export const STREAK_RULES: Record<StreakKind, string> = {
  gym: 'Gym task completed',
  study: 'At least half of the day’s study target',
  java: 'Any Java study on days it is planned',
  dsa: 'Any DSA study or problem on days it is planned',
  german: 'Any German study on days it is planned',
  overall: `${scheduleConfig.streakDayThreshold}%+ of the day’s tasks done`,
};

/** Tasks that count for the day (skipped tasks are left out). */
function countable(stats: Pick<DayStats, 'total' | 'skipped'>): number {
  return stats.total - stats.skipped;
}

/** A day with at least `threshold` % of its tasks completed counts as one Day-streak day. */
export function isStreakDay(
  stats: Pick<DayStats, 'total' | 'skipped' | 'completed'>,
  threshold = scheduleConfig.streakDayThreshold,
): boolean {
  const n = countable(stats);
  return n > 0 && stats.completed / n >= threshold / 100;
}

/** How many more tasks must be completed for the day to count (0 when it already does). */
export function tasksToStreakDay(
  stats: Pick<DayStats, 'total' | 'skipped' | 'completed'>,
  threshold = scheduleConfig.streakDayThreshold,
): number {
  const n = countable(stats);
  if (n <= 0) return 0;
  return Math.max(0, Math.ceil((n * threshold) / 100 - 1e-9) - stats.completed);
}

function markFor(ctx: StatsContext, kind: StreakKind, date: string, isToday: boolean): DayMark {
  const stats = dayStats(ctx, date);
  if (stats.special) return 'neutral';
  let planned: boolean;
  let done: boolean;
  switch (kind) {
    case 'gym':
      planned = stats.gymPlanned;
      done = stats.gymDone;
      break;
    case 'study':
      planned = stats.targetMinutes > 0;
      done = stats.studyMinutes >= stats.targetMinutes / 2;
      break;
    case 'overall':
      planned = stats.completionPct !== null;
      done = isStreakDay(stats);
      break;
    default: {
      const tasks = getDayTasks(ctx, date).filter((t) => t.category === kind && !t.skipped);
      planned = tasks.length > 0;
      const minutes = studyByCategoryOnDate(ctx, date).get(kind) ?? 0;
      const problems =
        kind === 'dsa' ? ctx.data.problemLogs.filter((l) => l.date === date).reduce((a, l) => a + l.count, 0) : 0;
      done = minutes > 0 || problems > 0;
    }
  }
  if (done) return 'hit';
  if (isToday) return 'pending';
  return planned ? 'miss' : 'neutral';
}

export function streakFor(ctx: StatsContext, kind: StreakKind, today: string): StreakResult {
  const start = ctx.data.settings.planStartDate;
  if (today < start) return { current: 0, longest: 0 };
  const dates = eachDate(start, today);
  return computeStreak(dates.map((d) => markFor(ctx, kind, d, d === today)));
}

export function allStreaks(ctx: StatsContext, today: string): Record<StreakKind, StreakResult> {
  const kinds: StreakKind[] = ['overall', 'gym', 'study', 'java', 'dsa', 'german'];
  return Object.fromEntries(kinds.map((k) => [k, streakFor(ctx, k, today)])) as Record<StreakKind, StreakResult>;
}

