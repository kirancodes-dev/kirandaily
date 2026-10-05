import { useSyncExternalStore } from 'react';

/** Chrome/Edge's install prompt event (not in TypeScript's DOM types yet). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

// Chrome fires this once, early, so it is caught when the app starts – not when
// the More page opens. Only Chromium browsers fire it; Safari never does.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    notify();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** One-tap install where the browser supports it (Chrome/Edge), plus "just installed". */
export function useInstallPrompt() {
  const canPrompt = useSyncExternalStore(
    subscribe,
    () => deferred !== null,
    () => false,
  );
  const justInstalled = useSyncExternalStore(
    subscribe,
    () => installed,
    () => false,
  );
  const prompt = async () => {
    const e = deferred;
    if (!e) return false;
    deferred = null;
    notify();
    await e.prompt();
    const choice = await e.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
    return choice.outcome === 'accepted';
  };
  return { canPrompt, justInstalled, prompt };
}
