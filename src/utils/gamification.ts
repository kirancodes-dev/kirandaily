/**
 * Motivation layer: XP, levels, badges, the GitHub-style activity graph and
 * the "streak day secured" celebration. Everything here is DERIVED from the
 * real data (ticked tasks, study time, logs) — nothing extra is stored, so it
 * can never show progress that didn't happen. Only days up to `today` count.
 */
import type { StatsContext, DayStats } from './calculations';
import { dayStats, getDayTasks } from './calculations';
import { isStreakDay, streakFor, type StreakResult } from './streaks';
import { addDays, eachDate, formatHours, parseISODate, startOfWeek } from './date';
import type { Roadmap } from '../types/roadmap';

/* ───────────────────────── XP ───────────────────────── */

export const XP_RULES = {
  /** Per completed task. */
  task: 10,
  /** Extra for a completed high-priority task. */
  highPriority: 5,
  /** 1 XP per this many study minutes. */
  studyMinutesPerXp: 2,
  /** Per Day-streak day (80 %+ of the day's tasks). */
  streakDay: 20,
  /** Bonus per perfect day (100 %). */
  perfectDay: 30,
  /** Per DSA problem solved. */
  dsaProblem: 2,
  /** 1 XP per this many German words. */
  germanWordsPerXp: 5,
} as const;

/** Running totals XP is calculated from. */
export interface ActivityTotals {
  tasksCompleted: number;
  highPriorityCompleted: number;
  studyMinutes: number;
  streakDays: number;
  perfectDays: number;
  dsaProblems: number;
  germanWords: number;
}

export interface XpBreakdown {
  tasks: number;
  priority: number;
  study: number;
  streak: number;
  perfect: number;
  dsa: number;
  german: number;
  total: number;
}

export const EMPTY_TOTALS: ActivityTotals = {
  tasksCompleted: 0,
  highPriorityCompleted: 0,
  studyMinutes: 0,
  streakDays: 0,
  perfectDays: 0,
  dsaProblems: 0,
  germanWords: 0,
};

export function xpFromTotals(t: ActivityTotals): XpBreakdown {
  const tasks = Math.max(0, t.tasksCompleted) * XP_RULES.task;
  const priority = Math.max(0, t.highPriorityCompleted) * XP_RULES.highPriority;
  const study = Math.floor(Math.max(0, t.studyMinutes) / XP_RULES.studyMinutesPerXp);
  const streak = Math.max(0, t.streakDays) * XP_RULES.streakDay;
  const perfect = Math.max(0, t.perfectDays) * XP_RULES.perfectDay;
  const dsa = Math.max(0, t.dsaProblems) * XP_RULES.dsaProblem;
  const german = Math.floor(Math.max(0, t.germanWords) / XP_RULES.germanWordsPerXp);
  return { tasks, priority, study, streak, perfect, dsa, german, total: tasks + priority + study + streak + perfect + dsa + german };
}

function diffXp(a: XpBreakdown, b: XpBreakdown): XpBreakdown {
  return {
    tasks: a.tasks - b.tasks,
    priority: a.priority - b.priority,
    study: a.study - b.study,
    streak: a.streak - b.streak,
    perfect: a.perfect - b.perfect,
    dsa: a.dsa - b.dsa,
    german: a.german - b.german,
    total: a.total - b.total,
  };
}

/* ───────────────────────── levels ───────────────────────── */

/** Level titles by the first level of each band. */
export const LEVEL_BANDS: readonly { from: number; title: string }[] = [
  { from: 1, title: 'Beginner' },
  { from: 5, title: 'Consistent' },
  { from: 10, title: 'Focused' },
  { from: 20, title: 'Unstoppable' },
  { from: 35, title: 'Legend' },
];

export function levelTitle(level: number): string {
  let title = LEVEL_BANDS[0].title;
  for (const b of LEVEL_BANDS) if (level >= b.from) title = b.title;
  return title;
}

/**
 * Total XP needed to reach `level`: Level 1 at 0, and Level n+1 needs
 * 100·n·(n+1)/2 (so each level takes 100 XP more than the one before:
 * 100, 200, 300 …).
 */
export function xpForLevel(level: number): number {
  const n = Math.max(0, Math.floor(level) - 1);
  return 50 * n * (n + 1);
}

export interface LevelInfo {
  level: number;
  title: string;
  xp: number;
  /** XP earned since reaching this level. */
  xpIntoLevel: number;
  /** XP this level takes in total (to the next one). */
  xpForNext: number;
  /** XP still missing for the next level. */
  xpToNext: number;
  /** 0–100 progress through this level. */
  pct: number;
}

export function levelFromXp(xpRaw: number): LevelInfo {
  const xp = Math.max(0, Math.floor(Number.isFinite(xpRaw) ? xpRaw : 0));
  let level = Math.floor((Math.sqrt(1 + (4 * xp) / 50) - 1) / 2) + 1;
  while (level > 1 && xpForLevel(level) > xp) level--;
  while (xpForLevel(level + 1) <= xp) level++;
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const xpIntoLevel = xp - start;
  const xpForNext = next - start;
  return {
    level,
    title: levelTitle(level),
    xp,
    xpIntoLevel,
    xpForNext,
    xpToNext: next - xp,
    pct: Math.floor((xpIntoLevel / xpForNext) * 100),
  };
}

/* ───────────────────────── days ───────────────────────── */

export interface DayActivity {
  date: string;
  stats: DayStats;
  highPriorityCompleted: number;
  streakDay: boolean;
  perfect: boolean;
  /** The routine "Wake up" task was ticked. */
  wakeDone: boolean;
}

/** All tasks counted (not skipped) were completed. */
export function isPerfectDay(s: Pick<DayStats, 'total' | 'skipped' | 'completed'>): boolean {
  const n = s.total - s.skipped;
  return n > 0 && s.completed >= n;
}

function wakeTemplateIds(ctx: StatsContext): Set<string> {
  return new Set(ctx.data.templates.filter((t) => t.key === 'wake').map((t) => t.id));
}

function dayActivity(ctx: StatsContext, date: string, wakeIds: Set<string>): DayActivity {
  const stats = dayStats(ctx, date);
  let highPriorityCompleted = 0;
  let wakeDone = false;
  for (const t of getDayTasks(ctx, date)) {
    if (!t.completed || t.skipped) continue;
    if (t.priority === 'high') highPriorityCompleted++;
    if ((t.templateId && wakeIds.has(t.templateId)) || /^wake up\b/i.test(t.title)) wakeDone = true;
  }
  return { date, stats, highPriorityCompleted, streakDay: isStreakDay(stats), perfect: isPerfectDay(stats), wakeDone };
}

/**
 * Longest run of Day-streak days in a row (strict: a missed day ends it,
 * special days and today-not-yet-done neither add nor break).
 */
export function longestRun(days: Pick<DayActivity, 'date' | 'streakDay' | 'stats'>[], today: string): number {
  let run = 0;
  let best = 0;
  for (const d of days) {
    if (d.streakDay) {
      run++;
      best = Math.max(best, run);
    } else if (d.stats.special || d.date === today || d.stats.completionPct === null) {
      // neutral
    } else {
      run = 0;
    }
  }
  return best;
}

/* ───────────────────────── badges ───────────────────────── */

export type BadgeIcon = 'check' | 'flame' | 'dumbbell' | 'book' | 'graduation' | 'code' | 'coffee' | 'languages' | 'star' | 'crown' | 'sunrise';
export type BadgeTone = 'emerald' | 'orange' | 'rose' | 'red' | 'indigo' | 'violet' | 'fuchsia' | 'teal' | 'sky' | 'amber';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: BadgeIcon;
  tone: BadgeTone;
  current: number;
  target: number;
  unlocked: boolean;
  /** "4/7", "3.5/10 h" — progress as text (never colour alone). */
  progressLabel: string;
}

export interface BadgeFacts {
  tasksCompleted: number;
  bestStreak: number;
  gymDays: number;
  studyMinutes: number;
  dsaProblems: number;
  javaPhase1: { done: number; total: number };
  germanA1: { done: number; total: number };
  perfectDays: number;
  bestRun: number;
  wakeDays: number;
}

interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: BadgeIcon;
  tone: BadgeTone;
  unit?: string;
  value: (f: BadgeFacts) => number;
  target: (f: BadgeFacts) => number;
}

const fixed = (n: number) => () => n;
const hours = (f: BadgeFacts) => Math.floor(f.studyMinutes / 6) / 10;

export const BADGE_DEFS: readonly BadgeDef[] = [
  { id: 'first-tick', name: 'First tick', description: 'Complete your first task', icon: 'check', tone: 'emerald', value: (f) => f.tasksCompleted, target: fixed(1) },
  { id: 'streak-3', name: '3-day streak', description: 'Reach a 3-day Day streak', icon: 'flame', tone: 'orange', value: (f) => f.bestStreak, target: fixed(3) },
  { id: 'streak-7', name: '7-day streak', description: 'Reach a 7-day Day streak', icon: 'flame', tone: 'orange', value: (f) => f.bestStreak, target: fixed(7) },
  { id: 'streak-30', name: '30-day streak', description: 'A whole month of 80% days', icon: 'flame', tone: 'rose', value: (f) => f.bestStreak, target: fixed(30) },
  { id: 'gym-7', name: 'Gym 7 days', description: 'Finish the gym on 7 days', icon: 'dumbbell', tone: 'red', value: (f) => f.gymDays, target: fixed(7) },
  { id: 'gym-30', name: 'Gym 30 days', description: 'Finish the gym on 30 days', icon: 'dumbbell', tone: 'red', value: (f) => f.gymDays, target: fixed(30) },
  { id: 'study-10', name: '10 study hours', description: 'Study 10 hours in total', icon: 'book', tone: 'indigo', unit: 'h', value: hours, target: fixed(10) },
  { id: 'study-50', name: '50 study hours', description: 'Study 50 hours in total', icon: 'book', tone: 'violet', unit: 'h', value: hours, target: fixed(50) },
  { id: 'study-100', name: '100 study hours', description: 'Study 100 hours in total', icon: 'graduation', tone: 'fuchsia', unit: 'h', value: hours, target: fixed(100) },
  { id: 'dsa-10', name: '10 DSA problems', description: 'Solve 10 DSA problems', icon: 'code', tone: 'emerald', value: (f) => f.dsaProblems, target: fixed(10) },
  { id: 'dsa-50', name: '50 DSA problems', description: 'Solve 50 DSA problems', icon: 'code', tone: 'teal', value: (f) => f.dsaProblems, target: fixed(50) },
  { id: 'dsa-100', name: '100 DSA problems', description: 'Solve 100 DSA problems', icon: 'code', tone: 'sky', value: (f) => f.dsaProblems, target: fixed(100) },
  { id: 'java-phase-1', name: 'Java Phase 1', description: 'Finish every Java Phase 1 topic', icon: 'coffee', tone: 'orange', value: (f) => f.javaPhase1.done, target: (f) => Math.max(1, f.javaPhase1.total) },
  { id: 'german-a1', name: 'German A1', description: 'Finish every German A1 topic', icon: 'languages', tone: 'amber', value: (f) => f.germanA1.done, target: (f) => Math.max(1, f.germanA1.total) },
  { id: 'perfect-day', name: 'Perfect day', description: 'Finish 100% of a day’s tasks', icon: 'star', tone: 'amber', value: (f) => f.perfectDays, target: fixed(1) },
  { id: 'perfect-week', name: 'Perfect week', description: '7 days in a row at 80%+', icon: 'crown', tone: 'violet', value: (f) => f.bestRun, target: fixed(7) },
  { id: 'early-bird', name: 'Early bird', description: 'Tick “Wake up” on 7 days', icon: 'sunrise', tone: 'sky', value: (f) => f.wakeDays, target: fixed(7) },
];

export function computeBadges(f: BadgeFacts): Badge[] {
  return BADGE_DEFS.map((def) => {
    const target = def.target(f);
    const current = Math.max(0, def.value(f));
    const shown = Math.min(current, target);
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon,
      tone: def.tone,
      current,
      target,
      unlocked: current >= target,
      progressLabel: `${shown}/${target}${def.unit ? ` ${def.unit}` : ''}`,
    };
  });
}

function sectionProgress(roadmap: Roadmap, match: RegExp): { done: number; total: number } {
  const section = roadmap.sections.find((s) => match.test(s.title)) ?? roadmap.sections[0];
  if (!section) return { done: 0, total: 0 };
  return { done: section.topics.filter((t) => t.status === 'completed').length, total: section.topics.length };
}

/* ───────────────────────── everything together ───────────────────────── */

export interface ActivitySummary {
  /** Plan start … today (empty before the plan starts). */
  days: DayActivity[];
  totals: ActivityTotals & { gymDays: number; wakeDays: number; activeDays: number; bestRun: number };
  xp: XpBreakdown;
  /** XP earned today (can be 0; negative corrections show as 0). */
  todayXp: XpBreakdown;
  level: LevelInfo;
  streak: StreakResult;
  badges: Badge[];
}

/** XP, level, streaks and badges from the data, counting only days up to `today`. */
export function computeActivity(ctx: StatsContext, today: string): ActivitySummary {
  const start = ctx.data.settings.planStartDate;
  const wakeIds = wakeTemplateIds(ctx);
  const days = today >= start ? eachDate(start, today).map((d) => dayActivity(ctx, d, wakeIds)) : [];

  const before: ActivityTotals = { ...EMPTY_TOTALS };
  let todayPart: ActivityTotals = { ...EMPTY_TOTALS };
  let gymDays = 0;
  let wakeDays = 0;
  let activeDays = 0;
  for (const d of days) {
    const part: ActivityTotals = {
      tasksCompleted: d.stats.completed,
      highPriorityCompleted: d.highPriorityCompleted,
      studyMinutes: d.stats.studyMinutes,
      streakDays: d.streakDay ? 1 : 0,
      perfectDays: d.perfect ? 1 : 0,
      dsaProblems: 0,
      germanWords: 0,
    };
    if (d.date === today) todayPart = part;
    else addTotals(before, part);
    if (d.stats.gymDone) gymDays++;
    if (d.wakeDone) wakeDays++;
    if (d.stats.completed > 0) activeDays++;
  }
  for (const l of ctx.data.problemLogs) {
    if (l.date < today) before.dsaProblems += l.count;
    else if (l.date === today) todayPart.dsaProblems += l.count;
  }
  for (const l of ctx.data.germanLogs) {
    if (l.date < today) before.germanWords += l.words;
    else if (l.date === today) todayPart.germanWords += l.words;
  }
  const all = addTotals({ ...before }, todayPart);

  const xp = xpFromTotals(all);
  const xpBefore = xpFromTotals(before);
  const rawToday = diffXp(xp, xpBefore);
  const todayXp = { ...rawToday, total: Math.max(0, rawToday.total) };
  const streak = streakFor(ctx, 'overall', today);
  const bestRun = longestRun(days, today);

  const badges = computeBadges({
    tasksCompleted: all.tasksCompleted,
    bestStreak: streak.longest,
    gymDays,
    studyMinutes: all.studyMinutes,
    dsaProblems: Math.max(0, all.dsaProblems),
    javaPhase1: sectionProgress(ctx.data.roadmaps.java, /^phase\s*1\b/i),
    germanA1: sectionProgress(ctx.data.roadmaps.german, /^a1\b/i),
    perfectDays: all.perfectDays,
    bestRun,
    wakeDays,
  });

  return {
    days,
    totals: { ...all, dsaProblems: Math.max(0, all.dsaProblems), germanWords: Math.max(0, all.germanWords), gymDays, wakeDays, activeDays, bestRun },
    xp,
    todayXp,
    level: levelFromXp(xp.total),
    streak,
    badges,
  };
}

function addTotals(into: ActivityTotals, add: ActivityTotals): ActivityTotals {
  into.tasksCompleted += add.tasksCompleted;
  into.highPriorityCompleted += add.highPriorityCompleted;
  into.studyMinutes += add.studyMinutes;
  into.streakDays += add.streakDays;
  into.perfectDays += add.perfectDays;
  into.dsaProblems += add.dsaProblems;
  into.germanWords += add.germanWords;
  return into;
}

/* ───────────────────────── activity graph ───────────────────────── */

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Green level for a day, like GitHub's contribution graph:
 * 0 nothing done (or nothing planned) · 1 under 40 % · 2 under 60 % ·
 * 3 under 80 % · 4 a Day-streak day (80 %+).
 */
export function heatLevel(s: Pick<DayStats, 'total' | 'skipped' | 'completed'>): HeatLevel {
  const n = s.total - s.skipped;
  if (n <= 0 || s.completed <= 0) return 0;
  if (isStreakDay(s)) return 4;
  const pct = (s.completed / n) * 100;
  return pct < 40 ? 1 : pct < 60 ? 2 : 3;
}

// Formatters are created once: building one per cell is the slowest part of the graph.
const CELL_DATE = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const MONTH_NAME = new Intl.DateTimeFormat('en-US', { month: 'short' });

/** "Mon, Oct 5: 83% done, 3 h study" */
export function heatCellLabel(date: string, s: Pick<DayStats, 'completionPct' | 'studyMinutes'>): string {
  const day = CELL_DATE.format(parseISODate(date));
  const done = s.completionPct === null ? 'no tasks' : `${s.completionPct}% done`;
  return `${day}: ${done}, ${formatHours(s.studyMinutes)} h study`;
}

/** `weeks` columns of Monday…Sunday dates, the last one being this week. */
export function heatmapColumns(today: string, weeks = 52): string[][] {
  const first = addDays(startOfWeek(today), -7 * (weeks - 1));
  const columns: string[][] = [];
  let d = first;
  for (let w = 0; w < weeks; w++) {
    const col: string[] = [];
    for (let i = 0; i < 7; i++) {
      col.push(d);
      d = addDays(d, 1);
    }
    columns.push(col);
  }
  return columns;
}

/** Month names above the first column of each month (dropping a first label that would collide). */
export function heatmapMonthLabels(columns: string[][]): { col: number; label: string }[] {
  const out: { col: number; label: string }[] = [];
  let prev = '';
  columns.forEach((col, i) => {
    const month = col[0].slice(0, 7);
    if (month !== prev) {
      out.push({ col: i, label: MONTH_NAME.format(parseISODate(col[0])) });
      prev = month;
    }
  });
  if (out.length > 1 && out[1].col - out[0].col < 3) out.shift();
  return out;
}

export interface HeatCell {
  date: string;
  /** before = earlier than the plan start, future = after today (both drawn empty). */
  kind: 'day' | 'before' | 'future';
  level: HeatLevel;
  label: string;
  isToday: boolean;
}

export interface HeatmapData {
  columns: HeatCell[][];
  months: { col: number; label: string }[];
  /** Level-4 days shown. */
  streakDays: number;
  /** Days with at least one task done. */
  activeDays: number;
}

export function buildHeatmap(ctx: StatsContext, today: string, weeks = 52): HeatmapData {
  const start = ctx.data.settings.planStartDate;
  const dates = heatmapColumns(today, weeks);
  let streakDays = 0;
  let activeDays = 0;
  const columns = dates.map((col) =>
    col.map((date): HeatCell => {
      if (date > today) return { date, kind: 'future', level: 0, label: '', isToday: false };
      if (date < start) return { date, kind: 'before', level: 0, label: '', isToday: false };
      const s = dayStats(ctx, date);
      const level = heatLevel(s);
      if (level === 4) streakDays++;
      if (s.completed > 0) activeDays++;
      return { date, kind: 'day', level, label: heatCellLabel(date, s), isToday: date === today };
    }),
  );
  return { columns, months: heatmapMonthLabels(dates), streakDays, activeDays };
}

/* ───────────────────────── celebration ───────────────────────── */

export type Celebration = 'streak' | 'perfect';

export interface DayFlags {
  streak: boolean;
  perfect: boolean;
}

export function dayFlags(s: Pick<DayStats, 'total' | 'skipped' | 'completed'>): DayFlags {
  return { streak: isStreakDay(s), perfect: isPerfectDay(s) };
}

/** localStorage key remembering the celebration already shown for a date. */
export const celebrationKey = (date: string) => `kiran-planner:ui:celebrated:${date}`;

export function parseCelebrated(value: string | null): Celebration | null {
  return value === 'streak' || value === 'perfect' ? value : null;
}

/**
 * Celebrate when the day crosses 80 % (or 100 %) since the last check, at
 * most once per level per day (`already` = what was shown today).
 */
export function nextCelebration(prev: DayFlags, now: DayFlags, already: Celebration | null): Celebration | null {
  if (now.perfect && !prev.perfect && already !== 'perfect') return 'perfect';
  if (now.streak && !prev.streak && already === null) return 'streak';
  return null;
}
