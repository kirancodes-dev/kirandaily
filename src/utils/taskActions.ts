/**
 * Pure data operations for tasks and templates: (data, …args) → new data.
 * Components call these through hooks/useTasks.ts.
 */
import type { AppData } from '../types/app';
import type { Recurrence, Task, TaskTemplate } from '../types/task';
import { addDays, durationMinutes } from './date';
import { uid } from './id';
import { virtualTaskId } from './schedule';

function withDuration(task: Task): Task {
  return { ...task, duration: durationMinutes(task.startTime, task.endTime) };
}

/** Stores a task (a changed template task becomes a stored override). */
export function saveTask(data: AppData, task: Task): AppData {
  const next = withDuration(task);
  const exists = data.tasks.some((t) => t.id === task.id);
  return {
    ...data,
    tasks: exists ? data.tasks.map((t) => (t.id === task.id ? next : t)) : [...data.tasks, next],
    exclusions: data.exclusions.filter((x) => x !== task.id),
  };
}

export function setCompleted(data: AppData, task: Task, completed: boolean, now = new Date()): AppData {
  return saveTask(data, {
    ...task,
    completed,
    skipped: completed ? false : task.skipped,
    completedAt: completed ? now.toISOString() : undefined,
  });
}

export function setSkipped(data: AppData, task: Task, skipped: boolean): AppData {
  return saveTask(data, { ...task, skipped, completed: skipped ? false : task.completed, completedAt: skipped ? undefined : task.completedAt });
}

/** Move / reschedule to another date and/or time. */
export function moveTask(data: AppData, task: Task, date: string, startTime: string, endTime: string): AppData {
  return saveTask(data, { ...task, date, startTime, endTime });
}

export function duplicateTask(data: AppData, task: Task): AppData {
  const copy: Task = {
    ...task,
    id: uid('task'),
    completed: false,
    skipped: false,
    completedAt: undefined,
    recurring: null,
    templateId: undefined,
  };
  return { ...data, tasks: [...data.tasks, withDuration(copy)] };
}

export function addTask(data: AppData, task: Omit<Task, 'id' | 'duration'>): AppData {
  return { ...data, tasks: [...data.tasks, withDuration({ ...task, id: uid('task'), duration: 0 })] };
}

/** Delete one day's task. Template tasks get an exclusion so they don't reappear. */
export function deleteTaskForDay(data: AppData, task: Task): AppData {
  return {
    ...data,
    tasks: data.tasks.filter((t) => t.id !== task.id),
    exclusions: task.templateId && !data.exclusions.includes(task.id) ? [...data.exclusions, task.id] : data.exclusions,
    sessions: data.sessions.map((s) => (s.taskId === task.id ? { ...s, taskId: undefined } : s)),
  };
}

/* ───────────────────────── templates ───────────────────────── */

export type TemplateChanges = Partial<
  Pick<TaskTemplate, 'title' | 'category' | 'startTime' | 'endTime' | 'priority' | 'notes' | 'recurrence' | 'rotateSubjects'>
>;

/** Original date encoded in a template task id ("tpl-x@2026-10-05"). */
export function originalDateOf(taskId: string): string | null {
  const at = taskId.lastIndexOf('@');
  return at === -1 ? null : taskId.slice(at + 1);
}

/**
 * Changes a repeating series from `effectiveFrom` onwards. Earlier days keep
 * the old version (the template is split), so past history never changes.
 */
export function updateTemplate(data: AppData, templateId: string, changes: TemplateChanges, effectiveFrom: string): AppData {
  return splitTemplate(data, templateId, changes, effectiveFrom).data;
}

function splitTemplate(
  data: AppData,
  templateId: string,
  changes: TemplateChanges,
  effectiveFrom: string,
): { data: AppData; templateId: string } {
  const tpl = data.templates.find((t) => t.id === templateId);
  if (!tpl || (tpl.endDate && tpl.endDate < effectiveFrom)) return { data, templateId };
  if (tpl.startDate >= effectiveFrom) {
    return { data: { ...data, templates: data.templates.map((t) => (t.id === templateId ? { ...t, ...changes } : t)) }, templateId };
  }
  const newTpl: TaskTemplate = { ...tpl, ...changes, id: uid('tpl'), startDate: effectiveFrom };
  const old: TaskTemplate = { ...tpl, endDate: addDays(effectiveFrom, -1) };
  // Re-key stored overrides / exclusions of future days to the new template.
  const rekey = (id: string) => {
    const orig = originalDateOf(id);
    return id.startsWith(`${tpl.id}@`) && orig && orig >= effectiveFrom ? virtualTaskId(newTpl.id, orig) : id;
  };
  const next: AppData = {
    ...data,
    templates: [...data.templates.map((t) => (t.id === templateId ? old : t)), newTpl],
    tasks: data.tasks.map((t) => {
      const nid = rekey(t.id);
      return nid === t.id ? t : { ...t, id: nid, templateId: newTpl.id };
    }),
    exclusions: data.exclusions.map(rekey),
    sessions: data.sessions.map((s) => (s.taskId ? { ...s, taskId: rekey(s.taskId) } : s)),
  };
  return { data: next, templateId: newTpl.id };
}

/**
 * Edit "this and following days" from a task: updates the series and the
 * day's own stored copy (if it has one) so both agree.
 */
export function updateSeriesFromTask(data: AppData, task: Task, changes: TemplateChanges): AppData {
  if (!task.templateId) return data;
  const from = originalDateOf(task.id) ?? task.date;
  const split = splitTemplate(data, task.templateId, changes, from);
  let next = split.data;
  const stored = next.tasks.find((t) => t.id === virtualTaskId(split.templateId, from));
  if (stored) {
    const { recurrence, ...rest } = changes;
    next = saveTask(next, { ...stored, ...rest, recurring: recurrence ?? stored.recurring });
  }
  return next;
}

export function addTemplate(data: AppData, tpl: Omit<TaskTemplate, 'id'>): AppData {
  return { ...data, templates: [...data.templates, { ...tpl, id: uid('tpl') }] };
}

/** Turns a one-off task into a repeating series starting on its date. */
export function makeRecurring(data: AppData, task: Task, recurrence: Recurrence): AppData {
  const tpl: TaskTemplate = {
    id: uid('tpl'),
    title: task.title,
    category: task.category,
    startTime: task.startTime,
    endTime: task.endTime,
    priority: task.priority,
    notes: task.notes,
    recurrence,
    startDate: task.date,
  };
  const replacement: Task = { ...task, id: virtualTaskId(tpl.id, task.date), templateId: tpl.id, recurring: recurrence };
  const next: AppData = {
    ...data,
    templates: [...data.templates, tpl],
    tasks: data.tasks.filter((t) => t.id !== task.id),
    sessions: data.sessions.map((s) => (s.taskId === task.id ? { ...s, taskId: replacement.id } : s)),
  };
  // Keep the day's completion state on the first occurrence.
  return task.completed || task.skipped || task.subjectId ? saveTask(next, replacement) : next;
}

/** Ends a series: days before `fromDate` keep it. Locked (gym) templates are never removed. */
export function endTemplate(data: AppData, templateId: string, fromDate: string): AppData {
  const tpl = data.templates.find((t) => t.id === templateId);
  if (!tpl || tpl.locked) return data;
  if (tpl.startDate >= fromDate) {
    return {
      ...data,
      templates: data.templates.filter((t) => t.id !== templateId),
      tasks: data.tasks.filter((t) => !(t.templateId === templateId && !t.completed)),
      exclusions: data.exclusions.filter((x) => !x.startsWith(`${templateId}@`)),
    };
  }
  return {
    ...data,
    templates: data.templates.map((t) => (t.id === templateId ? { ...t, endDate: addDays(fromDate, -1) } : t)),
    tasks: data.tasks.filter((t) => !(t.templateId === templateId && t.date >= fromDate && !t.completed)),
  };
}

/** Templates active on or after a date (the "current timetable"). */
export function currentTemplates(templates: TaskTemplate[], date: string): TaskTemplate[] {
  return templates.filter((t) => !t.endDate || t.endDate >= date);
}

/**
 * Replace the timetable with the one in src/config/schedule.ts from `today`.
 * Past days and completed tasks are kept.
 */
export function replaceTimetable(data: AppData, fresh: TaskTemplate[], today: string): AppData {
  let next = data;
  for (const t of currentTemplates(data.templates, today)) {
    next = endTemplate({ ...next, templates: next.templates.map((x) => (x.id === t.id ? { ...x, locked: false } : x)) }, t.id, today);
  }
  const suffix = today.replace(/-/g, '');
  const added = fresh.map((t) => ({ ...t, id: `${t.id}-${suffix}`, startDate: today }));
  return { ...next, templates: [...next.templates.filter((t) => !added.some((a) => a.id === t.id)), ...added] };
}
