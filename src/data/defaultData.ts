import { scheduleConfig } from '../config/schedule';
import type { AppData } from '../types/app';
import { defaultCategories } from './categories';
import { createDefaultGoals } from './defaultGoals';
import { createDefaultTemplates } from './defaultSchedule';
import { createDsaRoadmap } from './dsaRoadmap';
import { createGermanRoadmap } from './germanRoadmap';
import { createJavaRoadmap } from './javaRoadmap';

export const DATA_VERSION = 1 as const;

/** Fresh app state: the full schedule, zero progress, no fake statistics. */
export function createDefaultData(): AppData {
  return {
    version: DATA_VERSION,
    profile: { name: scheduleConfig.userName, theme: 'system' },
    settings: {
      studyTargets: {
        weekday: scheduleConfig.weekdayStudyTarget,
        saturday: scheduleConfig.saturdayStudyTarget,
        sunday: scheduleConfig.sundayStudyTarget,
      },
      pomodoro: { ...scheduleConfig.pomodoroPresets[0] },
      planStartDate: scheduleConfig.planStartDate,
    },
    categories: defaultCategories.map((c) => ({ ...c })),
    templates: createDefaultTemplates(),
    tasks: [],
    exclusions: [],
    dayLogs: [],
    sessions: [],
    subjects: scheduleConfig.subjects.map((name, i) => ({
      id: `subject-${i + 1}`,
      name,
      topics: [],
      notes: '',
      assignmentStatus: 'not_started',
      revisionStatus: 'not_started',
      examPrepStatus: 'not_started',
    })),
    roadmaps: {
      java: createJavaRoadmap(),
      dsa: createDsaRoadmap(),
      german: createGermanRoadmap(),
    },
    problemLogs: [],
    germanLogs: [],
    projects: [],
    goals: createDefaultGoals(),
    notes: [],
    weeklyReviews: [],
    cgpa: { ...scheduleConfig.cgpa, semesters: [] },
  };
}
