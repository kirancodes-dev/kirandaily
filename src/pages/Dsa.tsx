import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus } from 'lucide-react';
import { useAppData } from '../hooks/useAppData';
import { useToday } from '../hooks/useToday';
import { useDsaStats } from '../hooks/useProgress';
import { useCategoryTotal, useRoadmap } from '../hooks/useRoadmap';
import { RoadmapView } from '../components/roadmap/RoadmapView';
import { PageHeader } from '../components/common/Feedback';
import { StatTile } from '../components/common/Card';
import { Button, IconButton } from '../components/common/Button';
import { ProgressBar } from '../components/common/Progress';
import { Modal } from '../components/common/Modal';
import { SelectField, TextField } from '../components/common/Fields';
import { formatMinutes, isValidISODate } from '../utils/date';
import { uid } from '../utils/id';

export default function Dsa() {
  const today = useToday();
  const { data, update } = useAppData();
  const stats = useDsaStats(today);
  const { progress, roadmap } = useRoadmap('dsa');
  const minutes = useCategoryTotal('dsa', today);
  const [logging, setLogging] = useState(false);

  const log = (topicId: string, count: number, date = today) =>
    update((d) => ({ ...d, problemLogs: [...d.problemLogs, { id: uid('prob'), date, topicId, count }] }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="DSA"
        subtitle="Start from zero: arrays and strings first, one pattern at a time."
        actions={
          <Button variant="primary" icon={<Plus size={18} aria-hidden />} onClick={() => setLogging(true)}>
            Log problems
          </Button>
        }
      />
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Solved today" value={stats.today} />
        <StatTile label="This week" value={stats.week} />
        <StatTile label="Total solved" value={stats.total} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Topics completed" value={`${progress.completed}/${progress.total}`} />
        <StatTile label="Time studied" value={formatMinutes(minutes)} />
      </div>
      <ProgressBar value={progress.pct} label="DSA roadmap" />
      <RoadmapView
        id="dsa"
        renderExtra={(topic) => {
          const count = stats.byTopic.get(topic.id) ?? 0;
          return (
            <div className="flex items-center rounded-xl ring-1 ring-inset ring-slate-300 dark:ring-slate-600" role="group" aria-label={`Problems solved for ${topic.title}`}>
              <IconButton label={`One less ${topic.title} problem`} disabled={count <= 0} onClick={() => log(topic.id, -1)}>
                <Minus size={16} aria-hidden />
              </IconButton>
              <span className="min-w-[2.5rem] text-center text-sm font-semibold tabular-nums" aria-live="polite">
                {count}
                <span className="sr-only"> problems</span>
              </span>
              <IconButton label={`One more ${topic.title} problem`} onClick={() => log(topic.id, 1)}>
                <Plus size={16} aria-hidden />
              </IconButton>
            </div>
          );
        }}
      />
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Edit topics in <Link to="/settings" className="font-medium underline">Settings → Roadmaps</Link>. A topic’s number is the problems you solved for it.
      </p>
      {logging && (
        <LogProblemsDialog
          topics={roadmap.sections.flatMap((s) => s.topics.map((t) => ({ value: t.id, label: `${s.title}: ${t.title}` })))}
          today={today}
          onClose={() => setLogging(false)}
          onSave={(topicId, count, date) => {
            log(topicId, count, date);
            setLogging(false);
          }}
        />
      )}
      {data.problemLogs.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-400">No problems logged yet — your first one starts the count.</p>}
    </div>
  );
}

function LogProblemsDialog({
  topics,
  today,
  onClose,
  onSave,
}: {
  topics: { value: string; label: string }[];
  today: string;
  onClose: () => void;
  onSave: (topicId: string, count: number, date: string) => void;
}) {
  const [topicId, setTopicId] = useState(topics[0]?.value ?? '');
  const [count, setCount] = useState('1');
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 500) return setError('Enter a whole number between 1 and 500.');
    if (!isValidISODate(date)) return setError('Pick a valid date.');
    if (!topicId) return setError('Choose a topic.');
    onSave(topicId, n, date);
  };
  return (
    <Modal
      open
      title="Log solved problems"
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
        <SelectField label="Topic" value={topicId} onChange={(e) => setTopicId(e.target.value)} options={topics} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Problems solved" type="number" inputMode="numeric" min={1} value={count} onChange={(e) => setCount(e.target.value)} />
          <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
