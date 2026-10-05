import { useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import type { RoadmapId } from '../../types/roadmap';
import { useRoadmap } from '../../hooks/useRoadmap';
import { Card } from '../common/Card';
import { IconButton } from '../common/Button';
import { Tabs } from '../common/Tabs';
import { InlineAdd } from '../common/InlineAdd';
import { ConfirmDialog } from '../common/Modal';
import { inputClass } from '../common/styles';

export function RoadmapSettings() {
  const [id, setId] = useState<RoadmapId>('java');
  return (
    <Card title="Roadmaps">
      <Tabs
        label="Roadmap to edit"
        value={id}
        onChange={setId}
        tabs={[
          { id: 'java', label: 'Java' },
          { id: 'dsa', label: 'DSA' },
          { id: 'german', label: 'German' },
        ]}
      />
      <div className="mt-3">
        <RoadmapEditor key={id} id={id} />
      </div>
    </Card>
  );
}

function RoadmapEditor({ id }: { id: RoadmapId }) {
  const { roadmap, edit } = useRoadmap(id);
  const [removing, setRemoving] = useState<{ id: string; title: string } | null>(null);
  return (
    <div className="space-y-4">
      {roadmap.sections.map((s, i) => (
        <section key={s.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700" aria-label={s.title}>
          <div className="flex items-center gap-1">
            <input
              aria-label="Section name"
              className={`${inputClass} mt-0 font-semibold`}
              defaultValue={s.title}
              onBlur={(e) => (e.target.value.trim() ? edit.renameSection(s.id, e.target.value.trim()) : (e.target.value = s.title))}
            />
            <IconButton label={`Move ${s.title} up`} disabled={i === 0} onClick={() => edit.moveSection(s.id, -1)}>
              <ArrowUp size={18} aria-hidden />
            </IconButton>
            <IconButton label={`Move ${s.title} down`} disabled={i === roadmap.sections.length - 1} onClick={() => edit.moveSection(s.id, 1)}>
              <ArrowDown size={18} aria-hidden />
            </IconButton>
            <IconButton label={`Delete section ${s.title}`} onClick={() => setRemoving({ id: s.id, title: s.title })}>
              <Trash2 size={18} aria-hidden />
            </IconButton>
          </div>
          <ul className="mt-2 space-y-1 pl-2">
            {s.topics.map((t) => (
              <li key={t.id} className="flex items-center gap-1">
                <input
                  aria-label={`Topic name (${s.title})`}
                  className={`${inputClass} mt-0`}
                  defaultValue={t.title}
                  onBlur={(e) => (e.target.value.trim() ? edit.renameTopic(t.id, e.target.value.trim()) : (e.target.value = t.title))}
                />
                <IconButton label={`Delete topic ${t.title}`} onClick={() => edit.removeTopic(t.id)}>
                  <Trash2 size={16} aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
          <div className="mt-2 pl-2">
            <InlineAdd label={`Add topic to ${s.title}`} placeholder="New topic" onAdd={(v) => edit.addTopic(s.id, v)} />
          </div>
        </section>
      ))}
      <InlineAdd label="Add section" placeholder="New section / phase / level" onAdd={edit.addSection} />
      <ConfirmDialog
        open={!!removing}
        danger
        title="Delete section?"
        message={`“${removing?.title}” and all its topics (with status and notes) will be deleted.`}
        confirmLabel="Delete"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) edit.removeSection(removing.id);
          setRemoving(null);
        }}
      />
    </div>
  );
}
