import { describe, expect, it } from 'vitest';
import { createDefaultData } from '../data/defaultData';
import { buildScheduleIndex, tasksForDate, virtualTaskId } from './schedule';
import { durationMinutes } from './date';

const studyCats = new Set(['college', 'java', 'dsa', 'german', 'project', 'revision', 'test', 'other']);

function plannedStudy(date: string) {
  const data = createDefaultData();
  return tasksForDate(buildScheduleIndex(data), date)
    .filter((t) => studyCats.has(t.category))
    .reduce((s, t) => s + t.duration, 0);
}

describe('default schedule', () => {
  const data = createDefaultData();
  const index = buildScheduleIndex(data);

  it('starts on October 5, 2026 with nothing before it', () => {
    expect(tasksForDate(index, '2026-10-04')).toHaveLength(0);
    expect(tasksForDate(index, '2026-10-05').length).toBeGreaterThan(5);
  });

  it('has the Monday timeline in order', () => {
    const titles = tasksForDate(index, '2026-10-05').map((t) => `${t.startTime} ${t.title}`);
    expect(titles).toEqual([
      '05:00 Wake up',
      '05:30 Gym',
      '07:00 Bath + breakfast',
      '08:00 Get ready + travel',
      '09:00 College',
      '17:00 Travel + rest',
      '18:00 College subject',
      '19:00 Dinner',
      '19:30 Java',
      '21:00 German',
      '21:30 Revision',
      '22:00 Sleep',
    ]);
  });

  it('has gym every single day, including weekends and future months', () => {
    for (const d of ['2026-10-05', '2026-10-10', '2026-10-11', '2026-11-15', '2027-03-07']) {
      const gym = tasksForDate(index, d).filter((t) => t.category === 'gym');
      expect(gym, d).toHaveLength(1);
      expect(gym[0].startTime).toBe('05:30');
    }
  });

  it('plans about 4h on weekdays and at least 8h on weekends', () => {
    for (const d of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']) {
      expect(plannedStudy(d)).toBeGreaterThanOrEqual(210);
      expect(plannedStudy(d)).toBeLessThanOrEqual(240);
    }
    expect(plannedStudy('2026-10-10')).toBeGreaterThanOrEqual(480);
    expect(plannedStudy('2026-10-11')).toBeGreaterThanOrEqual(480);
  });

  it('uses DSA on Tuesday and Java + DSA on Friday', () => {
    const tue = tasksForDate(index, '2026-10-06').map((t) => t.title);
    expect(tue).toContain('DSA');
    expect(tue).not.toContain('Java');
    const fri = tasksForDate(index, '2026-10-09').map((t) => t.title);
    expect(fri).toEqual(expect.arrayContaining(['Java', 'DSA', 'Weekly review']));
  });

  it('rotates college subjects through all 9 subjects', () => {
    const subjects = new Set<string>();
    for (let i = 5; i <= 31; i++) {
      const d = `2026-10-${String(i).padStart(2, '0')}`;
      for (const t of tasksForDate(index, d)) if (t.subjectId) subjects.add(t.subjectId);
    }
    expect(subjects.size).toBe(9);
  });

  it('gives sleep a 7 hour duration', () => {
    const sleep = tasksForDate(index, '2026-10-05').find((t) => t.title === 'Sleep')!;
    expect(sleep.duration).toBe(420);
    expect(durationMinutes(sleep.startTime, sleep.endTime)).toBe(420);
  });

  it('replaces a template task with its stored override and honours exclusions', () => {
    const gymTpl = data.templates.find((t) => t.key === 'gym')!;
    const id = virtualTaskId(gymTpl.id, '2026-10-06');
    const moved = { ...tasksForDate(index, '2026-10-06').find((t) => t.id === id)!, date: '2026-10-07', startTime: '18:00', endTime: '19:00' };
    const javaTpl = data.templates.find((t) => t.title === 'German')!;
    const idx2 = buildScheduleIndex({ ...data, tasks: [moved], exclusions: [virtualTaskId(javaTpl.id, '2026-10-06')] });
    const tue = tasksForDate(idx2, '2026-10-06');
    expect(tue.some((t) => t.category === 'gym')).toBe(false);
    expect(tue.some((t) => t.title === 'German')).toBe(false);
    const wed = tasksForDate(idx2, '2026-10-07').filter((t) => t.category === 'gym');
    expect(wed).toHaveLength(2); // its own gym + the moved one
  });
});
