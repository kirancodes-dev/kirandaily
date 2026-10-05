import { describe, expect, it } from 'vitest';
import {
  BADGE_DEFS,
  EMPTY_TOTALS,
  buildHeatmap,
  celebrationKey,
  computeActivity,
  computeBadges,
  dayFlags,
  heatCellLabel,
  heatLevel,
  heatmapColumns,
  heatmapMonthLabels,
  isPerfectDay,
  levelFromXp,
  levelTitle,
  nextCelebration,
  parseCelebrated,
  xpForLevel,
  xpFromTotals,
  type BadgeFacts,
} from './gamification';
import { createDefaultData } from '../data/defaultData';
import { buildStatsContext, getDayTasks } from './calculations';
import { setCompleted, setSkipped } from './taskActions';
import { eachDate } from './date';
import type { AppData } from '../types/app';

const MON = '2026-10-05'; // plan start

function complete(data: AppData, date: string, titles: string[] | number): AppData {
  const tasks = getDayTasks(buildStatsContext(data), date);
  const pick = typeof titles === 'number' ? tasks.slice(0, titles) : tasks.filter((t) => titles.includes(t.title));
  for (const t of pick) data = setCompleted(data, t, true);
  return data;
}

describe('XP', () => {
  it('follows the rules: tasks, priority, study, streak, perfect, DSA, German', () => {
    expect(xpFromTotals(EMPTY_TOTALS).total).toBe(0);
    const xp = xpFromTotals({
      tasksCompleted: 3, // 30
      highPriorityCompleted: 1, // 5
      studyMinutes: 91, // 45
      streakDays: 2, // 40
      perfectDays: 1, // 30
      dsaProblems: 4, // 8
      germanWords: 23, // 4
    });
    expect(xp).toEqual({ tasks: 30, priority: 5, study: 45, streak: 40, perfect: 30, dsa: 8, german: 4, total: 162 });
  });

  it('never goes negative', () => {
    expect(xpFromTotals({ ...EMPTY_TOTALS, dsaProblems: -3, germanWords: -10 }).total).toBe(0);
  });

  it('is earned only from real completions', () => {
    let data = createDefaultData();
    const zero = computeActivity(buildStatsContext(data), MON);
    expect(zero.xp.total).toBe(0);
    expect(zero.level.level).toBe(1);

    data = complete(data, MON, ['Gym', 'Java']); // 2 tasks, both high priority, Java = 90 study min
    const a = computeActivity(buildStatsContext(data), MON);
    expect(a.xp).toMatchObject({ tasks: 20, priority: 10, study: 45, streak: 0, perfect: 0, total: 75 });
    expect(a.todayXp.total).toBe(75);
    expect(a.totals.tasksCompleted).toBe(2);
    expect(a.totals.studyMinutes).toBe(90);
    expect(a.totals.gymDays).toBe(1);
  });

  it('adds streak-day and perfect-day bonuses', () => {
    const data = complete(createDefaultData(), MON, 12); // all 12 Monday tasks
    const a = computeActivity(buildStatsContext(data), MON);
    // 120 tasks + 15 (gym, college subject, Java) + 105 study (210 min) + 20 streak + 30 perfect
    expect(a.xp).toMatchObject({ tasks: 120, priority: 15, study: 105, streak: 20, perfect: 30, total: 290 });
    expect(a.level).toMatchObject({ level: 2, xpIntoLevel: 190, xpForNext: 200, xpToNext: 10 });
  });

  it('separates today’s XP from earlier days', () => {
    let data = complete(createDefaultData(), MON, 12);
    data = complete(data, '2026-10-06', ['Gym']);
    const a = computeActivity(buildStatsContext(data), '2026-10-06');
    expect(a.xp.total).toBe(290 + 15);
    expect(a.todayXp).toMatchObject({ tasks: 10, priority: 5, total: 15 });
  });

  it('ignores future days and logs, and days before the plan', () => {
    let data = complete(createDefaultData(), '2026-10-07', ['Gym', 'Java']);
    data = {
      ...data,
      problemLogs: [
        { id: 'p1', date: MON, topicId: 'x', count: 3 },
        { id: 'p2', date: '2026-10-09', topicId: 'x', count: 50 },
      ],
      germanLogs: [{ id: 'g1', date: '2026-10-09', words: 500, lessons: 1 }],
    };
    const a = computeActivity(buildStatsContext(data), '2026-10-06');
    expect(a.xp.total).toBe(6); // only the 3 problems on Monday
    expect(a.totals.dsaProblems).toBe(3);
    expect(a.totals.germanWords).toBe(0);
    expect(computeActivity(buildStatsContext(data), '2026-10-01').days).toEqual([]);
  });

  it('counts DSA and German logs for today, with corrections', () => {
    const data: AppData = {
      ...createDefaultData(),
      problemLogs: [
        { id: 'p1', date: MON, topicId: 'x', count: 2 },
        { id: 'p2', date: MON, topicId: 'x', count: -1 },
      ],
      germanLogs: [{ id: 'g1', date: MON, words: 12, lessons: 0 }],
    };
    const a = computeActivity(buildStatsContext(data), MON);
    expect(a.todayXp).toMatchObject({ dsa: 2, german: 2, total: 4 });
  });
});

describe('levels', () => {
  it('needs 100·n·(n+1)/2 XP for level n+1', () => {
    expect([1, 2, 3, 4, 5, 10].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000, 4500]);
  });

  it('turns XP into a level with progress', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, title: 'Beginner', xp: 0, xpIntoLevel: 0, xpForNext: 100, xpToNext: 100, pct: 0 });
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100)).toMatchObject({ level: 2, xpIntoLevel: 0, xpForNext: 200 });
    expect(levelFromXp(450)).toMatchObject({ level: 3, xpIntoLevel: 150, xpForNext: 300, pct: 50 });
    expect(levelFromXp(4500).level).toBe(10);
    expect(levelFromXp(4499).level).toBe(9);
    expect(levelFromXp(-5).level).toBe(1);
    expect(levelFromXp(Number.NaN).level).toBe(1);
  });

  it('is exact at every boundary', () => {
    for (let l = 1; l <= 80; l++) {
      expect(levelFromXp(xpForLevel(l)).level).toBe(l);
      if (l > 1) expect(levelFromXp(xpForLevel(l) - 1).level).toBe(l - 1);
    }
  });

  it('has a title per level band', () => {
    expect([1, 4, 5, 9, 10, 19, 20, 34, 35, 99].map(levelTitle)).toEqual([
      'Beginner', 'Beginner', 'Consistent', 'Consistent', 'Focused', 'Focused', 'Unstoppable', 'Unstoppable', 'Legend', 'Legend',
    ]);
  });
});

describe('badges', () => {
  const none: BadgeFacts = {
    tasksCompleted: 0,
    bestStreak: 0,
    gymDays: 0,
    studyMinutes: 0,
    dsaProblems: 0,
    javaPhase1: { done: 0, total: 6 },
    germanA1: { done: 0, total: 16 },
    perfectDays: 0,
    bestRun: 0,
    wakeDays: 0,
  };

  it('has about 14+ badges with unique ids, all locked at the start', () => {
    expect(BADGE_DEFS.length).toBeGreaterThanOrEqual(14);
    expect(new Set(BADGE_DEFS.map((b) => b.id)).size).toBe(BADGE_DEFS.length);
    const badges = computeBadges(none);
    expect(badges.every((b) => !b.unlocked)).toBe(true);
    expect(badges.find((b) => b.id === 'first-tick')?.progressLabel).toBe('0/1');
    expect(badges.find((b) => b.id === 'java-phase-1')?.progressLabel).toBe('0/6');
  });

  it('unlocks at the target and shows progress as text', () => {
    const badges = computeBadges({ ...none, tasksCompleted: 1, gymDays: 4, studyMinutes: 125, bestStreak: 8, dsaProblems: 120, bestRun: 7 });
    const by = (id: string) => badges.find((b) => b.id === id)!;
    expect(by('first-tick').unlocked).toBe(true);
    expect(by('gym-7')).toMatchObject({ unlocked: false, progressLabel: '4/7' });
    expect(by('study-10')).toMatchObject({ unlocked: false, progressLabel: '2/10 h' });
    expect(by('streak-7').unlocked).toBe(true);
    expect(by('streak-30').progressLabel).toBe('8/30');
    expect(by('dsa-100')).toMatchObject({ unlocked: true, progressLabel: '100/100' });
    expect(by('perfect-week').unlocked).toBe(true);
  });

  it('shows fractional study hours, rounded down', () => {
    const b = computeBadges({ ...none, studyMinutes: 90 }).find((x) => x.id === 'study-10')!;
    expect(b.progressLabel).toBe('1.5/10 h');
  });

  it('comes from real data: first tick, gym, early bird, perfect day, roadmaps', () => {
    let data = createDefaultData();
    for (const d of eachDate(MON, '2026-10-11')) data = complete(data, d, ['Wake up', 'Gym']);
    data = complete(data, MON, 12);
    const phase1 = data.roadmaps.java.sections[0];
    data = {
      ...data,
      roadmaps: {
        ...data.roadmaps,
        java: { ...data.roadmaps.java, sections: [{ ...phase1, topics: phase1.topics.map((t) => ({ ...t, status: 'completed' as const })) }, ...data.roadmaps.java.sections.slice(1)] },
      },
    };
    const a = computeActivity(buildStatsContext(data), '2026-10-11');
    const by = (id: string) => a.badges.find((b) => b.id === id)!;
    expect(by('first-tick').unlocked).toBe(true);
    expect(by('gym-7').unlocked).toBe(true);
    expect(by('early-bird').unlocked).toBe(true);
    expect(by('perfect-day').unlocked).toBe(true);
    expect(by('java-phase-1').unlocked).toBe(true);
    expect(by('german-a1').unlocked).toBe(false);
    expect(by('streak-3').unlocked).toBe(false);
  });

  it('perfect week needs 7 Day-streak days in a row', () => {
    let data = createDefaultData();
    const days = eachDate(MON, '2026-10-12');
    for (const d of days) {
      if (d === '2026-10-08') continue; // a miss in the middle
      const n = getDayTasks(buildStatsContext(data), d).length;
      data = complete(data, d, n);
    }
    let a = computeActivity(buildStatsContext(data), '2026-10-12');
    expect(a.totals.bestRun).toBe(4); // Fri 9 … Mon 12
    expect(a.badges.find((b) => b.id === 'perfect-week')!.unlocked).toBe(false);
    data = complete(data, '2026-10-08', 20);
    a = computeActivity(buildStatsContext(data), '2026-10-12');
    expect(a.totals.bestRun).toBe(8);
    expect(a.badges.find((b) => b.id === 'perfect-week')!.unlocked).toBe(true);
    expect(a.streak.longest).toBe(8);
  });

  it('special days and today-not-done-yet don’t break a run', () => {
    let data = createDefaultData();
    for (const d of eachDate(MON, '2026-10-07')) data = complete(data, d, 20);
    data = { ...data, dayLogs: [{ date: '2026-10-08', special: { kind: 'birthday', note: '' } }] };
    for (const d of eachDate('2026-10-09', '2026-10-11')) data = complete(data, d, 20);
    const a = computeActivity(buildStatsContext(data), '2026-10-12');
    expect(a.totals.bestRun).toBe(6);
  });
});

describe('activity graph', () => {
  it('maps completion to GitHub-like green levels', () => {
    expect(heatLevel({ total: 0, skipped: 0, completed: 0 })).toBe(0);
    expect(heatLevel({ total: 10, skipped: 0, completed: 0 })).toBe(0);
    expect(heatLevel({ total: 10, skipped: 0, completed: 3 })).toBe(1);
    expect(heatLevel({ total: 10, skipped: 0, completed: 4 })).toBe(2);
    expect(heatLevel({ total: 10, skipped: 0, completed: 6 })).toBe(3);
    expect(heatLevel({ total: 10, skipped: 0, completed: 7 })).toBe(3);
    expect(heatLevel({ total: 10, skipped: 0, completed: 8 })).toBe(4);
    expect(heatLevel({ total: 12, skipped: 2, completed: 8 })).toBe(4);
    // 79.x % rounds to 80 % but is not a streak day.
    expect(heatLevel({ total: 39, skipped: 0, completed: 31 })).toBe(3);
  });

  it('labels each day in words', () => {
    expect(heatCellLabel('2026-10-05', { completionPct: 83, studyMinutes: 180 })).toBe('Mon, Oct 5: 83% done, 3 h study');
    expect(heatCellLabel('2026-10-06', { completionPct: 17, studyMinutes: 90 })).toBe('Tue, Oct 6: 17% done, 1.5 h study');
    expect(heatCellLabel('2026-10-04', { completionPct: null, studyMinutes: 0 })).toBe('Sun, Oct 4: no tasks, 0 h study');
  });

  it('lays out 52 Monday-first weeks ending this week', () => {
    const cols = heatmapColumns('2026-10-07');
    expect(cols).toHaveLength(52);
    expect(cols.every((c) => c.length === 7)).toBe(true);
    expect(cols[51][0]).toBe('2026-10-05');
    expect(cols[51][6]).toBe('2026-10-11');
    expect(cols[0][0]).toBe('2025-10-13');
    expect(new Set(cols.flat()).size).toBe(364);
  });

  it('puts month names above the first week of each month', () => {
    const labels = heatmapMonthLabels(heatmapColumns('2026-10-07')); // first week: Mon 13 Oct 2025
    expect(labels[0]).toEqual({ col: 0, label: 'Oct' });
    expect(labels[1]).toEqual({ col: 3, label: 'Nov' }); // Mon 3 Nov 2025
    expect(labels.at(-1)).toEqual({ col: 51, label: 'Oct' });
    expect(labels.map((l) => l.label)).toEqual(['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']);
    // A first label that would sit right next to the second one is dropped.
    const tight = heatmapMonthLabels(heatmapColumns('2026-10-21')); // first week: Mon 27 Oct 2025
    expect(tight[0]).toEqual({ col: 1, label: 'Nov' });
  });

  it('builds cells from real data; days before the plan and future days are empty', () => {
    let data = complete(createDefaultData(), MON, 10); // 10/12 = 83 % → streak day
    data = complete(data, '2026-10-06', ['Gym']);
    const hm = buildHeatmap(buildStatsContext(data), '2026-10-07');
    const cell = (d: string) => hm.columns.flat().find((c) => c.date === d)!;
    expect(cell('2026-10-04')).toMatchObject({ kind: 'before', label: '' });
    expect(cell('2026-10-05')).toMatchObject({ kind: 'day', level: 4, label: 'Mon, Oct 5: 83% done, 3 h study' });
    expect(cell('2026-10-06')).toMatchObject({ kind: 'day', level: 1 });
    expect(cell('2026-10-07')).toMatchObject({ kind: 'day', level: 0, isToday: true });
    expect(cell('2026-10-08')).toMatchObject({ kind: 'future' });
    expect(hm.streakDays).toBe(1);
    expect(hm.activeDays).toBe(2);
  });

  it('never shows a ticked future day', () => {
    const data = complete(createDefaultData(), '2026-10-09', 12);
    const hm = buildHeatmap(buildStatsContext(data), '2026-10-07');
    expect(hm.streakDays).toBe(0);
    expect(hm.columns.flat().find((c) => c.date === '2026-10-09')!.kind).toBe('future');
  });
});

describe('celebration', () => {
  it('fires once when the day crosses 80 %, and again at 100 %', () => {
    const none = { streak: false, perfect: false };
    const streak = { streak: true, perfect: false };
    const perfect = { streak: true, perfect: true };
    expect(nextCelebration(none, streak, null)).toBe('streak');
    expect(nextCelebration(streak, perfect, 'streak')).toBe('perfect');
    expect(nextCelebration(none, perfect, null)).toBe('perfect');
    // Already shown today.
    expect(nextCelebration(none, streak, 'streak')).toBeNull();
    expect(nextCelebration(none, perfect, 'perfect')).toBeNull();
    expect(nextCelebration(none, streak, 'perfect')).toBeNull();
    // No change since the last check: no party.
    expect(nextCelebration(streak, streak, null)).toBeNull();
    expect(nextCelebration(perfect, perfect, null)).toBeNull();
  });

  it('reads the per-day flags and storage', () => {
    expect(dayFlags({ total: 12, skipped: 0, completed: 10 })).toEqual({ streak: true, perfect: false });
    expect(dayFlags({ total: 12, skipped: 2, completed: 10 })).toEqual({ streak: true, perfect: true });
    expect(isPerfectDay({ total: 0, skipped: 0, completed: 0 })).toBe(false);
    expect(celebrationKey('2026-10-05')).toBe('kiran-planner:ui:celebrated:2026-10-05');
    expect(parseCelebrated('streak')).toBe('streak');
    expect(parseCelebrated('perfect')).toBe('perfect');
    expect(parseCelebrated('junk')).toBeNull();
    expect(parseCelebrated(null)).toBeNull();
  });

  it('skipped tasks count as out of the day', () => {
    let data = createDefaultData();
    const tasks = getDayTasks(buildStatsContext(data), MON);
    data = setSkipped(data, tasks[0], true);
    data = complete(data, MON, tasks.slice(1).map((t) => t.title));
    const a = computeActivity(buildStatsContext(data), MON);
    expect(a.totals.perfectDays).toBe(1);
  });
});
