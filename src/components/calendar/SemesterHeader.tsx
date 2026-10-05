import { CalendarCheck, ChevronDown, GraduationCap, PencilLine, ShieldCheck, TreePalm, type LucideIcon } from 'lucide-react';
import type { CalendarEvent, SemesterInfo } from '../../types/extras';
import { formatShortDate, parseISODate, WEEKDAY_SHORT } from '../../utils/date';
import { eventTiming, formatDateRange, lastWorkingDay, nextAssessment, nextHoliday, semesterProgress, shortTitle } from '../../utils/events';

interface Props {
  info: SemesterInfo;
  events: CalendarEvent[];
  today: string;
}

/** Semester hero: progress through the semester, countdowns and the official rules. */
export function SemesterHeader({ info, events, today }: Props) {
  const p = semesterProgress(info, today);
  const test = nextAssessment(events, today);
  const holiday = nextHoliday(events, today);
  const lwd = lastWorkingDay(events);
  const [firstNote, ...otherNotes] = info.notes;
  const progressText =
    p.phase === 'before'
      ? `Starts in ${p.daysToStart} ${p.daysToStart === 1 ? 'day' : 'days'}`
      : p.phase === 'after'
        ? 'Semester complete'
        : `Week ${p.week} of ${p.totalWeeks}`;

  return (
    <section
      aria-labelledby="semester-title"
      className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-indigo-600 to-violet-700 p-4 text-white shadow-md dark:from-brand-800 dark:via-indigo-900 dark:to-violet-950 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white/80">Semester calendar</p>
          <h2 id="semester-title" className="text-xl font-bold leading-tight sm:text-2xl">
            {info.title}
          </h2>
          <p className="mt-0.5 text-sm text-white/85">{formatDateRange(info.startDate, info.endDate)}</p>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
          <GraduationCap size={26} aria-hidden />
        </span>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm font-semibold">
          <span>{progressText}</span>
          <span className="tabular-nums">{p.pct}% of semester done</span>
        </div>
        <div
          role="progressbar"
          aria-label="Semester progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={p.pct}
          aria-valuetext={`${progressText}, ${p.pct}% of semester done`}
          className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-white/25"
        >
          <div className="h-full rounded-full bg-white" style={{ width: `${p.pct}%` }} />
        </div>
        {p.phase === 'during' && (
          <p className="mt-1 text-xs text-white/80">
            {p.daysLeft === 0 ? 'Last day of the semester' : `${p.daysLeft} days to go · ends ${formatShortDate(info.endDate)}`}
          </p>
        )}
      </div>

      <ul className="mt-4 grid grid-cols-3 gap-2" aria-label="Countdowns">
        <Countdown icon={PencilLine} label="Next test / exam" event={test} today={today} />
        <Countdown icon={TreePalm} label="Next holiday" event={holiday} today={today} />
        <Countdown icon={CalendarCheck} label="Last working day" event={lwd} today={today} useDate />
      </ul>

      {firstNote && (
        <div className="mt-4 rounded-2xl bg-white/10 p-3 text-sm">
          <p className="flex items-start gap-2 font-medium">
            <ShieldCheck size={18} aria-hidden className="mt-0.5 shrink-0" />
            {firstNote}
          </p>
          {otherNotes.length > 0 && (
            <details className="group mt-1">
              <summary className="flex min-h-touch cursor-pointer list-none items-center gap-1 font-medium text-white/90 [&::-webkit-details-marker]:hidden">
                <ChevronDown size={16} aria-hidden className="transition-transform group-open:rotate-180" />
                {otherNotes.length} more {otherNotes.length === 1 ? 'note' : 'notes'} from the official calendar
              </summary>
              <ul className="ml-6 list-disc space-y-1 text-white/90">
                {otherNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              {info.sourceLabel && <p className="mt-2 text-xs text-white/75">Source: {info.sourceLabel}</p>}
            </details>
          )}
        </div>
      )}
    </section>
  );
}

function Countdown({ icon: Icon, label, event, today, useDate }: { icon: LucideIcon; label: string; event?: CalendarEvent; today: string; useDate?: boolean }) {
  let value = '—';
  let sub = 'Nothing coming up';
  if (event) {
    const t = eventTiming(event, today);
    const d = parseISODate(event.date);
    if (t.phase === 'upcoming') value = `${t.days} ${t.days === 1 ? 'day' : 'days'}`;
    else if (t.phase === 'today') value = 'Today';
    else if (t.phase === 'ongoing') value = 'On now';
    else value = 'Done';
    const when = `${WEEKDAY_SHORT[d.getDay()]}, ${formatShortDate(event.date)}`;
    sub = useDate ? when : `${shortTitle(event)} · ${when}`;
  }
  return (
    <li className="min-w-0 rounded-2xl bg-white/10 p-2.5 sm:p-3">
      <p className="flex items-center gap-1 text-xs font-medium leading-tight text-white/85">
        <Icon size={13} aria-hidden className="hidden shrink-0 min-[400px]:block" />
        {label}
      </p>
      <p className="mt-1 text-lg font-bold leading-tight tabular-nums sm:text-2xl">{value}</p>
      <p className="mt-0.5 break-words text-xs leading-snug text-white/85">{sub}</p>
    </li>
  );
}
