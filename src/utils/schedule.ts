import type { AppData } from '../types/app';
import type { Recurrence, Task, TaskTemplate } from '../types/task';
import { dayOfWeek, daysBetween, durationMinutes, timeToMinutes } from './date';
import { holidayDates, timetableSwaps } from './events';

/** Id of the task a template produces on a given date. */
export function virtualTaskId(templateId: string, date: string): string {
  return `${templateId}@${date}`;
}

export function recurrenceMatches(rec: Recurrence, dow: number): boolean {
  switch (rec.type) {
    case 'daily':
      return true;
    case 'weekdays':
      return dow >= 1 && dow <= 5;
    case 'saturday':
      return dow === 6;
    case 'sunday':
      return dow === 0;
    case 'custom':
      return (rec.days ?? []).includes(dow);
    default:
      return false;
  }
}

/** `dow` overrides the date's weekday (a Saturday that follows the Monday timetable). */
export function templateAppliesOn(t: TaskTemplate, date: string, dow = dayOfWeek(date)): boolean {
  if (date < t.startDate) return false;
  if (t.endDate && date > t.endDate) return false;
  return recurrenceMatches(t.recurrence, dow);
}

/**
 * Blocks that only happen because there is college that day: College itself
 * (the "classes" category) and the trips to and from it. Study, gym, meals
 * and sleep still happen on a holiday.
 */
const COLLEGE_DAY_KEYS = ['college', 'getready', 'travel'];

export function isCollegeDayTemplate(t: Pick<TaskTemplate, 'key' | 'category'>): boolean {
  return t.category === 'classes' || (!!t.key && COLLEGE_DAY_KEYS.includes(t.key));
}

/** Subject shown in a rotating college block on a date. */
export function rotatingSubjectId(t: TaskTemplate, date: string, subjectIds: string[]): string | undefined {
  if (!t.rotateSubjects || subjectIds.length === 0) return undefined;
  const n = subjectIds.length;
  const offset = Math.max(0, daysBetween(t.startDate, date));
  const idx = (((offset + (t.rotationSlot ?? 0) * 4) % n) + n) % n;
  return subjectIds[idx];
}

export function taskFromTemplate(t: TaskTemplate, date: string, subjectIds: string[]): Task {
  return {
    id: virtualTaskId(t.id, date),
    date,
    title: t.title,
    category: t.category,
    startTime: t.startTime,
    endTime: t.endTime,
    duration: durationMinutes(t.startTime, t.endTime),
    completed: false,
    skipped: false,
    notes: t.notes,
    priority: t.priority,
    recurring: { ...t.recurrence },
    templateId: t.id,
    subjectId: rotatingSubjectId(t, date, subjectIds),
  };
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime) || a.title.localeCompare(b.title),
  );
}

export type ScheduleSource = Pick<AppData, 'templates' | 'tasks' | 'exclusions' | 'subjects'> & Partial<Pick<AppData, 'events'>>;

/**
 * Pre-computed lookup so building many days (calendar, reviews) stays fast.
 * A template task is "virtual" until the user changes it; then a stored task
 * with the same id replaces it (even if it was moved to another date).
 */
export interface ScheduleIndex {
  byDate: Map<string, Task[]>;
  storedIds: Set<string>;
  excluded: Set<string>;
  templates: TaskTemplate[];
  subjectIds: string[];
  /** Holidays from the calendar: college-day blocks are left out. */
  holidays: Set<string>;
  /** Days that follow another weekday's timetable (date → 0-6). */
  dayAs: Map<string, number>;
}

export function buildScheduleIndex(src: ScheduleSource): ScheduleIndex {
  const byDate = new Map<string, Task[]>();
  for (const task of src.tasks) {
    const list = byDate.get(task.date);
    if (list) list.push(task);
    else byDate.set(task.date, [task]);
  }
  return {
    byDate,
    storedIds: new Set(src.tasks.map((t) => t.id)),
    excluded: new Set(src.exclusions),
    templates: src.templates,
    subjectIds: src.subjects.map((s) => s.id),
    holidays: new Set(holidayDates(src.events ?? [])),
    dayAs: timetableSwaps(src.events ?? []),
  };
}

/** Weekday whose timetable a date follows (its own unless the calendar says otherwise). */
export function timetableDay(index: Pick<ScheduleIndex, 'dayAs'>, date: string): number {
  return index.dayAs.get(date) ?? dayOfWeek(date);
}

/** All tasks on a date, sorted by start time. */
export function tasksForDate(index: ScheduleIndex, date: string): Task[] {
  const result: Task[] = [...(index.byDate.get(date) ?? [])];
  const dow = timetableDay(index, date);
  const holiday = index.holidays.has(date);
  for (const t of index.templates) {
    if (!templateAppliesOn(t, date, dow)) continue;
    if (holiday && isCollegeDayTemplate(t)) continue;
    const id = virtualTaskId(t.id, date);
    if (index.storedIds.has(id) || index.excluded.has(id)) continue;
    result.push(taskFromTemplate(t, date, index.subjectIds));
  }
  return sortTasks(result);
}

/** Current template for a routine key (wake, gym, college, sleep…) on a date. */
export function activeTemplateByKey(templates: TaskTemplate[], key: string, date: string): TaskTemplate | undefined {
  const candidates = templates.filter(
    (t) => t.key === key && t.startDate <= date && (!t.endDate || t.endDate >= date),
  );
  if (candidates.length > 0) return candidates[candidates.length - 1];
  // Before the plan starts (or after a template ended) fall back to the latest one.
  const all = templates.filter((t) => t.key === key);
  return all[all.length - 1];
}

export function describeRecurrence(rec: Recurrence | null): string {
  if (!rec) return 'One-off';
  switch (rec.type) {
    case 'daily':
      return 'Every day';
    case 'weekdays':
      return 'Weekdays';
    case 'saturday':
      return 'Saturdays';
    case 'sunday':
      return 'Sundays';
    case 'custom': {
      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const days = [...(rec.days ?? [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      return days.length ? days.map((d) => names[d]).join(', ') : 'No days';
    }
  }
}
