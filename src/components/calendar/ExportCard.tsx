import { useMemo, useState, type ReactNode } from 'react';
import { BellRing, CalendarArrowDown, ChevronDown, Download, Globe, GraduationCap, Heart, Laptop, Repeat, Smartphone, Star, TreePalm, type LucideIcon } from 'lucide-react';
import { useAppData } from '../../hooks/useAppData';
import { useToast } from '../../hooks/useToast';
import { formatShortDate } from '../../utils/date';
import { holidayDates, timetableSwaps } from '../../utils/events';
import { deviceTimeZone, eventsToIcs, exportTimeZone, skippedHolidays, timetableTemplates, timetableToIcs } from '../../utils/ics';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { SelectField } from '../common/Fields';
import { downloadText } from './download';

const ICS_TYPE = 'text/calendar;charset=utf-8';
const ALERT_OPTIONS = [0, 5, 10, 15, 30];

/** Export to Apple Calendar (iPhone/Mac) and Google Calendar as .ics files. */
export function ExportCard({ today }: { today: string }) {
  const { data } = useAppData();
  const { toast } = useToast();
  const [onlyImportant, setOnlyImportant] = useState(false);
  const [includeRoutine, setIncludeRoutine] = useState(false);
  const [alert, setAlert] = useState<string>(String(data.prefs.remindBeforeMinutes));
  const [stopAtSemesterEnd, setStopAtSemesterEnd] = useState(true);
  const [skipHolidays, setSkipHolidays] = useState(true);

  const datesToExport = onlyImportant ? data.events.filter((e) => e.important) : data.events;
  const blocks = useMemo(() => timetableTemplates(data.templates, today, includeRoutine), [data.templates, today, includeRoutine]);
  const semesterEnd = data.semesterInfo.endDate;
  const canStop = semesterEnd >= today;
  const until = stopAtSemesterEnd && canStop ? semesterEnd : undefined;
  const holidays = useMemo(() => holidayDates(data.events), [data.events]);
  const dayAs = useMemo(() => timetableSwaps(data.events), [data.events]);
  // Holidays on which College (and the trips to it) would otherwise alert you.
  const offDays = useMemo(() => skippedHolidays(blocks, holidays, today, until), [blocks, holidays, today, until]);
  const alertOptions = ALERT_OPTIONS.includes(data.prefs.remindBeforeMinutes) ? ALERT_OPTIONS : [...ALERT_OPTIONS, data.prefs.remindBeforeMinutes].sort((a, b) => a - b);

  const exportDates = () => {
    downloadText('kiran-planner-semester.ics', eventsToIcs(datesToExport, { now: new Date(), timeZone: exportTimeZone(deviceTimeZone()) }), ICS_TYPE);
    toast({ id: 'ics-export', tone: 'success', title: 'Calendar file downloaded', body: `${datesToExport.length} dates in kiran-planner-semester.ics. Open it to add them.` });
  };

  const exportTimetable = () => {
    const ics = timetableToIcs(data.templates, {
      today,
      now: new Date(),
      timeZone: exportTimeZone(deviceTimeZone()),
      includeRoutine,
      alertMinutes: alert === 'none' ? null : Number(alert),
      until,
      holidays: skipHolidays ? holidays : [],
      // Saturdays that follow a weekday timetable get that day's blocks, like Today does.
      dayAs,
      categories: data.categories,
    });
    downloadText('kiran-planner-timetable.ics', ics, ICS_TYPE);
    const skipped = skipHolidays && offDays.length > 0 ? ` College is left out on ${offDays.length} ${offDays.length === 1 ? 'holiday' : 'holidays'}.` : '';
    const swapped = [...dayAs.keys()].filter((d) => d >= today && (!until || d <= until)).length;
    const followed = swapped > 0 ? ` ${swapped} ${swapped === 1 ? 'Saturday follows' : 'Saturdays follow'} a weekday timetable.` : '';
    toast({
      id: 'ics-export',
      tone: 'success',
      title: 'Timetable downloaded',
      body: `${blocks.length} repeating blocks in kiran-planner-timetable.ics.${skipped}${followed} Open it to add them.`,
    });
  };

  return (
    <Card title="Add to Apple or Google Calendar" icon={<CalendarArrowDown size={20} aria-hidden className="text-brand-600 dark:text-brand-300" />}>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        A web app can only alert you while it is open. Your phone’s calendar can alert you any time — even when Kiran Planner is closed and the phone is
        locked. Download a calendar file and add it once.
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section aria-labelledby="export-dates" className="flex flex-col rounded-2xl border border-slate-200 p-3 dark:border-slate-700 sm:p-4">
          <h3 id="export-dates" className="flex items-center gap-2 font-semibold">
            <Star size={18} aria-hidden className="text-amber-500" />
            Semester & important dates
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Holidays, IA tests, exams and your own dates as all-day events. In Apple Calendar, starred dates remind you the day before at 9 AM.
          </p>
          <label className="mt-3 flex min-h-touch items-center gap-3">
            <input type="checkbox" className="h-5 w-5 shrink-0" checked={onlyImportant} onChange={(e) => setOnlyImportant(e.target.checked)} />
            Only starred dates
          </label>
          <ul className="mt-2 flex flex-wrap gap-1.5 text-sm" aria-label="What the file contains">
            {[
              { n: datesToExport.filter((e) => e.kind === 'holiday').length, label: 'holidays', icon: TreePalm },
              { n: datesToExport.filter((e) => e.kind === 'test' || e.kind === 'exam').length, label: 'tests & exams', icon: GraduationCap },
              { n: datesToExport.filter((e) => e.important).length, label: 'starred (with reminder)', icon: Star },
              { n: datesToExport.filter((e) => e.source !== 'semester').length, label: 'added by you', icon: Heart },
            ]
              .filter((x) => x.n > 0)
              .map(({ n, label, icon: Icon }) => (
                <li key={label} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <Icon size={14} aria-hidden />
                  {n} {label}
                </li>
              ))}
          </ul>
          <div className="mt-auto pt-3">
            <Button variant="primary" block icon={<Download size={18} aria-hidden />} onClick={exportDates} disabled={datesToExport.length === 0}>
              Download {datesToExport.length} dates (.ics)
            </Button>
          </div>
        </section>

        <section aria-labelledby="export-timetable" className="flex flex-col rounded-2xl border border-slate-200 p-3 dark:border-slate-700 sm:p-4">
          <h3 id="export-timetable" className="flex items-center gap-2 font-semibold">
            <Repeat size={18} aria-hidden className="text-brand-600 dark:text-brand-300" />
            My timetable with alerts
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Your current repeating timetable as weekly events, each with an alert. This is what makes your iPhone and Mac remind you reliably.
          </p>
          <fieldset className="mt-3">
            <legend className="sr-only">Which blocks</legend>
            <label className="flex min-h-touch items-center gap-3">
              <input type="radio" name="tt-scope" className="h-5 w-5 shrink-0" checked={!includeRoutine} onChange={() => setIncludeRoutine(false)} />
              Study, gym and college only
            </label>
            <label className="flex min-h-touch items-center gap-3">
              <input type="radio" name="tt-scope" className="h-5 w-5 shrink-0" checked={includeRoutine} onChange={() => setIncludeRoutine(true)} />
              Everything, incl. wake-up, meals, travel and sleep
            </label>
          </fieldset>
          <SelectField
            className="mt-2"
            label="Alert"
            value={alert}
            onChange={(e) => setAlert(e.target.value)}
            options={[
              ...alertOptions.map((m) => ({ value: String(m), label: m === 0 ? 'At the start' : `${m} minutes before` })),
              { value: 'none', label: 'No alerts' },
            ]}
          />
          {canStop && (
            <label className="mt-2 flex min-h-touch items-center gap-3">
              <input type="checkbox" className="h-5 w-5 shrink-0" checked={stopAtSemesterEnd} onChange={(e) => setStopAtSemesterEnd(e.target.checked)} />
              Stop repeating after the semester ({formatShortDate(semesterEnd)})
            </label>
          )}
          {offDays.length > 0 && (
            <label className="mt-2 flex min-h-touch items-start gap-3 py-1">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={skipHolidays} onChange={(e) => setSkipHolidays(e.target.checked)} />
              <span>
                No college or travel alerts on holidays
                <span className="block text-sm text-slate-600 dark:text-slate-400">
                  {offDays.length} {offDays.length === 1 ? 'holiday falls' : 'holidays fall'} on a college day: {offDays.map((d) => formatShortDate(d)).join(', ')}
                </span>
              </span>
            </label>
          )}
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {blocks.length > 0
              ? `${blocks.length} repeating ${blocks.length === 1 ? 'block' : 'blocks'}: ${[...new Set(blocks.map((b) => b.title))].slice(0, 4).join(', ')}${blocks.length > 4 ? '…' : ''}`
              : 'No repeating timetable from today on.'}
          </p>
          <div className="mt-auto pt-3">
            <Button variant="primary" block icon={<BellRing size={18} aria-hidden />} onClick={exportTimetable} disabled={blocks.length === 0}>
              Download timetable (.ics)
            </Button>
          </div>
        </section>
      </div>

      <div className="mt-4 space-y-2">
        <HowTo icon={Smartphone} title="On iPhone">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Tap a download button above and confirm Download.</li>
            <li>Open the file: Safari’s downloads list (the arrow in the address bar) or Files → Downloads.</li>
            <li>
              Tap <strong>Add All</strong> and choose a calendar. Tip: first create a calendar called “Kiran” in the Calendar app so you can remove it all in one go later.
            </li>
          </ol>
        </HowTo>
        <HowTo icon={Laptop} title="On Mac">
          <p>Open the downloaded file. Calendar opens and asks which calendar to add the events to — choose one and click OK. With iCloud, they appear on your iPhone too.</p>
        </HowTo>
        <HowTo icon={Globe} title="In Google Calendar">
          <p>
            On a computer open calendar.google.com → Settings (gear) → <strong>Import & export</strong> → choose the file → pick a calendar → Import. The events then show on
            every device signed in to that Google account.
          </p>
          <p className="mt-2 rounded-lg bg-slate-100 px-2.5 py-1.5 dark:bg-slate-800">
            <strong>Alerts:</strong> Google Calendar doesn’t import the alerts in the file. It uses that calendar’s default notifications instead — set them under Settings →
            your calendar → <strong>Event notifications</strong>. For reliable alerts, add the files on your iPhone or Mac.
          </p>
        </HowTo>
      </div>

      <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
        <strong>It’s a copy, not a live link.</strong> A website can’t keep a two-way connection to Apple or Google Calendar. After you change your timetable or dates,
        download again and replace the old events (delete the old calendar first to avoid duplicates).
      </p>
    </Card>
  );
}

function HowTo({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-slate-200 dark:border-slate-700">
      <summary className="flex min-h-touch cursor-pointer list-none items-center gap-2 px-3 font-medium [&::-webkit-details-marker]:hidden">
        <Icon size={18} aria-hidden className="text-slate-500" />
        {title}
        <ChevronDown size={18} aria-hidden className="ml-auto text-slate-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-3 pb-3 text-sm text-slate-700 dark:text-slate-300">{children}</div>
    </details>
  );
}
