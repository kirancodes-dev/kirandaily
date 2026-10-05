/**
 * iCalendar (.ics, RFC 5545) export and import.
 *
 * Export puts the semester dates and the repeating timetable into Apple
 * Calendar (iPhone/Mac) or Google Calendar, whose alerts work even when this
 * app is closed. Import reads events from another calendar's .ics file.
 * It is a one-time copy either way: a static website can't keep a live link.
 */
import type { CalendarEvent, EventKind } from '../types/extras';
import type { CategoryDef, Recurrence, TaskTemplate } from '../types/task';
import { addDays, dayOfWeek, isValidISODate, timeToMinutes, minutesToTime } from './date';
import { recurrenceMatches, describeRecurrence } from './schedule';
import { currentTemplates } from './taskActions';
import { EVENT_KINDS, KIND_LABELS, dayAfterEnd, eventEnd, guessKind, isMultiDay } from './events';

const CRLF = '\r\n';
export const KOLKATA = 'Asia/Kolkata';
const PRODID = '-//Kiran Planner//Calendar export 1.1//EN';
const UID_DOMAIN = 'kiran-planner';

/**
 * Time zone written into timed events: an IANA name (only Asia/Kolkata gets a
 * VTIMEZONE, India has no daylight saving) or null for "floating" local times,
 * which show at the same clock time wherever the phone is.
 */
export type IcsTimeZone = typeof KOLKATA | null;

/* ───────────────────────── low-level writing ───────────────────────── */

/** Escapes TEXT values: backslash, semicolon, comma and newlines. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function utf8Length(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp < 0x80) return 1;
  if (cp < 0x800) return 2;
  if (cp < 0x10000) return 3;
  return 4;
}

/** Folds a content line at 75 octets (UTF-8), never splitting a character. Continuation lines start with a space. */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const len = utf8Length(ch);
    if (bytes + len > limit) {
      parts.push(cur);
      cur = '';
      bytes = 0;
      limit = 74; // the leading space counts towards the 75
    }
    cur += ch;
    bytes += len;
  }
  parts.push(cur);
  return parts.join(`${CRLF} `);
}

/** "2026-10-22" → "20261022" */
export function icsDate(date: string): string {
  return date.replace(/-/g, '');
}

/** ("2026-10-31", "14:30") → "20261031T143000" */
export function icsDateTime(date: string, time: string): string {
  return `${icsDate(date)}T${time.replace(':', '')}00`;
}

/** UTC timestamp, e.g. DTSTAMP: "20261005T141500Z". */
export function icsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

const VTIMEZONE_KOLKATA = [
  'BEGIN:VTIMEZONE',
  `TZID:${KOLKATA}`,
  'BEGIN:STANDARD',
  'DTSTART:19700101T000000',
  'TZOFFSETFROM:+0530',
  'TZOFFSETTO:+0530',
  'TZNAME:IST',
  'END:STANDARD',
  'END:VTIMEZONE',
];

function timeProp(name: 'DTSTART' | 'DTEND' | 'EXDATE', date: string, time: string, tz: IcsTimeZone): string {
  return tz ? `${name};TZID=${tz}:${icsDateTime(date, time)}` : `${name}:${icsDateTime(date, time)}`;
}

/** Wraps VEVENT blocks into a complete calendar (CRLF line endings, folded lines). */
export function buildCalendar(calName: string, vevents: string[][], tz: IcsTimeZone): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calName)}`,
    ...(tz ? [`X-WR-TIMEZONE:${tz}`, ...VTIMEZONE_KOLKATA] : []),
    ...vevents.flat(),
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}

function alarm(trigger: string, text: string): string[] {
  return ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(text)}`, `TRIGGER:${trigger}`, 'END:VALARM'];
}

/* ───────────────────────── semester & important dates ───────────────────────── */

export interface EventsIcsOptions {
  /** Used for DTSTAMP. */
  now: Date;
  timeZone: IcsTimeZone;
  calName?: string;
}

/** One VEVENT for a calendar event: all-day (exclusive DTEND) or timed; important ones get an alert a day before. */
export function eventToVevent(e: CalendarEvent, opts: EventsIcsOptions): string[] {
  const lines = ['BEGIN:VEVENT', `UID:${e.id}@${UID_DOMAIN}`, `DTSTAMP:${icsUtc(opts.now)}`];
  if (e.startTime) {
    const end = eventEnd(e);
    lines.push(timeProp('DTSTART', e.date, e.startTime, opts.timeZone));
    if (e.endTime) {
      // A one-day event can't end before it starts: treat that as ending the next morning.
      const endDate = end === e.date && e.endTime <= e.startTime ? addDays(e.date, 1) : end;
      lines.push(timeProp('DTEND', endDate, e.endTime, opts.timeZone));
    }
    else if (isMultiDay(e)) lines.push(timeProp('DTEND', end, '23:59', opts.timeZone));
    else lines.push('DURATION:PT1H');
  } else {
    lines.push(`DTSTART;VALUE=DATE:${icsDate(e.date)}`, `DTEND;VALUE=DATE:${icsDate(dayAfterEnd(e))}`, 'TRANSP:TRANSPARENT');
  }
  lines.push(`SUMMARY:${escapeText(e.title)}`);
  const source = e.source === 'semester' ? 'From the official semester calendar' : 'From Kiran Planner';
  lines.push(`DESCRIPTION:${escapeText(e.notes ? `${e.notes}\n\n${source}` : source)}`);
  lines.push(`CATEGORIES:${[KIND_LABELS[e.kind], ...(e.important ? ['Important'] : [])].map(escapeText).join(',')}`);
  if (e.important) {
    // All-day: 9 AM the day before (start is midnight). Timed: 24 hours before.
    lines.push(...alarm(e.startTime ? '-P1D' : '-PT15H', `Tomorrow: ${e.title}`));
  }
  lines.push('END:VEVENT');
  return lines;
}

export function eventsToIcs(events: CalendarEvent[], opts: EventsIcsOptions): string {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  return buildCalendar(opts.calName ?? 'Kiran – Semester & important dates', sorted.map((e) => eventToVevent(e, opts)), opts.timeZone);
}

/* ───────────────────────── timetable (repeating) ───────────────────────── */

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

/** Days of the week (0 = Sunday) a recurrence covers. */
export function recurrenceDays(rec: Recurrence): number[] {
  return MONDAY_FIRST.filter((d) => recurrenceMatches(rec, d));
}

/** RRULE value for a recurrence: daily → FREQ=DAILY, otherwise weekly with BYDAY. Null when it never repeats. */
export function recurrenceRule(rec: Recurrence, until?: string): string | null {
  const days = recurrenceDays(rec);
  if (days.length === 0) return null;
  const base = days.length === 7 ? 'FREQ=DAILY' : `FREQ=WEEKLY;BYDAY=${days.map((d) => BYDAY[d]).join(',')}`;
  return until ? `${base};UNTIL=${until}` : base;
}

/** First date on/after `from` (within a week) on which the recurrence happens. */
export function firstOccurrence(rec: Recurrence, from: string): string | null {
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i);
    if (recurrenceMatches(rec, dayOfWeek(d))) return d;
  }
  return null;
}

/** Routine items (wake, meals, travel, sleep) use the "routine" category. */
const ROUTINE_CATEGORY = 'routine';

/**
 * Blocks that only happen because there is college that day: College itself
 * (the "classes" category) and the trips to and from it. Study, gym, meals
 * and sleep still happen on a holiday.
 */
const COLLEGE_DAY_KEYS = ['college', 'getready', 'travel'];

export function isCollegeDayTemplate(t: Pick<TaskTemplate, 'key' | 'category'>): boolean {
  return t.category === 'classes' || (!!t.key && COLLEGE_DAY_KEYS.includes(t.key));
}

/** First and last date (inclusive) a template repeats in an export, or null when it never happens. */
function exportSpan(t: TaskTemplate, today: string, until?: string): { first: string; last?: string } | null {
  const from = t.startDate > today ? t.startDate : today;
  const last = [t.endDate, until].filter((x): x is string => !!x && isValidISODate(x)).sort()[0];
  const first = firstOccurrence(t.recurrence, from);
  if (!first || (last && first > last)) return null;
  return { first, last };
}

/** Holidays on which a college-day block would otherwise repeat (they become EXDATEs). */
export function holidayExceptions(t: TaskTemplate, holidays: string[], today: string, until?: string): string[] {
  if (!isCollegeDayTemplate(t)) return [];
  const span = exportSpan(t, today, until);
  if (!span) return [];
  return holidays.filter((d) => d >= span.first && (!span.last || d <= span.last) && recurrenceMatches(t.recurrence, dayOfWeek(d)));
}

/** Holidays that fall on a college day of any of these blocks (for the export summary). */
export function skippedHolidays(templates: TaskTemplate[], holidays: string[], today: string, until?: string): string[] {
  return [...new Set(templates.flatMap((t) => holidayExceptions(t, holidays, today, until)))].sort();
}

/** The current repeating timetable (active from today), optionally without routine items. */
export function timetableTemplates(templates: TaskTemplate[], today: string, includeRoutine: boolean): TaskTemplate[] {
  return currentTemplates(templates, today).filter((t) => includeRoutine || t.category !== ROUTINE_CATEGORY);
}

export interface TimetableIcsOptions {
  today: string;
  now: Date;
  timeZone: IcsTimeZone;
  /** Alert this many minutes before each block starts; null = no alerts. */
  alertMinutes: number | null;
  /** Stop repeating after this date (e.g. the semester's end), on top of each template's own end date. */
  until?: string;
  /** Holidays: college-day blocks (college, travel) are left out on these dates with EXDATE. */
  holidays?: string[];
  categories: CategoryDef[];
  calName?: string;
}

/** UNTIL for a last date: end of that day, in UTC when a time zone is used (RFC 5545 requires it). */
function untilValue(date: string, tz: IcsTimeZone): string {
  if (!tz) return icsDateTime(date, '23:59').replace(/00$/, '59');
  const [y, m, d] = date.split('-').map(Number);
  return icsUtc(new Date(zonedWallToUtc({ y, m, d, h: 23, mi: 59, s: 59 }, tz)));
}

export function templateToVevent(t: TaskTemplate, opts: TimetableIcsOptions): string[] | null {
  const span = exportSpan(t, opts.today, opts.until);
  if (!span) return null;
  const { first, last } = span;
  const rule = recurrenceRule(t.recurrence, last ? untilValue(last, opts.timeZone) : undefined);
  if (!rule) return null;
  // Sleep (22:00 → 05:00) crosses midnight: it ends the next morning.
  const endDate = timeToMinutes(t.endTime) <= timeToMinutes(t.startTime) ? addDays(first, 1) : first;
  const category = opts.categories.find((c) => c.id === t.category)?.label ?? t.category;
  const details = [
    `${category} · ${describeRecurrence(t.recurrence)}`,
    t.rotateSubjects ? 'The college subject changes every day – see the app.' : '',
    t.notes,
    'From your Kiran Planner timetable',
  ].filter(Boolean);
  const lines = [
    'BEGIN:VEVENT',
    `UID:${t.id}@${UID_DOMAIN}`,
    `DTSTAMP:${icsUtc(opts.now)}`,
    timeProp('DTSTART', first, t.startTime, opts.timeZone),
    timeProp('DTEND', endDate, t.endTime, opts.timeZone),
    `RRULE:${rule}`,
    // EXDATE has the same form (time zone or floating) as DTSTART, as RFC 5545 requires.
    ...holidayExceptions(t, opts.holidays ?? [], opts.today, opts.until).map((d) => timeProp('EXDATE', d, t.startTime, opts.timeZone)),
    `SUMMARY:${escapeText(t.title)}`,
    `DESCRIPTION:${escapeText(details.join('\n'))}`,
    `CATEGORIES:${escapeText(category)}`,
  ];
  if (opts.alertMinutes !== null) {
    const trigger = opts.alertMinutes > 0 ? `-PT${opts.alertMinutes}M` : 'PT0S';
    const when = opts.alertMinutes > 0 ? `in ${opts.alertMinutes} min` : 'now';
    lines.push(...alarm(trigger, `${t.title} starts ${when}`));
  }
  lines.push('END:VEVENT');
  return lines;
}

export function timetableToIcs(templates: TaskTemplate[], opts: TimetableIcsOptions & { includeRoutine: boolean }): string {
  const vevents = timetableTemplates(templates, opts.today, opts.includeRoutine)
    .map((t) => templateToVevent(t, opts))
    .filter((v): v is string[] => v !== null);
  return buildCalendar(opts.calName ?? 'Kiran – Timetable', vevents, opts.timeZone);
}

/* ───────────────────────── time zones ───────────────────────── */

interface Wall {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

export function isKnownTimeZone(tz: string): boolean {
  try {
    formatterFor(tz);
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock time in a zone (or the device's own zone when tz is undefined) for a UTC instant. */
function wallAt(utcMs: number, tz?: string): Wall {
  if (!tz) {
    const d = new Date(utcMs);
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds() };
  }
  const p = Object.fromEntries(formatterFor(tz).formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
}

function wallToMs(w: Wall): number {
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
}

/** UTC instant of a wall-clock time in an IANA zone. */
function zonedWallToUtc(w: Wall, tz: string): number {
  const guess = wallToMs(w);
  const offset1 = wallToMs(wallAt(guess, tz)) - guess;
  const utc = guess - offset1;
  const offset2 = wallToMs(wallAt(utc, tz)) - utc;
  return offset2 === offset1 ? utc : guess - offset2;
}

function wallToParts(w: Wall): { date: string; time: string } {
  const p = (n: number) => String(n).padStart(2, '0');
  return { date: `${w.y}-${p(w.m)}-${p(w.d)}`, time: `${p(w.h)}:${p(w.mi)}` };
}

/* ───────────────────────── reading ───────────────────────── */

/** Undoes line folding (CRLF/LF + space or tab) and drops empty lines. */
export function unfoldLines(text: string): string[] {
  const out: string[] = [];
  for (const line of text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/)) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) out[out.length - 1] += line.slice(1);
    else if (line.trim()) out.push(line);
  }
  return out;
}

export interface ContentLine {
  name: string;
  params: Record<string, string>;
  value: string;
}

function splitOutsideQuotes(text: string, sep: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    if (ch === sep && !quoted) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

/** "DTSTART;TZID=Asia/Kolkata:20261031T143000" → { name, params, value }. */
export function parseContentLine(line: string): ContentLine | null {
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ':' && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon <= 0) return null;
  const [name, ...rawParams] = splitOutsideQuotes(line.slice(0, colon), ';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"(.*)"$/, '$1');
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

/** Reverses escapeText. */
export function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

/** Splits a multi-value TEXT (CATEGORIES) on unescaped commas. */
function splitTextList(value: string): string[] {
  const parts: string[] = [];
  let cur = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '\\' && i + 1 < value.length) {
      cur += ch + value[++i];
    } else if (ch === ',') {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts.map((v) => unescapeText(v).trim()).filter(Boolean);
}

const DT_RE = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/;

/** "PT1H30M" → 90, "P2D" → 2880. */
export function parseDurationMinutes(value: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!m || value.trim() === 'P' || value.trim() === 'PT') return null;
  const [, sign, w, d, h, mi, s] = m;
  const total = Number(w ?? 0) * 10080 + Number(d ?? 0) * 1440 + Number(h ?? 0) * 60 + Number(mi ?? 0) + Math.floor(Number(s ?? 0) / 60);
  return sign === '-' ? -total : total;
}

export interface ParsedIcsEvent {
  uid: string;
  title: string;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  notes: string;
  kind: EventKind;
  important: boolean;
  /** Had an RRULE: only the first occurrence is imported. */
  recurring: boolean;
}

export interface IcsParseResult {
  /** The text looked like an iCalendar file. */
  valid: boolean;
  events: ParsedIcsEvent[];
  /** Events with RRULE (first occurrence imported). */
  recurringCount: number;
  /** VEVENTs that were cancelled or had no usable start date. */
  skipped: number;
  warnings: string[];
}

export interface IcsParseOptions {
  /** Convert times into this zone (default: the device's zone). */
  timeZone?: string;
}

interface ParsedWhen {
  date: string;
  time?: string;
}

/**
 * Reads VEVENTs: DTSTART/DTEND as DATE or DATE-TIME (UTC "Z", TZID or
 * floating, converted to local date/time), DURATION, SUMMARY, DESCRIPTION,
 * LOCATION, CATEGORIES and UID. Recurring events keep their first date only.
 */
export function parseIcs(text: string, opts: IcsParseOptions = {}): IcsParseResult {
  const lines = unfoldLines(text);
  const result: IcsParseResult = { valid: false, events: [], recurringCount: 0, skipped: 0, warnings: [] };
  if (!lines.some((l) => l.trim().toUpperCase() === 'BEGIN:VCALENDAR')) return result;
  result.valid = true;

  // Fixed offsets declared in VTIMEZONE blocks, for TZIDs the browser doesn't know (e.g. Outlook's Windows names).
  const fixedOffsets = new Map<string, number>();
  const unknownZones = new Set<string>();
  const stack: string[] = [];
  let tzid: string | null = null;
  let current: ContentLine[] | null = null;
  const vevents: ContentLine[][] = [];

  for (const raw of lines) {
    const cl = parseContentLine(raw.trim());
    if (!cl) continue;
    if (cl.name === 'BEGIN') {
      const comp = cl.value.trim().toUpperCase();
      stack.push(comp);
      if (comp === 'VEVENT' && stack.length === 2) current = [];
      if (comp === 'VTIMEZONE') tzid = null;
      continue;
    }
    if (cl.name === 'END') {
      const comp = stack.pop();
      if (comp === 'VEVENT' && current) {
        vevents.push(current);
        current = null;
      }
      continue;
    }
    const top = stack[stack.length - 1];
    if (top === 'VEVENT' && current) current.push(cl);
    else if (top === 'VTIMEZONE' && cl.name === 'TZID') tzid = cl.value.trim();
    else if (top === 'STANDARD' && cl.name === 'TZOFFSETTO' && tzid && !fixedOffsets.has(tzid)) {
      const m = /^([+-])(\d{2})(\d{2})/.exec(cl.value.trim());
      if (m) fixedOffsets.set(tzid, (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])));
    }
  }

  const toWall = (cl: ContentLine): ParsedWhen | null => {
    const m = DT_RE.exec(cl.value.trim());
    if (!m) return null;
    const [, y, mo, d, h, mi, s, z] = m;
    const date = `${y}-${mo}-${d}`;
    if (!isValidISODate(date)) return null;
    if (h === undefined || cl.params.VALUE === 'DATE') return { date };
    const wall: Wall = { y: +y, m: +mo, d: +d, h: +h, mi: +mi, s: +(s ?? 0) };
    if (wall.h > 23 || wall.mi > 59) return null;
    let utc: number | null = null;
    if (z) utc = wallToMs(wall);
    else if (cl.params.TZID) {
      const zone = cl.params.TZID.replace(/^\//, '');
      if (isKnownTimeZone(zone)) utc = zonedWallToUtc(wall, zone);
      else if (fixedOffsets.has(cl.params.TZID)) utc = wallToMs(wall) - fixedOffsets.get(cl.params.TZID)! * 60_000;
      else unknownZones.add(cl.params.TZID);
    }
    // Floating (or unknown zone): keep the clock time as written.
    return wallToParts(utc === null ? wall : wallAt(utc, opts.timeZone));
  };

  for (const props of vevents) {
    const get = (name: string) => props.find((p) => p.name === name);
    if (get('STATUS')?.value.trim().toUpperCase() === 'CANCELLED') {
      result.skipped++;
      continue;
    }
    const startLine = get('DTSTART');
    const start = startLine ? toWall(startLine) : null;
    if (!start) {
      result.skipped++;
      continue;
    }
    const endLine = get('DTEND');
    let end = endLine ? toWall(endLine) : null;
    const durationLine = get('DURATION');
    const duration = durationLine ? parseDurationMinutes(durationLine.value) : null;

    const ev: ParsedIcsEvent = {
      uid: get('UID')?.value.trim() ?? '',
      title: (unescapeText(get('SUMMARY')?.value ?? '').trim() || '(No title)').slice(0, 300),
      date: start.date,
      notes: '',
      kind: 'event',
      important: false,
      recurring: !!get('RRULE'),
    };

    if (!start.time) {
      // All-day: DTEND is exclusive.
      let lastDay = start.date;
      if (end && !end.time && end.date > start.date) lastDay = addDays(end.date, -1);
      else if (!end && duration && duration >= 1440) lastDay = addDays(start.date, Math.floor(duration / 1440) - 1);
      if (lastDay > start.date) ev.endDate = lastDay;
    } else {
      ev.startTime = start.time;
      if (!end && duration && duration > 0) {
        const startMin = timeToMinutes(start.time) + duration;
        end = { date: addDays(start.date, Math.floor(startMin / 1440)), time: minutesToTime(startMin % 1440) };
      }
      if (end?.time && end.date === addDays(start.date, 1) && end.time === '00:00') {
        ev.endTime = '23:59'; // ends at midnight: keep it a one-day event
      } else if (end?.time && (end.date > start.date || end.time > start.time)) {
        ev.endTime = end.time;
        if (end.date > start.date) ev.endDate = end.date;
      }
    }

    const description = unescapeText(get('DESCRIPTION')?.value ?? '').trim();
    const location = unescapeText(get('LOCATION')?.value ?? '').trim();
    ev.notes = [description, location ? `Location: ${location}` : ''].filter(Boolean).join('\n').slice(0, 2000);

    const categories = props.filter((p) => p.name === 'CATEGORIES').flatMap((p) => splitTextList(p.value));
    const lower = categories.map((c) => c.toLowerCase());
    const kindFromCategory = EVENT_KINDS.find((k) => lower.includes(KIND_LABELS[k].toLowerCase()));
    ev.kind = kindFromCategory ?? guessKind(`${ev.title} ${categories.join(' ')}`);
    ev.important = lower.includes('important');
    if (ev.recurring) result.recurringCount++;
    result.events.push(ev);
  }

  result.events.sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  if (unknownZones.size > 0) result.warnings.push(`Unknown time zone ${[...unknownZones].join(', ')}: those times were kept as written.`);
  return result;
}

/** A parsed event as app data (source "import"). */
export function importedToEvent(p: ParsedIcsEvent, important = p.important): Omit<CalendarEvent, 'id'> {
  const e: Omit<CalendarEvent, 'id'> = { title: p.title, date: p.date, kind: p.kind, important, notes: p.notes, source: 'import' };
  if (p.endDate && p.endDate > p.date) e.endDate = p.endDate;
  if (p.startTime) e.startTime = p.startTime;
  if (p.startTime && p.endTime) e.endTime = p.endTime;
  return e;
}

/** The device's IANA zone, or undefined when unknown. */
export function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Time zone to write: Asia/Kolkata on a device set to India time (Chrome calls
 * it Asia/Calcutta), floating local times anywhere else. Pass deviceTimeZone().
 */
export function exportTimeZone(deviceZone: string | undefined): IcsTimeZone {
  return deviceZone === KOLKATA || deviceZone === 'Asia/Calcutta' ? KOLKATA : null;
}
