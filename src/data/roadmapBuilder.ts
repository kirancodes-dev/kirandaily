import type { Roadmap, RoadmapId } from '../types/roadmap';
import { slug } from '../utils/id';

/** Builds a roadmap with zero progress from plain section → topics lists. */
export function buildRoadmap(id: RoadmapId, title: string, sections: Record<string, string[]>): Roadmap {
  return {
    id,
    title,
    sections: Object.entries(sections).map(([sectionTitle, topics]) => ({
      id: `${id}-${slug(sectionTitle)}`,
      title: sectionTitle,
      topics: topics.map((t) => ({
        id: `${id}-${slug(sectionTitle)}-${slug(t)}`,
        title: t,
        status: 'not_started' as const,
        notes: '',
      })),
    })),
  };
}
