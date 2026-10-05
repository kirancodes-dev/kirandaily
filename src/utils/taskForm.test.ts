import { describe, expect, it } from 'vitest';
import { toRecurrence, validateTask, type TaskFormValues } from './taskForm';

const base: TaskFormValues = {
  title: 'Java',
  date: '2026-10-05',
  startTime: '19:30',
  endTime: '21:00',
  category: 'java',
  subjectId: '',
  priority: 'medium',
  notes: '',
  repeat: 'none',
  days: [],
  scope: 'day',
};

describe('task form validation', () => {
  it('accepts a valid task', () => {
    expect(validateTask(base)).toEqual({});
  });
  it('rejects empty titles, invalid times, zero length and missing dates', () => {
    expect(validateTask({ ...base, title: '  ' }).title).toBeDefined();
    expect(validateTask({ ...base, startTime: '' }).startTime).toBeDefined();
    expect(validateTask({ ...base, endTime: '19:30' }).endTime).toBeDefined();
    expect(validateTask({ ...base, date: '' }).date).toBeDefined();
    expect(validateTask({ ...base, repeat: 'custom', days: [] }).days).toBeDefined();
  });
  it('builds recurrences', () => {
    expect(toRecurrence(base)).toBeNull();
    expect(toRecurrence({ repeat: 'custom', days: [3, 1] })).toEqual({ type: 'custom', days: [1, 3] });
    expect(toRecurrence({ repeat: 'daily', days: [] })).toEqual({ type: 'daily' });
  });
});
