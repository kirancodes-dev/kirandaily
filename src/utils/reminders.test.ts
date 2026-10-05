import { describe, expect, it } from 'vitest';
import type { Task } from '../types/task';
import { createDefaultData } from '../data/defaultData';
import { buildScheduleIndex, tasksForDate } from './schedule';
import {
  alertedStorageKey,
  currentTasks,
  loadAlerted,
  noticeText,
  overdueTasks,
  planReminders,
  pruneAlerted,
  reminderKey,
  saveAlerted,
  type ReminderPlanInput,
} from './reminders';

const at = (date: string, time: string, seconds = 0) => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min, seconds);
};

const DAY = '2026-10-05';
/** The real Monday plan: Wake up 05:00 … Java 19:30–21:00, German 21:00–21:30, Revision 21:30–22:00, Sleep 22:00–05:00. */
const monday = (): Task[] => tasksForDate(buildScheduleIndex(createDefaultData()), DAY);
const byTitle = (tasks: Task[], title: string) => tasks.find((t) => t.title === title)!;

const plan = (over: Partial<ReminderPlanInput> & Pick<ReminderPlanInput, 'now'>) =>
  planReminders({ tasks: monday(), lastCheck: null, alerted: new Set(), remindBeforeMinutes: 0, ...over });

const keysOf = (p: ReturnType<typeof planReminders>) => p.due.map((d) => `${d.kind}:${d.task.title}`);

describe('planReminders', () => {
  it('fires "starting" when the start passes between two checks', () => {
    const p = plan({ now: at(DAY, '19:30', 10), lastCheck: at(DAY, '19:29', 50) });
    // Dinner (19:00–19:30) ends at the same moment.
    expect(keysOf(p)).toEqual(['overdue:Dinner', 'starting:Java']);
    expect(p.notices).toHaveLength(2);
    expect(p.notices.every((n) => n.type === 'single')).toBe(true);
  });

  it('honours "remind me N minutes before"', () => {
    const early = plan({ now: at(DAY, '19:20', 5), lastCheck: at(DAY, '19:19', 45), remindBeforeMinutes: 10 });
    expect(keysOf(early)).toEqual(['starting:Java']);
    expect(early.due[0].at).toEqual(at(DAY, '19:20'));
    // At the start itself nothing new fires (already reminded).
    const atStart = plan({ now: at(DAY, '19:30', 5), lastCheck: at(DAY, '19:29', 45), remindBeforeMinutes: 10 });
    expect(keysOf(atStart)).toEqual(['overdue:Dinner']);
  });

  it('fires nothing when nothing became due since the last check', () => {
    expect(plan({ now: at(DAY, '19:45'), lastCheck: at(DAY, '19:44') }).due).toEqual([]);
  });

  it('skips completed and skipped tasks', () => {
    const tasks = monday().map((t) =>
      t.title === 'Java' ? { ...t, completed: true } : t.title === 'Dinner' ? { ...t, skipped: true } : t,
    );
    expect(plan({ tasks, now: at(DAY, '19:30', 10), lastCheck: at(DAY, '19:29', 50) }).due).toEqual([]);
  });

  it('fires "overdue" when the end passes without a tick', () => {
    const p = plan({ now: at(DAY, '21:00', 15), lastCheck: at(DAY, '20:59', 55) });
    expect(keysOf(p)).toEqual(['overdue:Java', 'starting:German']);
  });

  it('does not repeat keys that were already alerted (reloads, other tabs)', () => {
    const tasks = monday();
    const alerted = new Set([reminderKey('starting', byTitle(tasks, 'Java'))]);
    const p = plan({ tasks, alerted, now: at(DAY, '19:30', 10), lastCheck: at(DAY, '19:29', 50) });
    expect(keysOf(p)).toEqual(['overdue:Dinner']);
  });

  it('collapses many alerts into one summary after the app was closed for hours', () => {
    // First check after opening at 19:28: only things from the last 2 hours count.
    const p = plan({ now: at(DAY, '19:28') });
    expect(keysOf(p)).toEqual(['overdue:Travel + rest', 'overdue:College subject', 'starting:Dinner']);
    expect(p.notices).toHaveLength(1);
    const summary = p.notices[0];
    expect(summary.type).toBe('summary');
    if (summary.type === 'summary') {
      expect(summary.overdue).toBe(2);
      expect(summary.starting).toBe(1);
    }
    expect(noticeText(summary, at(DAY, '19:28'))).toEqual({
      title: '3 tasks are waiting',
      body: '2 overdue · 1 starting: Travel + rest, College subject, Dinner.',
    });
  });

  it('never alerts things that became due more than ~2 hours ago', () => {
    // Opened at 23:30 after a whole day away: morning tasks are not alerted.
    const p = plan({ now: at(DAY, '23:30'), lastCheck: at(DAY, '06:00') });
    // German ended at 21:30, exactly 2 hours ago: too old.
    expect(keysOf(p)).toEqual(['overdue:Revision', 'starting:Sleep']);
    expect(p.due.every((d) => d.at.getTime() > at(DAY, '21:30').getTime())).toBe(true);
  });

  it('gives "overdue" instead of "starting" for a task that already ended', () => {
    const p = plan({ now: at(DAY, '21:05'), lastCheck: at(DAY, '19:00', 30), collapseAt: 99 });
    expect(keysOf(p)).not.toContain('starting:Java');
    expect(keysOf(p)).toContain('overdue:Java');
    expect(keysOf(p)).toContain('starting:German');
  });

  it('does not alert sleep as overdue on its own day (it ends tomorrow)', () => {
    const p = plan({ now: at(DAY, '23:59'), lastCheck: at(DAY, '22:00', 30) });
    expect(p.due).toEqual([]);
  });
});

describe('overdueTasks / currentTasks', () => {
  it('lists tasks that ended without a tick, oldest first', () => {
    const tasks = monday().map((t) => (t.title === 'Gym' ? { ...t, completed: true } : t));
    expect(overdueTasks(tasks, at(DAY, '08:30')).map((t) => t.title)).toEqual(['Wake up', 'Bath + breakfast']);
    expect(overdueTasks(tasks, at(DAY, '04:00'))).toEqual([]);
  });

  it('finds the task happening now', () => {
    expect(currentTasks(monday(), at(DAY, '20:00')).map((t) => t.title)).toEqual(['Java']);
    expect(currentTasks(monday(), at(DAY, '23:30')).map((t) => t.title)).toEqual(['Sleep']);
    const done = monday().map((t) => (t.title === 'Java' ? { ...t, completed: true } : t));
    expect(currentTasks(done, at(DAY, '20:00'))).toEqual([]);
  });
});

describe('noticeText', () => {
  const java = () => byTitle(monday(), 'Java');
  const single = (kind: 'starting' | 'overdue') => ({
    type: 'single' as const,
    reminder: { key: reminderKey(kind, java()), kind, task: java(), at: at(DAY, kind === 'starting' ? '19:30' : '21:00') },
  });

  it('describes starting reminders relative to now', () => {
    expect(noticeText(single('starting'), at(DAY, '19:20')).title).toBe('Java starts in 10 min');
    expect(noticeText(single('starting'), at(DAY, '19:30', 20)).title).toBe('Java starts now');
    expect(noticeText(single('starting'), at(DAY, '19:42')).title).toBe('Java started 12 min ago');
  });

  it('asks about overdue tasks', () => {
    expect(noticeText(single('overdue'), at(DAY, '21:00'))).toEqual({
      title: 'Java ended — did you do it?',
      body: 'It ended at 9:00 PM and isn’t ticked yet. Tick it if you did, or move / skip it.',
    });
  });
});

describe('alerted storage', () => {
  const memory = () => {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      key: (i: number) => [...map.keys()][i] ?? null,
      get length() {
        return map.size;
      },
      map,
    };
  };

  it('saves, merges and loads per-day keys', () => {
    const s = memory();
    saveAlerted(s, DAY, ['starting:a']);
    saveAlerted(s, DAY, ['overdue:b', 'starting:a']);
    expect([...loadAlerted(s, DAY)].sort()).toEqual(['overdue:b', 'starting:a']);
    expect(s.map.has(alertedStorageKey(DAY))).toBe(true);
    expect(loadAlerted(s, '2026-10-06').size).toBe(0);
  });

  it('survives broken or missing storage', () => {
    const s = memory();
    s.setItem(alertedStorageKey(DAY), '{broken');
    expect(loadAlerted(s, DAY).size).toBe(0);
    expect(loadAlerted(undefined, DAY).size).toBe(0);
    const throwing = { ...s, getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
    expect(() => saveAlerted(throwing, DAY, ['x'])).not.toThrow();
  });

  it('prunes other days', () => {
    const s = memory();
    saveAlerted(s, '2026-10-03', ['a']);
    saveAlerted(s, '2026-10-04', ['b']);
    saveAlerted(s, DAY, ['c']);
    s.setItem('kiran-planner:data', '{}');
    pruneAlerted(s, [DAY, '2026-10-04']);
    expect([...s.map.keys()].sort()).toEqual([alertedStorageKey('2026-10-04'), alertedStorageKey(DAY), 'kiran-planner:data'].sort());
  });
});
