import type { AppData } from '../types/app';
import { currentTemplates } from './taskActions';
import { describeRecurrence } from './schedule';
import { formatShortDate, formatTime12 } from './date';

export interface SearchResult {
  type: 'Task' | 'Repeating task' | 'Subject' | 'Topic' | 'Project' | 'Note' | 'Goal';
  title: string;
  detail: string;
  to: string;
}

const ROADMAP_PAGE = { java: '/java', dsa: '/dsa', german: '/german' } as const;

/** Case-insensitive search across tasks, subjects, roadmap topics, projects, notes and goals. */
export function searchData(data: AppData, query: string, today: string, limit = 60): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const has = (...parts: (string | undefined)[]) => parts.some((p) => p?.toLowerCase().includes(q));
  const out: SearchResult[] = [];

  for (const t of currentTemplates(data.templates, today)) {
    if (has(t.title, t.notes))
      out.push({ type: 'Repeating task', title: t.title, detail: `${formatTime12(t.startTime)} · ${describeRecurrence(t.recurrence)}`, to: '/schedule?view=routine' });
  }
  for (const t of [...data.tasks].sort((a, b) => b.date.localeCompare(a.date))) {
    if (has(t.title, t.notes)) out.push({ type: 'Task', title: t.title, detail: `${formatShortDate(t.date)} · ${formatTime12(t.startTime)}`, to: `/?date=${t.date}` });
  }
  for (const s of data.subjects) {
    if (has(s.name, s.notes)) out.push({ type: 'Subject', title: s.name, detail: 'College subject', to: '/subjects' });
    for (const t of s.topics) if (has(t.title)) out.push({ type: 'Topic', title: t.title, detail: s.name, to: '/subjects' });
  }
  for (const id of ['java', 'dsa', 'german'] as const) {
    const r = data.roadmaps[id];
    for (const sec of r.sections)
      for (const t of sec.topics) if (has(t.title, t.notes)) out.push({ type: 'Topic', title: t.title, detail: `${r.title} · ${sec.title}`, to: ROADMAP_PAGE[id] });
  }
  for (const p of data.projects) if (has(p.name, p.description, p.technology, p.notes)) out.push({ type: 'Project', title: p.name, detail: p.technology, to: '/projects' });
  for (const n of data.notes) if (has(n.title, n.content)) out.push({ type: 'Note', title: n.title || 'Untitled', detail: formatShortDate(n.date), to: '/notes' });
  for (const g of data.goals) if (has(g.title, g.description)) out.push({ type: 'Goal', title: g.title, detail: g.term === 'short' ? 'Short-term' : 'Long-term', to: '/goals' });
  return out.slice(0, limit);
}
