import type { ReactNode } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

interface BannerProps {
  tone?: 'info' | 'warning' | 'error';
  children: ReactNode;
  onDismiss?: () => void;
}

const TONE = {
  info: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100',
  warning: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
  error: 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
};

export function Banner({ tone = 'info', children, onDismiss }: BannerProps) {
  const Icon = tone === 'info' ? Info : AlertTriangle;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-2xl border p-3 text-sm ${TONE[tone]}`}>
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss message" className="-m-2 min-h-touch min-w-touch rounded-xl p-2">
          <X size={18} aria-hidden className="mx-auto" />
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700">
      {icon && <div className="text-slate-400">{icon}</div>}
      <p className="font-medium">{title}</p>
      {children && <div className="text-sm text-slate-600 dark:text-slate-400">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-slate-600 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
