import { describe, expect, it } from 'vitest';
import type { Task } from '../types/task';
import {
  availableFrom,
  canMarkDone,
  formatWait,
  gateMessage,
  isHappening,
  isLate,
  minutesLeft,
  taskEnd,
  taskStart,
  timeUntilStart,
} from './timeGate';

/** Local time on a date, e.g. at('2026-10-05', '19:30'). */
const at = (date: string, time: string, seconds = 0) => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min, seconds);
};

const task = (over: Partial<Task> = {}): Task => ({
  id: 't1',
  date: '2026-10-05',
  title: 'Java',
  category: 'java',
  startTime: '19:30',
  endTime: '21:00',
  duration: 90,
  completed: false,
  skipped: false,
  notes: '',
  priority: 'high',
  recurring: null,
  ...over,
});

const sleep = task({ title: 'Sleep', category: 'routine', startTime: '22:00', endTime: '05:00', duration: 420 });

describe('taskStart / taskEnd', () => {
  it('uses the task date and local times', () => {
    expect(taskStart(task())).toEqual(at('2026-10-05', '19:30'));
    expect(taskEnd(task())).toEqual(at('2026-10-05', '21:00'));
  });

  it('puts the end of a task that crosses midnight on the next day', () => {
    expect(taskStart(sleep)).toEqual(at('2026-10-05', '22:00'));
    expect(taskEnd(sleep)).toEqual(at('2026-10-06', '05:00'));
    // Ending exactly at midnight is also the next day.
    expect(taskEnd(task({ startTime: '23:00', endTime: '00:00' }))).toEqual(at('2026-10-06', '00:00'));
  });

  it('crosses month and year ends', () => {
    expect(taskEnd({ ...sleep, date: '2026-10-31' })).toEqual(at('2026-11-01', '05:00'));
    expect(taskEnd({ ...sleep, date: '2026-12-31' })).toEqual(at('2027-01-01', '05:00'));
  });
});

describe('canMarkDone', () => {
  it('blocks a task before its start time and allows it from the start', () => {
    expect(canMarkDone(task(), at('2026-10-05', '07:30'))).toBe(false);
    expect(canMarkDone(task(), at('2026-10-05', '19:29', 59))).toBe(false);
    expect(canMarkDone(task(), at('2026-10-05', '19:30'))).toBe(true);
    expect(canMarkDone(task(), at('2026-10-05', '23:59'))).toBe(true);
  });

  it('always allows tasks on past dates and never tasks on future dates', () => {
    expect(canMarkDone(task({ date: '2026-10-04' }), at('2026-10-05', '00:01'))).toBe(true);
    expect(canMarkDone(task({ date: '2026-09-01', startTime: '23:59' }), at('2026-10-05', '00:00'))).toBe(true);
    expect(canMarkDone(task({ date: '2026-10-06', startTime: '00:00' }), at('2026-10-05', '23:59'))).toBe(false);
    expect(canMarkDone(task({ date: '2026-12-25' }), at('2026-10-05', '23:59'))).toBe(false);
  });

  it('handles midnight: a 00:00 task can be ticked from midnight', () => {
    const early = task({ title: 'Night study', startTime: '00:00', endTime: '01:00' });
    expect(canMarkDone(early, at('2026-10-04', '23:59'))).toBe(false);
    expect(canMarkDone(early, at('2026-10-05', '00:00'))).toBe(true);
  });

  it('lets sleep (22:00 → 05:00) be ticked from 22:00 on its own date, and the next morning', () => {
    expect(canMarkDone(sleep, at('2026-10-05', '21:59'))).toBe(false);
    expect(canMarkDone(sleep, at('2026-10-05', '22:00'))).toBe(true);
    expect(canMarkDone(sleep, at('2026-10-06', '05:10'))).toBe(true);
  });

  it('allows everything when the time-lock is off', () => {
    expect(canMarkDone(task(), at('2026-10-05', '07:30'), false)).toBe(true);
    expect(canMarkDone(task({ date: '2026-12-25' }), at('2026-10-05', '07:30'), false)).toBe(true);
  });

  it('never blocks a task with a broken date', () => {
    expect(canMarkDone(task({ date: 'not-a-date' }), at('2026-10-05', '07:30'))).toBe(true);
  });
});

describe('timeUntilStart', () => {
  it('counts whole minutes, rounding up, and stops at 0', () => {
    expect(timeUntilStart(task(), at('2026-10-05', '17:25'))).toBe(125);
    expect(timeUntilStart(task(), at('2026-10-05', '19:29', 30))).toBe(1);
    expect(timeUntilStart(task(), at('2026-10-05', '19:30'))).toBe(0);
    expect(timeUntilStart(task(), at('2026-10-05', '22:00'))).toBe(0);
    expect(timeUntilStart(task({ date: '2026-10-06' }), at('2026-10-05', '19:30'))).toBe(1440);
  });
});

describe('isLate', () => {
  const doneAt = (date: string, time: string, over: Partial<Task> = {}) =>
    task({ completed: true, completedAt: at(date, time).toISOString(), ...over });

  it('is late only when ticked after the end time', () => {
    expect(isLate(doneAt('2026-10-05', '20:00'))).toBe(false);
    expect(isLate(doneAt('2026-10-05', '21:00'))).toBe(false);
    expect(isLate(doneAt('2026-10-05', '21:01'))).toBe(true);
    expect(isLate(doneAt('2026-10-06', '08:00'))).toBe(true);
  });

  it('supports a grace period', () => {
    expect(isLate(doneAt('2026-10-05', '21:08'), 10)).toBe(false);
    expect(isLate(doneAt('2026-10-05', '21:11'), 10)).toBe(true);
  });

  it('uses the next-day end for tasks that cross midnight', () => {
    expect(isLate({ ...sleep, completed: true, completedAt: at('2026-10-06', '04:59').toISOString() })).toBe(false);
    expect(isLate({ ...sleep, completed: true, completedAt: at('2026-10-06', '05:30').toISOString() })).toBe(true);
  });

  it('is never late without a completion', () => {
    expect(isLate(task())).toBe(false);
    expect(isLate(task({ completed: true }))).toBe(false);
    expect(isLate(task({ completed: true, completedAt: 'garbage' }))).toBe(false);
    expect(isLate(doneAt('2026-10-06', '08:00', { skipped: true }))).toBe(false);
  });
});

describe('isHappening / minutesLeft', () => {
  it('is true from the start until (not including) the end', () => {
    expect(isHappening(task(), at('2026-10-05', '19:29'))).toBe(false);
    expect(isHappening(task(), at('2026-10-05', '19:30'))).toBe(true);
    expect(isHappening(task(), at('2026-10-05', '21:00'))).toBe(false);
    expect(minutesLeft(task(), at('2026-10-05', '20:15'))).toBe(45);
    expect(minutesLeft(task(), at('2026-10-05', '22:00'))).toBe(0);
  });

  it('covers the night for sleep', () => {
    expect(isHappening(sleep, at('2026-10-06', '03:00'))).toBe(true);
    expect(minutesLeft(sleep, at('2026-10-06', '03:00'))).toBe(120);
  });
});

describe('messages', () => {
  it('formats waits', () => {
    expect(formatWait(0)).toBe('1 min');
    expect(formatWait(25)).toBe('25 min');
    expect(formatWait(60)).toBe('1 h');
    expect(formatWait(125)).toBe('2 h 5 min');
    expect(formatWait(1440)).toBe('1 day');
    expect(formatWait(2000)).toBe('1 day 9 h');
    expect(formatWait(4320)).toBe('3 days');
  });

  it('explains when a task can be ticked', () => {
    expect(gateMessage(task(), at('2026-10-05', '17:25'))).toEqual({
      title: 'Not yet — Java starts at 7:30 PM',
      body: 'You can tick it once it starts (in 2 h 5 min).',
    });
    expect(gateMessage(task({ date: '2026-10-06' }), at('2026-10-05', '19:30')).title).toBe('Not yet — Java is tomorrow at 7:30 PM');
    expect(gateMessage(task({ date: '2026-10-08' }), at('2026-10-05', '19:30')).title).toBe('Not yet — Java is on Thu, Oct 8 at 7:30 PM');
  });

  it('labels the time a task becomes available', () => {
    expect(availableFrom(task(), at('2026-10-05', '08:00'))).toBe('7:30 PM');
    expect(availableFrom(task({ date: '2026-10-06' }), at('2026-10-05', '08:00'))).toBe('Tue, Oct 6, 7:30 PM');
  });
});
