import type { Priority, Recurrence, RecurrenceType } from '../types/task';
import { isValidISODate, isValidTime, minutesToTime, todayISO } from './date';

export type EditScope = 'day' | 'series';

export interface TaskFormValues {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  category: string;
  subjectId: string;
  priority: Priority;
  notes: string;
  repeat: 'none' | RecurrenceType;
  days: number[];
  scope: EditScope;
}

export function toRecurrence(v: Pick<TaskFormValues, 'repeat' | 'days'>): Recurrence | null {
  if (v.repeat === 'none') return null;
  return v.repeat === 'custom' ? { type: 'custom', days: [...v.days].sort() } : { type: v.repeat };
}

/** Form validation: empty titles, invalid dates/times, zero-length tasks. */
export function validateTask(v: TaskFormValues): Partial<Record<keyof TaskFormValues, string>> {
  const errors: Partial<Record<keyof TaskFormValues, string>> = {};
  if (!v.title.trim()) errors.title = 'Give the task a title.';
  if (!isValidISODate(v.date)) errors.date = 'Pick a valid date.';
  if (!isValidTime(v.startTime)) errors.startTime = 'Enter a valid start time.';
  if (!isValidTime(v.endTime)) errors.endTime = 'Enter a valid end time.';
  else if (v.startTime === v.endTime) errors.endTime = 'End time must differ from start time.';
  if (v.repeat === 'custom' && v.days.length === 0) errors.days = 'Choose at least one day.';
  return errors;
}

/**
 * Times a new task starts with: today, the next half hour after now (one hour long), so a task
 * added in the evening isn't overdue the moment it's saved; other days 6–7 PM.
 */
export function defaultTaskTimes(date: string, now: Date): { startTime: string; endTime: string } {
  if (date !== todayISO(now)) return { startTime: '18:00', endTime: '19:00' };
  const minutes = now.getHours() * 60 + now.getMinutes();
  // Late at night the last slot of the day (23:30, running into the night) instead of tomorrow.
  const start = Math.min(Math.ceil((minutes + 1) / 30) * 30, 23 * 60 + 30);
  return { startTime: minutesToTime(start), endTime: minutesToTime(start + 60) };
}
