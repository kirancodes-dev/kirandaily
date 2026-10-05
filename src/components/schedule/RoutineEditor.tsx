import { useState } from 'react';
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Priority, Recurrence, RecurrenceType, TaskTemplate } from '../../types/task';
import { useAppData } from '../../hooks/useAppData';
import { useTasks } from '../../hooks/useTasks';
import { currentTemplates } from '../../utils/taskActions';
import { describeRecurrence } from '../../utils/schedule';
import { formatLongDate, formatMinutes, formatTime12, durationMinutes, isValidISODate, isValidTime, timeToMinutes, WEEKDAY_SHORT, WEEK_ORDER } from '../../utils/date';
import { Card } from '../common/Card';
import { Button, IconButton } from '../common/Button';
import { CategoryChip } from '../common/Chips';
import { Modal, ConfirmDialog } from '../common/Modal';
import { SelectField, TextArea, TextField } from '../common/Fields';

const GROUPS: { title: string; match: (r: Recurrence) => boolean }[] = [
  { title: 'Every day', match: (r) => r.type === 'daily' },
  { title: 'Weekdays', match: (r) => r.type === 'weekdays' || (r.type === 'custom' && (r.days ?? []).every((d) => d >= 1 && d <= 5)) },
  { title: 'Saturday', match: (r) => r.type === 'saturday' },
  { title: 'Sunday', match: (r) => r.type === 'sunday' },
  { title: 'Other days', match: () => true },
];

export function RoutineEditor({ today }: { today: string }) {
  const { data } = useAppData();
  const ops = useTasks();
  const [editing, setEditing] = useState<TaskTemplate | 'new' | null>(null);
  const [deleting, setDeleting] = useState<TaskTemplate | null>(null);
  const templates = currentTemplates(data.templates, today).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const used = new Set<string>();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-slate-600 dark:text-slate-400">
          Your repeating timetable. Changes apply from the date you choose; earlier days stay as they were.
        </p>
        <Button variant="primary" icon={<Plus size={18} aria-hidden />} onClick={() => setEditing('new')}>
          Add repeating task
        </Button>
      </div>
      {GROUPS.map((g) => {
        const items = templates.filter((t) => !used.has(t.id) && g.match(t.recurrence));
        items.forEach((t) => used.add(t.id));
        if (!items.length) return null;
        return (
          <Card key={g.title} title={g.title}>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((t) => (
                <li key={t.id} className="flex items-center gap-2 py-2">
                  <div className="w-20 shrink-0 text-sm tabular-nums text-slate-600 dark:text-slate-400">{formatTime12(t.startTime)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 font-medium">
                      {t.title}
                      {t.locked && <Lock size={14} aria-label="Protected" className="text-slate-500" />}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                      <CategoryChip id={t.category} />
                      <span>{formatMinutes(durationMinutes(t.startTime, t.endTime))}</span>
                      <span>· {describeRecurrence(t.recurrence)}</span>
                      {t.startDate > today && <span>· from {formatLongDate(t.startDate)}</span>}
                      {t.endDate && <span>· until {formatLongDate(t.endDate)}</span>}
                    </div>
                  </div>
                  <IconButton label={`Edit ${t.title}`} onClick={() => setEditing(t)}>
                    <Pencil size={18} aria-hidden />
                  </IconButton>
                  <IconButton label={t.locked ? `${t.title} is protected` : `Delete ${t.title}`} disabled={t.locked} onClick={() => setDeleting(t)}>
                    <Trash2 size={18} aria-hidden />
                  </IconButton>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}

      {editing && (
        <TemplateForm
          template={editing === 'new' ? null : editing}
          today={today}
          onClose={() => setEditing(null)}
          onSave={(values, from) => {
            if (editing === 'new') ops.addTemplate({ ...values, startDate: from });
            else ops.updateTemplate(editing.id, values, from);
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        danger
        title="Remove repeating task?"
        message={`“${deleting?.title}” will be removed from today onwards. Past days keep their history.`}
        confirmLabel="Remove"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) ops.endTemplate(deleting.id, today > deleting.startDate ? today : deleting.startDate);
          setDeleting(null);
        }}
      />
    </div>
  );
}

type TemplateValues = Pick<TaskTemplate, 'title' | 'category' | 'startTime' | 'endTime' | 'priority' | 'notes' | 'recurrence'>;

function TemplateForm({
  template,
  today,
  onClose,
  onSave,
}: {
  template: TaskTemplate | null;
  today: string;
  onClose: () => void;
  onSave: (v: TemplateValues, from: string) => void;
}) {
  const { data } = useAppData();
  const [v, setV] = useState<TemplateValues>(
    template
      ? { title: template.title, category: template.category, startTime: template.startTime, endTime: template.endTime, priority: template.priority, notes: template.notes, recurrence: template.recurrence }
      : { title: '', category: 'java', startTime: '18:00', endTime: '19:00', priority: 'medium', notes: '', recurrence: { type: 'daily' } },
  );
  const [from, setFrom] = useState(template && template.startDate > today ? template.startDate : today);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof TemplateValues>(k: K, val: TemplateValues[K]) => setV((p) => ({ ...p, [k]: val }));

  const save = () => {
    if (!v.title.trim()) return setError('Give it a title.');
    if (!isValidTime(v.startTime) || !isValidTime(v.endTime) || v.startTime === v.endTime) return setError('Check the start and end times.');
    if (v.recurrence.type === 'custom' && !(v.recurrence.days ?? []).length) return setError('Choose at least one day.');
    if (!isValidISODate(from)) return setError('Pick a valid “apply from” date.');
    onSave({ ...v, title: v.title.trim(), recurrence: template?.locked ? { type: 'daily' } : v.recurrence }, from);
  };

  return (
    <Modal
      open
      title={template ? `Edit ${template.title}` : 'New repeating task'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <TextField label="Title" value={v.title} onChange={(e) => set('title', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Start" type="time" value={v.startTime} onChange={(e) => set('startTime', e.target.value)} />
          <TextField label="End" type="time" value={v.endTime} onChange={(e) => set('endTime', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Category"
            value={v.category}
            onChange={(e) => set('category', e.target.value)}
            options={data.categories.map((c) => ({ value: c.id, label: c.label }))}
          />
          <SelectField
            label="Priority"
            value={v.priority}
            onChange={(e) => set('priority', e.target.value as Priority)}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
          />
        </div>
        {template?.locked ? (
          <p className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">Gym repeats every day and can’t be removed. You can change its time.</p>
        ) : (
          <>
            <SelectField
              label="Repeat"
              value={v.recurrence.type}
              onChange={(e) => set('recurrence', { type: e.target.value as RecurrenceType, days: v.recurrence.days ?? [] })}
              options={[
                { value: 'daily', label: 'Every day' },
                { value: 'weekdays', label: 'Weekdays (Mon–Fri)' },
                { value: 'saturday', label: 'Every Saturday' },
                { value: 'sunday', label: 'Every Sunday' },
                { value: 'custom', label: 'Custom days' },
              ]}
            />
            {v.recurrence.type === 'custom' && (
              <fieldset>
                <legend className="text-sm font-medium">Days</legend>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {WEEK_ORDER.map((d) => {
                    const days = v.recurrence.days ?? [];
                    const on = days.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set('recurrence', { type: 'custom', days: on ? days.filter((x) => x !== d) : [...days, d].sort() })}
                        className={`min-h-touch min-w-touch rounded-xl px-2 text-sm font-medium ring-1 ring-inset ${
                          on ? 'bg-brand-600 text-white ring-brand-600' : 'ring-slate-300 dark:ring-slate-600'
                        }`}
                      >
                        {WEEKDAY_SHORT[d]}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </>
        )}
        <TextField label="Apply from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} hint="Days before this keep the old version." />
        <TextArea label="Notes" value={v.notes} onChange={(e) => set('notes', e.target.value)} />
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
