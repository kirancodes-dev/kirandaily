import { describe, expect, it } from 'vitest';
import { createDefaultData } from '../data/defaultData';
import { buildScheduleIndex, tasksForDate } from './schedule';
import {
  deleteTaskForDay,
  duplicateTask,
  endTemplate,
  makeRecurring,
  moveTask,
  replaceTimetable,
  setCompleted,
  updateSeriesFromTask,
  addTask,
} from './taskActions';
import { createDefaultTemplates } from '../data/defaultSchedule';
import type { AppData } from '../types/app';

const day = (data: AppData, d: string) => tasksForDate(buildScheduleIndex(data), d);
const find = (data: AppData, d: string, title: string) => day(data, d).find((t) => t.title === title)!;

describe('task actions', () => {
  it('moves a task for a birthday without touching other days', () => {
    let data = createDefaultData();
    data = moveTask(data, find(data, '2026-10-05', 'Java'), '2026-10-05', '16:00', '17:00');
    const java = find(data, '2026-10-05', 'Java');
    expect(java.startTime).toBe('16:00');
    expect(java.duration).toBe(60);
    expect(find(data, '2026-10-07', 'Java').startTime).toBe('19:30');
    // Reschedule to another day
    data = moveTask(data, java, '2026-10-06', '06:00', '07:00');
    expect(day(data, '2026-10-05').some((t) => t.title === 'Java')).toBe(false);
    expect(day(data, '2026-10-06').filter((t) => t.title === 'Java')).toHaveLength(1);
  });

  it('deletes one day only, duplicates, and adds one-off tasks', () => {
    let data = createDefaultData();
    const before = day(data, '2026-10-05').length;
    data = deleteTaskForDay(data, find(data, '2026-10-05', 'German'));
    expect(day(data, '2026-10-05')).toHaveLength(before - 1);
    expect(day(data, '2026-10-06').some((t) => t.title === 'German')).toBe(true);
    data = duplicateTask(data, find(data, '2026-10-05', 'Revision'));
    expect(day(data, '2026-10-05').filter((t) => t.title === 'Revision')).toHaveLength(2);
    data = addTask(data, {
      date: '2026-10-05', title: 'Birthday party', category: 'other', startTime: '19:00', endTime: '21:00',
      completed: false, skipped: false, notes: '', priority: 'low', recurring: null,
    });
    expect(find(data, '2026-10-05', 'Birthday party').duration).toBe(120);
  });

  it('edits a series from a date forward and keeps the past', () => {
    let data = createDefaultData();
    data = setCompleted(data, find(data, '2026-10-05', 'German'), true);
    data = updateSeriesFromTask(data, find(data, '2026-10-07', 'German'), { startTime: '20:45', endTime: '21:30', title: 'German A1' });
    expect(find(data, '2026-10-05', 'German').completed).toBe(true);
    expect(find(data, '2026-10-06', 'German').startTime).toBe('21:00');
    expect(find(data, '2026-10-07', 'German A1').startTime).toBe('20:45');
    expect(find(data, '2026-10-20', 'German A1').startTime).toBe('20:45');
    expect(day(data, '2026-10-07').filter((t) => t.title.startsWith('German'))).toHaveLength(1);
  });

  it('keeps a completed day consistent when its series is edited', () => {
    let data = createDefaultData();
    data = setCompleted(data, find(data, '2026-10-07', 'Revision'), true);
    data = updateSeriesFromTask(data, find(data, '2026-10-07', 'Revision'), { title: 'Daily revision' });
    const wed = day(data, '2026-10-07').filter((t) => t.title.includes('evision'));
    expect(wed).toHaveLength(1);
    expect(wed[0]).toMatchObject({ title: 'Daily revision', completed: true });
  });

  it('never deletes the gym series', () => {
    const data = createDefaultData();
    const gym = data.templates.find((t) => t.key === 'gym')!;
    expect(endTemplate(data, gym.id, '2026-10-05')).toBe(data);
    const ended = endTemplate(data, data.templates.find((t) => t.title === 'Revision')!.id, '2026-10-12');
    expect(day(ended, '2026-10-08').some((t) => t.title === 'Revision')).toBe(true);
    expect(day(ended, '2026-10-12').some((t) => t.title === 'Revision')).toBe(false);
  });

  it('turns a one-off task into a repeating one', () => {
    let data = addTask(createDefaultData(), {
      date: '2026-10-06', title: 'SQL', category: 'other', startTime: '06:00', endTime: '06:30',
      completed: false, skipped: false, notes: '', priority: 'medium', recurring: null,
    });
    data = makeRecurring(data, find(data, '2026-10-06', 'SQL'), { type: 'custom', days: [2] });
    expect(day(data, '2026-10-06').filter((t) => t.title === 'SQL')).toHaveLength(1);
    expect(day(data, '2026-10-13').filter((t) => t.title === 'SQL')).toHaveLength(1);
    expect(day(data, '2026-10-07').some((t) => t.title === 'SQL')).toBe(false);
  });

  it('reloads the timetable from config without losing history', () => {
    let data = createDefaultData();
    data = setCompleted(data, find(data, '2026-10-05', 'Gym'), true);
    data = replaceTimetable(data, createDefaultTemplates(), '2026-10-10');
    expect(find(data, '2026-10-05', 'Gym').completed).toBe(true);
    expect(day(data, '2026-10-10').filter((t) => t.category === 'gym')).toHaveLength(1);
    expect(day(data, '2026-10-09').filter((t) => t.category === 'gym')).toHaveLength(1);
    expect(data.templates.filter((t) => t.key === 'gym' && !t.endDate)[0].locked).toBe(true);
  });
});
