/**
 * Calendar events (semester calendar + important dates): pure helpers for
 * lists, countdowns, multi-day ranges, the semester progress bar and the
 * add/edit form. Dates are local "YYYY-MM-DD", times "HH:mm".
 *
 * A multi-day event with times runs continuously from `date startTime` to
 * `endDate endTime` (the same meaning Apple and Google Calendar use).
 */
import type { CalendarEvent, EventKind, SemesterInfo } from '../types/extras';
import { addDays, daysBetween, eachDate, formatMonthYear, formatShortDate, formatTime12, isValidISODate, isValidTime, parseISODate } from './date';

type EventDates = Pick<CalendarEvent, 'date' | 'endDate'>;

export const KIND_LABELS: Record<EventKind, string> = {
  exam: 'Exam',
  test: 'Test',
  holiday: 'Holiday',
  deadline: 'Deadline',
  event: 'Event',
  class: 'Class',
  personal: 'Personal',
  other: 'Other',
};

export const EVENT_KINDS = Object.keys(KIND_LABELS) as EventKind[];

/* ───────────────────────── dates & ranges ───────────────────────── */

/** Last day (inclusive) of an event. */
export function eventEnd(e: EventDates): string {
  return e.endDate && e.endDate > e.date ? e.endDate : e.date;
}

export function isMultiDay(e: EventDates): boolean {
  return eventEnd(e) !== e.date;
}

/** Number of calendar days an event covers (1 for a single day). */
export function eventLength(e: EventDates): number {
  return daysBetween(e.date, eventEnd(e)) + 1;
}

/** Every date an event covers: a multi-day event expands to each of its days (max one year). */
export function eventDays(e: EventDates): string[] {
  return eachDate(e.date, eventEnd(e)).slice(0, 366);
}

export function occursOn(e: EventDates, date: string): boolean {
  return e.date <= date && date <= eventEnd(e);
}

/** By start date, all-day before timed, then start time, then title. */
export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  return a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.title.localeCompare(b.title);
}

export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(compareEvents);
}

/** Events happening on a date (multi-day events count on each of their days). */
export function eventsOn(events: CalendarEvent[], date: string): CalendarEvent[] {
  return sortEvents(events.filter((e) => occursOn(e, date)));
}

/** Events that are not over yet on `today` (ongoing ones first), soonest first. */
export function upcoming(events: CalendarEvent[], today: string, n = Infinity): CalendarEvent[] {
  return sortEvents(events.filter((e) => eventEnd(e) >= today)).slice(0, n);
}

/** Whole days from today to a date (negative = in the past). */
export function daysUntil(today: string, date: string): number {
  return daysBetween(today, date);
}

/** Map of date → events for every day from `from` to `to` (inclusive). */
export function eventsByDate(events: CalendarEvent[], from: string, to: string): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of sortEvents(events)) {
    const start = e.date > from ? e.date : from;
    const end = eventEnd(e) < to ? eventEnd(e) : to;
    if (start > end) continue;
    for (const d of eachDate(start, end)) {
      const list = map.get(d);
      if (list) list.push(e);
      else map.set(d, [e]);
    }
  }
  return map;
}

/* ───────────────────────── labels ───────────────────────── */

/** "Today", "Tomorrow", "Yesterday", "in 5 days", "3 days ago". */
export function relativeDayLabel(today: string, date: string): string {
  const n = daysBetween(today, date);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

export type EventPhase = 'past' | 'today' | 'ongoing' | 'upcoming';

export interface EventTiming {
  phase: EventPhase;
  /** Days until the start (upcoming), until the last day (ongoing) or since the end (past). */
  days: number;
  /** Day number within a multi-day event that is on today (1-based). */
  dayIndex: number;
  totalDays: number;
}

export function eventTiming(e: EventDates, today: string): EventTiming {
  const end = eventEnd(e);
  const totalDays = eventLength(e);
  if (end < today) return { phase: 'past', days: daysBetween(end, today), dayIndex: 0, totalDays };
  if (e.date > today) return { phase: 'upcoming', days: daysBetween(today, e.date), dayIndex: 0, totalDays };
  if (totalDays === 1) return { phase: 'today', days: 0, dayIndex: 1, totalDays };
  return { phase: 'ongoing', days: daysBetween(today, end), dayIndex: daysBetween(e.date, today) + 1, totalDays };
}

/** Short status shown on an event row: "Tomorrow", "in 5 days", "Day 3 of 8", "Past". */
export function timingLabel(e: EventDates, today: string): string {
  const t = eventTiming(e, today);
  switch (t.phase) {
    case 'past':
      return 'Past';
    case 'today':
      return 'Today';
    case 'upcoming':
      return relativeDayLabel(today, e.date);
    case 'ongoing':
      if (t.dayIndex === 1) return 'Starts today';
      if (t.days === 0) return 'Last day today';
      return `Day ${t.dayIndex} of ${t.totalDays}`;
  }
}

/** Abbreviation in brackets at the end of a title: "First Internal Assessment Test (IA-1)" → "IA-1". */
export function shortTitle(e: Pick<CalendarEvent, 'title'>): string {
  const m = /\(([^()]{1,12})\)\s*$/.exec(e.title);
  return m ? m[1].trim() : e.title;
}

/** "IA-1 starts in 17 days", "Last working day is tomorrow", "IA-1 test today", "IA-1 test · day 3 of 8". */
export function countdownText(e: CalendarEvent, today: string): string {
  const t = eventTiming(e, today);
  const name = shortTitle(e);
  // "IA-1 test", but never "Gandhi Jayanthi holiday".
  const named = name !== e.title && (e.kind === 'test' || e.kind === 'exam') ? `${name} ${KIND_LABELS[e.kind].toLowerCase()}` : name;
  switch (t.phase) {
    case 'upcoming': {
      const verb = isMultiDay(e) || e.kind === 'test' || e.kind === 'exam' || e.kind === 'class' ? 'starts' : 'is';
      return `${name} ${verb} ${t.days === 1 ? 'tomorrow' : `in ${t.days} days`}`;
    }
    case 'today':
      return `${named} today`;
    case 'ongoing':
      if (t.dayIndex === 1) return `${named} starts today`;
      return `${named} · day ${t.dayIndex} of ${t.totalDays}`;
    case 'past':
      return `${name} was ${t.days === 1 ? 'yesterday' : `${t.days} days ago`}`;
  }
}

/** "Oct 22", "Oct 22 – 29", "Sep 28 – Oct 2", "Dec 28, 2026 – Jan 1, 2027". */
export function formatDateRange(start: string, end: string): string {
  if (end <= start) return formatShortDate(start);
  const s = parseISODate(start);
  const e = parseISODate(end);
  if (s.getFullYear() !== e.getFullYear()) {
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`;
  }
  if (s.getMonth() === e.getMonth()) return `${formatShortDate(start)} – ${e.getDate()}`;
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

/** "Oct 22 – 29 · 8 days" for multi-day events, "" for single days. */
export function rangeText(e: EventDates): string {
  if (!isMultiDay(e)) return '';
  return `${formatDateRange(e.date, eventEnd(e))} · ${eventLength(e)} days`;
}

/** "2:30 PM – 4:30 PM", "2:30 PM", or "" for all-day events. */
export function timeText(e: Pick<CalendarEvent, 'startTime' | 'endTime'>): string {
  if (!e.startTime) return '';
  return e.endTime ? `${formatTime12(e.startTime)} – ${formatTime12(e.endTime)}` : formatTime12(e.startTime);
}

export interface MonthGroup {
  key: string;
  label: string;
  events: CalendarEvent[];
}

/** Groups (sorted) events by month. With `from`, events that started earlier are listed under from's month. */
export function groupByMonth(events: CalendarEvent[], from?: string): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const e of sortEvents(events)) {
    const anchor = from && e.date < from ? from : e.date;
    const key = anchor.slice(0, 7);
    let g = groups.find((x) => x.key === key);
    if (!g) {
      const [y, m] = key.split('-').map(Number);
      g = { key, label: formatMonthYear(y, m), events: [] };
      groups.push(g);
    }
    g.events.push(e);
  }
  return groups.sort((a, b) => a.key.localeCompare(b.key));
}

/* ───────────────────────── filters & finders ───────────────────────── */

export type EventFilter = 'all' | 'important' | 'exams' | 'holidays';

export function filterEvents(events: CalendarEvent[], filter: EventFilter): CalendarEvent[] {
  switch (filter) {
    case 'important':
      return events.filter((e) => e.important);
    case 'exams':
      return events.filter((e) => e.kind === 'exam' || e.kind === 'test');
    case 'holidays':
      return events.filter((e) => e.kind === 'holiday');
    default:
      return events;
  }
}

/** First event (ongoing or upcoming) that matches. */
export function nextEvent(events: CalendarEvent[], today: string, match: (e: CalendarEvent) => boolean): CalendarEvent | undefined {
  return upcoming(events.filter(match), today)[0];
}

/** Next (or ongoing) test or exam: IA-1, IA-2, lab IA, SEE… */
export function nextAssessment(events: CalendarEvent[], today: string): CalendarEvent | undefined {
  return nextEvent(events, today, (e) => e.kind === 'test' || e.kind === 'exam');
}

export function nextHoliday(events: CalendarEvent[], today: string): CalendarEvent | undefined {
  return nextEvent(events, today, (e) => e.kind === 'holiday');
}

/** The semester's "Last working day" entry, if there is one. */
export function lastWorkingDay(events: CalendarEvent[]): CalendarEvent | undefined {
  return sortEvents(events.filter((e) => /last working day/i.test(e.title))).pop();
}

const ALWAYS_SHOWN: EventKind[] = ['holiday', 'exam', 'test', 'deadline'];

/**
 * Worth marking on a day: important dates, holidays, tests, exams, deadlines
 * and timed events on every day they cover; other multi-day events (a month
 * long department course) only on their first day, so they don't crowd the view.
 */
export function isNotableOn(e: CalendarEvent, date: string): boolean {
  return occursOn(e, date) && (e.important || e.date === date || e.startTime !== undefined || ALWAYS_SHOWN.includes(e.kind));
}

/** Events worth showing on Today (and the month grid) for a date. */
export function relevantOn(events: CalendarEvent[], date: string): CalendarEvent[] {
  return eventsOn(events, date).filter((e) => isNotableOn(e, date));
}

/* ───────────────────────── semester progress ───────────────────────── */

export interface SemesterProgress {
  phase: 'before' | 'during' | 'after';
  /** Current week (1-based); 0 before the start. */
  week: number;
  totalWeeks: number;
  /** Share of the semester's days already behind you (0–100). */
  pct: number;
  totalDays: number;
  /** Days until the last day (0 on/after it). */
  daysLeft: number;
  /** Days until the first day (0 once started). */
  daysToStart: number;
}

export function semesterProgress(info: Pick<SemesterInfo, 'startDate' | 'endDate'>, today: string): SemesterProgress {
  const totalDays = Math.max(1, daysBetween(info.startDate, info.endDate) + 1);
  const totalWeeks = Math.ceil(totalDays / 7);
  if (today < info.startDate) {
    return { phase: 'before', week: 0, totalWeeks, pct: 0, totalDays, daysLeft: totalDays, daysToStart: daysBetween(today, info.startDate) };
  }
  if (today > info.endDate) return { phase: 'after', week: totalWeeks, totalWeeks, pct: 100, totalDays, daysLeft: 0, daysToStart: 0 };
  const elapsed = daysBetween(info.startDate, today);
  return {
    phase: 'during',
    week: Math.min(totalWeeks, Math.floor(elapsed / 7) + 1),
    totalWeeks,
    pct: Math.round((elapsed / totalDays) * 100),
    totalDays,
    daysLeft: daysBetween(today, info.endDate),
    daysToStart: 0,
  };
}

/* ───────────────────────── add / edit form ───────────────────────── */

export interface EventFormValues {
  title: string;
  date: string;
  /** '' = single day. */
  endDate: string;
  allDay: boolean;
  startTime: string;
  /** '' = no end time. */
  endTime: string;
  kind: EventKind;
  important: boolean;
  notes: string;
}

export type EventFormErrors = Partial<Record<keyof EventFormValues, string>>;

export function emptyEventForm(date: string): EventFormValues {
  return { title: '', date, endDate: '', allDay: true, startTime: '09:00', endTime: '', kind: 'personal', important: true, notes: '' };
}

export function eventToForm(e: CalendarEvent): EventFormValues {
  return {
    title: e.title,
    date: e.date,
    endDate: e.endDate && e.endDate > e.date ? e.endDate : '',
    allDay: !e.startTime,
    startTime: e.startTime ?? '09:00',
    endTime: e.endTime ?? '',
    kind: e.kind,
    important: e.important,
    notes: e.notes,
  };
}

/** Empty title, invalid dates/times, end before start. */
export function validateEventForm(v: EventFormValues): EventFormErrors {
  const errors: EventFormErrors = {};
  if (!v.title.trim()) errors.title = 'Give the date a title.';
  else if (v.title.trim().length > 300) errors.title = 'Keep the title under 300 characters.';
  if (!isValidISODate(v.date)) errors.date = 'Pick a valid date.';
  if (v.endDate) {
    if (!isValidISODate(v.endDate)) errors.endDate = 'Pick a valid end date.';
    else if (isValidISODate(v.date) && v.endDate < v.date) errors.endDate = 'The end date can’t be before the start date.';
  }
  if (!v.allDay) {
    if (!isValidTime(v.startTime)) errors.startTime = 'Enter a valid start time.';
    if (v.endTime) {
      if (!isValidTime(v.endTime)) errors.endTime = 'Enter a valid end time.';
      else if (isValidTime(v.startTime) && (!v.endDate || v.endDate <= v.date) && v.endTime <= v.startTime)
        errors.endTime = 'End time must be after the start time.';
    }
  }
  if (v.notes.length > 2000) errors.notes = 'Keep notes under 2000 characters.';
  return errors;
}

/** Form values → event fields (only sets the optional ones that apply). */
export function formToEvent(v: EventFormValues): Omit<CalendarEvent, 'id' | 'source'> {
  const out: Omit<CalendarEvent, 'id' | 'source'> = {
    title: v.title.trim(),
    date: v.date,
    kind: v.kind,
    important: v.important,
    notes: v.notes.trim(),
  };
  if (v.endDate && v.endDate > v.date) out.endDate = v.endDate;
  if (!v.allDay) {
    out.startTime = v.startTime;
    if (v.endTime) out.endTime = v.endTime;
  }
  return out;
}

/* ───────────────────────── import helpers ───────────────────────── */

/** Same title (ignoring case and spacing) on the same start date = duplicate. */
export function dedupeKey(e: Pick<CalendarEvent, 'title' | 'date'>): string {
  return `${e.title.trim().toLowerCase().replace(/\s+/g, ' ')}|${e.date}`;
}

/** For each candidate: is it already in `existing` (or earlier in the candidate list)? */
export function markDuplicates<T extends Pick<CalendarEvent, 'title' | 'date'>>(existing: CalendarEvent[], candidates: T[]): { item: T; duplicate: boolean }[] {
  const seen = new Set(existing.map(dedupeKey));
  return candidates.map((item) => {
    const key = dedupeKey(item);
    const duplicate = seen.has(key);
    seen.add(key);
    return { item, duplicate };
  });
}

/** Best guess of the kind from a title / category text. */
export function guessKind(text: string): EventKind {
  const t = text.toLowerCase();
  if (/\b(holiday|jayant[hi]*|festival|diwali|deepavali|christmas|new year|republic day|independence day|vacation)\b/.test(t)) return 'holiday';
  if (/\b(exams?|see|finals?|end[- ]sem(ester)?)\b/.test(t)) return 'exam';
  if (/\b(tests?|ia-?\d|quiz(zes)?|assessments?|viva|mid-?terms?)\b/.test(t)) return 'test';
  if (/\b(deadline|due|submission|submit|last date|registration)\b/.test(t)) return 'deadline';
  if (/\b(class(es)?|lectures?|lab|timetable)\b/.test(t)) return 'class';
  if (/\b(birthday|anniversary)\b/.test(t)) return 'personal';
  return 'event';
}

/** Official semester dates that were deleted and can be brought back. */
export function missingOfficial(events: CalendarEvent[], official: CalendarEvent[]): CalendarEvent[] {
  const ids = new Set(events.map((e) => e.id));
  return official.filter((o) => !ids.has(o.id));
}

/** Last date (exclusive) helper used by the .ics export. */
export function dayAfterEnd(e: EventDates): string {
  return addDays(eventEnd(e), 1);
}
