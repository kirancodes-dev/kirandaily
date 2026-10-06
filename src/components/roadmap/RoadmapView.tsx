import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RoadmapId, RoadmapTopic } from '../../types/roadmap';
import type { WorkStatus } from '../../types/subject';
import { useRoadmap } from '../../hooks/useRoadmap';
import { Card } from '../common/Card';
import { ProgressBar } from '../common/Progress';
import { StatusSelect } from '../common/Chips';
import { STATUS_LABELS } from '../../utils/labels';
import { roadmapProgress } from '../../utils/calculations';
import { inputClass } from '../common/styles';

interface Props {
  id: RoadmapId;
  labels?: Record<WorkStatus, string>;
  /** Extra controls per topic (e.g. DSA problem counter). */
  renderExtra?: (topic: RoadmapTopic) => ReactNode;
}

export function RoadmapView({ id, labels = STATUS_LABELS, renderExtra }: Props) {
  const { roadmap, setStatus, setNotes } = useRoadmap(id);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {roadmap.sections.map((section) => {
        const p = roadmapProgress({ ...roadmap, sections: [section] });
        return (
          <Card key={section.id} title={section.title}>
            <div className="mb-3">
              <ProgressBar value={p.pct} label={`${p.completed} of ${p.total} completed`} />
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {section.topics.map((topic) => {
                const expanded = open === topic.id;
                return (
                  <li key={topic.id} className="py-2">
                    {/* The title keeps a readable width: on phones the controls move to their own line below it. */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={`notes-${topic.id}`}
                        onClick={() => setOpen(expanded ? null : topic.id)}
                        className="flex min-h-touch min-w-[9rem] flex-1 items-center gap-1 text-left font-medium"
                      >
                        {expanded ? <ChevronDown size={18} aria-hidden className="shrink-0" /> : <ChevronRight size={18} aria-hidden className="shrink-0" />}
                        <span className={`min-w-0 [overflow-wrap:anywhere] ${topic.status === 'completed' ? 'text-slate-500 line-through dark:text-slate-400' : ''}`}>
                          {topic.title}
                        </span>
                        {topic.notes && <span className="ml-1 shrink-0 text-xs text-slate-500">· notes</span>}
                      </button>
                      <div className="ml-auto flex items-center gap-2">
                        {renderExtra?.(topic)}
                        <StatusSelect value={topic.status} onChange={(s) => setStatus(topic.id, s)} label={`Status of ${topic.title}`} labels={labels} />
                      </div>
                    </div>
                    {expanded && (
                      <div id={`notes-${topic.id}`} className="mt-2">
                        <label className="text-sm font-medium" htmlFor={`notes-input-${topic.id}`}>
                          Notes for {topic.title}
                        </label>
                        <textarea
                          id={`notes-input-${topic.id}`}
                          rows={3}
                          className={inputClass}
                          value={topic.notes}
                          onChange={(e) => setNotes(topic.id, e.target.value)}
                          placeholder="Key points, links, mistakes to remember…"
                        />
                      </div>
                    )}
                  </li>
                );
              })}
              {section.topics.length === 0 && <li className="py-2 text-sm text-slate-600">No topics. Add some in Settings → Roadmaps.</li>}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
