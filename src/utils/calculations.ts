import type { AppData, Settings } from '../types/app';
import type { Task } from '../types/task';
import type { StudySession } from '../types/study';
import type { Roadmap } from '../types/roadmap';
import type { CgpaData, Subject, WorkStatus } from '../types/subject';
import type { Project } from '../types/project';
import { addDays, dayOfWeek, eachDate, monthDates, startOfWeek, weekDates } from './date';
import { buildScheduleIndex, tasksForDate, type ScheduleIndex } from './schedule';

/* ───────────────────────── context ───────────────────────── */

/** Pre-computed lookups shared by every statistic. Build once per data change. */
export interface StatsContext {
  data: AppData;
  index: ScheduleIndex;
  sessionsByDate: Map<string, StudySession[]>;
  /** Tasks whose study time is already recorded by a session. */
  linkedTaskIds: Set<string>;
  studyCategories: Set<string>;
  dayCache: Map<string, Task[]>;
}

export function buildStatsContext(data: AppData): StatsContext {
  const sessionsByDate = new Map<string, StudySession[]>();
  for (const s of data.sessions) {
    const list = sessionsByDate.get(s.date);
    if (list) list.push(s);
    else sessionsByDate.set(s.date, [s]);
  }
  return {
    data,
    index: buildScheduleIndex(data),
    sessionsByDate,
    linkedTaskIds: new Set(data.sessions.map((s) => s.taskId).filter((id): id is string => !!id)),
    studyCategories: new Set(data.categories.filter((c) => c.isStudy).map((c) => c.id)),
    dayCache: new Map(),
  };
}

export function getDayTasks(ctx: StatsContext, date: string): Task[] {
  let tasks = ctx.dayCache.get(date);
  if (!tasks) {
    tasks = tasksForDate(ctx.index, date);
    ctx.dayCache.set(date, tasks);
  }
  return tasks;
}

/* ───────────────────────── study time ───────────────────────── */

/** `dayAs` (from the schedule index) gives a Saturday that follows a weekday timetable the weekday target. */
export function studyTargetMinutes(settings: Settings, date: string, dayAs?: Map<string, number>): number {
  const dow = dayAs?.get(date) ?? dayOfWeek(date);
  const hours =
    dow === 6 ? settings.studyTargets.saturday : dow === 0 ? settings.studyTargets.sunday : settings.studyTargets.weekday;
  return Math.max(0, hours) * 60;
}

/**
 * Study minutes per category on a date:
 * timer/manual sessions + completed study tasks that have no linked session
 * (so a task finished with the timer is never counted twice).
 */
export function studyByCategoryOnDate(ctx: StatsContext, date: string): Map<string, number> {
  const out = new Map<string, number>();
  const add = (cat: string, mins: number) => out.set(cat, (out.get(cat) ?? 0) + mins);
  for (const s of ctx.sessionsByDate.get(date) ?? []) add(s.category, s.minutes);
  for (const t of getDayTasks(ctx, date)) {
    if (t.completed && !t.skipped && ctx.studyCategories.has(t.category) && !ctx.linkedTaskIds.has(t.id)) {
      add(t.category, t.duration);
    }
  }
  return out;
}

export function studyMinutesOnDate(ctx: StatsContext, date: string): number {
  let total = 0;
  for (const m of studyByCategoryOnDate(ctx, date).values()) total += m;
  return total;
}

export function studyByCategory(ctx: StatsContext, dates: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of dates) {
    for (const [cat, m] of studyByCategoryOnDate(ctx, d)) out.set(cat, (out.get(cat) ?? 0) + m);
  }
  return out;
}

export function studyMinutesInRange(ctx: StatsContext, dates: string[]): number {
  return dates.reduce((sum, d) => sum + studyMinutesOnDate(ctx, d), 0);
}

export function studyTargetInRange(settings: Settings, dates: string[], dayAs?: Map<string, number>): number {
  return dates.reduce((sum, d) => sum + studyTargetMinutes(settings, d, dayAs), 0);
}

/** Study minutes for a subject (sessions + completed tasks linked to it). */
export function subjectStudyMinutes(ctx: StatsContext, subjectId: string, dates: string[]): number {
  let total = 0;
  for (const s of ctx.data.sessions) if (s.subjectId === subjectId) total += s.minutes;
  for (const d of dates) {
    for (const t of getDayTasks(ctx, d)) {
      if (t.subjectId === subjectId && t.completed && !t.skipped && !ctx.linkedTaskIds.has(t.id)) total += t.duration;
    }
  }
  return total;
}

/* ───────────────────────── day statistics ───────────────────────── */

export interface DayStats {
  date: string;
  total: number;
  completed: number;
  skipped: number;
  /** completed / (total - skipped), 0-100. null when nothing is planned. */
  completionPct: number | null;
  studyMinutes: number;
  targetMinutes: number;
  gymPlanned: boolean;
  gymDone: boolean;
  special: boolean;
}

export function dayStats(ctx: StatsContext, date: string): DayStats {
  const tasks = getDayTasks(ctx, date);
  const skipped = tasks.filter((t) => t.skipped).length;
  const completed = tasks.filter((t) => t.completed && !t.skipped).length;
  const countable = tasks.length - skipped;
  const gymTasks = tasks.filter((t) => t.category === 'gym');
  return {
    date,
    total: tasks.length,
    completed,
    skipped,
    completionPct: countable > 0 ? Math.round((completed / countable) * 100) : null,
    studyMinutes: studyMinutesOnDate(ctx, date),
    targetMinutes: studyTargetMinutes(ctx.data.settings, date, ctx.index.dayAs),
    gymPlanned: gymTasks.length > 0,
    gymDone: gymTasks.some((t) => t.completed && !t.skipped),
    special: ctx.data.dayLogs.some((l) => l.date === date && !!l.special),
  };
}

export interface RangeSummary {
  studyMinutes: number;
  targetMinutes: number;
  tasksTotal: number;
  tasksCompleted: number;
  tasksSkipped: number;
  /** Past tasks that were neither completed nor skipped (shown neutrally as "not done"). */
  tasksNotDone: number;
  completionPct: number | null;
  gymDays: number;
  gymPlannedDays: number;
  /** Days counted (not in the future). */
  daysCounted: number;
}

/** Summary over dates; only days up to `today` count towards completion and gym. */
export function rangeSummary(ctx: StatsContext, dates: string[], today: string): RangeSummary {
  const s: RangeSummary = {
    studyMinutes: 0,
    targetMinutes: 0,
    tasksTotal: 0,
    tasksCompleted: 0,
    tasksSkipped: 0,
    tasksNotDone: 0,
    completionPct: null,
    gymDays: 0,
    gymPlannedDays: 0,
    daysCounted: 0,
  };
  for (const d of dates) {
    if (d > today) continue;
    const ds = dayStats(ctx, d);
    s.daysCounted++;
    s.studyMinutes += ds.studyMinutes;
    s.targetMinutes += ds.targetMinutes;
    s.tasksTotal += ds.total;
    s.tasksCompleted += ds.completed;
    s.tasksSkipped += ds.skipped;
    if (d < today) s.tasksNotDone += ds.total - ds.completed - ds.skipped;
    if (ds.gymPlanned) s.gymPlannedDays++;
    if (ds.gymDone) s.gymDays++;
  }
  const countable = s.tasksTotal - s.tasksSkipped;
  s.completionPct = countable > 0 ? Math.round((s.tasksCompleted / countable) * 100) : null;
  return s;
}

/* ───────────────────────── progress ───────────────────────── */

export interface RoadmapProgress {
  total: number;
  completed: number;
  inProgress: number;
  pct: number;
}

export function roadmapProgress(roadmap: Roadmap): RoadmapProgress {
  const topics = roadmap.sections.flatMap((s) => s.topics);
  const completed = topics.filter((t) => t.status === 'completed').length;
  const inProgress = topics.filter((t) => t.status === 'in_progress').length;
  return {
    total: topics.length,
    completed,
    inProgress,
    pct: topics.length ? Math.round((completed / topics.length) * 100) : 0,
  };
}

/** Topics completed between two dates (inclusive, local). */
export function topicsCompletedBetween(roadmap: Roadmap, from: string, to: string): number {
  return roadmap.sections
    .flatMap((s) => s.topics)
    .filter((t) => {
      if (t.status !== 'completed' || !t.completedAt) return false;
      const d = localDateOfIso(t.completedAt);
      return d >= from && d <= to;
    }).length;
}

function localDateOfIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const STATUS_SCORE: Record<WorkStatus, number> = { not_started: 0, in_progress: 0.5, completed: 1 };

/** Subject progress: average of topic completion (if any topics) and the three status fields. */
export function subjectProgress(subject: Subject): number {
  const parts = [
    STATUS_SCORE[subject.assignmentStatus],
    STATUS_SCORE[subject.revisionStatus],
    STATUS_SCORE[subject.examPrepStatus],
  ];
  if (subject.topics.length > 0) parts.push(subject.topics.filter((t) => t.done).length / subject.topics.length);
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
}

export function collegeProgress(subjects: Subject[]): number {
  if (!subjects.length) return 0;
  return Math.round(subjects.reduce((sum, s) => sum + subjectProgress(s), 0) / subjects.length);
}

export function projectsProgress(projects: Project[]): number | null {
  if (!projects.length) return null;
  return Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length);
}

/* ───────────────────────── DSA / German ───────────────────────── */

export function dsaProblemStats(data: Pick<AppData, 'problemLogs'>, today: string) {
  const week = new Set(weekDates(today));
  let todayCount = 0;
  let weekCount = 0;
  let total = 0;
  const byTopic = new Map<string, number>();
  for (const log of data.problemLogs) {
    total += log.count;
    if (log.date === today) todayCount += log.count;
    if (week.has(log.date)) weekCount += log.count;
    byTopic.set(log.topicId, (byTopic.get(log.topicId) ?? 0) + log.count);
  }
  return { today: todayCount, week: weekCount, total, byTopic };
}

export function germanTotals(data: Pick<AppData, 'germanLogs'>) {
  return data.germanLogs.reduce(
    (acc, l) => ({ words: acc.words + l.words, lessons: acc.lessons + l.lessons }),
    { words: 0, lessons: 0 },
  );
}

/* ───────────────────────── CGPA ───────────────────────── */

export interface CgpaResult {
  /** Cumulative CGPA from semester entries, or the manually entered current CGPA. */
  cgpa: number;
  fromSemesters: boolean;
  weighted: boolean;
  /** Average SGPA needed in the remaining semesters to reach the target (null if none remain). */
  requiredAverage: number | null;
  remainingSemesters: number;
  progressPct: number;
}

export function calculateCgpa(c: CgpaData): CgpaResult {
  const sems = c.semesters.filter((s) => Number.isFinite(s.sgpa));
  const weighted = sems.length > 0 && sems.every((s) => (s.credits ?? 0) > 0);
  let cgpa = c.current;
  if (sems.length > 0) {
    if (weighted) {
      const credits = sems.reduce((a, s) => a + (s.credits ?? 0), 0);
      cgpa = sems.reduce((a, s) => a + s.sgpa * (s.credits ?? 0), 0) / credits;
    } else {
      cgpa = sems.reduce((a, s) => a + s.sgpa, 0) / sems.length;
    }
  }
  const remainingSemesters = Math.max(0, c.totalSemesters - sems.length);
  let requiredAverage: number | null = null;
  if (sems.length > 0 && remainingSemesters > 0) {
    // Approximation: assumes remaining semesters carry equal weight.
    requiredAverage = (c.target * c.totalSemesters - cgpa * sems.length) / remainingSemesters;
  }
  return {
    cgpa: round2(cgpa),
    fromSemesters: sems.length > 0,
    weighted,
    requiredAverage: requiredAverage === null ? null : round2(requiredAverage),
    remainingSemesters,
    progressPct: c.target > 0 ? Math.min(100, Math.round((cgpa / c.target) * 100)) : 0,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ───────────────────────── chart series ───────────────────────── */

/** Last `weeks` weeks, never before the week the plan started. */
export function weeklyStudySeries(ctx: StatsContext, today: string, weeks = 8) {
  const thisWeek = startOfWeek(today);
  const firstWeek = startOfWeek(ctx.data.settings.planStartDate);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisWeek, -7 * (weeks - 1 - i));
    const dates = weekDates(start).filter((d) => d <= today);
    return {
      label: start.slice(5).replace('-', '/'),
      weekStart: start,
      hours: round1(studyMinutesInRange(ctx, dates) / 60),
      target: round1(studyTargetInRange(ctx.data.settings, weekDates(start), ctx.index.dayAs) / 60),
      gymDays: rangeSummary(ctx, weekDates(start), today).gymDays,
    };
  }).filter((w) => w.weekStart >= firstWeek);
}

/** Last `months` months, never before the month the plan started. */
export function monthlyStudySeries(ctx: StatsContext, today: string, months = 6) {
  const [y, m] = today.split('-').map(Number);
  const firstMonth = ctx.data.settings.planStartDate.slice(0, 7);
  return Array.from({ length: months }, (_, i) => {
    const date = new Date(y, m - 1 - (months - 1 - i), 1);
    const yy = date.getFullYear();
    const mm = date.getMonth() + 1;
    const dates = monthDates(yy, mm).filter((d) => d <= today);
    return {
      key: `${yy}-${String(mm).padStart(2, '0')}`,
      label: date.toLocaleDateString('en-US', { month: 'short' }),
      hours: round1(studyMinutesInRange(ctx, dates) / 60),
    };
  }).filter((x) => x.key >= firstMonth);
}

export function completionSeries(ctx: StatsContext, today: string, days = 14) {
  return eachDate(addDays(today, -(days - 1)), today).map((d) => {
    const s = dayStats(ctx, d);
    return { label: d.slice(8), date: d, pct: s.completionPct ?? 0, hasTasks: s.completionPct !== null };
  });
}

const round1 = (n: number) => Math.round(n * 10) / 10;
