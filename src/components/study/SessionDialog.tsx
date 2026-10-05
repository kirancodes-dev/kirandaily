import { useMemo, useState } from 'react';
import type { StudySession } from '../../types/study';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { SelectField, TextField } from '../common/Fields';
import { useAppData } from '../../hooks/useAppData';
import { useCategories } from '../../hooks/useCategories';
import { useNow } from '../../hooks/useNow';
import { getDayTasks } from '../../utils/calculations';
import { formatTime12, isValidISODate } from '../../utils/date';
import { canMarkDone } from '../../utils/timeGate';

interface Props {
  title: string;
  initialMinutes: number;
  date: string;
  /** Manual entries can change the date. */
  manual?: boolean;
  startedAt?: string;
  source: StudySession['source'];
  onSave: (session: Omit<StudySession, 'id'>, completeTaskId?: string) => void;
  onClose: () => void;
}

/** Asks category, topic (and optional subject / planned task), then saves the duration. */
export function SessionDialog({ title, initialMinutes, date: initialDate, manual, startedAt, source, onSave, onClose }: Props) {
  const { data, stats } = useAppData();
  const { studyCategories } = useCategories();
  const [date, setDate] = useState(initialDate);
  const [category, setCategory] = useState(studyCategories[0]?.id ?? 'other');
  const [topic, setTopic] = useState('');
  const [minutes, setMinutes] = useState(String(initialMinutes));
  const [subjectId, setSubjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const now = useNow();
  const gateOn = data.prefs.timeGate;
  // Only tasks that have started can be completed (time-lock).
  const openTasks = useMemo(
    () =>
      isValidISODate(date)
        ? getDayTasks(stats, date).filter((t) => t.category === category && !t.completed && !t.skipped && canMarkDone(t, now, gateOn))
        : [],
    [stats, date, category, now, gateOn],
  );

  const save = () => {
    const m = Number(minutes);
    if (!Number.isFinite(m) || m < 1 || m > 1440) return setError('Minutes must be between 1 and 1440.');
    if (!isValidISODate(date)) return setError('Pick a valid date.');
    const task = openTasks.find((t) => t.id === taskId);
    onSave(
      {
        date,
        category,
        topic: topic.trim(),
        minutes: Math.round(m),
        startedAt: startedAt ?? new Date().toISOString(),
        source,
        subjectId: category === 'college' ? subjectId || task?.subjectId || undefined : undefined,
      },
      task?.id,
    );
  };

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{manual ? 'Cancel' : 'Don’t save'}</Button>
          <Button variant="primary" onClick={save}>
            Save session
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Minutes" type="number" inputMode="numeric" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!manual} />
        </div>
        <SelectField
          label="Category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setTaskId('');
          }}
          options={studyCategories.map((c) => ({ value: c.id, label: c.label }))}
        />
        <TextField label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Loops, Arrays, A1 numbers" />
        {category === 'college' && (
          <SelectField
            label="Subject"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            options={[{ value: '', label: 'Choose subject (optional)' }, ...data.subjects.map((s) => ({ value: s.id, label: s.name }))]}
          />
        )}
        {openTasks.length > 0 && (
          <SelectField
            label="Also complete a planned task?"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            hint="Its planned time is replaced by this session so nothing is counted twice."
            options={[
              { value: '', label: 'No' },
              ...openTasks.map((t) => ({ value: t.id, label: `${formatTime12(t.startTime)} ${t.title}` })),
            ]}
          />
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
