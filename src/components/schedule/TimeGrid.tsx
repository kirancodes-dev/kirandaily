import { Check } from 'lucide-react';
import type { Task } from '../../types/task';
import { useCategories } from '../../hooks/useCategories';
import { BORDER_CLASSES } from '../../utils/categoryStyles';
import { formatTime12, timeToMinutes } from '../../utils/date';

const HOUR_PX = 52;

interface Column {
  date: string;
  label: string;
  tasks: Task[];
}

interface Placed {
  task: Task;
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

function layout(tasks: Task[], startMin: number, endMin: number): Placed[] {
  const items = tasks
    .map((task) => {
      const s = timeToMinutes(task.startTime);
      let e = s + task.duration;
      if (e > endMin) e = endMin;
      return { task, s: Math.max(s, startMin), e };
    })
    .filter((i) => i.e > i.s)
    .sort((a, b) => a.s - b.s || b.e - a.e);
  // Greedy lanes for overlapping blocks.
  const placed: (Placed & { s: number; e: number })[] = [];
  let group: typeof placed = [];
  let groupEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...group.map((g) => g.lane + 1));
    group.forEach((g) => (g.lanes = lanes));
    group = [];
  };
  for (const it of items) {
    if (it.s >= groupEnd) {
      flush();
      groupEnd = it.e;
    } else groupEnd = Math.max(groupEnd, it.e);
    const used = new Set(group.filter((g) => g.e > it.s).map((g) => g.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    const p = {
      task: it.task,
      s: it.s,
      e: it.e,
      top: ((it.s - startMin) / 60) * HOUR_PX,
      height: Math.max(((it.e - it.s) / 60) * HOUR_PX - 2, 24),
      lane,
      lanes: 1,
    };
    group.push(p);
    placed.push(p);
  }
  flush();
  return placed;
}

interface TimeGridProps {
  columns: Column[];
  onSelect: (task: Task) => void;
  today: string;
}

/** Rows = hours, columns = days. Blocks are buttons that open the task options. */
export function TimeGrid({ columns, onSelect, today }: TimeGridProps) {
  const { get } = useCategories();
  const all = columns.flatMap((c) => c.tasks);
  const startHour = Math.min(5, ...all.map((t) => Math.floor(timeToMinutes(t.startTime) / 60)));
  const endHour = Math.max(
    23,
    ...all.map((t) => {
      const s = timeToMinutes(t.startTime);
      return s + t.duration <= 1440 ? Math.ceil((s + t.duration) / 60) : 24;
    }),
  );
  const startMin = startHour * 60;
  const endMin = Math.min(endHour, 24) * 60;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const height = hours.length * HOUR_PX;

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${columns.length}, minmax(${columns.length > 1 ? '7rem' : '0'}, 1fr))` }}>
        <div className="sticky left-0 z-10 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
        {columns.map((c) => (
          <div
            key={c.date}
            className={`border-b border-l border-slate-200 px-2 py-2 text-center text-sm font-semibold dark:border-slate-800 ${
              c.date === today ? 'text-brand-700 dark:text-brand-300' : ''
            }`}
          >
            {c.label}
            {c.date === today && <span className="sr-only"> (today)</span>}
          </div>
        ))}

        <div className="sticky left-0 z-10 bg-white dark:bg-slate-900" style={{ height }} aria-hidden>
          {hours.map((h) => (
            <div key={h} className="pr-1 text-right text-xs text-slate-500" style={{ height: HOUR_PX }}>
              {formatTime12(`${String(h % 24).padStart(2, '0')}:00`).replace(':00', '')}
            </div>
          ))}
        </div>

        {columns.map((c) => (
          <div key={c.date} className="relative border-l border-slate-200 dark:border-slate-800" style={{ height }}>
            {hours.map((h, i) => (
              <div key={h} className="absolute inset-x-0 border-t border-slate-100 dark:border-slate-800" style={{ top: i * HOUR_PX }} aria-hidden />
            ))}
            <ul aria-label={`Tasks on ${c.label}`} className="absolute inset-0">
              {layout(c.tasks, startMin, endMin).map((p) => {
                const cat = get(p.task.category);
                const done = p.task.completed && !p.task.skipped;
                return (
                  <li
                    key={p.task.id}
                    className="absolute px-0.5"
                    style={{ top: p.top + 1, height: p.height, left: `${(p.lane / p.lanes) * 100}%`, width: `${100 / p.lanes}%` }}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(p.task)}
                      className={`flex h-full w-full flex-col overflow-hidden rounded-lg border-l-4 bg-slate-50 px-1.5 py-0.5 text-left text-xs hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 ${BORDER_CLASSES[cat.color]} ${
                        done || p.task.skipped ? 'opacity-60' : ''
                      }`}
                      aria-label={`${p.task.title}, ${cat.label}, ${formatTime12(p.task.startTime)} to ${formatTime12(p.task.endTime)}${
                        done ? ', completed' : p.task.skipped ? ', skipped' : ''
                      }`}
                    >
                      <span className={`flex items-center gap-1 font-semibold leading-tight ${done ? 'line-through' : ''}`}>
                        {done && <Check size={12} aria-hidden className="shrink-0" />}
                        <span className="truncate">{p.task.title}</span>
                      </span>
                      {p.height > 34 && (
                        <span className="truncate text-[11px] text-slate-600 dark:text-slate-400">
                          {formatTime12(p.task.startTime)}
                          {p.task.skipped ? ' · skipped' : ''}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
