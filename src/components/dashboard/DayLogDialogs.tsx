import { useState } from 'react';
import type { DayLog } from '../../types/task';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { SelectField, TextField } from '../common/Fields';

type Special = NonNullable<DayLog['special']>;

export function SleepDialog({ initial, onSave, onClose }: { initial?: number; onSave: (h: number | undefined) => void; onClose: () => void }) {
  const [value, setValue] = useState(initial !== undefined ? String(initial) : '');
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    if (value.trim() === '') return onSave(undefined);
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 24) return setError('Enter hours between 0 and 24.');
    onSave(Math.round(n * 10) / 10);
  };
  return (
    <Modal
      open
      title="Log sleep"
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
      <TextField
        label="Hours slept last night"
        type="number"
        inputMode="decimal"
        step="0.5"
        min={0}
        max={24}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        error={error}
        hint="Leave empty to clear."
      />
    </Modal>
  );
}

export function SpecialDayDialog({
  initial,
  onSave,
  onClose,
}: {
  initial?: Special;
  onSave: (s: Special | undefined) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<Special['kind']>(initial?.kind ?? 'birthday');
  const [note, setNote] = useState(initial?.note ?? '');
  return (
    <Modal
      open
      title="Special day"
      onClose={onClose}
      footer={
        <>
          {initial && (
            <Button variant="ghost" onClick={() => onSave(undefined)}>
              Remove
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onSave({ kind, note: note.trim() })}>
            Save
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
        Birthday, party or outing? Mark the day so streaks are not affected. Your plan stays as it is — move or skip
        tasks you can’t do.
      </p>
      <div className="space-y-3">
        <SelectField
          label="Type"
          value={kind}
          onChange={(e) => setKind(e.target.value as Special['kind'])}
          options={[
            { value: 'birthday', label: 'Birthday' },
            { value: 'party', label: 'Party' },
            { value: 'outing', label: 'Outing' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <TextField label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Rahul’s birthday, 7 PM" />
      </div>
    </Modal>
  );
}
