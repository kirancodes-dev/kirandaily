import type { WorkStatus } from './subject';

export type RoadmapId = 'java' | 'dsa' | 'german';

export interface RoadmapTopic {
  id: string;
  title: string;
  status: WorkStatus;
  notes: string;
  /** ISO timestamp set when the topic is marked completed. */
  completedAt?: string;
}

export interface RoadmapSection {
  id: string;
  title: string;
  topics: RoadmapTopic[];
}

export interface Roadmap {
  id: RoadmapId;
  title: string;
  sections: RoadmapSection[];
}

/** One entry per change in solved DSA problems (+n / -n). */
export interface ProblemLog {
  id: string;
  date: string;
  topicId: string;
  count: number;
}

export interface GermanLog {
  id: string;
  date: string;
  words: number;
  lessons: number;
}
