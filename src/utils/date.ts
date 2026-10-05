/**
 * Date/time helpers. Dates are stored as local "YYYY-MM-DD" strings and times
 * as "HH:mm" strings, so nothing shifts between time zones.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Monday-first order used by week views. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parses "YYYY-MM-DD" as a local date (midday, so DST never changes the day). */
export function parseISODate(value: string): Date {
  const m = DATE_RE.exec(value);
  if (!m) throw new Error(`Invalid date: ${value}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

export function addDays(date: string, days: number): string {
  const d = parseISODate(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function dayOfWeek(date: string): number {
  return parseISODate(date).getDay();
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: string): string {
  const dow = dayOfWeek(date);
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

/** Monday … Sunday of the week containing `date`. */
export function weekDates(date: string): string[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

/** All dates in a month. `month` is 1-12. */
export function monthDates(year: number, month: number): string[] {
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, i) => toISODate(new Date(year, month - 1, i + 1, 12)));
}

/** Calendar grid (Monday first). Cells outside the month are null. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const dates = monthDates(year, month);
  const lead = (dayOfWeek(dates[0]) + 6) % 7;
  const cells: (string | null)[] = [...Array(lead).fill(null), ...dates];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Inclusive list of dates from `from` to `to`. Empty if to < from. */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard < 3700) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard++;
  }
  return out;
}

export function formatLongDate(date: string): string {
  return parseISODate(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDate(date: string): string {
  return parseISODate(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatMonthYear(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const t = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Minutes between start and end. An end before the start crosses midnight (sleep). */
export function durationMinutes(start: string, end: string): number {
  if (!isValidTime(start) || !isValidTime(end)) return 0;
  const diff = timeToMinutes(end) - timeToMinutes(start);
  return diff > 0 ? diff : diff + 1440;
}

/** "17:30" → "5:30 PM" */
export function formatTime12(time: string): string {
  if (!isValidTime(time)) return time;
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** 270 → "4h 30m", 45 → "45m", 0 → "0h" */
export function formatMinutes(total: number): string {
  const mins = Math.max(0, Math.round(total));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0 && m === 0) return '0h';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** 4.5 → "4.5", 4 → "4" */
export function formatHours(minutes: number): string {
  const h = Math.round((minutes / 60) * 10) / 10;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
