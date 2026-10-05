import type { CategoryColor } from '../types/task';

/** Literal class strings so Tailwind keeps them. Colour is always paired with a text label. */
export const CHIP_CLASSES: Record<CategoryColor, string> = {
  indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200',
  emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  amber: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  sky: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
  violet: 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200',
  rose: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
  slate: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  red: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200',
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200',
  lime: 'bg-lime-100 text-lime-800 dark:bg-lime-500/20 dark:text-lime-200',
  fuchsia: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-200',
};

/** Left border accent for timeline / grid blocks. */
export const BORDER_CLASSES: Record<CategoryColor, string> = {
  indigo: 'border-l-indigo-500',
  orange: 'border-l-orange-500',
  emerald: 'border-l-emerald-500',
  amber: 'border-l-amber-500',
  sky: 'border-l-sky-500',
  violet: 'border-l-violet-500',
  rose: 'border-l-rose-500',
  slate: 'border-l-slate-400',
  red: 'border-l-red-500',
  teal: 'border-l-teal-500',
  lime: 'border-l-lime-500',
  fuchsia: 'border-l-fuchsia-500',
};

/** Hex colours for charts. */
export const CHART_COLORS: Record<CategoryColor, string> = {
  indigo: '#6366f1',
  orange: '#f97316',
  emerald: '#10b981',
  amber: '#f59e0b',
  sky: '#0ea5e9',
  violet: '#8b5cf6',
  rose: '#f43f5e',
  slate: '#64748b',
  red: '#ef4444',
  teal: '#14b8a6',
  lime: '#84cc16',
  fuchsia: '#d946ef',
};

export const COLOR_OPTIONS = Object.keys(CHIP_CLASSES) as CategoryColor[];
