import type { WorkStatus } from '../types/subject';
import type { DayLog } from '../types/task';
import type { NoteCategory } from '../types/note';
import type { ProjectStatus } from '../types/project';

export const STATUS_LABELS: Record<WorkStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
};

/** German uses "Learning" instead of "In progress". */
export const GERMAN_STATUS_LABELS: Record<WorkStatus, string> = { ...STATUS_LABELS, in_progress: 'Learning' };

export const SPECIAL_LABELS: Record<NonNullable<DayLog['special']>['kind'], string> = {
  birthday: 'Birthday',
  party: 'Party',
  outing: 'Outing',
  other: 'Special day',
};

export const NOTE_CATEGORIES: Record<NoteCategory, string> = {
  college: 'College',
  java: 'Java',
  dsa: 'DSA',
  german: 'German',
  project: 'Project',
  personal: 'Personal',
};

export const PROJECT_STATUS: Record<ProjectStatus, string> = {
  idea: 'Idea',
  planning: 'Planning',
  development: 'Development',
  testing: 'Testing',
  completed: 'Completed',
};
