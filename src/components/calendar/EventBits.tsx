import { Star } from 'lucide-react';
import type { EventKind } from '../../types/extras';
import { parseISODate, WEEKDAY_SHORT } from '../../utils/date';
import { KIND_META } from './kindMeta';

/** Kind chip: icon + text. */
export function KindChip({ kind }: { kind: EventKind }) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.chip}`}>
      <Icon size={12} aria-hidden className="shrink-0" />
      {meta.label}
    </span>
  );
}

/** Month / day / weekday block at the start of an event row (decorative: the row describes the date in text). */
export function DateBlock({ date, kind }: { date: string; kind: EventKind }) {
  const d = parseISODate(date);
  return (
    <span
      aria-hidden
      className={`flex w-14 shrink-0 flex-col items-center justify-center rounded-xl py-1.5 leading-none ring-1 ring-inset ${KIND_META[kind].block}`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
      <span className="my-0.5 text-2xl font-bold tabular-nums">{d.getDate()}</span>
      <span className="text-xs font-medium">{WEEKDAY_SHORT[d.getDay()]}</span>
    </span>
  );
}

/** Star toggle for "important" (aria-pressed). */
export function StarButton({ title, important, onToggle }: { title: string; important: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={important}
      aria-label={`Important: ${title}`}
      title={important ? 'Important – tap to remove the star' : 'Mark as important'}
      onClick={onToggle}
      className="inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      <Star
        size={22}
        aria-hidden
        className={important ? 'fill-amber-400 text-amber-500 dark:fill-amber-300 dark:text-amber-300' : 'text-slate-400 dark:text-slate-500'}
      />
    </button>
  );
}
