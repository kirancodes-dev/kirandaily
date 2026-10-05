import { useState, type FormEvent } from 'react';
import type { Priority, Task } from '../../types/task';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { SelectField, TextArea, TextField } from '../common/Fields';
import { useAppData } from '../../hooks/useAppData';
import { durationMinutes, formatMinutes, isValidTime, WEEKDAY_SHORT, WEEK_ORDER } from '../../utils/date';
import { validateTask, type TaskFormValues } from '../../utils/taskForm';

interface TaskFormProps {
  open: boolean;
  /** Task being edited, or null to create a new one. */
  task: Task | null;
  defaultDate: string;
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => void;
}

function initialValues(task: Task | null, date: string): TaskFormValues {
  return {
    title: task?.title ?? '',
    date: task?.date ?? date,
    startTime: task?.startTime ?? '18:00',
    endTime: task?.endTime ?? '19:00',
    category: task?.category ?? 'java',
    subjectId: task?.subjectId ?? '',
    priority: task?.priority ?? 'medium',
    notes: task?.notes ?? '',
    repeat: task?.recurring?.type ?? 'none',
    days: task?.recurring?.days ?? [],
    scope: 'day',
  };
}

export function TaskForm({ open, task, defaultDate, onClose, onSubmit }: TaskFormProps) {
  const { data } = useAppData();
  const [v, setV] = useState(() => initialValues(task, defaultDate));
  const [errors, setErrors] = useState<ReturnType<typeof validateTask>>({});
  const isSeries = !!task?.templateId;
  const set = <K extends keyof TaskFormValues>(k: K, value: TaskFormValues[K]) => setV((p) => ({ ...p, [k]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validateTask(v);
    setErrors(errs);
    if (Object.keys(errs).length === 0) onSubmit({ ...v, title: v.title.trim() });
  };

  const canEditRepeat = !isSeries || v.scope === 'series';
  const duration = isValidTime(v.startTime) && isValidTime(v.endTime) ? durationMinutes(v.startTime, v.endTime) : 0;
  const crossesMidnight = isValidTime(v.startTime) && isValidTime(v.endTime) && v.endTime < v.startTime;

  return (
    <Modal
      open={open}
      title={task ? 'Edit task' : 'Add task'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="task-form">
            Save
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} className="space-y-3" noValidate>
        {isSeries && (
          <fieldset className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <legend className="px-1 text-sm font-medium">This task repeats. Apply changes to:</legend>
            {(
              [
                ['day', 'This day only'],
                ['series', 'This and following days'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex min-h-touch items-center gap-3">
                <input type="radio" name="scope" className="h-5 w-5" checked={v.scope === value} onChange={() => set('scope', value)} />
                {label}
              </label>
            ))}
          </fieldset>
        )}
        <TextField label="Title" value={v.title} onChange={(e) => set('title', e.target.value)} error={errors.title} required autoFocus={!task} />
        {!(isSeries && v.scope === 'series') && (
          <TextField label="Date" type="date" value={v.date} onChange={(e) => set('date', e.target.value)} error={errors.date} required />
        )}
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Start" type="time" value={v.startTime} onChange={(e) => set('startTime', e.target.value)} error={errors.startTime} required />
          <TextField label="End" type="time" value={v.endTime} onChange={(e) => set('endTime', e.target.value)} error={errors.endTime} required />
        </div>
        {duration > 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Duration: {formatMinutes(duration)}
            {crossesMidnight && ' (ends the next morning)'}
          </p>
        )}
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
        {v.category === 'college' && !(isSeries && v.scope === 'series') && (
          <SelectField
            label="Subject"
            value={v.subjectId}
            onChange={(e) => set('subjectId', e.target.value)}
            options={[{ value: '', label: 'No subject' }, ...data.subjects.map((s) => ({ value: s.id, label: s.name }))]}
          />
        )}
        {canEditRepeat && (
          <SelectField
            label="Repeat"
            value={v.repeat}
            onChange={(e) => set('repeat', e.target.value as TaskFormValues['repeat'])}
            options={[
              ...(isSeries ? [] : [{ value: 'none', label: 'Does not repeat' }]),
              { value: 'daily', label: 'Every day' },
              { value: 'weekdays', label: 'Weekdays (Mon–Fri)' },
              { value: 'saturday', label: 'Every Saturday' },
              { value: 'sunday', label: 'Every Sunday' },
              { value: 'custom', label: 'Custom days' },
            ]}
            hint={!isSeries && v.repeat !== 'none' ? 'Repeats from the chosen date onwards.' : undefined}
          />
        )}
        {canEditRepeat && v.repeat === 'custom' && (
          <fieldset>
            <legend className="text-sm font-medium">Days</legend>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {WEEK_ORDER.map((d) => {
                const on = v.days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set('days', on ? v.days.filter((x) => x !== d) : [...v.days, d])}
                    className={`min-h-touch min-w-touch rounded-xl px-2 text-sm font-medium ring-1 ring-inset ${
                      on ? 'bg-brand-600 text-white ring-brand-600' : 'ring-slate-300 dark:ring-slate-600'
                    }`}
                  >
                    {WEEKDAY_SHORT[d]}
                  </button>
                );
              })}
            </div>
            {errors.days && (
              <p role="alert" className="mt-1 text-sm font-medium text-red-700 dark:text-red-400">
                {errors.days}
              </p>
            )}
          </fieldset>
        )}
        <TextArea label="Notes" value={v.notes} onChange={(e) => set('notes', e.target.value)} />
      </form>
    </Modal>
  );
}
