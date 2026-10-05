import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../types/extras';
import type { TaskTemplate } from '../types/task';
import { createDefaultData } from '../data/defaultData';
import { createSemesterEvents } from '../data/semesterCalendar';
import { holidayDates } from './events';
import {
  escapeText,
  eventsToIcs,
  eventToVevent,
  exportTimeZone,
  firstOccurrence,
  foldLine,
  holidayExceptions,
  icsUtc,
  importedToEvent,
  isCollegeDayTemplate,
  KOLKATA,
  parseContentLine,
  parseDurationMinutes,
  parseIcs,
  recurrenceRule,
  skippedHolidays,
  templateToVevent,
  timetableTemplates,
  timetableToIcs,
  unescapeText,
  unfoldLines,
} from './ics';

const NOW = new Date('2026-10-05T08:45:00Z');
const utf8 = (s: string) => new TextEncoder().encode(s).length;
/** Unfolded content lines of a generated file. */
const linesOf = (ics: string) => unfoldLines(ics);

const ev = (over: Partial<CalendarEvent> & Pick<CalendarEvent, 'date' | 'title'>): CalendarEvent => ({
  id: 'evt_1',
  kind: 'event',
  important: false,
  notes: '',
  source: 'user',
  ...over,
});

describe('text escaping and folding', () => {
  it('escapes backslash, semicolon, comma and newlines', () => {
    expect(escapeText('a\\b;c,d\ne\r\nf')).toBe('a\\\\b\\;c\\,d\\ne\\nf');
    expect(unescapeText(escapeText('a\\b;c,d\ne'))).toBe('a\\b;c,d\ne');
    expect(unescapeText('x\\Ny')).toBe('x\ny');
  });

  it('leaves short lines alone and folds long ones at 75 octets', () => {
    expect(foldLine('SUMMARY:short')).toBe('SUMMARY:short');
    const long = `DESCRIPTION:${'x'.repeat(200)}`;
    const folded = foldLine(long);
    const parts = folded.split('\r\n');
    expect(parts.length).toBe(3);
    expect(utf8(parts[0])).toBe(75);
    for (const p of parts.slice(1)) {
      expect(p.startsWith(' ')).toBe(true);
      expect(utf8(p)).toBeLessThanOrEqual(75);
    }
    expect(unfoldLines(folded)).toEqual([long]);
  });

  it('never splits a multi-byte character', () => {
    const line = `SUMMARY:${'–ಕನ್ನಡ😀'.repeat(20)}`;
    const parts = foldLine(line).split('\r\n');
    for (const p of parts) {
      expect(utf8(p)).toBeLessThanOrEqual(75);
      expect(p).not.toMatch(/�/);
    }
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line);
  });

  it('writes UTC stamps', () => {
    expect(icsUtc(NOW)).toBe('20261005T084500Z');
  });
});

describe('semester & important dates export', () => {
  const events = createSemesterEvents();
  const ics = eventsToIcs(events, { now: NOW, timeZone: KOLKATA });

  it('is a valid calendar with CRLF endings', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(ics.split('\r\n').every((l) => utf8(l) <= 75)).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(events.length);
    expect(ics).toContain('BEGIN:VTIMEZONE\r\nTZID:Asia/Kolkata');
  });

  it('writes multi-day all-day events with an exclusive end date and an alert for important ones', () => {
    const ia1 = events.find((e) => e.title.includes('IA-1'))!;
    const lines = eventToVevent(ia1, { now: NOW, timeZone: KOLKATA });
    expect(lines).toContain('DTSTART;VALUE=DATE:20261022');
    expect(lines).toContain('DTEND;VALUE=DATE:20261030');
    expect(lines).toContain(`UID:${ia1.id}@kiran-planner`);
    expect(lines).toContain('DTSTAMP:20261005T084500Z');
    expect(lines).toContain('CATEGORIES:Test,Important');
    expect(lines).toContain('BEGIN:VALARM');
    expect(lines).toContain('TRIGGER:-PT15H');
  });

  it('writes single all-day days and leaves unimportant ones without an alert', () => {
    const gandhi = events.find((e) => e.title === 'Gandhi Jayanthi')!;
    const lines = eventToVevent(gandhi, { now: NOW, timeZone: KOLKATA });
    expect(lines).toContain('DTSTART;VALUE=DATE:20261002');
    expect(lines).toContain('DTEND;VALUE=DATE:20261003');
    expect(lines).not.toContain('BEGIN:VALARM');
  });

  it('writes timed events with a time zone or as floating time', () => {
    const talk = events.find((e) => e.title.startsWith('Technical talk'))!;
    expect(eventToVevent(talk, { now: NOW, timeZone: KOLKATA })).toEqual(
      expect.arrayContaining(['DTSTART;TZID=Asia/Kolkata:20261031T143000', 'DTEND;TZID=Asia/Kolkata:20261031T163000']),
    );
    expect(eventToVevent(talk, { now: NOW, timeZone: null })).toEqual(expect.arrayContaining(['DTSTART:20261031T143000', 'DTEND:20261031T163000']));
    const noEnd = eventToVevent(ev({ title: 'Call', date: '2026-10-07', startTime: '18:00', important: true }), { now: NOW, timeZone: null });
    expect(noEnd).toContain('DURATION:PT1H');
    expect(noEnd).toContain('TRIGGER:-P1D');
    const overnight = eventToVevent(ev({ title: 'Trip', date: '2026-10-07', endDate: '2026-10-09', startTime: '22:00', endTime: '06:00' }), { now: NOW, timeZone: null });
    expect(overnight).toEqual(expect.arrayContaining(['DTSTART:20261007T220000', 'DTEND:20261009T060000']));
  });

  it('escapes and folds user text', () => {
    const e = ev({ title: 'Lab; viva, prep\\done', date: '2026-10-07', notes: `Line 1\nLine 2 ${'long '.repeat(30)}` });
    const ics2 = eventsToIcs([e], { now: NOW, timeZone: null });
    expect(ics2).toContain('SUMMARY:Lab\\; viva\\, prep\\\\done');
    expect(ics2).not.toContain('VTIMEZONE');
    const desc = linesOf(ics2).find((l) => l.startsWith('DESCRIPTION:'))!;
    expect(desc.startsWith('DESCRIPTION:Line 1\\nLine 2 long')).toBe(true);
  });
});

describe('timetable export', () => {
  const data = createDefaultData();
  const opts = { today: '2026-10-05', now: NOW, timeZone: KOLKATA, alertMinutes: 0, categories: data.categories } as const;

  it('repeats weekly by day, or daily', () => {
    expect(recurrenceRule({ type: 'daily' })).toBe('FREQ=DAILY');
    expect(recurrenceRule({ type: 'weekdays' })).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
    expect(recurrenceRule({ type: 'saturday' })).toBe('FREQ=WEEKLY;BYDAY=SA');
    expect(recurrenceRule({ type: 'sunday' })).toBe('FREQ=WEEKLY;BYDAY=SU');
    expect(recurrenceRule({ type: 'custom', days: [0, 6] })).toBe('FREQ=WEEKLY;BYDAY=SA,SU');
    expect(recurrenceRule({ type: 'custom', days: [0, 1, 2, 3, 4, 5, 6] })).toBe('FREQ=DAILY');
    expect(recurrenceRule({ type: 'custom', days: [] })).toBeNull();
    expect(recurrenceRule({ type: 'daily' }, '20270210T182959Z')).toBe('FREQ=DAILY;UNTIL=20270210T182959Z');
  });

  it('starts on the first matching day', () => {
    expect(firstOccurrence({ type: 'saturday' }, '2026-10-05')).toBe('2026-10-10');
    expect(firstOccurrence({ type: 'weekdays' }, '2026-10-10')).toBe('2026-10-12');
    expect(firstOccurrence({ type: 'custom', days: [] }, '2026-10-05')).toBeNull();
  });

  it('picks the current timetable, with or without routine items', () => {
    const all = timetableTemplates(data.templates, '2026-10-05', true);
    const focus = timetableTemplates(data.templates, '2026-10-05', false);
    expect(all.length).toBe(data.templates.length);
    expect(focus.some((t) => t.title === 'Sleep')).toBe(false);
    expect(focus.some((t) => t.title === 'Gym')).toBe(true);
    expect(focus.some((t) => t.title === 'College')).toBe(true);
    expect(focus.some((t) => t.title === 'Java')).toBe(true);
    const ended: TaskTemplate = { ...data.templates[0], id: 'old', endDate: '2026-10-01' };
    expect(timetableTemplates([ended], '2026-10-05', true)).toEqual([]);
  });

  it('writes gym as a daily event with an alert at the start', () => {
    const gym = data.templates.find((t) => t.key === 'gym')!;
    const lines = templateToVevent(gym, opts)!;
    expect(lines).toEqual(
      expect.arrayContaining([
        `UID:${gym.id}@kiran-planner`,
        'DTSTART;TZID=Asia/Kolkata:20261005T053000',
        'DTEND;TZID=Asia/Kolkata:20261005T070000',
        'RRULE:FREQ=DAILY',
        'SUMMARY:Gym',
        'BEGIN:VALARM',
        'TRIGGER:PT0S',
      ]),
    );
  });

  it('ends sleep the next morning and honours "remind before" and UNTIL', () => {
    const sleep = data.templates.find((t) => t.key === 'sleep')!;
    const lines = templateToVevent(sleep, { ...opts, alertMinutes: 10, until: '2027-02-10' })!;
    expect(lines).toEqual(
      expect.arrayContaining([
        'DTSTART;TZID=Asia/Kolkata:20261005T220000',
        'DTEND;TZID=Asia/Kolkata:20261006T050000',
        'RRULE:FREQ=DAILY;UNTIL=20270210T182959Z',
        'TRIGGER:-PT10M',
      ]),
    );
    const floating = templateToVevent(sleep, { ...opts, timeZone: null, alertMinutes: null, until: '2027-02-10' })!;
    expect(floating).toEqual(expect.arrayContaining(['DTSTART:20261005T220000', 'DTEND:20261006T050000', 'RRULE:FREQ=DAILY;UNTIL=20270210T235959']));
    expect(floating).not.toContain('BEGIN:VALARM');
  });

  it('uses the earlier of the template end and the chosen end; skips templates that never happen', () => {
    const java = data.templates.find((t) => t.title === 'Java' && t.recurrence.type === 'saturday')!;
    const lines = templateToVevent({ ...java, endDate: '2026-12-31' }, { ...opts, until: '2027-02-10' })!;
    expect(lines).toContain('RRULE:FREQ=WEEKLY;BYDAY=SA;UNTIL=20261231T182959Z');
    expect(lines).toContain('DTSTART;TZID=Asia/Kolkata:20261010T080000');
    expect(templateToVevent({ ...java, endDate: '2026-10-08' }, opts)).toBeNull(); // no Saturday left
    expect(templateToVevent({ ...java, recurrence: { type: 'custom', days: [] } }, opts)).toBeNull();
  });

  it('starts future templates on their own start date', () => {
    const java = data.templates.find((t) => t.title === 'Java' && t.recurrence.type === 'saturday')!;
    const lines = templateToVevent({ ...java, startDate: '2026-11-01' }, opts)!;
    expect(lines).toContain('DTSTART;TZID=Asia/Kolkata:20261107T080000');
  });

  it('builds a whole file', () => {
    const ics = timetableToIcs(data.templates, { ...opts, includeRoutine: false });
    expect(ics).toContain('X-WR-CALNAME:Kiran – Timetable');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
    expect(ics).not.toContain('SUMMARY:Sleep');
    expect(ics.match(/BEGIN:VEVENT/g)!.length).toBe(timetableTemplates(data.templates, '2026-10-05', false).length);
    expect(ics.match(/BEGIN:VALARM/g)!.length).toBe(ics.match(/BEGIN:VEVENT/g)!.length);
  });

  it('only uses Asia/Kolkata on a device set to India time', () => {
    expect(exportTimeZone('Asia/Kolkata')).toBe('Asia/Kolkata');
    expect(exportTimeZone('Asia/Calcutta')).toBe('Asia/Kolkata');
    expect(exportTimeZone('Europe/Berlin')).toBeNull();
    // An unknown zone means floating times, whatever zone the machine running the test is in.
    expect(exportTimeZone(undefined)).toBeNull();
    expect(exportTimeZone('')).toBeNull();
  });

  describe('official holidays', () => {
    const holidays = holidayDates(createSemesterEvents());
    const college = data.templates.find((t) => t.key === 'college')!;
    const travel = data.templates.find((t) => t.key === 'travel')!;
    const getReady = data.templates.find((t) => t.key === 'getready')!;
    const gym = data.templates.find((t) => t.key === 'gym')!;

    it('knows which blocks only happen on college days', () => {
      expect([college, travel, getReady].every(isCollegeDayTemplate)).toBe(true);
      expect(isCollegeDayTemplate(gym)).toBe(false);
      expect(data.templates.filter(isCollegeDayTemplate).map((t) => t.title)).toEqual(['Get ready + travel', 'College', 'Travel + rest']);
    });

    it('leaves college out on weekday holidays with an EXDATE in the same form as DTSTART', () => {
      const lines = templateToVevent(college, { ...opts, until: '2027-02-10', holidays })!;
      const exdates = lines.filter((l) => l.startsWith('EXDATE'));
      // Mahanavami, Vijayadashami, Balipadyami, Christmas, Makara Sankranthi, Republic Day – Gandhi Jayanthi is already past.
      expect(exdates).toEqual([
        'EXDATE;TZID=Asia/Kolkata:20261020T090000',
        'EXDATE;TZID=Asia/Kolkata:20261021T090000',
        'EXDATE;TZID=Asia/Kolkata:20261110T090000',
        'EXDATE;TZID=Asia/Kolkata:20261225T090000',
        'EXDATE;TZID=Asia/Kolkata:20270114T090000',
        'EXDATE;TZID=Asia/Kolkata:20270126T090000',
      ]);
      expect(lines).toContain('DTSTART;TZID=Asia/Kolkata:20261005T090000');
      const floating = templateToVevent(college, { ...opts, timeZone: null, holidays })!;
      expect(floating).toContain('DTSTART:20261005T090000');
      expect(floating).toContain('EXDATE:20261020T090000');
      expect(floating.filter((l) => l.startsWith('EXDATE')).every((l) => /^EXDATE:\d{8}T\d{6}$/.test(l))).toBe(true);
      const leave = templateToVevent(travel, { ...opts, holidays })!;
      expect(leave).toContain('EXDATE;TZID=Asia/Kolkata:20261020T170000');
    });

    it('keeps study, gym and weekend blocks on holidays, and skips holidays outside the range or off the weekdays', () => {
      expect(templateToVevent(gym, { ...opts, holidays })!.some((l) => l.startsWith('EXDATE'))).toBe(false);
      // A Saturday holiday is not a weekday college day; one after UNTIL or before today is left out.
      expect(holidayExceptions(college, ['2026-10-01', '2026-10-24', '2026-10-26', '2027-03-01'], '2026-10-05', '2027-02-10')).toEqual(['2026-10-26']);
      expect(holidayExceptions(gym, holidays, '2026-10-05')).toEqual([]);
      expect(holidayExceptions({ ...college, endDate: '2026-10-01' }, holidays, '2026-10-05')).toEqual([]);
    });

    it('counts the holidays that fall on college days for the summary', () => {
      const blocks = timetableTemplates(data.templates, '2026-10-05', false);
      expect(skippedHolidays(blocks, holidays, '2026-10-05', '2027-02-10')).toEqual(['2026-10-20', '2026-10-21', '2026-11-10', '2026-12-25', '2027-01-14', '2027-01-26']);
      expect(skippedHolidays(blocks, holidays, '2026-10-05', '2026-10-20')).toEqual(['2026-10-20']);
      expect(skippedHolidays([gym], holidays, '2026-10-05')).toEqual([]);
    });

    it('puts the EXDATEs into the whole file and keeps every line within 75 octets', () => {
      const ics = timetableToIcs(data.templates, { ...opts, includeRoutine: true, until: '2027-02-10', holidays });
      expect(ics.match(/^EXDATE;TZID=Asia\/Kolkata:20261020T\d{6}\r$/gm)!.length).toBe(3); // get ready, college, travel
      expect(ics.split('\r\n').every((l) => utf8(l) <= 75)).toBe(true);
      const parsed = parseIcs(ics, { timeZone: KOLKATA });
      expect(parsed.events.length).toBe(timetableTemplates(data.templates, '2026-10-05', true).length);
    });
  });
});

describe('reading .ics files', () => {
  it('parses content lines with quoted parameters', () => {
    expect(parseContentLine('DTSTART;TZID="America/New_York":20261005T090000')).toEqual({
      name: 'DTSTART',
      params: { TZID: 'America/New_York' },
      value: '20261005T090000',
    });
    expect(parseContentLine('DESCRIPTION;ALTREP="cid:x:y":Hello: world')).toMatchObject({ value: 'Hello: world' });
    expect(parseContentLine('garbage')).toBeNull();
  });

  it('parses durations', () => {
    expect(parseDurationMinutes('PT1H30M')).toBe(90);
    expect(parseDurationMinutes('P2D')).toBe(2880);
    expect(parseDurationMinutes('P1W')).toBe(10080);
    expect(parseDurationMinutes('-PT15M')).toBe(-15);
    expect(parseDurationMinutes('nope')).toBeNull();
  });

  it('round-trips the app’s own export', () => {
    const events = [
      ...createSemesterEvents(),
      ev({ id: 'p1', title: 'Amma, birthday; party \\ cake', date: '2026-11-03', kind: 'personal', important: true, notes: 'Buy gift\nCall at 9' }),
    ];
    const parsed = parseIcs(eventsToIcs(events, { now: NOW, timeZone: KOLKATA }), { timeZone: KOLKATA });
    expect(parsed.valid).toBe(true);
    expect(parsed.events).toHaveLength(events.length);
    for (const original of events) {
      const p = parsed.events.find((x) => x.uid === `${original.id}@kiran-planner`)!;
      expect(p, original.title).toBeDefined();
      expect(p.title).toBe(original.title);
      expect(p.date).toBe(original.date);
      expect(p.endDate).toBe(original.endDate);
      expect(p.startTime).toBe(original.startTime);
      expect(p.endTime).toBe(original.endTime);
      expect(p.kind).toBe(original.kind);
      expect(p.important).toBe(original.important);
    }
    const party = parsed.events.find((x) => x.uid === 'p1@kiran-planner')!;
    expect(party.notes).toBe('Buy gift\nCall at 9\n\nFrom Kiran Planner');
  });

  const file = (body: string) =>
    ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Test//EN', body, 'END:VCALENDAR', ''].join('\r\n');

  it('converts UTC and TZID times into the local zone', () => {
    const text = file(
      [
        'BEGIN:VEVENT',
        'UID:a',
        'SUMMARY:UTC meeting',
        'DTSTART:20261005T033000Z',
        'DTEND:20261005T043000Z',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:b',
        'SUMMARY:Berlin call',
        'DTSTART;TZID=Europe/Berlin:20261005T090000',
        'DURATION:PT45M',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:c',
        'SUMMARY:Floating',
        'DTSTART:20261006T070000',
        'END:VEVENT',
      ].join('\r\n'),
    );
    const { events } = parseIcs(text, { timeZone: KOLKATA });
    expect(events.map((e) => [e.title, e.date, e.startTime, e.endTime])).toEqual([
      ['UTC meeting', '2026-10-05', '09:00', '10:00'],
      ['Berlin call', '2026-10-05', '12:30', '13:15'], // CEST = UTC+2
      ['Floating', '2026-10-06', '07:00', undefined],
    ]);
  });

  it('crosses midnight when converting', () => {
    const text = file(['BEGIN:VEVENT', 'SUMMARY:Late', 'DTSTART:20261005T200000Z', 'DTEND:20261005T213000Z', 'END:VEVENT'].join('\r\n'));
    const [e] = parseIcs(text, { timeZone: KOLKATA }).events;
    expect([e.date, e.startTime, e.endDate, e.endTime]).toEqual(['2026-10-06', '01:30', undefined, '03:00']);
  });

  it('keeps an overnight event as a continuous range and a midnight end as one day', () => {
    const text = file(
      [
        'BEGIN:VEVENT',
        'SUMMARY:Night trek',
        'DTSTART:20261010T220000',
        'DTEND:20261011T050000',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'SUMMARY:Party',
        'DTSTART:20261012T200000',
        'DTEND:20261013T000000',
        'END:VEVENT',
      ].join('\r\n'),
    );
    const [trek, party] = parseIcs(text).events;
    expect([trek.date, trek.endDate, trek.startTime, trek.endTime]).toEqual(['2026-10-10', '2026-10-11', '22:00', '05:00']);
    expect([party.date, party.endDate, party.startTime, party.endTime]).toEqual(['2026-10-12', undefined, '20:00', '23:59']);
  });

  it('reads all-day ranges (exclusive end), folded lines, escapes, location and categories', () => {
    const text = file(
      [
        'BEGIN:VEVENT',
        'UID:x1',
        'DTSTART;VALUE=DATE:20261102',
        'DTEND;VALUE=DATE:20261105',
        'SUMMARY:Diwali\\, holidays',
        'DESCRIPTION:Line one\\nLine two that is quite long and therefore was folded by',
        '  the exporter',
        'LOCATION:Home',
        'CATEGORIES:Personal,IMPORTANT',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'DESCRIPTION:Alarm text must not replace the event description',
        'TRIGGER:-PT15M',
        'END:VALARM',
        'END:VEVENT',
      ].join('\r\n'),
    );
    const [e] = parseIcs(text).events;
    expect(e).toEqual({
      uid: 'x1',
      title: 'Diwali, holidays',
      date: '2026-11-02',
      endDate: '2026-11-04',
      notes: 'Line one\nLine two that is quite long and therefore was folded by the exporter\nLocation: Home',
      kind: 'personal',
      important: true,
      recurring: false,
    });
  });

  it('imports only the first date of repeating events and counts them', () => {
    const text = file(
      [
        'BEGIN:VEVENT',
        'SUMMARY:Weekly quiz',
        'DTSTART;VALUE=DATE:20261009',
        'RRULE:FREQ=WEEKLY;COUNT=10',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'SUMMARY:Cancelled',
        'STATUS:CANCELLED',
        'DTSTART;VALUE=DATE:20261009',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'SUMMARY:No start',
        'END:VEVENT',
      ].join('\n'),
    );
    const r = parseIcs(text);
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({ title: 'Weekly quiz', date: '2026-10-09', recurring: true, kind: 'test' });
    expect(r.recurringCount).toBe(1);
    expect(r.skipped).toBe(2);
  });

  it('uses VTIMEZONE offsets for zones the browser does not know', () => {
    const text = file(
      [
        'BEGIN:VTIMEZONE',
        'TZID:India Standard Time',
        'BEGIN:STANDARD',
        'DTSTART:16010101T000000',
        'TZOFFSETFROM:+0530',
        'TZOFFSETTO:+0530',
        'END:STANDARD',
        'END:VTIMEZONE',
        'BEGIN:VEVENT',
        'SUMMARY:Outlook meeting',
        'DTSTART;TZID=India Standard Time:20261005T100000',
        'DTEND;TZID=India Standard Time:20261005T110000',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'SUMMARY:Mystery zone',
        'DTSTART;TZID=Mars/Olympus:20261005T100000',
        'END:VEVENT',
      ].join('\r\n'),
    );
    const r = parseIcs(text, { timeZone: 'Europe/London' });
    expect(r.events[0]).toMatchObject({ title: 'Outlook meeting', startTime: '05:30', endTime: '06:30' }); // BST = UTC+1
    expect(r.events[1]).toMatchObject({ title: 'Mystery zone', startTime: '10:00' });
    expect(r.warnings[0]).toMatch(/Mars\/Olympus/);
  });

  it('refuses files that are not calendars', () => {
    expect(parseIcs('hello').valid).toBe(false);
    expect(parseIcs('').events).toEqual([]);
    expect(parseIcs(file('')).valid).toBe(true);
  });

  it('turns parsed events into app events', () => {
    const e = importedToEvent({ uid: 'u', title: 'T', date: '2026-10-05', endDate: '2026-10-06', startTime: '10:00', notes: '', kind: 'event', important: false, recurring: true }, true);
    expect(e).toEqual({ title: 'T', date: '2026-10-05', endDate: '2026-10-06', startTime: '10:00', kind: 'event', important: true, notes: '', source: 'import' });
  });
});
