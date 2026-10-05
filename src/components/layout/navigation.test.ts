import { describe, expect, it } from 'vitest';
import {
  groupNav,
  isSidebarActive,
  isTabActive,
  isWidePage,
  MORE_NAV,
  PRIMARY_NAV,
  SIDEBAR_FOOTER_NAV,
  SIDEBAR_PROFILE_PATH,
  SIDEBAR_SECTIONS,
  type NavItem,
} from './navigation';
import { Sun } from 'lucide-react';

describe('PRIMARY_NAV', () => {
  it('has the 5 phone tabs in shortcut order 1–5', () => {
    expect(PRIMARY_NAV.map((n) => n.label)).toEqual(['Today', 'Schedule', 'Study', 'Progress', 'More']);
  });
});

describe('groupNav', () => {
  it('keeps every More item exactly once, grouped in first-seen order', () => {
    const sections = groupNav(MORE_NAV);
    expect(sections.map((s) => s.title)).toEqual(['You', 'Plan & reflect', 'Learning tracks', 'College', 'App']);
    expect(sections.flatMap((s) => s.items)).toHaveLength(MORE_NAV.length);
    expect(new Set(sections.flatMap((s) => s.items.map((i) => i.to))).size).toBe(MORE_NAV.length);
  });

  it('puts items without a group under "More"', () => {
    const items: NavItem[] = [
      { to: '/a', label: 'A', icon: Sun, group: 'App' },
      { to: '/b', label: 'B', icon: Sun },
      { to: '/c', label: 'C', icon: Sun, group: 'App' },
    ];
    expect(groupNav(items)).toEqual([
      { title: 'App', items: [items[0], items[2]] },
      { title: 'More', items: [items[1]] },
    ]);
  });
});

describe('desktop sidebar layout', () => {
  it('reaches every More page once: profile card, sections, or footer', () => {
    const listed = [SIDEBAR_PROFILE_PATH, ...SIDEBAR_SECTIONS.flatMap((s) => s.items.map((i) => i.to)), ...SIDEBAR_FOOTER_NAV.map((i) => i.to)];
    expect([...listed].sort()).toEqual(MORE_NAV.map((m) => m.to).sort());
  });

  it('keeps Search and Settings in the footer and drops the one-item sections', () => {
    expect(SIDEBAR_FOOTER_NAV.map((n) => n.label)).toEqual(['Search', 'Settings']);
    expect(SIDEBAR_SECTIONS.map((s) => s.title)).toEqual(['Plan & reflect', 'Learning tracks', 'College']);
  });
});

describe('isTabActive (phone tab bar)', () => {
  it('lights Today only on the home route', () => {
    expect(isTabActive('/', '/')).toBe(true);
    expect(isTabActive('/', '/schedule')).toBe(false);
  });

  it('lights a tab for its page and sub-pages, not look-alike paths', () => {
    expect(isTabActive('/study', '/study')).toBe(true);
    expect(isTabActive('/progress', '/progress')).toBe(true);
    expect(isTabActive('/study', '/studying')).toBe(false);
  });

  it('lights More for every page listed under More', () => {
    for (const path of ['/more', '/java', '/calendar', '/settings', '/search', '/profile']) {
      expect(isTabActive('/more', path), path).toBe(true);
    }
    expect(isTabActive('/more', '/')).toBe(false);
    expect(isTabActive('/more', '/schedule')).toBe(false);
  });

  it('keeps the weekly review under Progress, not More', () => {
    expect(isTabActive('/more', '/progress')).toBe(false);
    expect(isTabActive('/progress', '/progress')).toBe(true);
  });
});

describe('isSidebarActive (desktop sidebar)', () => {
  it('lights Weekly review (not Progress) on the weekly tab, with extra params', () => {
    expect(isSidebarActive('/progress?tab=weekly', '/progress', '?tab=weekly')).toBe(true);
    expect(isSidebarActive('/progress?tab=weekly', '/progress', '?tab=weekly&date=2026-10-04')).toBe(true);
    expect(isSidebarActive('/progress', '/progress', '?tab=weekly')).toBe(false);
  });

  it('lights Progress on its other tabs', () => {
    expect(isSidebarActive('/progress', '/progress', '')).toBe(true);
    expect(isSidebarActive('/progress', '/progress', '?tab=monthly')).toBe(true);
    expect(isSidebarActive('/progress?tab=weekly', '/progress', '?tab=monthly')).toBe(false);
  });

  it('lights exactly one item for every page', () => {
    // The sidebar shows all 5 primary items, the profile card and every More page (see SIDEBAR_*).
    const all = [...PRIMARY_NAV, ...MORE_NAV];
    for (const [pathname, search] of [
      ['/', ''],
      ['/', '?date=2026-10-06'],
      ['/schedule', '?view=month'],
      ['/study', ''],
      ['/java', ''],
      ['/progress', '?tab=weekly'],
      ['/progress', ''],
      ['/progress', '?tab=monthly'],
      ['/more', ''],
      ['/profile', ''],
      ['/calendar', ''],
      ['/search', ''],
      ['/settings', ''],
    ]) {
      const lit = all.filter((n) => isSidebarActive(n.to, pathname, search)).map((n) => n.label);
      expect(lit, `${pathname}${search}`).toHaveLength(1);
    }
  });
});

describe('isWidePage', () => {
  it('widens the timeline, week, chart and month pages only', () => {
    expect(['/', '/schedule', '/progress', '/calendar'].every(isWidePage)).toBe(true);
    expect(isWidePage('/settings')).toBe(false);
    expect(isWidePage('/notes')).toBe(false);
  });
});
