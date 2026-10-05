import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { useAppData } from '../hooks/useAppData';
import { useToday } from '../hooks/useToday';
import { useSubjects } from '../hooks/useSubjects';
import { collegeProgress, subjectProgress, subjectStudyMinutes } from '../utils/calculations';
import { eachDate, formatMinutes } from '../utils/date';
import { PageHeader } from '../components/common/Feedback';
import { Card } from '../components/common/Card';
import { IconButton, Button } from '../components/common/Button';
import { ProgressBar } from '../components/common/Progress';
import { StatusSelect } from '../components/common/Chips';
import { InlineAdd } from '../components/common/InlineAdd';
import { TextArea, TextField } from '../components/common/Fields';
import { ConfirmDialog, Modal } from '../components/common/Modal';
import type { Subject } from '../types/subject';

export default function Subjects() {
  const today = useToday();
  const { stats, data } = useAppData();
  const s = useSubjects();
  const [open, setOpen] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Subject | null>(null);
  const [removing, setRemoving] = useState<Subject | null>(null);

  const minutes = useMemo(() => {
    const dates = eachDate(data.settings.planStartDate, today);
    return new Map(s.subjects.map((sub) => [sub.id, subjectStudyMinutes(stats, sub.id, dates)]));
  }, [stats, s.subjects, data.settings.planStartDate, today]);

  return (
    <div className="space-y-4">
      <PageHeader title="College" subtitle="Your subjects — keep the CGPA at 8+ and aim for 8.5." />
      <ProgressBar value={collegeProgress(s.subjects)} label="All subjects" />

      <ul className="space-y-3">
        {s.subjects.map((sub) => {
          const expanded = open === sub.id;
          const pct = subjectProgress(sub);
          return (
            <li key={sub.id}>
              <Card as="article">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : sub.id)}
                    className="flex min-h-touch min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {expanded ? <ChevronDown size={20} aria-hidden /> : <ChevronRight size={20} aria-hidden />}
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-semibold">{sub.name}</span>
                      <span className="block text-sm text-slate-600 dark:text-slate-400">
                        {pct}% · {formatMinutes(minutes.get(sub.id) ?? 0)} studied · {sub.topics.filter((t) => t.done).length}/{sub.topics.length} topics
                      </span>
                    </span>
                  </button>
                  <IconButton label={`Rename ${sub.name}`} onClick={() => setRenaming(sub)}>
                    <Pencil size={18} aria-hidden />
                  </IconButton>
                </div>
                <div className="mt-2">
                  <ProgressBar value={pct} label={`${sub.name} progress`} showValue={false} size="sm" />
                </div>
                {expanded && (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      {(
                        [
                          ['assignmentStatus', 'Assignments'],
                          ['revisionStatus', 'Revision'],
                          ['examPrepStatus', 'Exam preparation'],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key}>
                          <p className="mb-1 text-sm font-medium">{label}</p>
                          <StatusSelect value={sub[key]} onChange={(v) => s.patch(sub.id, { [key]: v })} label={`${label} status for ${sub.name}`} />
                        </div>
                      ))}
                    </div>
                    <div>
                      <h3 className="mb-1 font-medium">Topics</h3>
                      <ul className="mb-2">
                        {sub.topics.map((t) => (
                          <li key={t.id} className="flex items-center gap-2">
                            <label className="flex min-h-touch flex-1 items-center gap-3">
                              <input type="checkbox" className="h-5 w-5" checked={t.done} onChange={() => s.toggleTopic(sub.id, t.id)} />
                              <span className={t.done ? 'text-slate-500 line-through' : ''}>{t.title}</span>
                            </label>
                            <IconButton label={`Remove topic ${t.title}`} onClick={() => s.removeTopic(sub.id, t.id)}>
                              <Trash2 size={16} aria-hidden />
                            </IconButton>
                          </li>
                        ))}
                      </ul>
                      <InlineAdd label={`Add topic to ${sub.name}`} placeholder="e.g. Unit 1 – Introduction" onAdd={(v) => s.addTopic(sub.id, v)} />
                    </div>
                    <TextArea label="Notes" value={sub.notes} onChange={(e) => s.patch(sub.id, { notes: e.target.value })} />
                    <Button variant="ghost" className="text-red-700 dark:text-red-400" icon={<Trash2 size={18} aria-hidden />} onClick={() => setRemoving(sub)}>
                      Remove subject
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
      <Card title="Add a subject">
        <InlineAdd label="Add subject" placeholder="Subject name" onAdd={s.addSubject} />
      </Card>

      {renaming && <RenameDialog subject={renaming} onClose={() => setRenaming(null)} onSave={(n) => (s.rename(renaming.id, n), setRenaming(null))} />}
      <ConfirmDialog
        open={!!removing}
        danger
        title="Remove subject?"
        message={`“${removing?.name}” with its topics and notes will be removed. Study time already logged stays.`}
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) s.removeSubject(removing.id);
          setRemoving(null);
        }}
      />
    </div>
  );
}

function RenameDialog({ subject, onClose, onSave }: { subject: Subject; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(subject.name);
  return (
    <Modal
      open
      title="Rename subject"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={() => onSave(name)}>
            Save
          </Button>
        </>
      }
    >
      <TextField label="Subject name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
    </Modal>
  );
}
