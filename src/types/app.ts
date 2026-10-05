import type { CategoryDef, DayLog, Task, TaskTemplate } from './task';
import type { StudySession, PomodoroPreset } from './study';
import type { CgpaData, Subject } from './subject';
import type { GermanLog, ProblemLog, Roadmap, RoadmapId } from './roadmap';
import type { Project } from './project';
import type { Goal } from './goal';
import type { Note } from './note';
import type { WeeklyReview } from './review';

export type ThemePref = 'light' | 'dark' | 'system';

export interface StudyTargets {
  /** Hours, Monday–Friday. */
  weekday: number;
  saturday: number;
  sunday: number;
}

export interface Settings {
  studyTargets: StudyTargets;
  pomodoro: PomodoroPreset;
  /** First day of the plan; streaks and reviews start here. */
  planStartDate: string;
}

export interface Profile {
  name: string;
  theme: ThemePref;
}

/** Everything the app stores. Exported/imported as one JSON document. */
export interface AppData {
  version: 1;
  profile: Profile;
  settings: Settings;
  categories: CategoryDef[];
  templates: TaskTemplate[];
  /** Tasks the user created or changed (template tasks are virtual until changed). */
  tasks: Task[];
  /** Virtual template task ids the user deleted for one day. */
  exclusions: string[];
  dayLogs: DayLog[];
  sessions: StudySession[];
  subjects: Subject[];
  roadmaps: Record<RoadmapId, Roadmap>;
  problemLogs: ProblemLog[];
  germanLogs: GermanLog[];
  projects: Project[];
  goals: Goal[];
  notes: Note[];
  weeklyReviews: WeeklyReview[];
  cgpa: CgpaData;
}
