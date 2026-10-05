import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../types/extras';
import { createSemesterEvents, defaultSemesterInfo } from '../data/semesterCalendar';
import {
  countdownText,
  daysUntil,
  dedupeKey,
  emptyEventForm,
  eventDays,
  eventEnd,
  eventLength,
  eventsByDate,
  eventsOn,
  eventTiming,
  eventToForm,
  filterEvents,
  formatDateRange,
  formToEvent,
  groupByMonth,
  guessKind,
  holidayDates,
  isMultiDay,
  isNotableOn,
  importantSoon,
  alsoText,
  splitHighlights,
  lastWorkingDay,
  markDuplicates,
  missingOfficial,
  nextAssessment,
  nextHoliday,
  rangeText,
  relativeDayLabel,
  relevantOn,
  semesterProgress,
  shortTitle,
  sortEvents,
  timeText,
  timetableSwaps,
  timingLabel,
  upcoming,
  validateEventForm,
} from './events';

const ev = (over: Partial<CalendarEvent> & Pick<CalendarEvent, 'date' | 'title'>): CalendarEvent => ({
  id: over.title,
  kind: 'event',
  important: false,
  notes: '',
  source: 'user',
  ...over,
});

const sem = createSemesterEvents();
const ia1 = sem.find((e) => e.title.includes('IA-1'))!;

describe('multi-day expansion', () => {
  it('expands a range to every day, inclusive', () => {
    expect(eventDays(ia1)).toEqual(['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29']);
    expect(eventLength(ia1)).toBe(8);
    expect(isMultiDay(ia1)).toBe(true);
  });

  it('treats a missing or earlier end date as a single day', () => {
    expect(eventDays(ev({ title: 'a', date: '2026-10-02' }))).toEqual(['2026-10-02']);
    expect(eventEnd({ date: '2026-10-02', endDate: '2026-10-01' })).toBe('2026-10-02');
    expect(isMultiDay({ date: '2026-10-02', endDate: '2026-10-02' })).toBe(false);
  });

  it('crosses months and years', () => {
    const lab = sem.find((e) => e.title.startsWith('Laboratory IA'))!;
    expect(eventDays(lab)).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01']);
  });
});

describe('eventsOn / upcoming', () => {
  it('finds single-day and multi-day events on a date', () => {
    expect(eventsOn(sem, '2026-10-02').map((e) => e.title)).toEqual(['Gandhi Jayanthi']);
    expect(eventsOn(sem, '2026-10-25').map((e) => e.title)).toEqual([
      'Overview of Geographical Information System',
      'First Internal Assessment Test (IA-1)',
    ]);
    expect(eventsOn(sem, '2026-10-03')).toEqual([]);
  });

  it('lists all-day events before timed ones on the same day', () => {
    expect(eventsOn(sem, '2026-10-31').map((e) => e.startTime ?? 'all-day')).toEqual(['all-day', '14:30']);
  });

  it('returns ongoing and future events, soonest first, limited to n', () => {
    const next = upcoming(sem, '2026-10-05', 3).map((e) => e.title);
    expect(next).toEqual(['AIML for Hydro Informatics', 'Overview of Geographical Information System', 'Mahanavami']);
    expect(upcoming(sem, '2026-10-23').some((e) => e === ia1)).toBe(true); // ongoing
    expect(upcoming(sem, '2026-10-30').some((e) => e === ia1)).toBe(false); // over
    expect(upcoming(sem, '2027-03-01')).toEqual([]);
  });

  it('sorts by date, then time, then title', () => {
    const list = sortEvents([
      ev({ title: 'b', date: '2026-10-02', startTime: '10:00' }),
      ev({ title: 'a', date: '2026-10-02', startTime: '10:00' }),
      ev({ title: 'z', date: '2026-10-02' }),
      ev({ title: 'y', date: '2026-10-01' }),
    ]);
    expect(list.map((e) => e.title)).toEqual(['y', 'z', 'a', 'b']);
  });

  it('builds a date → events map clipped to a range', () => {
    const map = eventsByDate(sem, '2026-10-01', '2026-10-31');
    expect(map.get('2026-10-02')?.map((e) => e.title)).toEqual(['Gandhi Jayanthi']);
    expect(map.get('2026-10-29')?.some((e) => e === ia1)).toBe(true);
    expect(map.has('2026-09-30')).toBe(false);
    expect(map.has('2026-11-10')).toBe(false);
  });

  it('marks long unimportant events only on their first day', () => {
    const gis = sem.find((e) => e.title.startsWith('Overview of Geographical'))!;
    expect(isNotableOn(gis, '2026-10-05')).toBe(true);
    expect(isNotableOn(gis, '2026-10-06')).toBe(false);
    expect(isNotableOn(ia1, '2026-10-29')).toBe(true);
    expect(isNotableOn(ia1, '2026-10-30')).toBe(false); // not on that day at all
    const talk = sem.find((e) => e.title.startsWith('Technical talk'))!;
    expect(isNotableOn(talk, '2026-10-31')).toBe(true);
  });

  it('shows only relevant events on Today', () => {
    // Day 1 of two department courses: both start today.
    expect(relevantOn(sem, '2026-10-05')).toHaveLength(2);
    // Day 2: ongoing, unimportant department courses are not repeated.
    expect(relevantOn(sem, '2026-10-06')).toEqual([]);
    // Every day of IA-1 is relevant.
    expect(relevantOn(sem, '2026-10-26').map((e) => e.title)).toEqual(['First Internal Assessment Test (IA-1)']);
    expect(relevantOn(sem, '2026-10-02').map((e) => e.title)).toEqual(['Gandhi Jayanthi']);
  });
});

describe('countdowns and labels', () => {
  it('counts days', () => {
    expect(daysUntil('2026-10-05', '2026-10-22')).toBe(17);
    expect(daysUntil('2026-10-05', '2026-10-05')).toBe(0);
    expect(daysUntil('2026-10-05', '2026-10-01')).toBe(-4);
  });

  it('labels relative days', () => {
    expect(relativeDayLabel('2026-10-05', '2026-10-05')).toBe('Today');
    expect(relativeDayLabel('2026-10-05', '2026-10-06')).toBe('Tomorrow');
    expect(relativeDayLabel('2026-10-05', '2026-10-04')).toBe('Yesterday');
    expect(relativeDayLabel('2026-10-05', '2026-10-10')).toBe('in 5 days');
    expect(relativeDayLabel('2026-10-05', '2026-10-01')).toBe('4 days ago');
  });

  it('knows where an event is in time', () => {
    expect(eventTiming(ia1, '2026-10-05')).toEqual({ phase: 'upcoming', days: 17, dayIndex: 0, totalDays: 8 });
    expect(eventTiming(ia1, '2026-10-24')).toEqual({ phase: 'ongoing', days: 5, dayIndex: 3, totalDays: 8 });
    expect(eventTiming(ia1, '2026-10-31').phase).toBe('past');
    expect(eventTiming({ date: '2026-10-05' }, '2026-10-05').phase).toBe('today');
  });

  it('writes row labels', () => {
    expect(timingLabel(ia1, '2026-10-21')).toBe('Tomorrow');
    expect(timingLabel(ia1, '2026-10-22')).toBe('Starts today');
    expect(timingLabel(ia1, '2026-10-24')).toBe('Day 3 of 8');
    expect(timingLabel(ia1, '2026-10-29')).toBe('Last day today');
    expect(timingLabel(ia1, '2026-11-01')).toBe('Past');
    expect(timingLabel({ date: '2026-10-05' }, '2026-10-05')).toBe('Today');
  });

  it('shortens titles with a bracketed abbreviation', () => {
    const official = (title: string) => sem.find((e) => e.title === title)!;
    expect(shortTitle(ia1)).toBe('IA-1');
    expect(shortTitle(official('Theory exams begin (SEE)'))).toBe('SEE');
    expect(shortTitle(official('Gandhi Jayanthi'))).toBe('Gandhi Jayanthi');
    expect(shortTitle(official('Value-added course: System on Chip (SoC) – Chip UVM'))).toBe('Value-added course: System on Chip (SoC) – Chip UVM');
    // Your own tests and exams are shortened the same way.
    expect(shortTitle(ev({ title: 'DBMS lab internal (Lab-IA2)', date: '2026-11-02', kind: 'test' }))).toBe('Lab-IA2');
    expect(shortTitle(ev({ title: 'Mock exam (Q2)', date: '2026-11-02', kind: 'exam' }))).toBe('Q2');
  });

  it('keeps the full title when the brackets are not an abbreviation', () => {
    const own = (title: string, kind: CalendarEvent['kind'] = 'personal') => ev({ title, date: '2026-10-11', kind });
    expect(shortTitle(own('Amma birthday (Sunday)'))).toBe('Amma birthday (Sunday)');
    expect(shortTitle(own('Project review (online)', 'deadline'))).toBe('Project review (online)');
    expect(shortTitle(own('Hackathon (Day 1)', 'event'))).toBe('Hackathon (Day 1)');
    expect(shortTitle(own('Dentist (Dr. Rao)'))).toBe('Dentist (Dr. Rao)');
    // Even abbreviation-like brackets stay on personal dates ("Trip (USA)" is not called "USA").
    expect(shortTitle(own('Trip (USA)'))).toBe('Trip (USA)');
    // A test whose brackets hold words, a date or only the abbreviation.
    expect(shortTitle(own('Quiz (Sunday)', 'test'))).toBe('Quiz (Sunday)');
    expect(shortTitle(own('Viva (2026)', 'test'))).toBe('Viva (2026)');
    expect(shortTitle(own('(IA-1)', 'test'))).toBe('(IA-1)');
    expect(countdownText(own('Amma birthday (Sunday)'), '2026-10-05')).toBe('Amma birthday (Sunday) is in 6 days');
    expect(countdownText(own('Hackathon (Day 1)', 'event'), '2026-10-06')).toBe('Hackathon (Day 1) is in 5 days');
  });

  it('writes countdown sentences', () => {
    expect(countdownText(ia1, '2026-10-05')).toBe('IA-1 starts in 17 days');
    expect(countdownText(ia1, '2026-10-21')).toBe('IA-1 starts tomorrow');
    expect(countdownText(ia1, '2026-10-22')).toBe('IA-1 test starts today');
    expect(countdownText(ia1, '2026-10-24')).toBe('IA-1 test · day 3 of 8');
    const lwd = lastWorkingDay(sem)!;
    expect(countdownText(lwd, '2027-01-04')).toBe('Last working day is tomorrow');
    expect(countdownText(lwd, '2027-01-05')).toBe('Last working day today');
    expect(countdownText(ev({ title: 'Quiz', date: '2026-10-05', kind: 'test' }), '2026-10-05')).toBe('Quiz today');
    expect(countdownText(lwd, '2027-01-08')).toBe('Last working day was 3 days ago');
  });

  it('formats date ranges and times', () => {
    expect(formatDateRange('2026-10-22', '2026-10-22')).toBe('Oct 22');
    expect(formatDateRange('2026-10-22', '2026-10-29')).toBe('Oct 22 – 29');
    expect(formatDateRange('2026-09-28', '2026-10-02')).toBe('Sep 28 – Oct 2');
    expect(formatDateRange('2026-12-28', '2027-01-01')).toBe('Dec 28, 2026 – Jan 1, 2027');
    expect(rangeText(ia1)).toBe('Oct 22 – 29 · 8 days');
    expect(rangeText({ date: '2026-10-02' })).toBe('');
    expect(timeText({ startTime: '14:30', endTime: '16:30' })).toBe('2:30 PM – 4:30 PM');
    expect(timeText({ startTime: '09:00' })).toBe('9:00 AM');
    expect(timeText({})).toBe('');
  });

  it('groups by month, anchoring ongoing events to the first month shown', () => {
    const groups = groupByMonth(upcoming(sem, '2026-10-25'), '2026-10-25');
    expect(groups[0].label).toBe('October 2026');
    expect(groups[0].events[0].title).toBe('Overview of Geographical Information System'); // started Oct 5
    expect(groups.map((g) => g.key)).toEqual(['2026-10', '2026-11', '2026-12', '2027-01', '2027-02']);
    const all = groupByMonth(sem);
    expect(all[0].key).toBe('2026-09');
    expect(all.reduce((n, g) => n + g.events.length, 0)).toBe(sem.length);
  });
});

describe('filters and finders', () => {
  it('filters by chip', () => {
    expect(filterEvents(sem, 'all')).toHaveLength(sem.length);
    expect(filterEvents(sem, 'important').every((e) => e.important)).toBe(true);
    expect(filterEvents(sem, 'exams').map((e) => e.kind)).toEqual(expect.arrayContaining(['test', 'exam']));
    expect(filterEvents(sem, 'exams').every((e) => e.kind === 'test' || e.kind === 'exam')).toBe(true);
    expect(filterEvents(sem, 'holidays').map((e) => e.title)).toContain('Gandhi Jayanthi');
  });

  it('finds the next test/exam, holiday and the last working day', () => {
    expect(nextAssessment(sem, '2026-10-05')?.title).toBe('First Internal Assessment Test (IA-1)');
    expect(nextAssessment(sem, '2026-10-25')?.title).toBe('First Internal Assessment Test (IA-1)'); // ongoing
    expect(nextAssessment(sem, '2026-10-30')?.title).toBe('Second Internal Assessment Test (IA-2)');
    expect(nextAssessment(sem, '2027-01-02')?.title).toBe('Theory exams begin (SEE)');
    expect(nextAssessment(sem, '2027-01-19')).toBeUndefined();
    expect(nextHoliday(sem, '2026-10-05')?.title).toBe('Mahanavami');
    expect(lastWorkingDay(sem)?.date).toBe('2027-01-05');
    expect(lastWorkingDay([])).toBeUndefined();
  });
});

describe('semester progress', () => {
  it('is week 5 of 23 and 18% done on Oct 5', () => {
    expect(semesterProgress(defaultSemesterInfo, '2026-10-05')).toEqual({
      phase: 'during',
      week: 5,
      totalWeeks: 23,
      pct: 18,
      totalDays: 157,
      daysLeft: 128,
      daysToStart: 0,
    });
  });

  it('handles the first and last day, before and after', () => {
    expect(semesterProgress(defaultSemesterInfo, '2026-09-07')).toMatchObject({ phase: 'during', week: 1, pct: 0 });
    expect(semesterProgress(defaultSemesterInfo, '2027-02-10')).toMatchObject({ phase: 'during', week: 23, daysLeft: 0 });
    expect(semesterProgress(defaultSemesterInfo, '2026-09-01')).toMatchObject({ phase: 'before', week: 0, pct: 0, daysToStart: 6 });
    expect(semesterProgress(defaultSemesterInfo, '2027-03-01')).toMatchObject({ phase: 'after', pct: 100, daysLeft: 0 });
  });

  it('survives an end date before the start', () => {
    const p = semesterProgress({ startDate: '2026-10-05', endDate: '2026-10-01' }, '2026-10-05');
    expect(p.totalDays).toBe(1);
    expect(Number.isFinite(p.pct)).toBe(true);
  });
});

describe('event form', () => {
  const valid = { ...emptyEventForm('2026-10-05'), title: 'Hackathon' };

  it('accepts a valid all-day date', () => {
    expect(validateEventForm(valid)).toEqual({});
  });

  it('requires a title and valid dates', () => {
    expect(validateEventForm({ ...valid, title: '  ' }).title).toBe('Give the date a title.');
    expect(validateEventForm({ ...valid, date: '2026-02-30' }).date).toBe('Pick a valid date.');
    expect(validateEventForm({ ...valid, endDate: '2026-10-04' }).endDate).toBe('The end date can’t be before the start date.');
    expect(validateEventForm({ ...valid, endDate: '2026-10-05' })).toEqual({});
    expect(validateEventForm({ ...valid, title: 'x'.repeat(301) }).title).toMatch(/300/);
    expect(validateEventForm({ ...valid, notes: 'x'.repeat(2001) }).notes).toMatch(/2000/);
  });

  it('validates times only when not all-day', () => {
    expect(validateEventForm({ ...valid, startTime: 'bad' })).toEqual({});
    expect(validateEventForm({ ...valid, allDay: false, startTime: '25:00' }).startTime).toBe('Enter a valid start time.');
    expect(validateEventForm({ ...valid, allDay: false, startTime: '10:00', endTime: '' })).toEqual({});
    expect(validateEventForm({ ...valid, allDay: false, startTime: '10:00', endTime: '09:00' }).endTime).toBe('End time must be after the start time.');
    expect(validateEventForm({ ...valid, allDay: false, startTime: '10:00', endTime: '10:00' }).endTime).toBe('End time must be after the start time.');
    // A multi-day event may end earlier in the day than it started.
    expect(validateEventForm({ ...valid, allDay: false, endDate: '2026-10-06', startTime: '22:00', endTime: '05:00' })).toEqual({});
  });

  it('turns form values into an event and back', () => {
    const out = formToEvent({ ...valid, title: ' Hackathon ', endDate: '2026-10-06', allDay: false, startTime: '09:00', endTime: '18:00', notes: ' bring laptop ' });
    expect(out).toEqual({
      title: 'Hackathon',
      date: '2026-10-05',
      endDate: '2026-10-06',
      startTime: '09:00',
      endTime: '18:00',
      kind: 'personal',
      important: true,
      notes: 'bring laptop',
    });
    const allDay = formToEvent({ ...valid, endDate: '2026-10-05', startTime: '09:00' });
    expect(allDay).not.toHaveProperty('endDate');
    expect(allDay).not.toHaveProperty('startTime');
    const back = eventToForm({ ...out, id: 'x', source: 'user' });
    expect(back).toMatchObject({ allDay: false, endDate: '2026-10-06', startTime: '09:00', endTime: '18:00' });
    expect(eventToForm(ia1)).toMatchObject({ allDay: true, endDate: '2026-10-29', endTime: '' });
  });
});

describe('import helpers', () => {
  it('detects duplicates by title (any case/spacing) and date', () => {
    expect(dedupeKey({ title: '  Gandhi   JAYANTHI ', date: '2026-10-02' })).toBe(dedupeKey({ title: 'Gandhi Jayanthi', date: '2026-10-02' }));
    const marked = markDuplicates(sem, [
      { title: 'gandhi jayanthi', date: '2026-10-02' },
      { title: 'Gandhi Jayanthi', date: '2026-10-03' },
      { title: 'New', date: '2026-10-03' },
      { title: 'new', date: '2026-10-03' },
    ]);
    expect(marked.map((m) => m.duplicate)).toEqual([true, false, false, true]);
  });

  it('guesses kinds from titles', () => {
    expect(guessKind('Diwali holiday')).toBe('holiday');
    expect(guessKind('Theory exams begin (SEE)')).toBe('exam');
    expect(guessKind('IA-2 Maths')).toBe('test');
    expect(guessKind('Assignment submission')).toBe('deadline');
    expect(guessKind('Extra lab class')).toBe('class');
    expect(guessKind('Amma birthday')).toBe('personal');
    expect(guessKind('Tech fest')).toBe('event');
    expect(guessKind('SEE')).toBe('exam');
    expect(guessKind('SEE begins')).toBe('exam');
    expect(guessKind('Final exam: Compiler Design')).toBe('exam');
  });

  it('does not take the verb "see" or a sports final for an exam', () => {
    expect(guessKind('See Priya off at the airport')).toBe('event');
    expect(guessKind('See you at the farewell')).toBe('event');
    expect(guessKind('Go see Interstellar')).toBe('event');
    expect(guessKind('SEE YOU AT THE FAREWELL')).toBe('event');
    expect(guessKind('Champions League final')).toBe('event');
    expect(guessKind('Finals night with friends')).toBe('event');
    // Even after an import, a mis-guessed date can't take over the "Next test / exam" countdown.
    const imported = ev({ title: 'See Priya off at the airport', date: '2026-10-08', kind: guessKind('See Priya off at the airport'), source: 'import' });
    expect(nextAssessment([...sem, imported], '2026-10-05')?.id).toBe(ia1.id);
  });

  it('lists every holiday date, multi-day ones day by day', () => {
    const days = holidayDates([...sem, ev({ title: 'Diwali break', date: '2026-11-07', endDate: '2026-11-09', kind: 'holiday' })]);
    expect(days).toContain('2026-10-20');
    expect(days).toContain('2026-11-08');
    expect(days).toEqual([...new Set(days)].sort());
    expect(days.filter((d) => d === '2026-11-10')).toHaveLength(1);
    expect(holidayDates([])).toEqual([]);
  });

  it('finds deleted official dates', () => {
    expect(missingOfficial(sem, sem)).toEqual([]);
    const without = sem.filter((e) => e.id !== ia1.id);
    expect(missingOfficial(without, sem)).toEqual([ia1]);
  });
});

describe('Today card', () => {
  it('gives holidays, tests, starred and timed events a row and puts the rest on one line', () => {
    const { highlights, others } = splitHighlights(relevantOn(sem, '2026-10-05'));
    expect(highlights).toEqual([]);
    expect(others.map((e) => e.title)).toEqual(['AIML for Hydro Informatics', 'Overview of Geographical Information System']);
    expect(splitHighlights(relevantOn(sem, '2026-10-24')).highlights.map((e) => e.title)).toEqual(['First Internal Assessment Test (IA-1)']);
    expect(splitHighlights(relevantOn(sem, '2026-10-20')).highlights.map((e) => e.title)).toEqual(['Mahanavami']);
    const talk = relevantOn(sem, '2026-10-31');
    expect(splitHighlights(talk).highlights.map((e) => e.title)).toEqual(['Technical talk: RISC Processors']);
    expect(splitHighlights(talk).others.map((e) => e.title)).toEqual(['Saturday: Wednesday timetable followed']);
  });

  it('writes the "Also today" text', () => {
    const gis = sem.find((e) => e.title === 'Overview of Geographical Information System')!;
    expect(alsoText(gis, '2026-10-05')).toBe('Overview of Geographical Information System (first day)');
    expect(alsoText(gis, '2026-10-07')).toBe('Overview of Geographical Information System (day 3 of 26)');
    expect(alsoText(gis, '2026-10-30')).toBe('Overview of Geographical Information System (last day)');
    expect(alsoText(ev({ title: 'Club activity', date: '2026-11-28' }), '2026-11-28')).toBe('Club activity');
  });

  it('counts down only to starred dates within the horizon', () => {
    expect(importantSoon(sem, '2026-10-05', 30).map((e) => e.title)).toEqual(['First Internal Assessment Test (IA-1)']);
    // On IA-1's third day it is not "upcoming" any more; the parent–teacher meeting is 21 days away.
    expect(importantSoon(sem, '2026-10-24', 30).map((e) => e.title)).toEqual(['Parent–Teacher Meeting']);
    expect(importantSoon(sem, '2026-10-05', 70, 3).map((e) => e.title)).toEqual([
      'First Internal Assessment Test (IA-1)',
      'Parent–Teacher Meeting',
      'Second Internal Assessment Test (IA-2)',
    ]);
    expect(importantSoon(sem, '2027-02-23', 30)).toEqual([]);
    expect(importantSoon([ev({ title: 'Exactly 30', date: '2026-11-04', important: true })], '2026-10-05', 30)).toHaveLength(1);
    expect(importantSoon([ev({ title: 'Day 31', date: '2026-11-05', important: true })], '2026-10-05', 30)).toHaveLength(0);
  });
});

describe('semester data', () => {
  it('has the 15 vs 22 Feb note on the even semester event', () => {
    const even = sem.find((e) => e.title === 'Even semester classes begin')!;
    expect(even.notes).toMatch(/15 Feb/);
  });
});

describe('timetableSwaps', () => {
  it('reads every "Saturday: X timetable followed" day of the semester', () => {
    const swaps = timetableSwaps(createSemesterEvents());
    expect([...swaps]).toEqual([
      ['2026-09-12', 1],
      ['2026-09-26', 2],
      ['2026-10-31', 3],
      ['2026-11-28', 5],
      ['2026-12-12', 3],
      ['2026-12-26', 1],
    ]);
  });

  it('accepts other spellings, and ignores holidays and multi-day entries', () => {
    const swaps = timetableSwaps([
      ev({ date: '2026-11-07', title: "Monday's time-table" }),
      ev({ date: '2026-11-14', title: 'Friday timetable', kind: 'holiday' }),
      ev({ date: '2026-11-21', endDate: '2026-11-22', title: 'Tuesday timetable' }),
      ev({ date: '2026-11-29', title: 'Timetable review' }),
    ]);
    expect([...swaps]).toEqual([['2026-11-07', 1]]);
  });
});
