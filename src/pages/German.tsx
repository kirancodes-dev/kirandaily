import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { useAppData } from '../hooks/useAppData';
import { useToday } from '../hooks/useToday';
import { useGermanTotals } from '../hooks/useProgress';
import { useCategoryTotal, useRoadmap } from '../hooks/useRoadmap';
import { RoadmapView } from '../components/roadmap/RoadmapView';
import { GERMAN_STATUS_LABELS } from '../utils/labels';
import { PageHeader } from '../components/common/Feedback';
import { Card, StatTile } from '../components/common/Card';
import { Button, IconButton } from '../components/common/Button';
import { ProgressBar } from '../components/common/Progress';
import { Modal } from '../components/common/Modal';
import { TextField } from '../components/common/Fields';
import { formatMinutes, formatShortDate, isValidISODate } from '../utils/date';
import { roadmapProgress } from '../utils/calculations';
import { uid } from '../utils/id';

export default function German() {
  const today = useToday();
  const { data, update } = useAppData();
  const totals = useGermanTotals();
  const { roadmap, progress } = useRoadmap('german');
  const minutes = useCategoryTotal('german', today);
  const [adding, setAdding] = useState(false);
  const logs = [...data.germanLogs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

  return (
    <div className="space-y-4">
      <PageHeader
        title="German"
        subtitle="A1 → A2 → B1. A little every day beats a lot once a week."
        actions={
          <Button variant="primary" icon={<Plus size={18} aria-hidden />} onClick={() => setAdding(true)}>
            Log words / lessons
          </Button>
        }
      />
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Minutes studied" value={Math.round(minutes)} hint={formatMinutes(minutes)} />
        <StatTile label="Vocabulary" value={totals.words} hint="words learned" />
        <StatTile label="Lessons" value={totals.lessons} hint="completed" />
      </div>
      <Card title="Levels">
        <div className="space-y-3">
          {roadmap.sections.map((s) => {
            const p = roadmapProgress({ ...roadmap, sections: [s] });
            return <ProgressBar key={s.id} value={p.pct} label={`${s.title} · ${p.completed}/${p.total} topics`} />;
          })}
          <p className="text-sm text-slate-600 dark:text-slate-400">Overall: {progress.pct}% · no exam taken yet — aim for the A1 exam once A1 is complete.</p>
        </div>
      </Card>
      <RoadmapView id="german" labels={GERMAN_STATUS_LABELS} />

      <Card title="Recent vocabulary & lessons">
        {logs.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-1">
                <span className="flex-1">
                  {formatShortDate(l.date)}: {l.words} word{l.words === 1 ? '' : 's'}, {l.lessons} lesson{l.lessons === 1 ? '' : 's'}
                </span>
                <IconButton label={`Delete entry from ${formatShortDate(l.date)}`} onClick={() => update((d) => ({ ...d, germanLogs: d.germanLogs.filter((x) => x.id !== l.id) }))}>
                  <Trash2 size={18} aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Minutes come from finished German tasks and study sessions. Edit topics in{' '}
        <Link to="/settings" className="font-medium underline">Settings → Roadmaps</Link>.
      </p>
      {adding && (
        <GermanLogDialog
          today={today}
          onClose={() => setAdding(false)}
          onSave={(date, words, lessons) => {
            update((d) => ({ ...d, germanLogs: [...d.germanLogs, { id: uid('de'), date, words, lessons }] }));
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

function GermanLogDialog({ today, onClose, onSave }: { today: string; onClose: () => void; onSave: (date: string, words: number, lessons: number) => void }) {
  const [date, setDate] = useState(today);
  const [words, setWords] = useState('10');
  const [lessons, setLessons] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const w = Number(words);
    const l = Number(lessons);
    if (!Number.isInteger(w) || !Number.isInteger(l) || w < 0 || l < 0) return setError('Use whole numbers (0 or more).');
    if (w === 0 && l === 0) return setError('Enter at least one word or lesson.');
    if (!isValidISODate(date)) return setError('Pick a valid date.');
    onSave(date, w, l);
  };
  return (
    <Modal
      open
      title="Log German progress"
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
        <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="New words" type="number" inputMode="numeric" min={0} value={words} onChange={(e) => setWords(e.target.value)} />
          <TextField label="Lessons completed" type="number" inputMode="numeric" min={0} value={lessons} onChange={(e) => setLessons(e.target.value)} />
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
