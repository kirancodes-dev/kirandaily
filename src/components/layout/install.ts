/** Where the app is running, as far as "how do I install it?" is concerned. */
export type InstallPlatform = 'ios' | 'mac-safari' | 'chromium' | 'firefox' | 'other';

/**
 * Picks the install instructions to lead with. iPadOS Safari reports itself as a Mac,
 * so a "Macintosh" with a touch screen is treated as iOS. Every iOS browser installs
 * through Share → Add to Home Screen.
 */
export function detectInstallPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  const ua = userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return 'ios';
  if (/Firefox\//.test(ua) && !/Seamonkey/i.test(ua)) return 'firefox';
  if (/Chrome\/|Chromium\/|Edg\/|OPR\//.test(ua)) return 'chromium';
  if (/Macintosh/.test(ua) && /Version\/[\d.]+.*Safari\//.test(ua)) return 'mac-safari';
  return 'other';
}

export interface StandaloneEnv {
  matchMedia?: (query: string) => { matches: boolean };
  /** Safari's navigator.standalone (true on an iPhone Home Screen app). */
  standalone?: boolean;
}

/** True inside the installed app (Home Screen, Dock or a Chrome app window). */
export function isStandaloneDisplay(env: StandaloneEnv): boolean {
  if (env.standalone === true) return true;
  if (typeof env.matchMedia !== 'function') return false;
  return ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some((mode) => {
    try {
      return env.matchMedia!(`(display-mode: ${mode})`).matches;
    } catch {
      return false;
    }
  });
}

/** The real browser environment for isStandaloneDisplay. */
export function browserStandaloneEnv(): StandaloneEnv {
  if (typeof window === 'undefined') return {};
  return {
    matchMedia: typeof window.matchMedia === 'function' ? (q) => window.matchMedia(q) : undefined,
    standalone: (navigator as Navigator & { standalone?: boolean }).standalone,
  };
}

/** localStorage key for "don't show install tips again" (device-only UI state). */
export const INSTALL_HINT_KEY = 'kiran-planner:ui:install-hint';

export interface InstallStep {
  platform: InstallPlatform;
  device: string;
  steps: string[];
}

/** Step-by-step instructions per platform, the detected one first. */
export function installSteps(current: InstallPlatform): InstallStep[] {
  const all: InstallStep[] = [
    {
      platform: 'ios',
      device: 'iPhone or iPad (Safari)',
      steps: ['Tap the Share button', 'Scroll down and choose Add to Home Screen', 'Keep “Open as Web App” on, then tap Add'],
    },
    {
      platform: 'mac-safari',
      device: 'Mac (Safari)',
      steps: ['In the menu bar choose File → Add to Dock', 'Click Add — it opens in its own window from the Dock'],
    },
    {
      platform: 'chromium',
      device: 'Chrome or Edge (Mac, Windows, Android)',
      steps: ['Click the Install icon at the right of the address bar', 'Or open the ⋮ menu → Cast, save and share → Install page as app'],
    },
  ];
  const lead = all.find((s) => s.platform === current);
  return lead ? [lead, ...all.filter((s) => s !== lead)] : all;
}
