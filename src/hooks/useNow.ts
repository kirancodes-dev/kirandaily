import { useMemo, useSyncExternalStore } from 'react';

/**
 * The current time, shared by every component that needs it (one timer for
 * the whole app). Updates every 30 s and right away when the app comes back
 * to the foreground (phones pause timers in the background).
 */
const TICK_MS = 30_000;
const listeners = new Set<() => void>();
let snapshot = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;

function tick() {
  snapshot = Date.now();
  listeners.forEach((l) => l());
}

function onVisible() {
  if (document.visibilityState === 'visible') tick();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
    }
  };
}

function getSnapshot() {
  // Nobody was listening for a while (first render, or after a pause): refresh.
  if (Date.now() - snapshot >= TICK_MS) snapshot = Date.now();
  return snapshot;
}

export function useNow(): Date {
  const ms = useSyncExternalStore(subscribe, getSnapshot);
  return useMemo(() => new Date(ms), [ms]);
}
