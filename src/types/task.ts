/** Built-in category ids. Users can rename them and add custom ones in Settings. */
export type CategoryId = string;

export interface CategoryDef {
  id: CategoryId;
  label: string;
  /** Counts towards study hours. */
  isStudy: boolean;
  /** Built-in categories can be renamed but not deleted. */
  builtIn: boolean;
  /** Tailwind colour key used for chips (always shown together with the label). */
  color: CategoryColor;
}

export type CategoryColor =
  | 'indigo'
  | 'orange'
  | 'emerald'
  | 'amber'
  | 'sky'
  | 'violet'
  | 'rose'
  | 'slate'
  | 'red'
  | 'teal'
  | 'lime'
  | 'fuchsia';

export type Priority = 'low' | 'medium' | 'high';

export type RecurrenceType = 'daily' | 'weekdays' | 'saturday' | 'sunday' | 'custom';

export interface Recurrence {
  type: RecurrenceType;
  /** Only used for `custom`. 0 = Sunday … 6 = Saturday. */
  days?: number[];
}

/**
 * A repeating schedule item. Day tasks are derived from templates
 * (see utils/schedule.ts) and only stored once the user changes them.
 */
export interface TaskTemplate {
  id: string;
  /** Stable key for routine items edited from Settings (wake, gym, college, sleep…). */
  key?: string;
  title: string;
  category: CategoryId;
  startTime: string; // HH:mm
  endTime: string; // HH:mm (may be earlier than start = crosses midnight)
  priority: Priority;
  notes: string;
  recurrence: Recurrence;
  /** First date (YYYY-MM-DD) this template applies to. */
  startDate: string;
  /** Last date it applies to (inclusive). Empty = open ended. */
  endDate?: string;
  /** Rotate through the college subjects (shows a different subject each day). */
  rotateSubjects?: boolean;
  /** Offset used when rotating subjects so two college blocks on one day differ. */
  rotationSlot?: number;
  /** Protected templates (gym) cannot be deleted. */
  locked?: boolean;
}

export interface Task {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  category: CategoryId;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  /** Minutes. Derived from start/end but stored for convenience/export. */
  duration: number;
  completed: boolean;
  skipped: boolean;
  notes: string;
  priority: Priority;
  /** Recurrence of the series this task belongs to, or null for a one-off task. */
  recurring: Recurrence | null;
  /** Template the task was generated from. */
  templateId?: string;
  /** College subject linked to this task. */
  subjectId?: string;
  /** ISO timestamp of completion. */
  completedAt?: string;
}

/** Per-day extra info: sleep log and "special day" (birthday, party, outing). */
export interface DayLog {
  date: string;
  sleepHours?: number;
  special?: {
    kind: 'birthday' | 'party' | 'outing' | 'other';
    note: string;
  };
}
