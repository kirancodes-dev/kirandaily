import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { ToastContext, type ToastInput } from './contexts';

interface Shown extends Required<Pick<ToastInput, 'id' | 'title' | 'tone'>> {
  body?: string;
  action?: ToastInput['action'];
}

const TONE = {
  info: 'border-sky-300 bg-white text-slate-900 dark:border-sky-700 dark:bg-slate-900 dark:text-slate-100',
  success: 'border-emerald-300 bg-white text-slate-900 dark:border-emerald-700 dark:bg-slate-900 dark:text-slate-100',
  warning: 'border-amber-300 bg-white text-slate-900 dark:border-amber-700 dark:bg-slate-900 dark:text-slate-100',
  error: 'border-red-300 bg-white text-slate-900 dark:border-red-700 dark:bg-slate-900 dark:text-slate-100',
};
const ICON = {
  info: <Info size={20} className="text-sky-600" aria-hidden />,
  success: <CheckCircle2 size={20} className="text-emerald-600" aria-hidden />,
  warning: <AlertTriangle size={20} className="text-amber-600" aria-hidden />,
  error: <AlertTriangle size={20} className="text-red-600" aria-hidden />,
};

let counter = 0;

/** Small notification pop-ups (top of the screen, below the bar). Max 3 at a time. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Shown[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = input.id ?? `toast-${++counter}`;
      const shown: Shown = { id, title: input.title, body: input.body, tone: input.tone ?? 'info', action: input.action };
      setToasts((t) => [...t.filter((x) => x.id !== id), shown].slice(-3));
      const old = timers.current.get(id);
      if (old) clearTimeout(old);
      const duration = input.duration ?? 5000;
      if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+3.75rem)] z-[60] flex flex-col items-center gap-2 px-3 lg:left-auto lg:right-4 lg:top-4 lg:w-96 lg:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' || t.tone === 'warning' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border p-3 shadow-lg ${TONE[t.tone]}`}
          >
            <span className="mt-0.5 shrink-0">{ICON[t.tone]}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug">{t.title}</p>
              {t.body && <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{t.body}</p>}
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  className="mt-2 min-h-touch rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="-m-1 inline-flex min-h-touch min-w-touch items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
