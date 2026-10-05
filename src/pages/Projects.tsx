import { useState } from 'react';
import { ExternalLink, FolderGit2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCollection } from '../hooks/useCollection';
import { useToday } from '../hooks/useToday';
import type { Project, ProjectStatus } from '../types/project';
import { PageHeader, EmptyState } from '../components/common/Feedback';
import { Card } from '../components/common/Card';
import { Button, IconButton } from '../components/common/Button';
import { ProgressBar } from '../components/common/Progress';
import { ConfirmDialog, Modal } from '../components/common/Modal';
import { SelectField, TextArea, TextField } from '../components/common/Fields';
import { formatShortDate, isValidISODate } from '../utils/date';
import { PROJECT_STATUS } from '../utils/labels';


export default function Projects() {
  const today = useToday();
  const { items, add, save, remove } = useCollection('projects');
  const [editing, setEditing] = useState<Project | 'new' | null>(null);
  const [removing, setRemoving] = useState<Project | null>(null);
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all');
  const shown = items.filter((p) => filter === 'all' || p.status === filter);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Projects"
        subtitle="Java and backend projects for your portfolio and internships."
        actions={
          <Button variant="primary" icon={<Plus size={18} aria-hidden />} onClick={() => setEditing('new')}>
            New project
          </Button>
        }
      />
      {items.length > 0 && (
        <SelectField
          label="Show"
          className="max-w-xs"
          value={filter}
          onChange={(e) => setFilter(e.target.value as ProjectStatus | 'all')}
          options={[{ value: 'all', label: 'All projects' }, ...Object.entries(PROJECT_STATUS).map(([value, label]) => ({ value, label }))]}
        />
      )}
      {shown.length === 0 ? (
        <EmptyState icon={<FolderGit2 size={32} aria-hidden />} title={items.length ? 'No projects with this status' : 'No projects yet'}>
          {items.length ? null : 'Add your first idea — even a small Java console app counts.'}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((p) => (
            <li key={p.id}>
              <Card as="article">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold">{p.name}</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {PROJECT_STATUS[p.status]}
                      {p.technology && ` · ${p.technology}`}
                    </p>
                  </div>
                  <IconButton label={`Edit ${p.name}`} onClick={() => setEditing(p)}>
                    <Pencil size={18} aria-hidden />
                  </IconButton>
                  <IconButton label={`Delete ${p.name}`} onClick={() => setRemoving(p)}>
                    <Trash2 size={18} aria-hidden />
                  </IconButton>
                </div>
                {p.description && <p className="mt-2">{p.description}</p>}
                <div className="mt-3">
                  <ProgressBar value={p.progress} label="Progress" />
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {p.startDate && `Started ${formatShortDate(p.startDate)}`}
                  {p.startDate && p.targetDate && ' · '}
                  {p.targetDate && `Target ${formatShortDate(p.targetDate)}`}
                  {p.targetDate && p.targetDate < today && p.status !== 'completed' && ' (past target)'}
                </p>
                {p.githubUrl && (
                  <a href={p.githubUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex min-h-touch items-center gap-1 font-medium text-brand-700 underline dark:text-brand-300">
                    <ExternalLink size={16} aria-hidden /> Repository
                  </a>
                )}
                {p.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">{p.notes}</p>}
              </Card>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <ProjectForm
          project={editing === 'new' ? null : editing}
          today={today}
          onClose={() => setEditing(null)}
          onSave={(p) => {
            if (editing === 'new') add(p);
            else save({ ...p, id: editing.id });
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        danger
        title="Delete project?"
        message={`“${removing?.name}” will be deleted.`}
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

function ProjectForm({ project, today, onClose, onSave }: { project: Project | null; today: string; onClose: () => void; onSave: (p: Omit<Project, 'id'>) => void }) {
  const [v, setV] = useState<Omit<Project, 'id'>>(
    project ?? { name: '', description: '', technology: 'Java', status: 'idea', startDate: today, targetDate: '', progress: 0, githubUrl: '', notes: '' },
  );
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  const submit = () => {
    if (!v.name.trim()) return setError('Give the project a name.');
    if (v.startDate && !isValidISODate(v.startDate)) return setError('Start date is not valid.');
    if (v.targetDate && !isValidISODate(v.targetDate)) return setError('Target date is not valid.');
    if (v.githubUrl && !/^https?:\/\//i.test(v.githubUrl)) return setError('GitHub URL should start with https://');
    onSave({ ...v, name: v.name.trim(), progress: Math.max(0, Math.min(100, Math.round(v.progress))) });
  };
  return (
    <Modal
      open
      title={project ? 'Edit project' : 'New project'}
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
        <TextField label="Name" value={v.name} onChange={(e) => set('name', e.target.value)} />
        <TextArea label="Description" value={v.description} onChange={(e) => set('description', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Technology" value={v.technology} onChange={(e) => set('technology', e.target.value)} />
          <SelectField
            label="Status"
            value={v.status}
            onChange={(e) => set('status', e.target.value as ProjectStatus)}
            options={Object.entries(PROJECT_STATUS).map(([value, label]) => ({ value, label }))}
          />
          <TextField label="Start date" type="date" value={v.startDate} onChange={(e) => set('startDate', e.target.value)} />
          <TextField label="Target date" type="date" value={v.targetDate} onChange={(e) => set('targetDate', e.target.value)} />
        </div>
        <TextField label={`Progress: ${v.progress}%`} type="range" min={0} max={100} step={5} value={v.progress} onChange={(e) => set('progress', Number(e.target.value))} />
        <TextField label="GitHub URL" type="url" inputMode="url" placeholder="https://github.com/…" value={v.githubUrl} onChange={(e) => set('githubUrl', e.target.value.trim())} />
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
