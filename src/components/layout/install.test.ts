import { describe, expect, it } from 'vitest';
import { detectInstallPlatform, installSteps, isStandaloneDisplay } from './install';

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.41 Mobile/15E148 Safari/604.1',
  ipadDesktopMode: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  macEdge: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  macFirefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:131.0) Gecko/20100101 Firefox/131.0',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
};

describe('detectInstallPlatform', () => {
  it('sends every iPhone browser to Share → Add to Home Screen', () => {
    expect(detectInstallPlatform(UA.iphoneSafari)).toBe('ios');
    expect(detectInstallPlatform(UA.iphoneChrome)).toBe('ios');
  });

  it('spots an iPad that claims to be a Mac by its touch screen', () => {
    expect(detectInstallPlatform(UA.ipadDesktopMode, 5)).toBe('ios');
    expect(detectInstallPlatform(UA.macSafari, 0)).toBe('mac-safari');
  });

  it('tells Mac Safari from Chromium browsers and Firefox', () => {
    expect(detectInstallPlatform(UA.macChrome)).toBe('chromium');
    expect(detectInstallPlatform(UA.macEdge)).toBe('chromium');
    expect(detectInstallPlatform(UA.android)).toBe('chromium');
    expect(detectInstallPlatform(UA.macFirefox)).toBe('firefox');
    expect(detectInstallPlatform('')).toBe('other');
  });
});

describe('isStandaloneDisplay', () => {
  const media = (matching: string[]) => (q: string) => ({ matches: matching.includes(q) });

  it('is true for the iPhone Home Screen app (navigator.standalone)', () => {
    expect(isStandaloneDisplay({ standalone: true })).toBe(true);
  });

  it('is true for installed display modes', () => {
    expect(isStandaloneDisplay({ matchMedia: media(['(display-mode: standalone)']) })).toBe(true);
    expect(isStandaloneDisplay({ matchMedia: media(['(display-mode: minimal-ui)']) })).toBe(true);
  });

  it('is false in a normal browser tab or without matchMedia', () => {
    expect(isStandaloneDisplay({ matchMedia: media(['(display-mode: browser)']), standalone: false })).toBe(false);
    expect(isStandaloneDisplay({})).toBe(false);
    expect(
      isStandaloneDisplay({
        matchMedia: () => {
          throw new Error('unsupported');
        },
      }),
    ).toBe(false);
  });
});

describe('installSteps', () => {
  it('leads with the current platform and keeps the others', () => {
    expect(installSteps('mac-safari').map((s) => s.platform)).toEqual(['mac-safari', 'ios', 'chromium']);
    expect(installSteps('ios')[0].steps.join(' ')).toContain('Add to Home Screen');
    expect(installSteps('mac-safari')[0].steps.join(' ')).toContain('File → Add to Dock');
    expect(installSteps('chromium')[0].steps.join(' ')).toContain('Install');
  });

  it('lists all platforms when the browser cannot install', () => {
    expect(installSteps('firefox').map((s) => s.platform)).toEqual(['ios', 'mac-safari', 'chromium']);
  });
});
