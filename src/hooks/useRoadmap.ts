import { useCallback, useMemo } from 'react';
import type { RoadmapId, RoadmapSection, RoadmapTopic } from '../types/roadmap';
import type { WorkStatus } from '../types/subject';
import { useAppData } from './useAppData';
import { roadmapProgress, studyByCategory } from '../utils/calculations';
import { eachDate } from '../utils/date';
import { uid } from '../utils/id';

export function useRoadmap(id: RoadmapId) {
  const { data, update } = useAppData();
  const roadmap = data.roadmaps[id];
  const progress = useMemo(() => roadmapProgress(roadmap), [roadmap]);

  const patchTopic = useCallback(
    (topicId: string, patch: Partial<RoadmapTopic>) =>
      update((d) => ({
        ...d,
        roadmaps: {
          ...d.roadmaps,
          [id]: {
            ...d.roadmaps[id],
            sections: d.roadmaps[id].sections.map((s) => ({
              ...s,
              topics: s.topics.map((t) => (t.id === topicId ? { ...t, ...patch } : t)),
            })),
          },
        },
      })),
    [update, id],
  );

  const setStatus = useCallback(
    (topicId: string, status: WorkStatus) =>
      patchTopic(topicId, { status, completedAt: status === 'completed' ? new Date().toISOString() : undefined }),
    [patchTopic],
  );

  /** Roadmap editing (Settings): rename / add / remove sections and topics. */
  const edit = useMemo(() => {
    const setSections = (fn: (s: RoadmapSection[]) => RoadmapSection[]) =>
      update((d) => ({ ...d, roadmaps: { ...d.roadmaps, [id]: { ...d.roadmaps[id], sections: fn(d.roadmaps[id].sections) } } }));
    return {
      renameSection: (sid: string, title: string) => setSections((ss) => ss.map((s) => (s.id === sid ? { ...s, title } : s))),
      addSection: (title: string) => setSections((ss) => [...ss, { id: uid(`${id}-sec`), title, topics: [] }]),
      removeSection: (sid: string) => setSections((ss) => ss.filter((s) => s.id !== sid)),
      moveSection: (sid: string, dir: -1 | 1) =>
        setSections((ss) => {
          const i = ss.findIndex((s) => s.id === sid);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= ss.length) return ss;
          const copy = [...ss];
          [copy[i], copy[j]] = [copy[j], copy[i]];
          return copy;
        }),
      addTopic: (sid: string, title: string) =>
        setSections((ss) =>
          ss.map((s) => (s.id === sid ? { ...s, topics: [...s.topics, { id: uid(`${id}-t`), title, status: 'not_started' as const, notes: '' }] } : s)),
        ),
      renameTopic: (topicId: string, title: string) => patchTopic(topicId, { title }),
      removeTopic: (topicId: string) => setSections((ss) => ss.map((s) => ({ ...s, topics: s.topics.filter((t) => t.id !== topicId) }))),
    };
  }, [update, id, patchTopic]);

  return { roadmap, progress, setStatus, setNotes: (topicId: string, notes: string) => patchTopic(topicId, { notes }), edit };
}

/** All-time minutes studied in a category (since the plan started). */
export function useCategoryTotal(category: string, today: string) {
  const { stats, data } = useAppData();
  return useMemo(() => {
    const dates = eachDate(data.settings.planStartDate, today);
    // Sessions logged before the plan start still count.
    const early = data.sessions.filter((s) => s.date < data.settings.planStartDate && s.category === category).reduce((a, s) => a + s.minutes, 0);
    return (studyByCategory(stats, dates).get(category) ?? 0) + early;
  }, [stats, data.settings.planStartDate, data.sessions, category, today]);
}
