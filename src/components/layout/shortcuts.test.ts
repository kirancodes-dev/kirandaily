import { describe, expect, it } from 'vitest';
import { isApplePlatform, isTypingTarget, resolveShortcut, shortcutHelp, type KeyLike } from './shortcuts';

const free = { typing: false, dialogOpen: false };
const key = (k: string, extra: Partial<KeyLike> = {}): KeyLike => ({ key: k, ...extra });

describe('resolveShortcut', () => {
  it('maps 1–5 to the five main pages', () => {
    expect(['1', '2', '3', '4', '5'].map((k) => resolveShortcut(key(k), free))).toEqual([
      { type: 'go', to: '/' },
      { type: 'go', to: '/schedule' },
      { type: 'go', to: '/study' },
      { type: 'go', to: '/progress' },
      { type: 'go', to: '/more' },
    ]);
    expect(resolveShortcut(key('6'), free)).toBeNull();
    expect(resolveShortcut(key('0'), free)).toBeNull();
  });

  it('opens search with / and with Cmd+K or Ctrl+K', () => {
    expect(resolveShortcut(key('/'), free)).toEqual({ type: 'search' });
    expect(resolveShortcut(key('k', { metaKey: true }), free)).toEqual({ type: 'search' });
    expect(resolveShortcut(key('K', { ctrlKey: true }), free)).toEqual({ type: 'search' });
  });

  it('maps n, t, ? and [ ]', () => {
    expect(resolveShortcut(key('n'), free)).toEqual({ type: 'new-task' });
    expect(resolveShortcut(key('N'), free)).toEqual({ type: 'new-task' });
    expect(resolveShortcut(key('t'), free)).toEqual({ type: 'today' });
    expect(resolveShortcut(key('?', {}), free)).toEqual({ type: 'help' });
    expect(resolveShortcut(key('['), free)).toEqual({ type: 'day', delta: -1 });
    expect(resolveShortcut(key(']'), free)).toEqual({ type: 'day', delta: 1 });
  });

  it('ignores other keys', () => {
    for (const k of ['a', 'Enter', 'Escape', ' ', 'ArrowLeft', 'Tab']) expect(resolveShortcut(key(k), free), k).toBeNull();
  });

  it('never steals keys typed into a field, but Cmd/Ctrl+K still searches', () => {
    const typing = { typing: true, dialogOpen: false };
    for (const k of ['1', '/', 'n', 't', '?', '[', ']']) expect(resolveShortcut(key(k), typing), k).toBeNull();
    expect(resolveShortcut(key('k', { metaKey: true }), typing)).toEqual({ type: 'search' });
  });

  it('does nothing while a dialog is open', () => {
    const dialog = { typing: false, dialogOpen: true };
    for (const k of ['1', '/', 'n', '?', ']']) expect(resolveShortcut(key(k), dialog), k).toBeNull();
    expect(resolveShortcut(key('k', { metaKey: true }), dialog)).toBeNull();
  });

  it('leaves browser shortcuts with modifiers alone (Cmd+1 tabs, Cmd+[ back, Alt+n …)', () => {
    expect(resolveShortcut(key('1', { metaKey: true }), free)).toBeNull();
    expect(resolveShortcut(key('[', { metaKey: true }), free)).toBeNull();
    expect(resolveShortcut(key('n', { ctrlKey: true }), free)).toBeNull();
    expect(resolveShortcut(key('n', { altKey: true }), free)).toBeNull();
    expect(resolveShortcut(key('k', { metaKey: true, altKey: true }), free)).toBeNull();
  });

  it('ignores IME composition and held-down keys, except [ ] which keep flipping days', () => {
    expect(resolveShortcut(key('n', { isComposing: true }), free)).toBeNull();
    expect(resolveShortcut(key('n', { repeat: true }), free)).toBeNull();
    expect(resolveShortcut(key('2', { repeat: true }), free)).toBeNull();
    expect(resolveShortcut(key('k', { metaKey: true, repeat: true }), free)).toBeNull();
    expect(resolveShortcut(key(']', { repeat: true }), free)).toEqual({ type: 'day', delta: 1 });
  });
});

describe('isTypingTarget', () => {
  it('treats text-like inputs, textareas, selects and contenteditable as typing', () => {
    expect(isTypingTarget({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(isTypingTarget({ tagName: 'INPUT', type: 'search' })).toBe(true);
    expect(isTypingTarget({ tagName: 'INPUT', type: 'date' })).toBe(true);
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('lets shortcuts work from buttons, links, checkboxes and the page', () => {
    expect(isTypingTarget({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(isTypingTarget({ tagName: 'INPUT', type: 'radio' })).toBe(false);
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isTypingTarget({ tagName: 'A' })).toBe(false);
    expect(isTypingTarget({ tagName: 'BODY', isContentEditable: false })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('isApplePlatform', () => {
  it('detects Mac, iPhone and iPad', () => {
    expect(isApplePlatform({ platform: 'MacIntel' })).toBe(true);
    expect(isApplePlatform({ userAgentData: { platform: 'macOS' } })).toBe(true);
    expect(isApplePlatform({ platform: 'iPhone' })).toBe(true);
    expect(isApplePlatform({ platform: '', userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)' })).toBe(true);
  });

  it('says no for Windows, Linux, Android and unknown', () => {
    expect(isApplePlatform({ platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' })).toBe(false);
    expect(isApplePlatform({ platform: 'Linux x86_64', userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' })).toBe(false);
    expect(isApplePlatform({ userAgentData: { platform: 'Android' }, userAgent: 'Mozilla/5.0 (Linux; Android 14)' })).toBe(false);
    expect(isApplePlatform(undefined)).toBe(false);
  });
});

describe('shortcutHelp', () => {
  it('lists every shortcut with the right modifier key', () => {
    const mac = shortcutHelp(true);
    const pc = shortcutHelp(false);
    const flat = (g: ReturnType<typeof shortcutHelp>) => g.flatMap((x) => x.rows.flatMap((r) => r.keys.map((k) => k.join('+'))));
    expect(flat(mac)).toEqual(expect.arrayContaining(['1', '2', '3', '4', '5', '/', '⌘+K', 'N', '[', ']', 'T', '?']));
    expect(flat(pc)).toContain('Ctrl+K');
    expect(flat(pc)).not.toContain('⌘+K');
  });

  it('names the five pages for keys 1–5', () => {
    const go = shortcutHelp(true)[0].rows.slice(0, 5);
    expect(go.map((r) => `${r.keys[0][0]} ${r.label}`)).toEqual(['1 Today', '2 Schedule', '3 Study', '4 Progress', '5 More']);
  });
});
