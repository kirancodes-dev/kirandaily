import { useState, type FormEvent } from 'react';
import { Star, Trash2 } from 'lucide-react';
import type { CalendarEvent, EventKind } from '../../types/extras';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { TextArea, TextField } from '../common/Fields';
import { EVENT_KINDS, emptyEventForm, eventToForm, validateEventForm, type EventFormErrors, type EventFormValues } from '../../utils/events';
import { KIND_META } from './kindMeta';
import { formatShortDate, formatTime12, isValidISODate, isValidTime, parseISODate, WEEKDAY_SHORT } from '../../utils/date';

const dayLabel = (date: string) => `${WEEKDAY_SHORT[parseISODate(date).getDay()]}, ${formatShortDate(date)}`;

interface Props {
  /** Event being edited, or null to add one. */
  event: CalendarEvent | null;
  /** Starting values for a new event. */
  defaults?: Partial<EventFormValues>;
  today: string;
  onClose: () => void;
  onSubmit: (values: EventFormValues) => void;
  onDelete?: (e: CalendarEvent) => void;
}

/** Add / edit a calendar date. Mount it with a `key` so it starts fresh each time. */
export function EventForm({ event, defaults, today, onClose, onSubmit, onDelete }: Props) {
  const [v, setV] = useState<EventFormValues>(() => (event ? eventToForm(event) : { ...emptyEventForm(today), ...defaults }));
  const [errors, setErrors] = useState<EventFormErrors>({});
  const set = <K extends keyof EventFormValues>(k: K, value: EventFormValues[K]) => setV((p) => ({ ...p, [k]: value }));

  // A multi-day event with times runs continuously from the first to the last day.
  const multiDay = isValidISODate(v.date) && isValidISODate(v.endDate) && v.endDate > v.date;
  const spanText =
    multiDay && !v.allDay && isValidTime(v.startTime)
      ? `Runs from ${dayLabel(v.date)}, ${formatTime12(v.startTime)} until ${dayLabel(v.endDate)}${isValidTime(v.endTime) ? `, ${formatTime12(v.endTime)}` : ''}.`
      : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validateEventForm(v);
    setErrors(errs);
    if (Object.keys(errs).length === 0) onSubmit(v);
  };

  return (
    <Modal
      open
      title={event ? 'Edit date' : 'Add important date'}
      onClose={onClose}
      footer={
        <>
          {event && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(event)}
              className="mr-auto inline-flex min-h-touch items-center gap-2 rounded-xl px-3 font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
            >
              <Trash2 size={18} aria-hidden />
              Delete
            </button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="event-form">
            Save
          </Button>
        </>
      }
    >
      <form id="event-form" onSubmit={submit} className="space-y-4" noValidate>
        {event?.source === 'semester' && (
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            From the official semester calendar. Changes only affect your copy.
          </p>
        )}
        {event?.source === 'import' && (
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">Imported from a calendar file.</p>
        )}
        <TextField
          label="Title"
          value={v.title}
          onChange={(e) => set('title', e.target.value)}
          error={errors.title}
          placeholder="e.g. Project review, Amma’s birthday"
          maxLength={300}
          autoFocus={!event}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Date" type="date" value={v.date} onChange={(e) => set('date', e.target.value)} error={errors.date} required />
          <TextField
            label="End date"
            type="date"
            value={v.endDate}
            min={v.date || undefined}
            onChange={(e) => set('endDate', e.target.value)}
            error={errors.endDate}
            hint={v.endDate ? undefined : 'Only for multi-day'}
          />
          {v.endDate && <ClearButton label="Clear end date" onClick={() => set('endDate', '')} />}
        </div>

        <label className="flex min-h-touch items-center gap-3 rounded-xl border border-slate-200 px-3 dark:border-slate-700">
          <input type="checkbox" className="h-5 w-5" checked={v.allDay} onChange={(e) => set('allDay', e.target.checked)} />
          <span className="font-medium">All day</span>
          <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">{v.allDay ? 'No time' : 'Set a time below'}</span>
        </label>
        {!v.allDay && (
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Start time" type="time" value={v.startTime} onChange={(e) => set('startTime', e.target.value)} error={errors.startTime} required />
            <TextField
              label="End time"
              type="time"
              value={v.endTime}
              onChange={(e) => set('endTime', e.target.value)}
              error={errors.endTime}
              hint={v.endTime ? undefined : 'Optional'}
            />
            {v.endTime && <ClearButton label="Clear end time" onClick={() => set('endTime', '')} />}
          </div>
        )}
        {spanText && <p className="text-sm text-slate-600 dark:text-slate-400">{spanText}</p>}

        <fieldset>
          <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">Type</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {EVENT_KINDS.map((k) => (
              <KindOption key={k} kind={k} checked={v.kind === k} onChange={() => set('kind', k)} />
            ))}
          </div>
        </fieldset>

        <label className="flex min-h-touch items-start gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={v.important} onChange={(e) => set('important', e.target.checked)} />
          <span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Star size={16} aria-hidden className={v.important ? 'fill-amber-400 text-amber-500' : 'text-slate-400'} />
              Important
            </span>
            <span className="block text-sm text-slate-600 dark:text-slate-400">Shows on Today with a countdown and reminds you a day before in calendar exports.</span>
          </span>
        </label>

        <TextArea label="Notes" value={v.notes} onChange={(e) => set('notes', e.target.value)} error={errors.notes} maxLength={2000} />
      </form>
    </Modal>
  );
}

/** Date/time inputs are hard to empty on iPhone, so offer a button. */
function ClearButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="col-start-2 -mt-3">
      <button type="button" onClick={onClick} className="inline-flex min-h-touch items-center text-sm font-medium text-brand-700 underline dark:text-brand-300">
        {label}
      </button>
    </div>
  );
}

function KindOption({ kind, checked, onChange }: { kind: EventKind; checked: boolean; onChange: () => void }) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  return (
    <label className="relative">
      <input type="radio" name="event-kind" value={kind} checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        className={`inline-flex min-h-touch cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-medium ring-1 ring-inset peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500 ${
          checked ? `${meta.chip} ring-current` : 'text-slate-700 ring-slate-300 hover:bg-slate-50 dark:text-slate-300 dark:ring-slate-600 dark:hover:bg-slate-800'
        }`}
      >
        <Icon size={16} aria-hidden />
        {meta.label}
      </span>
    </label>
  );
}
