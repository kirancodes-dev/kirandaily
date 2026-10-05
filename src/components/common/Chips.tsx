import { CheckCircle2, Circle, CircleDot } from 'lucide-react';
import type { WorkStatus } from '../../types/subject';
import { STATUS_LABELS } from '../../utils/labels';
import { CHIP_CLASSES } from '../../utils/categoryStyles';
import { useCategories } from '../../hooks/useCategories';

export function CategoryChip({ id }: { id: string }) {
  const { get } = useCategories();
  const c = get(id);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${CHIP_CLASSES[c.color]}`}>
      {c.label}
    </span>
  );
}

export function StatusIcon({ status }: { status: WorkStatus }) {
  if (status === 'completed') return <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" aria-hidden />;
  if (status === 'in_progress') return <CircleDot size={18} className="text-amber-600 dark:text-amber-400" aria-hidden />;
  return <Circle size={18} className="text-slate-400" aria-hidden />;
}

interface StatusSelectProps {
  value: WorkStatus;
  onChange: (s: WorkStatus) => void;
  label: string;
  labels?: Record<WorkStatus, string>;
}

/** Status picker with icon + text (never colour alone). */
export function StatusSelect({ value, onChange, label, labels = STATUS_LABELS }: StatusSelectProps) {
  return (
    <div className="flex items-center gap-1.5">
      <StatusIcon status={value} />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as WorkStatus)}
        className="min-h-touch rounded-xl border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-800"
      >
        {(Object.keys(labels) as WorkStatus[]).map((s) => (
          <option key={s} value={s}>
            {labels[s]}
          </option>
        ))}
      </select>
    </div>
  );
}
