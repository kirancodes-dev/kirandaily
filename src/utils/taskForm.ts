import type { Priority, Recurrence, RecurrenceType } from '../types/task';
import { isValidISODate, isValidTime } from './date';

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
