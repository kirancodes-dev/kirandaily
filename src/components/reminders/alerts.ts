/**
 * Browser alert helpers for reminders: a short beep (Web Audio), system
 * notifications and the app-icon badge. Every call is guarded — unsupported
 * browsers, blocked permissions or a suspended page simply do nothing.
 */

type AudioCtor = typeof AudioContext;
let audio: AudioContext | null = null;

function audioContext(): AudioContext | null {
  try {
    if (!audio) {
      const Ctor: AudioCtor | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
      if (!Ctor) return null;
      audio = new Ctor();
    }
    return audio;
  } catch {
    return null;
  }
}

/**
 * iPhone/Safari only allow sound after the user has touched the page once.
 * Call from a tap/click handler; it wakes the audio engine for later beeps.
 */
export function unlockAudio(): void {
  const ctx = audioContext();
  if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
}

/** Two soft tones (~0.4 s). Silent when audio is unavailable or still locked. */
export function playBeep(kind: 'info' | 'warning' = 'info'): void {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const notes = kind === 'warning' ? [660, 520] : [740, 988];
    const t0 = ctx.currentTime + 0.02;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = t0 + i * 0.18;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  } catch {
    // No sound — the toast is still shown.
  }
}

export type NotifyPermission = NotificationPermission | 'unsupported';

export function notificationPermission(): NotifyPermission {
  try {
    return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  } catch {
    return 'unsupported';
  }
}

export async function requestNotificationPermission(): Promise<NotifyPermission> {
  try {
    if (typeof Notification === 'undefined') return 'unsupported';
    // Older Safari only supports the callback form.
    return await new Promise<NotificationPermission>((resolve) => {
      const maybe = Notification.requestPermission((p) => resolve(p));
      if (maybe && typeof maybe.then === 'function') void maybe.then(resolve, () => resolve(Notification.permission));
    });
  } catch {
    return notificationPermission();
  }
}

/** Notifications shown by this page, by tag (so they can be closed again). */
const pageNotifications = new Map<string, Notification>();

/**
 * Shows a system notification (only when permission is granted).
 * Uses the page's Notification first (a click brings the app to the front),
 * then the service worker (required on iPhone and Android).
 */
export async function showSystemNotification(title: string, body: string, tag: string): Promise<boolean> {
  if (notificationPermission() !== 'granted') return false;
  const icon = `${import.meta.env.BASE_URL}pwa-192x192.png`;
  try {
    const n = new Notification(title, { body, tag, icon });
    pageNotifications.set(tag, n);
    n.onclick = () => {
      window.focus();
      n.close();
    };
    n.onclose = () => {
      if (pageNotifications.get(tag) === n) pageNotifications.delete(tag);
    };
    return true;
  } catch {
    // "Illegal constructor" on mobile — fall through to the service worker.
  }
  try {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    if (!reg) return false;
    await reg.showNotification(title, { body, tag, icon, badge: icon });
    return true;
  } catch {
    return false;
  }
}

/** Closes a notification that is no longer true (e.g. the task was ticked on another device). */
export function closeSystemNotification(tag: string): void {
  try {
    pageNotifications.get(tag)?.close();
    pageNotifications.delete(tag);
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
    void navigator.serviceWorker.ready
      .then((reg) => reg.getNotifications({ tag }))
      .then((list) => list.forEach((n) => n.close()))
      .catch(() => undefined);
  } catch {
    // Nothing to close.
  }
}

type BadgeNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

/** Number on the app icon (installed iPhone/Mac/desktop app). 0 clears it. */
export function setAppBadge(count: number): void {
  try {
    const nav = navigator as BadgeNavigator;
    if (count > 0 && nav.setAppBadge) void nav.setAppBadge(count).catch(() => undefined);
    else if (count <= 0 && nav.clearAppBadge) void nav.clearAppBadge().catch(() => undefined);
  } catch {
    // Badging not supported.
  }
}

/** The page is in the background (another tab/app is in front). */
export function pageInBackground(): boolean {
  try {
    return document.visibilityState === 'hidden' || !document.hasFocus();
  } catch {
    return false;
  }
}
