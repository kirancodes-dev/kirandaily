import { useCallback } from 'react';
import type { StudySession } from '../types/study';
import { useAppData } from './useAppData';
import { uid } from '../utils/id';
import { setCompleted } from '../utils/taskActions';
import { getDayTasks } from '../utils/calculations';

export function useStudySessions() {
  const { data, update, stats } = useAppData();

  /** Saves a session; optionally marks a planned task complete (its time then comes from the session). */
  const addSession = useCallback(
    (s: Omit<StudySession, 'id'>, completeTaskId?: string) =>
      update((d) => {
        let next = { ...d, sessions: [...d.sessions, { ...s, id: uid('ses'), taskId: completeTaskId }] };
        if (completeTaskId) {
          const task = getDayTasks(stats, s.date).find((t) => t.id === completeTaskId);
          if (task && !task.completed) next = setCompleted(next, task, true);
        }
        return next;
      }),
    [update, stats],
  );

  const removeSession = useCallback(
    (id: string) => update((d) => ({ ...d, sessions: d.sessions.filter((s) => s.id !== id) })),
    [update],
  );

  return { sessions: data.sessions, addSession, removeSession };
}
