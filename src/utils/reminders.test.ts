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
  refreshDue,
  reminderKey,
  saveAlerted,
  toNotices,
  waitForSync,
  withOvernight,
  type ReminderPlanInput,
  type SyncView,
} from './reminders';

const at = (date: string, time: string, seconds = 0) => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min, seconds);
};

const DAY = '2026-10-05';
const NEXT = '2026-10-06';
/** The real Monday plan: Wake up 05:00 … Java 19:30–21:00, German 21:00–21:30, Revision 21:30–22:00, Sleep 22:00–05:00. */
const monday = (): Task[] => tasksForDate(buildScheduleIndex(createDefaultData()), DAY);
const tuesday = (): Task[] => tasksForDate(buildScheduleIndex(createDefaultData()), NEXT);
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

  it('alerts a task again after it was moved to a later time the same day', () => {
    const tasks = monday();
    const java = byTitle(tasks, 'Java');
    // 21:00: "Java ended" was alerted, then Java was moved to 21:30–23:00 (same id).
    const alerted = new Set([reminderKey('starting', java), reminderKey('overdue', java)]);
    const moved = tasks.map((t) => (t.id === java.id ? { ...t, startTime: '21:30', endTime: '23:00' } : t));
    expect(reminderKey('starting', byTitle(moved, 'Java'))).not.toBe(reminderKey('starting', java));
    const atStart = plan({ tasks: moved, alerted, now: at(DAY, '21:30', 10), lastCheck: at(DAY, '21:29', 50) });
    expect(keysOf(atStart)).toEqual(['overdue:German', 'starting:Java', 'starting:Revision']);
    const atEnd = plan({ tasks: moved, alerted, now: at(DAY, '23:00', 10), lastCheck: at(DAY, '22:59', 50) });
    expect(keysOf(atEnd)).toEqual(['overdue:Java']);
  });

  it('keys include the slot', () => {
    const java = byTitle(monday(), 'Java');
    expect(reminderKey('starting', java)).toBe(`starting:${java.id}|2026-10-05T19:30`);
    expect(reminderKey('overdue', java)).toBe(`overdue:${java.id}|2026-10-05T21:00`);
    // The end of a task that crosses midnight is on the next day.
    expect(reminderKey('overdue', byTitle(monday(), 'Sleep'))).toMatch(/\|2026-10-06T05:00$/);
  });

  it('works across midnight when given yesterday’s, today’s and tomorrow’s tasks', () => {
    const late = { ...byTitle(monday(), 'Revision'), id: 'late', title: 'Late study', startTime: '23:00', endTime: '00:30' };
    const early = { ...byTitle(tuesday(), 'Wake up'), id: 'early', title: 'Early call', startTime: '00:05', endTime: '00:20' };
    const tasks = [...monday(), late, ...tuesday(), early];
    // "Remind me 10 min before" a 00:05 task fires at 23:55 the day before.
    const before = plan({ tasks, now: at(DAY, '23:55', 10), lastCheck: at(DAY, '23:54', 50), remindBeforeMinutes: 10 });
    expect(keysOf(before)).toEqual(['starting:Early call']);
    // A task running past midnight is alerted when it ends.
    const ended = plan({ tasks, now: at(NEXT, '00:30', 10), lastCheck: at(NEXT, '00:29', 50) });
    expect(keysOf(ended)).toEqual(['overdue:Late study']);
    // Last night's sleep is overdue at 05:00 if it wasn't ticked.
    const morning = plan({ tasks, now: at(NEXT, '05:00', 10), lastCheck: at(NEXT, '04:59', 50) });
    expect(keysOf(morning)).toEqual(['overdue:Sleep', 'starting:Wake up']);
    expect(morning.due[0].task.date).toBe(DAY);
  });
});

describe('toNotices', () => {
  it('shows up to two reminders one by one and collapses three or more', () => {
    const p = plan({ now: at(DAY, '19:28'), collapseAt: 99 });
    expect(p.due).toHaveLength(3);
    expect(toNotices(p.due.slice(0, 2)).map((n) => n.type)).toEqual(['single', 'single']);
    expect(toNotices(p.due)).toEqual([{ type: 'summary', reminders: p.due, overdue: 2, starting: 1 }]);
    expect(toNotices([])).toEqual([]);
  });
});

describe('refreshDue', () => {
  const due = () => plan({ now: at(DAY, '21:00', 10), lastCheck: at(DAY, '20:59', 50) }).due; // overdue Java, starting German

  it('keeps what is still open, with the latest task data', () => {
    const tasks = monday().map((t) => (t.title === 'Java' ? { ...t, notes: 'chapter 4' } : t));
    const fresh = refreshDue(due(), tasks, at(DAY, '21:05'));
    expect(fresh.map((d) => `${d.kind}:${d.task.title}`)).toEqual(['overdue:Java', 'starting:German']);
    expect(fresh[0].task.notes).toBe('chapter 4');
  });

  it('drops tasks ticked, skipped, deleted or moved in the meantime (e.g. on another device)', () => {
    const ticked = monday().map((t) => (t.title === 'Java' ? { ...t, completed: true } : t.title === 'German' ? { ...t, skipped: true } : t));
    expect(refreshDue(due(), ticked, at(DAY, '21:05'))).toEqual([]);
    expect(refreshDue(due(), monday().filter((t) => t.title !== 'Java'), at(DAY, '21:05')).map((d) => d.task.title)).toEqual(['German']);
    const moved = monday().map((t) => (t.title === 'Java' ? { ...t, endTime: '22:00' } : t));
    expect(refreshDue(due(), moved, at(DAY, '21:05')).map((d) => d.task.title)).toEqual(['German']);
  });

  it('drops "starting" once the task has ended, things older than 2 hours and duplicates', () => {
    expect(refreshDue(due(), monday(), at(DAY, '21:40')).map((d) => d.kind)).toEqual(['overdue']);
    expect(refreshDue(due(), monday(), at(DAY, '23:00'))).toEqual([]);
    expect(refreshDue([...due(), ...due()], monday(), at(DAY, '21:05'))).toHaveLength(2);
  });
});

describe('waitForSync', () => {
  const view = (over: Partial<SyncView>): SyncView => ({ configured: true, ready: true, signedIn: true, state: 'synced', ...over });

  it('waits while signed-in data is still loading from the cloud', () => {
    expect(waitForSync(view({ ready: false }))).toBe(true);
    expect(waitForSync(view({ state: 'connecting' }))).toBe(true);
    expect(waitForSync(view({ state: 'needs-choice' }))).toBe(true);
  });

  it('does not wait without cloud sync, when signed out, or once synced / offline', () => {
    expect(waitForSync(view({ configured: false, ready: false }))).toBe(false);
    expect(waitForSync(view({ signedIn: false, state: 'idle' }))).toBe(false);
    for (const state of ['synced', 'saving', 'offline', 'error', 'idle'] as const) expect(waitForSync(view({ state }))).toBe(false);
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

  it('withOvernight adds only yesterday’s tasks that run past midnight', () => {
    const tasks = withOvernight(monday(), tuesday(), NEXT);
    expect(tasks.filter((t) => t.date === DAY).map((t) => t.title)).toEqual(['Sleep']);
    expect(tasks).toHaveLength(tuesday().length + 1);
    // 01:00: last night's sleep is happening now; after 05:00 it is overdue if not ticked.
    expect(currentTasks(tasks, at(NEXT, '01:00')).map((t) => `${t.title} ${t.date}`)).toEqual([`Sleep ${DAY}`]);
    expect(overdueTasks(tasks, at(NEXT, '05:01')).map((t) => `${t.title} ${t.date}`)).toEqual([`Sleep ${DAY}`]);
    const ticked = withOvernight(monday().map((t) => ({ ...t, completed: true })), tuesday(), NEXT);
    expect(overdueTasks(ticked, at(NEXT, '05:01'))).toEqual([]);
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
