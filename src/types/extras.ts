/**
 * Data added in v1.1: profile details, calendar events (semester calendar +
 * important dates) and preferences. Synced in its own cloud chunk ("ext"),
 * which older app versions simply ignore.
 */

export interface ProfileLinks {
  /** GitHub username (not a URL). */
  github: string;
  /** LeetCode username. */
  leetcode: string;
  linkedin: string;
  portfolio: string;
}

export interface ProfileExtra {
  /** Square JPEG data URL (max ~256 px) or '' for none. */
  photo: string;
  headline: string;
  college: string;
  /** Current semester number, e.g. 5. */
  semester: number | null;
  bio: string;
  links: ProfileLinks;
}

export type EventKind = 'exam' | 'test' | 'holiday' | 'deadline' | 'event' | 'class' | 'personal' | 'other';

export interface CalendarEvent {
  id: string;
  title: string;
  /** Start date, YYYY-MM-DD. */
  date: string;
  /** Last day (inclusive) for multi-day events. */
  endDate?: string;
  /** Optional HH:mm times (all-day when missing). */
  startTime?: string;
  endTime?: string;
  kind: EventKind;
  /** Shown with a star, on Today as a countdown, and gets reminders. */
  important: boolean;
  notes: string;
  /** Where it came from: the semester calendar, added by hand, or an .ics import. */
  source: 'semester' | 'user' | 'import';
}

export interface Prefs {
  /** A task can only be ticked once its start time has arrived. */
  timeGate: boolean;
  /** In-app (and, if allowed, system) alerts when tasks start or are overdue. */
  reminders: boolean;
  reminderSound: boolean;
  /** Alert this many minutes before a task starts (0 = at start). */
  remindBeforeMinutes: number;
}

export interface SemesterInfo {
  title: string;
  /** First day of classes. */
  startDate: string;
  /** Last day of the semester (exams included), YYYY-MM-DD. */
  endDate: string;
  /** Lines from the official calendar footer (attendance rule etc.). */
  notes: string[];
  /** Where the dates came from. */
  sourceLabel: string;
}
