import { CalendarDays, Flag, GraduationCap, Heart, PencilLine, School, Sparkles, TreePalm, type LucideIcon } from 'lucide-react';
import type { EventKind } from '../../types/extras';
import { KIND_LABELS } from '../../utils/events';

interface KindStyle {
  label: string;
  icon: LucideIcon;
  /** Chip (always icon + text, never colour alone). */
  chip: string;
  /** Tinted date block on event rows. */
  block: string;
}

/** Literal class strings so Tailwind keeps them. */
export const KIND_META: Record<EventKind, KindStyle> = {
  exam: {
    label: KIND_LABELS.exam,
    icon: GraduationCap,
    chip: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
    block: 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-100 dark:ring-rose-500/30',
  },
  test: {
    label: KIND_LABELS.test,
    icon: PencilLine,
    chip: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
    block: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-500/30',
  },
  holiday: {
    label: KIND_LABELS.holiday,
    icon: TreePalm,
    chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
    block: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-100 dark:ring-emerald-500/30',
  },
  deadline: {
    label: KIND_LABELS.deadline,
    icon: Flag,
    chip: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200',
    block: 'bg-orange-50 text-orange-800 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-100 dark:ring-orange-500/30',
  },
  event: {
    label: KIND_LABELS.event,
    icon: Sparkles,
    chip: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
    block: 'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-100 dark:ring-sky-500/30',
  },
  class: {
    label: KIND_LABELS.class,
    icon: School,
    chip: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
    block: 'bg-indigo-50 text-indigo-800 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-100 dark:ring-indigo-500/30',
  },
  personal: {
    label: KIND_LABELS.personal,
    icon: Heart,
    chip: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-200',
    block: 'bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200 dark:bg-fuchsia-500/15 dark:text-fuchsia-100 dark:ring-fuchsia-500/30',
  },
  other: {
    label: KIND_LABELS.other,
    icon: CalendarDays,
    chip: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    block: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700',
  },
};
