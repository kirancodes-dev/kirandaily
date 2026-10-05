import { describe, expect, it } from 'vitest';
import { computeStreak, streakFor } from './streaks';
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
});
