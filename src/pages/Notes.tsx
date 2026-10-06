import { useMemo, useState } from 'react';
import { NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCollection } from '../hooks/useCollection';
import { useToday } from '../hooks/useToday';
import type { Note, NoteCategory } from '../types/note';
import { PageHeader, EmptyState } from '../components/common/Feedback';
import { Card } from '../components/common/Card';
import { Button, IconButton } from '../components/common/Button';
import { ConfirmDialog, Modal } from '../components/common/Modal';
import { SelectField, TextArea, TextField } from '../components/common/Fields';
import { formatLongDate, isValidISODate } from '../utils/date';
import { NOTE_CATEGORIES } from '../utils/labels';


export default function Notes() {
  const today = useToday();
  const { items, add, save, remove } = useCollection('notes');
  const [editing, setEditing] = useState<Note | 'new' | null>(null);
  const [removing, setRemoving] = useState<Note | null>(null);
  const [filter, setFilter] = useState<NoteCategory | 'all'>('all');
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((n) => (filter === 'all' || n.category === filter) && (!q || `${n.title} ${n.content}`.toLowerCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
  }, [items, filter, query]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notes"
        actions={
          <Button variant="primary" icon={<Plus size={18} aria-hidden />} onClick={() => setEditing('new')}>
            New note
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Category"
          value={filter}
          onChange={(e) => setFilter(e.target.value as NoteCategory | 'all')}
          options={[{ value: 'all', label: 'All categories' }, ...Object.entries(NOTE_CATEGORIES).map(([value, label]) => ({ value, label }))]}
        />
        <TextField label="Filter notes" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type to filter…" />
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={<NotebookPen size={32} aria-hidden />} title={items.length ? 'No matching notes' : 'No notes yet'} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((n) => (
            <li key={n.id}>
              <Card as="article">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold [overflow-wrap:anywhere]">{n.title || 'Untitled'}</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {NOTE_CATEGORIES[n.category]} · {formatLongDate(n.date)}
                    </p>
                  </div>
                  <IconButton label={`Edit note ${n.title}`} onClick={() => setEditing(n)}>
                    <Pencil size={18} aria-hidden />
                  </IconButton>
                  <IconButton label={`Delete note ${n.title}`} onClick={() => setRemoving(n)}>
                    <Trash2 size={18} aria-hidden />
                  </IconButton>
                </div>
                {n.content && <p className="mt-2 line-clamp-6 whitespace-pre-wrap [overflow-wrap:anywhere]">{n.content}</p>}
              </Card>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <NoteForm
          note={editing === 'new' ? null : editing}
          today={today}
          onClose={() => setEditing(null)}
          onSave={(n) => {
            if (editing === 'new') add(n);
            else save({ ...n, id: editing.id });
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        danger
        title="Delete note?"
        message={`“${removing?.title || 'Untitled'}” will be deleted.`}
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

function NoteForm({ note, today, onClose, onSave }: { note: Note | null; today: string; onClose: () => void; onSave: (n: Omit<Note, 'id'>) => void }) {
  const [v, setV] = useState({ title: note?.title ?? '', content: note?.content ?? '', category: note?.category ?? ('personal' as NoteCategory), date: note?.date ?? today });
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    if (!v.title.trim() && !v.content.trim()) return setError('Write a title or some content.');
    if (!isValidISODate(v.date)) return setError('Pick a valid date.');
    onSave({ ...v, title: v.title.trim(), updatedAt: new Date().toISOString() });
  };
  return (
    <Modal
      open
      title={note ? 'Edit note' : 'New note'}
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
        <TextField label="Title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Category"
            value={v.category}
            onChange={(e) => setV({ ...v, category: e.target.value as NoteCategory })}
            options={Object.entries(NOTE_CATEGORIES).map(([value, label]) => ({ value, label }))}
          />
          <TextField label="Date" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
        </div>
        <TextArea label="Content" rows={8} value={v.content} onChange={(e) => setV({ ...v, content: e.target.value })} />
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
