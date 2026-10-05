import { describe, expect, it } from 'vitest';
import { activitySummary, buildGraph, countsByDate, levelFor, levelScale, plural } from './contrib';
import { dayOfWeek } from '../date';

describe('contribution graph', () => {
  it('builds Monday-first week columns ending with the current week', () => {
    // 2026-10-05 is a Monday.
    const g = buildGraph([{ date: '2026-10-05', count: 2 }], '2026-10-07', 53);
    expect(g.weeks).toHaveLength(53);
    for (const col of g.weeks) expect(col).toHaveLength(7);
    expect(dayOfWeek(g.weeks[0][0]!.date)).toBe(1);
    const last = g.weeks[52];
    expect(last.map((c) => c?.date ?? null)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', null, null, null, null]);
    expect(last[0]).toMatchObject({ count: 2, level: 2, noData: false });
    expect(last[1]).toMatchObject({ count: 0, level: 0 });
    expect(g.weeks[0][0]!.date).toBe('2025-10-06');
  });

  it('marks days before the data starts as unknown, not zero', () => {
    const g = buildGraph([], '2026-10-05', 2, '2026-10-01');
    expect(g.weeks[0].map((c) => c!.noData)).toEqual([true, true, true, false, false, false, false]);
  });

  it('marks days after an older copy of the data as unknown too', () => {
    const g = buildGraph([{ date: '2026-10-03', count: 2 }], '2026-10-05', 2, undefined, '2026-10-03');
    // Mon Sep 28 – Sun Oct 4, then Mon Oct 5 (today).
    expect(g.weeks[0].map((c) => c!.noData)).toEqual([false, false, false, false, false, false, true]);
    expect(g.weeks[0][5]).toMatchObject({ date: '2026-10-03', count: 2, noData: false });
    expect(g.weeks[1][0]).toMatchObject({ date: '2026-10-05', noData: true });
  });

  it('labels months where they start, without crowding', () => {
    const g = buildGraph([], '2026-10-05', 53);
    const labels = g.months.map((m) => m.label);
    expect(labels.slice(-3)).toEqual(['Aug', 'Sep', 'Oct']);
    for (let i = 1; i < g.months.length; i++) expect(g.months[i].col - g.months[i - 1].col).toBeGreaterThanOrEqual(3);
    // Each label sits on the first week whose Monday is in that month.
    const oct = g.months[g.months.length - 1];
    expect(oct).toEqual({ col: 52, label: 'Oct' });
    expect(g.weeks[oct.col][0]!.date.slice(5, 7)).toBe('10');
    expect(g.weeks[oct.col - 1][0]!.date.slice(5, 7)).toBe('09');
  });

  it('maps small counts straight to levels and keeps big outliers from washing out the rest', () => {
    expect(levelScale([])).toBe(4);
    expect([0, 1, 2, 3, 4, 9].map((c) => levelFor(c, levelScale([1, 2, 3])))).toEqual([0, 1, 2, 3, 4, 4]);
    const busy = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 200];
    const scale = levelScale(busy);
    expect(scale).toBe(20); // 90th percentile, not the 200 outlier
    expect(levelFor(20, scale)).toBe(4);
    expect(levelFor(10, scale)).toBe(2);
    expect(levelFor(1, scale)).toBe(1);
  });

  it('adds up duplicate dates and ignores junk', () => {
    const m = countsByDate([
      { date: '2026-10-05', count: 1 },
      { date: '2026-10-05', count: 2 },
      { date: '2026-02-30', count: 4 },
      { date: '2026-10-04', count: -1 },
      { date: '2026-10-03', count: Number.NaN },
    ]);
    expect([...m.entries()]).toEqual([['2026-10-05', 3]]);
  });
});

describe('activity summary', () => {
  const days = (dates: string[]) => dates.map((date) => ({ date, count: 1 }));

  it('counts the current streak up to today, or yesterday while today is still open', () => {
    expect(activitySummary(days(['2026-10-03', '2026-10-04', '2026-10-05']), '2026-10-05')).toMatchObject({ currentStreak: 3, today: 1 });
    // Nothing yet today: the streak isn't broken until the day is over.
    expect(activitySummary(days(['2026-10-03', '2026-10-04']), '2026-10-05')).toMatchObject({ currentStreak: 2, today: 0 });
    expect(activitySummary(days(['2026-10-02', '2026-10-03']), '2026-10-05').currentStreak).toBe(0);
  });

  it('finds the longest streak, active days and total; future dates are ignored', () => {
    const s = activitySummary(
      [
        ...days(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-20', '2026-10-05']),
        { date: '2026-09-20', count: 4 },
        { date: '2026-10-09', count: 9 },
      ],
      '2026-10-05',
    );
    expect(s).toEqual({ total: 10, activeDays: 6, currentStreak: 1, longestStreak: 4, today: 1 });
    expect(activitySummary([], '2026-10-05')).toEqual({ total: 0, activeDays: 0, currentStreak: 0, longestStreak: 0, today: 0 });
  });

  it('pluralises with thousands separators', () => {
    expect(plural(1, ['day', 'days'])).toBe('1 day');
    expect(plural(0, ['day', 'days'])).toBe('0 days');
    expect(plural(1234, ['contribution', 'contributions'])).toBe('1,234 contributions');
  });
});
