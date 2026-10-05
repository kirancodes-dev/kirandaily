import { useCallback, useMemo } from 'react';
import type { Recurrence, Task, TaskTemplate } from '../types/task';
import { useAppData } from './useAppData';
import { getDayTasks } from '../utils/calculations';
import * as actions from '../utils/taskActions';

/** Tasks for one date plus every task operation. */
export function useTasks(date?: string) {
  const { data, stats, update } = useAppData();
  const tasks = useMemo(() => (date ? getDayTasks(stats, date) : []), [stats, date]);

  const ops = useMemo(
    () => ({
      toggle: (task: Task) => update((d) => actions.setCompleted(d, task, !task.completed)),
      skip: (task: Task, skipped = true) => update((d) => actions.setSkipped(d, task, skipped)),
      save: (task: Task) => update((d) => actions.saveTask(d, task)),
      move: (task: Task, newDate: string, start: string, end: string) =>
        update((d) => actions.moveTask(d, task, newDate, start, end)),
      duplicate: (task: Task) => update((d) => actions.duplicateTask(d, task)),
      remove: (task: Task) => update((d) => actions.deleteTaskForDay(d, task)),
      add: (task: Omit<Task, 'id' | 'duration'>) => update((d) => actions.addTask(d, task)),
      updateSeries: (task: Task, changes: actions.TemplateChanges) =>
        update((d) => actions.updateSeriesFromTask(d, task, changes)),
      endSeries: (task: Task) =>
        task.templateId && update((d) => actions.endTemplate(d, task.templateId!, actions.originalDateOf(task.id) ?? task.date)),
      makeRecurring: (task: Task, rec: Recurrence) => update((d) => actions.makeRecurring(d, task, rec)),
      updateTemplate: (id: string, changes: actions.TemplateChanges, from: string) =>
        update((d) => actions.updateTemplate(d, id, changes, from)),
      addTemplate: (tpl: Omit<TaskTemplate, 'id'>) => update((d) => actions.addTemplate(d, tpl)),
      endTemplate: (id: string, from: string) => update((d) => actions.endTemplate(d, id, from)),
    }),
    [update],
  );

  const templateOf = useCallback((task: Task) => data.templates.find((t) => t.id === task.templateId), [data.templates]);

  return { tasks, templateOf, ...ops };
}
