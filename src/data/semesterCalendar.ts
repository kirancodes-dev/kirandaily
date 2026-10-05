import type { CalendarEvent, SemesterInfo } from '../types/extras';

/**
 * 5th semester, AY 2026-27 – transcribed from "Calendar of Events [CoE] –
 * FIFTH Semester B.E., AY 2026-27" (Sapthagiri NPS University, School of
 * Engineering and Technology; ECE department copy dated 31-07-2026).
 * University-wide dates (holidays, IA tests, exams) apply to every branch;
 * department talks/courses may differ for CSE. Edit freely in the app.
 */
type Seed = Omit<CalendarEvent, 'id' | 'source' | 'notes'> & { notes?: string };

const seeds: Seed[] = [
  // September 2026
  { date: '2026-09-07', title: '3rd and 5th sem classes begin', kind: 'class', important: true },
  { date: '2026-09-07', endDate: '2026-09-10', title: 'Student registration', kind: 'deadline', important: true },
  { date: '2026-09-12', title: 'Saturday: Monday timetable followed', kind: 'class', important: false },
  { date: '2026-09-14', title: 'Ganesh Chaturthi', kind: 'holiday', important: false },
  { date: '2026-09-21', title: 'ISRO-IIRS course: Overview of Global Navigation Satellite System', kind: 'event', important: false },
  { date: '2026-09-26', title: 'Saturday: Tuesday timetable followed', kind: 'class', important: false },
  { date: '2026-09-28', endDate: '2026-09-30', title: 'Value-added course: System on Chip (SoC) – Chip UVM', kind: 'event', important: false },
  // October 2026
  { date: '2026-10-02', title: 'Gandhi Jayanthi', kind: 'holiday', important: false },
  { date: '2026-10-05', endDate: '2026-10-30', title: 'Overview of Geographical Information System', kind: 'event', important: false },
  { date: '2026-10-05', endDate: '2026-10-09', title: 'AIML for Hydro Informatics', kind: 'event', important: false },
  { date: '2026-10-20', title: 'Mahanavami', kind: 'holiday', important: false },
  { date: '2026-10-21', title: 'Vijayadashami', kind: 'holiday', important: false },
  { date: '2026-10-22', endDate: '2026-10-29', title: 'First Internal Assessment Test (IA-1)', kind: 'test', important: true },
  { date: '2026-10-31', title: 'Saturday: Wednesday timetable followed', kind: 'class', important: false },
  { date: '2026-10-31', startTime: '14:30', endTime: '16:30', title: 'Technical talk: RISC Processors', kind: 'event', important: false },
  // November 2026
  { date: '2026-11-09', endDate: '2026-11-20', title: 'RS & GIS Applications in Natural Resource Management', kind: 'event', important: false },
  { date: '2026-11-10', title: 'Balipadyami', kind: 'holiday', important: false },
  { date: '2026-11-14', title: 'Parent–Teacher Meeting', kind: 'event', important: true },
  { date: '2026-11-14', title: 'Expert talk on VLSI – Processors System', kind: 'event', important: false },
  { date: '2026-11-25', title: 'Geoscientific perspective on Geological Hazards: assessment, prediction and mitigation techniques', kind: 'event', important: false },
  { date: '2026-11-28', title: 'Saturday: Friday timetable followed', kind: 'class', important: false },
  { date: '2026-11-28', startTime: '14:00', endTime: '16:00', title: 'Club activity', kind: 'event', important: false },
  // December 2026
  { date: '2026-12-02', title: 'One-day workshop: Remote Sensing & In Situ Observation on the Moon', kind: 'event', important: false },
  { date: '2026-12-07', endDate: '2026-12-14', title: 'Second Internal Assessment Test (IA-2)', kind: 'test', important: true },
  { date: '2026-12-12', title: 'Saturday: Wednesday timetable followed', kind: 'class', important: false },
  { date: '2026-12-12', startTime: '14:00', endTime: '16:00', title: 'Club activity', kind: 'event', important: false },
  { date: '2026-12-25', title: 'Christmas', kind: 'holiday', important: false },
  { date: '2026-12-26', title: 'Saturday: Monday timetable followed', kind: 'class', important: false },
  { date: '2026-12-28', endDate: '2027-01-01', title: 'Laboratory IA and faculty feedback', kind: 'test', important: true },
  // January 2027
  { date: '2027-01-05', title: 'Last working day', kind: 'deadline', important: true },
  { date: '2027-01-07', title: 'IA marks submission', kind: 'deadline', important: false },
  { date: '2027-01-14', title: 'Makara Sankranthi', kind: 'holiday', important: false },
  { date: '2027-01-18', title: 'Theory exams begin (SEE)', kind: 'exam', important: true },
  { date: '2027-01-26', title: 'Republic Day', kind: 'holiday', important: false },
  // February 2027
  { date: '2027-02-08', endDate: '2027-02-10', title: 'Academic audit', kind: 'event', important: false },
  {
    date: '2027-02-22',
    title: 'Even semester classes begin',
    kind: 'class',
    important: true,
    notes: 'The events column says 22 Feb; the footer of the same calendar says 15 Feb 2027. Confirm with your department.',
  },
];

export function createSemesterEvents(): CalendarEvent[] {
  return seeds.map((s, i) => ({ notes: '', ...s, id: `sem5-2026-${String(i + 1).padStart(2, '0')}`, source: 'semester' }));
}

export const defaultSemesterInfo: SemesterInfo = {
  title: '5th Semester · AY 2026-27',
  startDate: '2026-09-07',
  endDate: '2027-02-10',
  sourceLabel: 'Calendar of Events (CoE), 5th semester B.E., AY 2026-27 – dated 31-07-2026',
  notes: [
    'Maintain 75% or more attendance in every subject at all times.',
    'Co-curricular, extra-curricular and sports activities require attendance above 75%.',
    'Club / outreach activities every month; special seminars or guest lectures every month.',
    '90 working days this semester.',
  ],
};
