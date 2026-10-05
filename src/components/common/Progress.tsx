interface ProgressBarProps {
  value: number; // 0-100
  label: string;
  showValue?: boolean;
  tone?: 'brand' | 'green' | 'amber';
  size?: 'sm' | 'md';
}

const TONES = { brand: 'bg-brand-600', green: 'bg-emerald-600', amber: 'bg-amber-500' };

export function ProgressBar({ value, label, showValue = true, tone = 'brand', size = 'md' }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
  return (
    <div>
      {showValue && (
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-slate-700 dark:text-slate-300">{label}</span>
          <span className="font-medium tabular-nums">{pct}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className={`w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 ${size === 'sm' ? 'h-1.5' : 'h-2.5'}`}
      >
        <div className={`h-full rounded-full ${TONES[tone]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
