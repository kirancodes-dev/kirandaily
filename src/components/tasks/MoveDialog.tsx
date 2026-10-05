import { useState } from 'react';
import type { Task } from '../../types/task';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { TextField } from '../common/Fields';
import { addDays, durationMinutes, formatTime12, isValidISODate, isValidTime, minutesToTime, timeToMinutes } from '../../utils/date';

/** Move / reschedule one task to another date or time (keeps its length). */
export function MoveDialog({ task, onClose, onMove }: { task: Task; onClose: () => void; onMove: (date: string, start: string, end: string) => void }) {
  const [date, setDate] = useState(task.date);
  const [start, setStart] = useState(task.startTime);
  const [error, setError] = useState<string | null>(null);
  const length = durationMinutes(task.startTime, task.endTime) || 60;
  const end = isValidTime(start) ? minutesToTime(timeToMinutes(start) + length) : task.endTime;

  const submit = (d = date, s = start) => {
    if (!isValidISODate(d)) return setError('Pick a valid date.');
    if (!isValidTime(s)) return setError('Enter a valid start time.');
    onMove(d, s, minutesToTime(timeToMinutes(s) + length));
  };

  return (
    <Modal
      open
      title={`Move “${task.title}”`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => submit()}>
            Move
          </Button>
        </>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Button onClick={() => submit(addDays(task.date, 1), task.startTime)}>Tomorrow, same time</Button>
        <Button onClick={() => submit(task.date, minutesToTime(timeToMinutes(task.startTime) + 60))}>1 hour later</Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <TextField label="Start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Ends at {formatTime12(end)} (same length). Other days are not changed.</p>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </Modal>
  );
}
