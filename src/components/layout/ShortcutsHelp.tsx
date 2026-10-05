import { Fragment, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { isApplePlatform, shortcutHelp } from './shortcuts';

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-lg border border-b-2 border-slate-300 bg-slate-50 px-1.5 font-sans text-sm font-semibold text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
      {children}
    </kbd>
  );
}

/** "Keyboard shortcuts" dialog, opened with "?" or from the sidebar. */
export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const groups = useMemo(() => shortcutHelp(typeof navigator !== 'undefined' && isApplePlatform(navigator)), []);
  return (
    <Modal open={open} title="Keyboard shortcuts" onClose={onClose}>
      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{group.title}</h3>
            <dl className="divide-y divide-slate-100 dark:divide-slate-800">
              {group.rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 py-2">
                  <dt className="text-[15px] text-slate-800 dark:text-slate-200">{row.label}</dt>
                  <dd className="flex shrink-0 items-center gap-1.5 text-sm text-slate-500">
                    {row.keys.map((combo, i) => (
                      <Fragment key={combo.join('+')}>
                        {i > 0 && <span>or</span>}
                        <span className="inline-flex items-center gap-1">
                          {combo.map((k) => (
                            <Kbd key={k}>{k}</Kbd>
                          ))}
                        </span>
                      </Fragment>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <p className="text-sm text-slate-600 dark:text-slate-400">Shortcuts pause while you type in a field or a dialog is open.</p>
      </div>
    </Modal>
  );
}
