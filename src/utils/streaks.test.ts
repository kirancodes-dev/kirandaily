import { describe, expect, it } from 'vitest';
import { computeStreak, isStreakDay, streakFor, tasksToStreakDay } from './streaks';
import { createDefaultData } from '../data/defaultData';
import { buildStatsContext, getDayTasks } from './calculations';
import { eachDate } from './date';
import { setCompleted } from './taskActions';
import type { AppData } from '../types/app';

describe('streaks', () => {
  it('forgives a single missed day but not two in a row', () => {
    expect(computeStreak(['hit', 'hit', 'miss', 'hit'])).toEqual({ current: 3, longest: 3 });
    expect(computeStreak(['hit', 'hit', 'miss', 'miss', 'hit'])).toEqual({ current: 1, longest: 2 });
    expect(computeStreak(['hit', 'neutral', 'hit', 'pending'])).toEqual({ current: 2, longest: 2 });
    expect(computeStreak([])).toEqual({ current: 0, longest: 0 });
  });

  it('counts the gym streak from real completions', () => {
    let data: AppData = createDefaultData();
    for (const d of eachDate('2026-10-05', '2026-10-09')) {
      const gym = getDayTasks(buildStatsContext(data), d).find((t) => t.category === 'gym')!;
      if (d !== '2026-10-07') data = setCompleted(data, gym, true);
    }
    // Today (10th) not done yet → pending, does not break the streak.
    const s = streakFor(buildStatsContext(data), 'gym', '2026-10-10');
    expect(s).toEqual({ current: 4, longest: 4 });
  });

  it('treats special days (birthdays) as neutral', () => {
    let data: AppData = createDefaultData();
    for (const d of ['2026-10-05', '2026-10-08']) {
      const gym = getDayTasks(buildStatsContext(data), d).find((t) => t.category === 'gym')!;
      data = setCompleted(data, gym, true);
    }
    data = {
      ...data,
      dayLogs: [
        { date: '2026-10-06', special: { kind: 'birthday', note: '' } },
        { date: '2026-10-07', special: { kind: 'party', note: '' } },
      ],
    };
    expect(streakFor(buildStatsContext(data), 'gym', '2026-10-08').current).toBe(2);
  });

  it('counts a Day-streak day only at 80 % or more of the tasks', () => {
    expect(isStreakDay({ total: 12, skipped: 0, completed: 9 })).toBe(false); // 75 %
    expect(isStreakDay({ total: 12, skipped: 0, completed: 10 })).toBe(true); // 83 %
    expect(isStreakDay({ total: 10, skipped: 0, completed: 8 })).toBe(true); // exactly 80 %
    expect(isStreakDay({ total: 12, skipped: 2, completed: 8 })).toBe(true); // skipped tasks don't count
    expect(isStreakDay({ total: 0, skipped: 0, completed: 0 })).toBe(false);
    expect(tasksToStreakDay({ total: 12, skipped: 0, completed: 4 })).toBe(6);
    expect(tasksToStreakDay({ total: 10, skipped: 0, completed: 7 })).toBe(1);
    expect(tasksToStreakDay({ total: 10, skipped: 0, completed: 9 })).toBe(0);
  });

  it('builds the Day streak from 80 % days', () => {
    let data: AppData = createDefaultData();
    const complete = (d: string, n: number) => {
      for (const t of getDayTasks(buildStatsContext(data), d).slice(0, n)) data = setCompleted(data, t, true);
    };
    complete('2026-10-05', 10); // 10/12 → counts
    complete('2026-10-06', 12); // 12/12 → counts
    complete('2026-10-07', 9); // 9/12 = 75 % → grace day
    complete('2026-10-08', 11); // counts
    expect(streakFor(buildStatsContext(data), 'overall', '2026-10-09')).toEqual({ current: 3, longest: 3 });
    complete('2026-10-09', 3); // today, not there yet → pending, streak unchanged
    expect(streakFor(buildStatsContext(data), 'overall', '2026-10-09').current).toBe(3);
  });
});
