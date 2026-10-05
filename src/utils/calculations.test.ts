import { describe, expect, it } from 'vitest';
import { createDefaultData } from '../data/defaultData';
import type { AppData } from '../types/app';
import {
  buildStatsContext,
  calculateCgpa,
  dayStats,
  dsaProblemStats,
  getDayTasks,
  rangeSummary,
  roadmapProgress,
  studyByCategory,
  studyMinutesOnDate,
  subjectProgress,
  weeklyStudySeries,
  monthlyStudySeries,
} from './calculations';
import { monthDates, weekDates } from './date';
import { setCompleted, setSkipped } from './taskActions';

function completeAll(data: AppData, date: string, filter: (title: string) => boolean): AppData {
  let next = data;
  for (const t of getDayTasks(buildStatsContext(data), date)) if (filter(t.title)) next = setCompleted(next, t, true);
  return next;
}

describe('calculations', () => {
  it('starts with zero progress (no fake statistics)', () => {
    const data = createDefaultData();
    const ctx = buildStatsContext(data);
    const s = dayStats(ctx, '2026-10-05');
    expect(s.completionPct).toBe(0);
    expect(s.studyMinutes).toBe(0);
    expect(s.targetMinutes).toBe(240);
    expect(s.gymDone).toBe(false);
    expect(dayStats(ctx, '2026-10-10').targetMinutes).toBe(480);
    expect(roadmapProgress(data.roadmaps.java).pct).toBe(0);
    expect(data.sessions).toHaveLength(0);
  });

  it('counts completed study tasks and sessions without double counting', () => {
    let data = completeAll(createDefaultData(), '2026-10-05', (t) => t === 'Java' || t === 'Gym');
    const java = getDayTasks(buildStatsContext(data), '2026-10-05').find((t) => t.title === 'Java')!;
    expect(studyMinutesOnDate(buildStatsContext(data), '2026-10-05')).toBe(90);
    // A timer session linked to the Java task replaces its planned 90 min with 100 actual minutes.
    data = {
      ...data,
      sessions: [
        { id: 's1', date: '2026-10-05', category: 'java', topic: 'Loops', minutes: 100, startedAt: '', source: 'timer', taskId: java.id },
        { id: 's2', date: '2026-10-05', category: 'german', topic: 'Numbers', minutes: 20, startedAt: '', source: 'manual' },
      ],
    };
    const ctx = buildStatsContext(data);
    expect(studyMinutesOnDate(ctx, '2026-10-05')).toBe(120);
    const s = dayStats(ctx, '2026-10-05');
    expect(s.gymDone).toBe(true);
    expect(s.completed).toBe(2);
    expect(s.completionPct).toBe(Math.round((2 / 12) * 100));
  });

  it('excludes skipped tasks from completion', () => {
    let data = createDefaultData();
    const tasks = getDayTasks(buildStatsContext(data), '2026-10-05');
    for (const t of tasks.slice(0, 6)) data = setSkipped(data, t, true);
    for (const t of tasks.slice(6, 9)) data = setCompleted(data, t, true);
    expect(dayStats(buildStatsContext(data), '2026-10-05').completionPct).toBe(50);
  });

  it('summarises a week and a month', () => {
    let data = createDefaultData();
    for (const d of weekDates('2026-10-05')) data = completeAll(data, d, (t) => t === 'Gym');
    data = completeAll(data, '2026-10-10', (t) => ['Java', 'DSA', 'German'].includes(t)); // Sat: 2×Java 1h, 2×DSA 1h, German 1h
    const ctx = buildStatsContext(data);
    const week = rangeSummary(ctx, weekDates('2026-10-05'), '2026-10-11');
    expect(week.gymDays).toBe(7);
    expect(week.gymPlannedDays).toBe(7);
    expect(week.studyMinutes).toBe(300);
    expect(week.targetMinutes).toBe(5 * 240 + 2 * 480);
    expect(week.tasksCompleted).toBe(12);
    // Future days do not count yet.
    const partial = rangeSummary(ctx, weekDates('2026-10-05'), '2026-10-07');
    expect(partial.daysCounted).toBe(3);
    expect(partial.gymDays).toBe(3);
    const month = rangeSummary(ctx, monthDates(2026, 10), '2026-10-31');
    expect(month.daysCounted).toBe(31);
    expect(month.gymPlannedDays).toBe(27); // Oct 5 – 31
    expect(month.gymDays).toBe(7);
    const cats = studyByCategory(ctx, monthDates(2026, 10));
    expect(cats.get('java')).toBe(120);
    expect(cats.get('german')).toBe(60);
  });

  it('builds chart series that start at the plan, not before', () => {
    let data = completeAll(createDefaultData(), '2026-10-05', (t) => t === 'Java' || t === 'Gym');
    data = completeAll(data, '2026-10-12', (t) => t === 'Gym');
    const ctx = buildStatsContext(data);
    const weekly = weeklyStudySeries(ctx, '2026-10-14');
    expect(weekly.map((w) => w.weekStart)).toEqual(['2026-10-05', '2026-10-12']);
    expect(weekly[0]).toMatchObject({ hours: 1.5, target: 36, gymDays: 1 });
    expect(weekly[1]).toMatchObject({ hours: 0, gymDays: 1 });
    expect(monthlyStudySeries(ctx, '2026-11-03')).toEqual([
      { key: '2026-10', label: 'Oct', hours: 1.5 },
      { key: '2026-11', label: 'Nov', hours: 0 },
    ]);
  });

  it('computes subject, DSA and CGPA figures', () => {
    const data = createDefaultData();
    const subject = { ...data.subjects[0], assignmentStatus: 'completed' as const, topics: [{ id: 'a', title: 'x', done: true }, { id: 'b', title: 'y', done: false }] };
    expect(subjectProgress(subject)).toBe(Math.round(((1 + 0 + 0 + 0.5) / 4) * 100));
    const dsa = dsaProblemStats(
      {
        problemLogs: [
          { id: '1', date: '2026-10-05', topicId: 'a', count: 3 },
          { id: '2', date: '2026-10-07', topicId: 'a', count: 2 },
          { id: '3', date: '2026-10-12', topicId: 'b', count: 1 },
        ],
      },
      '2026-10-07',
    );
    expect(dsa).toMatchObject({ today: 2, week: 5, total: 6 });
    expect(calculateCgpa(data.cgpa)).toMatchObject({ cgpa: 8, fromSemesters: false });
    const c = calculateCgpa({ current: 8, target: 8.5, totalSemesters: 8, semesters: [
      { id: '1', semester: 1, sgpa: 8 }, { id: '2', semester: 2, sgpa: 8.2 }, { id: '3', semester: 3, sgpa: 7.8 }, { id: '4', semester: 4, sgpa: 8 },
    ] });
    expect(c.cgpa).toBe(8);
    expect(c.requiredAverage).toBe(9);
    const w = calculateCgpa({ current: 8, target: 8.5, totalSemesters: 8, semesters: [
      { id: '1', semester: 1, sgpa: 9, credits: 20 }, { id: '2', semester: 2, sgpa: 7, credits: 10 },
    ] });
    expect(w.weighted).toBe(true);
    expect(w.cgpa).toBeCloseTo(8.33, 2);
  });
});
