import type { Goal } from '../types/goal';

type Seed = Pick<Goal, 'term' | 'title' | 'description' | 'deadline'>;

/** Starter goals. They begin at 0 % – progress is only what you enter. */
const seeds: Seed[] = [
  { term: 'short', title: 'Finish Java basics', description: 'Complete Java roadmap phases 1 and 2.', deadline: '2026-10-31' },
  { term: 'short', title: 'Start DSA', description: 'Arrays, strings, searching and sorting with daily practice.', deadline: '2026-11-30' },
  { term: 'short', title: 'Complete German A1', description: 'Finish every A1 topic and take a mock exam.', deadline: '2027-03-31' },
  { term: 'short', title: 'Maintain college CGPA', description: 'Stay at 8+ and push towards 8.5.', deadline: '' },
  { term: 'long', title: "German Master's (CS / AI)", description: 'Public university with low or zero tuition.', deadline: '' },
  { term: 'long', title: 'Internship', description: 'Backend / software internship before final year.', deadline: '' },
  { term: 'long', title: 'Backend development', description: 'Java → Spring Boot → SQL → backend projects → cloud.', deadline: '' },
  { term: 'long', title: '₹50L+ career target', description: 'Long-term compensation goal (equivalent).', deadline: '' },
];

export const createDefaultGoals = (): Goal[] =>
  seeds.map((s, i) => ({ ...s, id: `goal-${i + 1}`, progress: 0, status: 'not_started' }));
