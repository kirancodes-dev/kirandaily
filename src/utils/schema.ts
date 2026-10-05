import { z } from 'zod';
import { isValidISODate, isValidTime } from './date';

/** Runtime validation for stored and imported data. Mirrors src/types. */

const isoDate = z.string().refine(isValidISODate, 'Invalid date (expected YYYY-MM-DD)');
const optionalIsoDate = z.union([isoDate, z.literal('')]);
const time = z.string().refine(isValidTime, 'Invalid time (expected HH:mm)');
const id = z.string().min(1, 'Missing id');
const workStatus = z.enum(['not_started', 'in_progress', 'completed']);
const priority = z.enum(['low', 'medium', 'high']);

export const recurrenceSchema = z.object({
  type: z.enum(['daily', 'weekdays', 'saturday', 'sunday', 'custom']),
  days: z.array(z.number().int().min(0).max(6)).optional(),
});

export const categorySchema = z.object({
  id,
  label: z.string().min(1),
  isStudy: z.boolean(),
  builtIn: z.boolean(),
  color: z.enum(['indigo', 'orange', 'emerald', 'amber', 'sky', 'violet', 'rose', 'slate', 'red', 'teal', 'lime', 'fuchsia']),
});

export const templateSchema = z.object({
  id,
  key: z.string().optional(),
  title: z.string().min(1),
  category: z.string().min(1),
  startTime: time,
  endTime: time,
  priority,
  notes: z.string(),
  recurrence: recurrenceSchema,
  startDate: isoDate,
  endDate: optionalIsoDate.optional(),
  rotateSubjects: z.boolean().optional(),
  rotationSlot: z.number().int().optional(),
  locked: z.boolean().optional(),
});

export const taskSchema = z.object({
  id,
  date: isoDate,
  title: z.string().min(1),
  category: z.string().min(1),
  startTime: time,
  endTime: time,
  duration: z.number().min(0).max(1440),
  completed: z.boolean(),
  skipped: z.boolean(),
  notes: z.string(),
  priority,
  recurring: recurrenceSchema.nullable(),
  templateId: z.string().optional(),
  subjectId: z.string().optional(),
  completedAt: z.string().optional(),
});

export const dayLogSchema = z.object({
  date: isoDate,
  sleepHours: z.number().min(0).max(24).optional(),
  special: z
    .object({ kind: z.enum(['birthday', 'party', 'outing', 'other']), note: z.string() })
    .optional(),
});

export const sessionSchema = z.object({
  id,
  date: isoDate,
  category: z.string().min(1),
  topic: z.string(),
  minutes: z.number().min(0).max(1440),
  startedAt: z.string(),
  source: z.enum(['timer', 'pomodoro', 'manual']),
  taskId: z.string().optional(),
  subjectId: z.string().optional(),
});

export const subjectSchema = z.object({
  id,
  name: z.string().min(1),
  topics: z.array(z.object({ id, title: z.string(), done: z.boolean() })),
  notes: z.string(),
  assignmentStatus: workStatus,
  revisionStatus: workStatus,
  examPrepStatus: workStatus,
});

const roadmapTopicSchema = z.object({
  id,
  title: z.string().min(1),
  status: workStatus,
  notes: z.string(),
  completedAt: z.string().optional(),
});

const roadmapSchema = (rid: 'java' | 'dsa' | 'german') =>
  z.object({
    id: z.literal(rid),
    title: z.string(),
    sections: z.array(z.object({ id, title: z.string().min(1), topics: z.array(roadmapTopicSchema) })),
  });

export const roadmapsSchema = z.object({
  java: roadmapSchema('java'),
  dsa: roadmapSchema('dsa'),
  german: roadmapSchema('german'),
});

export const problemLogSchema = z.object({ id, date: isoDate, topicId: z.string(), count: z.number().int() });
export const germanLogSchema = z.object({ id, date: isoDate, words: z.number().int(), lessons: z.number().int() });

export const projectSchema = z.object({
  id,
  name: z.string().min(1),
  description: z.string(),
  technology: z.string(),
  status: z.enum(['idea', 'planning', 'development', 'testing', 'completed']),
  startDate: optionalIsoDate,
  targetDate: optionalIsoDate,
  progress: z.number().min(0).max(100),
  githubUrl: z.string(),
  notes: z.string(),
});

export const goalSchema = z.object({
  id,
  term: z.enum(['short', 'long']),
  title: z.string().min(1),
  description: z.string(),
  deadline: optionalIsoDate,
  progress: z.number().min(0).max(100),
  status: z.enum(['not_started', 'in_progress', 'completed', 'paused']),
});

export const noteSchema = z.object({
  id,
  title: z.string(),
  content: z.string(),
  category: z.enum(['college', 'java', 'dsa', 'german', 'project', 'personal']),
  date: isoDate,
  updatedAt: z.string(),
});

export const weeklyReviewSchema = z.object({
  id,
  weekStart: isoDate,
  wentWell: z.string(),
  improve: z.string(),
  nextPriority: z.string(),
  savedAt: z.string(),
});

export const cgpaSchema = z.object({
  current: z.number().min(0).max(10),
  target: z.number().min(0).max(10),
  totalSemesters: z.number().int().min(1).max(12),
  semesters: z.array(
    z.object({
      id,
      semester: z.number().int().min(1).max(12),
      sgpa: z.number().min(0).max(10),
      credits: z.number().min(0).optional(),
    }),
  ),
});

export const profileSchema = z.object({
  name: z.string().min(1),
  theme: z.enum(['light', 'dark', 'system']),
});

export const settingsSchema = z.object({
  studyTargets: z.object({
    weekday: z.number().min(0).max(24),
    saturday: z.number().min(0).max(24),
    sunday: z.number().min(0).max(24),
  }),
  pomodoro: z.object({ focus: z.number().int().min(1).max(240), break: z.number().int().min(0).max(120) }),
  planStartDate: isoDate,
});

/* ───────────── v1.1: profile details, calendar events, preferences ───────────── */

const shortText = (max: number) => z.string().max(max);

export const profileExtraSchema = z.object({
  photo: z.union([z.literal(''), z.string().max(400_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)]),
  headline: shortText(120),
  college: shortText(160),
  semester: z.number().int().min(1).max(12).nullable(),
  bio: shortText(1000),
  links: z.object({
    github: shortText(100),
    leetcode: shortText(100),
    linkedin: shortText(300),
    portfolio: shortText(300),
  }),
});

export const eventSchema = z
  .object({
    id,
    title: z.string().min(1).max(300),
    date: isoDate,
    endDate: isoDate.optional(),
    startTime: time.optional(),
    endTime: time.optional(),
    kind: z.enum(['exam', 'test', 'holiday', 'deadline', 'event', 'class', 'personal', 'other']),
    important: z.boolean(),
    notes: shortText(2000),
    source: z.enum(['semester', 'user', 'import']),
  })
  .refine((e) => !e.endDate || e.endDate >= e.date, 'End date is before the start date');

export const prefsSchema = z.object({
  timeGate: z.boolean(),
  reminders: z.boolean(),
  reminderSound: z.boolean(),
  remindBeforeMinutes: z.number().int().min(0).max(120),
});

export const semesterInfoSchema = z.object({
  title: shortText(200),
  startDate: isoDate,
  endDate: isoDate,
  notes: z.array(shortText(500)).max(30),
  sourceLabel: shortText(300),
});

/** Array-valued collections and their item schemas. */
export const collectionSchemas = {
  categories: categorySchema,
  templates: templateSchema,
  tasks: taskSchema,
  dayLogs: dayLogSchema,
  sessions: sessionSchema,
  subjects: subjectSchema,
  problemLogs: problemLogSchema,
  germanLogs: germanLogSchema,
  projects: projectSchema,
  goals: goalSchema,
  notes: noteSchema,
  weeklyReviews: weeklyReviewSchema,
  events: eventSchema,
} as const;

/** Object-valued sections. */
export const sectionSchemas = {
  profile: profileSchema,
  settings: settingsSchema,
  roadmaps: roadmapsSchema,
  cgpa: cgpaSchema,
  profileExtra: profileExtraSchema,
  prefs: prefsSchema,
  semesterInfo: semesterInfoSchema,
} as const;

/** Keys added after v1.0 – optional so older backups and saved data still load (defaults fill them in). */
export const OPTIONAL_KEYS = new Set(['events', 'profileExtra', 'prefs', 'semesterInfo']);

export const appDataSchema = z.object({
  version: z.literal(1),
  ...Object.fromEntries(Object.entries(sectionSchemas).map(([k, s]) => [k, OPTIONAL_KEYS.has(k) ? s.optional() : s])),
  ...Object.fromEntries(
    Object.entries(collectionSchemas).map(([k, s]) => [k, OPTIONAL_KEYS.has(k) ? z.array(s).optional() : z.array(s)]),
  ),
  exclusions: z.array(z.string()),
});
