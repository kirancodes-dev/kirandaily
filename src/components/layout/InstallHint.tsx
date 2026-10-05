import { useState } from 'react';
import { Download, MonitorSmartphone, Share, X } from 'lucide-react';
import { Button } from '../common/Button';
import { browserStandaloneEnv, detectInstallPlatform, INSTALL_HINT_KEY, installSteps, isStandaloneDisplay } from './install';
import { useInstallPrompt } from './installPrompt';

function readDismissed() {
  try {
    return localStorage.getItem(INSTALL_HINT_KEY) === 'dismissed';
  } catch {
    return false;
  }
}

/**
 * "Install on iPhone / Mac" card for the More page. Hidden inside the installed
 * app and after "Hide"; leads with the steps for the browser in use.
 */
export function InstallHint() {
  const [hidden, setHidden] = useState(() => readDismissed() || isStandaloneDisplay(browserStandaloneEnv()));
  const { canPrompt, justInstalled, prompt } = useInstallPrompt();
  const [platform] = useState(() => detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints));
  if (hidden || justInstalled) return null;

  const [lead, ...others] = installSteps(platform);
  const leadKnown = lead.platform === platform;
  const dismiss = () => {
    try {
      localStorage.setItem(INSTALL_HINT_KEY, 'dismissed');
    } catch {
      /* private mode: hide for this visit only */
    }
    setHidden(true);
  };

  return (
    <section
      aria-labelledby="install-hint-heading"
      className="relative mb-5 overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4 shadow-sm dark:border-brand-500/30 dark:from-brand-500/15 dark:to-slate-900"
    >
      <div className="flex items-center gap-3 pr-9">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
          <MonitorSmartphone size={22} aria-hidden />
        </span>
        <h2 id="install-hint-heading" className="text-[17px] font-semibold leading-snug">
          Install on iPhone &amp; Mac
        </h2>
      </div>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
        Open it from your Home Screen or Dock like a real app: full screen, one tap away, works offline.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide install tips"
        title="Hide install tips"
        className="absolute right-2 top-2 inline-flex min-h-touch min-w-touch items-center justify-center rounded-xl text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <X size={20} aria-hidden />
      </button>

      {!leadKnown && (
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
          {platform === 'firefox'
            ? 'Firefox on a computer can’t install web apps. Open this page in Safari or Chrome to install it.'
            : 'Open this page in Safari (iPhone, Mac) or Chrome to install it.'}
        </p>
      )}

      {leadKnown && (
        <div className="mt-3 rounded-xl bg-white/80 p-3 ring-1 ring-inset ring-brand-100 dark:bg-slate-900/70 dark:ring-brand-500/20">
          <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">
            On this device <span className="font-normal text-slate-600 dark:text-slate-400">· {lead.device}</span>
          </p>
          <ol className="mt-2 space-y-1.5" aria-label={`Install steps for ${lead.device}`}>
            {lead.steps.map((step, i) => (
              <li key={step} className="flex items-start gap-2 text-[15px]">
                <span
                  className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  {step}
                  {lead.platform === 'ios' && i === 0 && (
                    <Share size={16} aria-label="(Share icon)" className="ml-1 inline align-[-2px] text-brand-700 dark:text-brand-300" />
                  )}
                </span>
              </li>
            ))}
          </ol>
          {canPrompt && (
            <Button variant="primary" className="mt-3" icon={<Download size={18} aria-hidden />} onClick={() => void prompt()}>
              Install now
            </Button>
          )}
        </div>
      )}

      <details className="group mt-2">
        <summary className="inline-flex min-h-touch cursor-pointer list-none items-center rounded-xl px-1 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300 [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">{leadKnown ? 'Steps for your other devices' : 'Show install steps'}</span>
          <span className="hidden group-open:inline">{leadKnown ? 'Hide other devices' : 'Hide install steps'}</span>
        </summary>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {(leadKnown ? others : [lead, ...others]).map((s) => (
            <div
              key={s.platform}
              className="rounded-xl bg-white/60 p-3 text-sm ring-1 ring-inset ring-slate-200 dark:bg-slate-900/50 dark:ring-slate-700"
            >
              <p className="font-semibold">{s.device}</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-slate-700 dark:text-slate-300">
                {s.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
