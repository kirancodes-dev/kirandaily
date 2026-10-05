import { buildRoadmap } from './roadmapBuilder';

/** Edit topics here to change the default DSA roadmap (or edit it in the app: Settings → Roadmaps). */
export const dsaRoadmapTopics: Record<string, string[]> = {
  Beginner: ['Arrays', 'Strings', 'Searching', 'Sorting', 'Two pointers', 'Sliding window'],
  'Data structures': [
    'Linked List',
    'Stack',
    'Queue',
    'HashMap',
    'HashSet',
    'Trees',
    'Binary Search Tree',
    'Heap',
    'Graph',
  ],
  Algorithms: ['Recursion', 'Backtracking', 'Greedy', 'Dynamic Programming'],
};

export const createDsaRoadmap = () => buildRoadmap('dsa', 'DSA', dsaRoadmapTopics);
