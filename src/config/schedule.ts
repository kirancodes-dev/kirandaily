/**
 * ─────────────────────────────────────────────────────────────
 *  KIRAN PLANNER – CENTRAL SCHEDULE CONFIGURATION
 * ─────────────────────────────────────────────────────────────
 *  Edit this one file to change the default timetable.
 *
 *  Times are 24-hour "HH:mm". Days: 0 = Sunday … 6 = Saturday.
 *
 *  These values seed the app the first time it opens (or after
 *  Settings → "Reload timetable from config" / "Reset data").
 *  Day-to-day changes (move a task for a birthday etc.) are made
 *  inside the app and saved in your browser, not here.
 * ─────────────────────────────────────────────────────────────
 */
import type { Priority, Recurrence } from '../types/task';

export interface PlanBlock {
  /** Stable key (used for routine items editable from Settings). */
  key?: string;
  title: string;
  category: string;
  start: string;
  end: string;
  recurrence: Recurrence;
  priority?: Priority;
  notes?: string;
  /** Show a different college subject in this block each day. */
  rotateSubjects?: boolean;
  rotationSlot?: number;
  /** Cannot be deleted from the app (gym!). */
  locked?: boolean;
}

const MON_THU: Recurrence = { type: 'custom', days: [1, 2, 3, 4] };
const MON_WED: Recurrence = { type: 'custom', days: [1, 3] };
const TUE_THU: Recurrence = { type: 'custom', days: [2, 4] };
const FRIDAY: Recurrence = { type: 'custom', days: [5] };
const WEEKDAYS: Recurrence = { type: 'weekdays' };
const DAILY: Recurrence = { type: 'daily' };
const SATURDAY: Recurrence = { type: 'saturday' };
const SUNDAY: Recurrence = { type: 'sunday' };
const WEEKEND: Recurrence = { type: 'custom', days: [0, 6] };

export const scheduleConfig = {
  userName: 'Kiran',

  /** The plan starts here. Template tasks repeat after this date (into future months too). */
  planStartDate: '2026-10-05',

  /** A day counts towards your Day streak when at least this % of its tasks are done (skipped tasks don't count). */
  streakDayThreshold: 80,

  /** Focused study hours per day. */
  weekdayStudyTarget: 4,
  saturdayStudyTarget: 8,
  sundayStudyTarget: 8,

  /** Fixed daily routine. Gym is every day and is protected from deletion. */
  routine: {
    wakeUp: { start: '05:00', end: '05:30' },
    gym: { start: '05:30', end: '07:00', recurrence: 'daily' as const },
    breakfast: { start: '07:00', end: '08:00' },
    getReady: { start: '08:00', end: '09:00' },
    college: { start: '09:00', end: '17:00' },
    travel: { start: '17:00', end: '18:00' },
    sleep: { start: '22:00', end: '05:00' },
  },

  /** Pomodoro presets offered in the timer (minutes). First one is the default. */
  pomodoroPresets: [
    { focus: 25, break: 5 },
    { focus: 50, break: 10 },
    { focus: 90, break: 15 },
  ],

  /** Default college subject names (rename them in the app: More → College / Settings). */
  subjects: [
    'Subject 1',
    'Subject 2',
    'Subject 3',
    'Subject 4',
    'Subject 5',
    'Subject 6',
    'Subject 7',
    'Subject 8',
    'Subject 9',
  ],

  /** Default CGPA values. */
  cgpa: { current: 8.0, target: 8.5, totalSemesters: 8 },
};

const r = scheduleConfig.routine;

/** Routine blocks shared by every day. */
export const routineBlocks: PlanBlock[] = [
  { key: 'wake', title: 'Wake up', category: 'routine', start: r.wakeUp.start, end: r.wakeUp.end, recurrence: DAILY },
  {
    key: 'gym',
    title: 'Gym',
    category: 'gym',
    start: r.gym.start,
    end: r.gym.end,
    recurrence: DAILY,
    priority: 'high',
    locked: true,
  },
  { key: 'breakfast', title: 'Bath + breakfast', category: 'routine', start: r.breakfast.start, end: r.breakfast.end, recurrence: DAILY },
  { key: 'getready', title: 'Get ready + travel', category: 'routine', start: r.getReady.start, end: r.getReady.end, recurrence: WEEKDAYS },
  { key: 'college', title: 'College', category: 'classes', start: r.college.start, end: r.college.end, recurrence: WEEKDAYS },
  { key: 'travel', title: 'Travel + rest', category: 'routine', start: r.travel.start, end: r.travel.end, recurrence: WEEKDAYS },
  { key: 'sleep', title: 'Sleep', category: 'routine', start: r.sleep.start, end: r.sleep.end, recurrence: DAILY },
];

/** Monday – Friday evening plan. */
export const weekdayBlocks: PlanBlock[] = [
  { title: 'College subject', category: 'college', start: '18:00', end: '19:00', recurrence: WEEKDAYS, rotateSubjects: true, priority: 'high' },
  { title: 'Dinner', category: 'routine', start: '19:00', end: '19:30', recurrence: WEEKDAYS },
  { title: 'Java', category: 'java', start: '19:30', end: '21:00', recurrence: MON_WED, priority: 'high' },
  { title: 'DSA', category: 'dsa', start: '19:30', end: '21:00', recurrence: TUE_THU, priority: 'high' },
  { title: 'Java', category: 'java', start: '19:30', end: '20:15', recurrence: FRIDAY },
  { title: 'DSA', category: 'dsa', start: '20:15', end: '21:00', recurrence: FRIDAY },
  { title: 'German', category: 'german', start: '21:00', end: '21:30', recurrence: WEEKDAYS },
  { title: 'Revision', category: 'revision', start: '21:30', end: '22:00', recurrence: MON_THU },
  { title: 'Weekly review', category: 'revision', start: '21:30', end: '22:00', recurrence: FRIDAY },
];

/** Saturday plan (~8 focused hours). */
export const saturdayBlocks: PlanBlock[] = [
  { title: 'Java', category: 'java', start: '08:00', end: '09:00', recurrence: SATURDAY },
  { title: 'DSA', category: 'dsa', start: '09:00', end: '10:00', recurrence: SATURDAY },
  { title: 'College', category: 'college', start: '10:30', end: '12:30', recurrence: SATURDAY, rotateSubjects: true },
  { title: 'Lunch', category: 'routine', start: '12:30', end: '13:30', recurrence: WEEKEND },
  { title: 'Java', category: 'java', start: '13:30', end: '14:30', recurrence: SATURDAY },
  { title: 'DSA', category: 'dsa', start: '14:30', end: '15:30', recurrence: SATURDAY },
  { title: 'College', category: 'college', start: '16:00', end: '18:00', recurrence: SATURDAY, rotateSubjects: true, rotationSlot: 1 },
  { title: 'Dinner / rest', category: 'routine', start: '18:00', end: '19:00', recurrence: WEEKEND },
  { title: 'German', category: 'german', start: '19:00', end: '20:00', recurrence: WEEKEND },
  { title: 'Project / revision', category: 'project', start: '20:00', end: '21:00', recurrence: SATURDAY },
];

/** Sunday plan (~8 focused hours). */
export const sundayBlocks: PlanBlock[] = [
  { title: 'DSA', category: 'dsa', start: '08:00', end: '10:00', recurrence: SUNDAY },
  { title: 'College', category: 'college', start: '10:30', end: '12:30', recurrence: SUNDAY, rotateSubjects: true },
  { title: 'Java', category: 'java', start: '13:30', end: '15:30', recurrence: SUNDAY },
  { title: 'Weekly college revision', category: 'revision', start: '16:00', end: '18:00', recurrence: SUNDAY },
  { title: 'Weekly test + next week planning', category: 'test', start: '20:00', end: '21:00', recurrence: SUNDAY },
];

/** Everything that makes up the default timetable. */
export const defaultPlan: PlanBlock[] = [...routineBlocks, ...weekdayBlocks, ...saturdayBlocks, ...sundayBlocks];
