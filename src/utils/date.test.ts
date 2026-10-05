import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayOfWeek,
  durationMinutes,
  formatLongDate,
  formatMinutes,
  formatTime12,
  isValidISODate,
  isValidTime,
  monthGrid,
  startOfWeek,
  weekDates,
} from './date';

describe('date utils', () => {
  it('formats the plan start date like the dashboard', () => {
    expect(formatLongDate('2026-10-05')).toBe('Monday, October 5, 2026');
    expect(dayOfWeek('2026-10-05')).toBe(1);
  });

  it('validates dates and times', () => {
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2028-02-29')).toBe(true);
    expect(isValidISODate('2026-10-5')).toBe(false);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('05:30')).toBe(true);
    expect(isValidTime('5:30')).toBe(false);
  });

  it('handles weeks and month boundaries', () => {
    expect(startOfWeek('2026-10-11')).toBe('2026-10-05'); // Sunday → Monday
    expect(weekDates('2026-10-31')).toEqual([
      '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01',
    ]);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    const grid = monthGrid(2026, 10);
    expect(grid[0][0]).toBeNull(); // Oct 1 2026 is a Thursday
    expect(grid[0][3]).toBe('2026-10-01');
    expect(grid.flat().filter(Boolean)).toHaveLength(31);
  });

  it('computes durations including sleep across midnight', () => {
    expect(durationMinutes('05:30', '07:00')).toBe(90);
    expect(durationMinutes('22:00', '05:00')).toBe(420);
    expect(durationMinutes('bad', '05:00')).toBe(0);
  });

  it('formats times and durations', () => {
    expect(formatTime12('17:30')).toBe('5:30 PM');
    expect(formatTime12('00:05')).toBe('12:05 AM');
    expect(formatMinutes(270)).toBe('4h 30m');
    expect(formatMinutes(0)).toBe('0h');
    expect(formatMinutes(45)).toBe('45m');
  });
});
