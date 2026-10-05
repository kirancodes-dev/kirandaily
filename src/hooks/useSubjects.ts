import { useCallback } from 'react';
import type { Subject } from '../types/subject';
import { useAppData } from './useAppData';
import { uid } from '../utils/id';

export function useSubjects() {
  const { data, update } = useAppData();
  const patch = useCallback(
    (id: string, p: Partial<Subject>) => update((d) => ({ ...d, subjects: d.subjects.map((s) => (s.id === id ? { ...s, ...p } : s)) })),
    [update],
  );
  const patchTopics = useCallback(
    (id: string, fn: (t: Subject['topics']) => Subject['topics']) =>
      update((d) => ({ ...d, subjects: d.subjects.map((s) => (s.id === id ? { ...s, topics: fn(s.topics) } : s)) })),
    [update],
  );
  return {
    subjects: data.subjects,
    patch,
    rename: (id: string, name: string) => name.trim() && patch(id, { name: name.trim() }),
    addTopic: (id: string, title: string) => patchTopics(id, (ts) => [...ts, { id: uid('st'), title, done: false }]),
    toggleTopic: (id: string, topicId: string) => patchTopics(id, (ts) => ts.map((t) => (t.id === topicId ? { ...t, done: !t.done } : t))),
    removeTopic: (id: string, topicId: string) => patchTopics(id, (ts) => ts.filter((t) => t.id !== topicId)),
    addSubject: (name: string) =>
      update((d) => ({
        ...d,
        subjects: [
          ...d.subjects,
          { id: uid('subject'), name, topics: [], notes: '', assignmentStatus: 'not_started', revisionStatus: 'not_started', examPrepStatus: 'not_started' },
        ],
      })),
    removeSubject: (id: string) =>
      update((d) => ({
        ...d,
        subjects: d.subjects.filter((s) => s.id !== id),
        tasks: d.tasks.map((t) => (t.subjectId === id ? { ...t, subjectId: undefined } : t)),
        sessions: d.sessions.map((s) => (s.subjectId === id ? { ...s, subjectId: undefined } : s)),
      })),
  };
}
