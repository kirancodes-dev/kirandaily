import { buildRoadmap } from './roadmapBuilder';

/** Edit topics here to change the default Java roadmap (or edit it in the app: Settings → Roadmaps). */
export const javaRoadmapTopics: Record<string, string[]> = {
  'Phase 1 – Basics': ['Variables', 'Data types', 'Operators', 'Input/output', 'Conditions', 'Loops'],
  'Phase 2 – Building blocks': ['Methods', 'Arrays', 'Strings', 'OOP'],
  'Phase 3 – OOP in depth': ['Classes', 'Objects', 'Inheritance', 'Polymorphism', 'Interfaces', 'Exception handling'],
  'Phase 4 – Collections': ['Collections', 'ArrayList', 'LinkedList', 'HashMap', 'HashSet', 'Stack', 'Queue'],
};

export const createJavaRoadmap = () => buildRoadmap('java', 'Java', javaRoadmapTopics);
