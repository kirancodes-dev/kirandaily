import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarPlus, ChevronDown, GraduationCap, ListFilter, Plus, RotateCcw, Star, TreePalm } from 'lucide-react';
import type { CalendarEvent } from '../types/extras';
import { useAppData } from '../hooks/useAppData';
import { useExtras } from '../hooks/useExtras';
import { useToast } from '../hooks/useToast';
import { useToday } from '../hooks/useToday';
import { uid } from '../utils/id';
import { eventEnd, filterEvents, formToEvent, missingOfficial, sortEvents, upcoming, type EventFilter, type EventFormValues } from '../utils/events';
import { createSemesterEvents } from '../data/semesterCalendar';
import { PageHeader, EmptyState } from '../components/common/Feedback';
import { Tabs } from '../components/common/Tabs';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/Modal';
import { SemesterHeader } from '../components/calendar/SemesterHeader';
import { EventList, JumpToToday } from '../components/calendar/EventList';
import { EventForm } from '../components/calendar/EventForm';
import { ExportCard } from '../components/calendar/ExportCard';
import { ImportCard } from '../components/calendar/ImportCard';
import { PdfCard } from '../components/calendar/PdfCard';

type Tab = 'upcoming' | 'semester' | 'important' | 'sync';
const TABS: { id: Tab; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'semester', label: 'Semester' },
  { id: 'important', label: 'Important' },
  { id: 'sync', label: 'Sync' },
];

const FILTERS: { id: EventFilter; label: string; icon?: typeof Star }[] = [
  { id: 'all', label: 'All' },
  { id: 'important', label: 'Important', icon: Star },
  { id: 'exams', label: 'Exams & tests', icon: GraduationCap },
  { id: 'holidays', label: 'Holidays', icon: TreePalm },
];

type Editing = { event: CalendarEvent | null; defaults?: Partial<EventFormValues> } | null;

/**
 * Gives keyboard focus back after a sheet closes. The shared Modal unmounts
 * its <dialog> without close(), so the browser would drop focus to <body>.
 * Runs after React has re-rendered: a saved row is found again by its id; a
 * deleted one falls back to the selected tab.
 */
function focusBack(el: Element | null, eventId?: string) {
  requestAnimationFrame(() => {
    const byId = eventId ? document.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(eventId)}"]`) : null;
    const target =
      (el instanceof HTMLElement && el.isConnected ? el : null) ?? byId ?? document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    target?.focus();
  });
}

/** Semester calendar, important dates, and Apple / Google Calendar export & import. */
export default function Calendar() {
  const today = useToday();
  const { events, semesterInfo, saveEvent } = useExtras();
  const { update } = useAppData();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'upcoming') as Tab;
  const [filter, setFilter] = useState<EventFilter>('all');
  const [editing, setEditing] = useState<Editing>(null);
  const [formKey, setFormKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<CalendarEvent | null>(null);
  /** What had focus when the edit sheet / delete confirmation opened. */
  const editOpener = useRef<{ el: Element | null; id?: string }>({ el: null });
  const confirmOpener = useRef<Element | null>(null);

  const official = useMemo(() => createSemesterEvents(), []);
  const missing = missingOfficial(events, official);

  const setTab = (t: Tab) => setParams(t === 'upcoming' ? {} : { tab: t }, { replace: true });
  const open = (next: Editing) => {
    editOpener.current = { el: document.activeElement, id: next?.event?.id };
    setFormKey((k) => k + 1);
    setEditing(next);
  };
  const closeForm = () => {
    setEditing(null);
    focusBack(editOpener.current.el, editOpener.current.id);
  };
  const addImportant = () => open({ event: null, defaults: { date: today, kind: 'personal', important: true } });

  const restore = (e: CalendarEvent) => update((d) => (d.events.some((x) => x.id === e.id) ? d : { ...d, events: [...d.events, e] }));
  const remove = (e: CalendarEvent) => {
    update((d) => ({ ...d, events: d.events.filter((x) => x.id !== e.id) }));
    setConfirmDelete(null);
    closeForm();
    toast({ id: 'event-deleted', tone: 'info', title: `Deleted “${e.title}”`, action: { label: 'Undo', onClick: () => restore(e) }, duration: 8000 });
  };

  const submit = (v: EventFormValues) => {
    const fields = formToEvent(v);
    if (editing?.event) {
      const { id, source } = editing.event;
      saveEvent({ id, source, ...fields });
      toast({ id: 'event-saved', tone: 'success', title: 'Date updated' });
    } else {
      update((d) => ({ ...d, events: [...d.events, { ...fields, id: uid('evt'), source: 'user' }] }));
      toast({ id: 'event-saved', tone: 'success', title: fields.important ? 'Important date added' : 'Date added', body: fields.title });
    }
    closeForm();
  };

  const toggleImportant = (e: CalendarEvent) => {
    saveEvent({ ...e, important: !e.important });
    if (e.important && tab === 'important') {
      toast({ id: 'event-star', tone: 'info', title: `Removed the star from “${e.title}”`, action: { label: 'Undo', onClick: () => saveEvent({ ...e }) } });
    }
  };

  const rowProps = { today, onEdit: (e: CalendarEvent) => open({ event: e }), onToggleImportant: toggleImportant };

  const upcomingList = filterEvents(upcoming(events, today), filter);
  const semesterList = filterEvents(sortEvents(events.filter((e) => e.source === 'semester')), filter);
  const importantList = sortEvents(events.filter((e) => e.important));
  const importantAhead = importantList.filter((e) => eventEnd(e) >= today);
  const importantPast = importantList.filter((e) => eventEnd(e) < today);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendar"
        subtitle="Semester dates, exams and your important days."
        actions={
          <Button variant="primary" icon={<Plus size={18} aria-hidden />} onClick={addImportant}>
            Add important date
          </Button>
        }
      />

      <SemesterHeader info={semesterInfo} events={events} today={today} />

      {/* Slightly tighter tab padding so four tabs fit on a 360px phone. */}
      <div className="[&_[role=tab]]:px-1.5">
        <Tabs label="Calendar views" value={tab} onChange={setTab} tabs={TABS} />
      </div>

      {(tab === 'upcoming' || tab === 'semester') && (
        <div role="group" aria-label="Filter dates" className="flex flex-wrap items-center gap-2">
          <ListFilter size={18} aria-hidden className="text-slate-500" />
          {FILTERS.map((f) => {
            const on = filter === f.id;
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(f.id)}
                className={`inline-flex min-h-touch items-center gap-1.5 rounded-full px-3.5 text-sm font-medium ring-1 ring-inset ${
                  on
                    ? 'bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900 dark:ring-white'
                    : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                {Icon && <Icon size={15} aria-hidden />}
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {tab === 'upcoming' &&
        (upcomingList.length > 0 ? (
          <EventList events={upcomingList} from={today} initialLimit={40} {...rowProps} />
        ) : (
          <EmptyState icon={<CalendarPlus size={32} aria-hidden />} title={filter === 'all' ? 'Nothing coming up' : 'Nothing coming up for this filter'}>
            <Button className="mt-2" variant="primary" icon={<Plus size={18} aria-hidden />} onClick={addImportant}>
              Add important date
            </Button>
          </EmptyState>
        ))}

      {tab === 'semester' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-sm text-slate-600 dark:text-slate-400">Every date from the official calendar of events. Past dates are greyed out; tap one to edit it.</p>
            {semesterList.some((e) => eventEnd(e) < today) && <JumpToToday />}
          </div>
          {semesterList.length > 0 ? (
            <EventList events={semesterList} todayLine {...rowProps} />
          ) : (
            <EmptyState title="No semester dates for this filter" />
          )}
          {missing.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-slate-300 p-3 text-sm dark:border-slate-700">
              <span>
                {missing.length} official {missing.length === 1 ? 'date was' : 'dates were'} deleted.
              </span>
              <Button
                icon={<RotateCcw size={18} aria-hidden />}
                onClick={() => {
                  update((d) => ({ ...d, events: [...d.events, ...missingOfficial(d.events, official)] }));
                  toast({ id: 'restore', tone: 'success', title: `Restored ${missing.length} official ${missing.length === 1 ? 'date' : 'dates'}` });
                }}
              >
                Restore them
              </Button>
            </div>
          )}
        </>
      )}

      {tab === 'important' && (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Starred dates show on Today with a countdown and remind you the day before when you add them to your phone’s calendar (Sync tab).{' '}
            {importantAhead.length > 0 && <strong className="text-slate-800 dark:text-slate-200">{importantAhead.length} still ahead.</strong>}
          </p>
          {importantAhead.length > 0 ? (
            <EventList events={importantAhead} from={today} {...rowProps} />
          ) : (
            <EmptyState icon={<Star size={32} aria-hidden />} title="No important dates ahead">
              <p>Tap the star on any date, or add your own.</p>
              <Button className="mt-2" variant="primary" icon={<Plus size={18} aria-hidden />} onClick={addImportant}>
                Add important date
              </Button>
            </EmptyState>
          )}
          {importantPast.length > 0 && (
            <details className="group rounded-2xl border border-slate-200 dark:border-slate-800">
              <summary className="flex min-h-touch cursor-pointer list-none items-center gap-2 px-4 font-medium text-slate-700 dark:text-slate-300 [&::-webkit-details-marker]:hidden">
                <ChevronDown size={18} aria-hidden className="transition-transform group-open:rotate-180" />
                Past important dates ({importantPast.length})
              </summary>
              <div className="px-3 pb-3">
                <EventList events={importantPast} {...rowProps} />
              </div>
            </details>
          )}
        </>
      )}

      {tab === 'sync' && (
        <div className="space-y-4">
          <ExportCard today={today} />
          <ImportCard onShowDates={() => setTab('upcoming')} />
          <PdfCard sourceLabel={semesterInfo.sourceLabel} />
        </div>
      )}

      {editing && (
        <EventForm
          key={formKey}
          event={editing.event}
          defaults={editing.defaults}
          today={today}
          onClose={closeForm}
          onSubmit={submit}
          onDelete={(e) => {
            if (e.source !== 'semester') return remove(e);
            confirmOpener.current = document.activeElement;
            setConfirmDelete(e);
          }}
        />
      )}
      <ConfirmDialog
        open={!!confirmDelete}
        danger
        title="Delete this semester date?"
        message={
          <>
            <p>“{confirmDelete?.title}” comes from the official semester calendar.</p>
            <p className="mt-2 text-sm">You can bring deleted official dates back later from the Semester tab.</p>
          </>
        }
        confirmLabel="Delete"
        onCancel={() => {
          setConfirmDelete(null);
          focusBack(confirmOpener.current);
        }}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
      />
    </div>
  );
}
