import { useState } from 'react';
import { Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { useCollection } from '../hooks/useCollection';
import type { Goal, GoalStatus, GoalTerm } from '../types/goal';
import { PageHeader, EmptyState } from '../components/common/Feedback';
import { Card } from '../components/common/Card';
import { Button, IconButton } from '../components/common/Button';
import { ProgressBar } from '../components/common/Progress';
import { ConfirmDialog, Modal } from '../components/common/Modal';
import { SelectField, TextArea, TextField } from '../components/common/Fields';
import { formatLongDate, isValidISODate } from '../utils/date';

const STATUS: Record<GoalStatus, string> = { not_started: 'Not started', in_progress: 'In progress', completed: 'Completed', paused: 'Paused' };

export default function Goals() {
  const { items, add, save, remove } = useCollection('goals');
  const [editing, setEditing] = useState<Goal | { term: GoalTerm } | null>(null);
  const [removing, setRemoving] = useState<Goal | null>(null);

  const section = (term: GoalTerm, title: string) => {
    const goals = items.filter((g) => g.term === term);
    return (
      <section aria-labelledby={`goals-${term}`} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id={`goals-${term}`} className="text-xl font-semibold">
            {title}
          </h2>
          <Button icon={<Plus size={18} aria-hidden />} onClick={() => setEditing({ term })}>
            Add
          </Button>
        </div>
        {goals.length === 0 ? (
          <EmptyState icon={<Target size={28} aria-hidden />} title="No goals here yet" />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {goals.map((g) => (
              <li key={g.id}>
                <Card as="article">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold">{g.title}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {STATUS[g.status]}
                        {g.deadline && ` · by ${formatLongDate(g.deadline)}`}
                      </p>
                    </div>
                    <IconButton label={`Edit ${g.title}`} onClick={() => setEditing(g)}>
                      <Pencil size={18} aria-hidden />
                    </IconButton>
                    <IconButton label={`Delete ${g.title}`} onClick={() => setRemoving(g)}>
                      <Trash2 size={18} aria-hidden />
                    </IconButton>
                  </div>
                  {g.description && <p className="mt-2 text-slate-700 dark:text-slate-300">{g.description}</p>}
                  <div className="mt-3">
                    <ProgressBar value={g.progress} label="Progress" tone={g.status === 'completed' ? 'green' : 'brand'} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Goals" subtitle="Short-term steps towards the long-term plan: Germany M.Sc., internships, ₹50L+." />
      {section('short', 'Short-term')}
      {section('long', 'Long-term')}
      {editing && (
        <GoalForm
          goal={'id' in editing ? editing : null}
          term={editing.term}
          onClose={() => setEditing(null)}
          onSave={(g) => {
            if ('id' in editing) save({ ...g, id: editing.id });
            else add(g);
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        danger
        title="Delete goal?"
        message={`“${removing?.title}” will be deleted.`}
        confirmLabel="Delete"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) remove(removing.id);
          setRemoving(null);
        }}
      />
    </div>
  );
}

function GoalForm({ goal, term, onClose, onSave }: { goal: Goal | null; term: GoalTerm; onClose: () => void; onSave: (g: Omit<Goal, 'id'>) => void }) {
  const [v, setV] = useState<Omit<Goal, 'id'>>(goal ?? { term, title: '', description: '', deadline: '', progress: 0, status: 'not_started' });
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  const submit = () => {
    if (!v.title.trim()) return setError('Give the goal a title.');
    if (v.deadline && !isValidISODate(v.deadline)) return setError('Deadline is not a valid date.');
    onSave({ ...v, title: v.title.trim(), status: v.progress >= 100 ? 'completed' : v.status });
  };
  return (
    <Modal
      open
      title={goal ? 'Edit goal' : 'New goal'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <TextField label="Title" value={v.title} onChange={(e) => set('title', e.target.value)} />
        <TextArea label="Description" value={v.description} onChange={(e) => set('description', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Term"
            value={v.term}
            onChange={(e) => set('term', e.target.value as GoalTerm)}
            options={[
              { value: 'short', label: 'Short-term' },
              { value: 'long', label: 'Long-term' },
            ]}
          />
          <SelectField label="Status" value={v.status} onChange={(e) => set('status', e.target.value as GoalStatus)} options={Object.entries(STATUS).map(([value, label]) => ({ value, label }))} />
        </div>
        <TextField label="Deadline (optional)" type="date" value={v.deadline} onChange={(e) => set('deadline', e.target.value)} />
        <TextField label={`Progress: ${v.progress}%`} type="range" min={0} max={100} step={5} value={v.progress} onChange={(e) => set('progress', Number(e.target.value))} />
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
