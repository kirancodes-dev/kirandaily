import { describe, expect, it } from 'vitest';
import { isValidUsername, normalizeUsername, profileUrl } from './usernames';

describe('usernames', () => {
  it('accepts only letters, digits, - and _ (1–39 characters)', () => {
    for (const ok of ['kiran', 'kirancodes-dev', 'kiran_codes', 'K1', 'a'.repeat(39)]) expect(isValidUsername(ok), ok).toBe(true);
    for (const bad of ['', 'a'.repeat(40), 'kiran dev', '../etc', 'kiran/x', '<script>', 'ki?ran', 'kiran%2F', 'kiran.dev', 'kirán', null, 42]) {
      expect(isValidUsername(bad), String(bad)).toBe(false);
    }
  });

  it('turns pasted handles and profile links into a bare username', () => {
    expect(normalizeUsername('  @kiran  ', 'github')).toBe('kiran');
    expect(normalizeUsername('https://github.com/kirancodes-dev/', 'github')).toBe('kirancodes-dev');
    expect(normalizeUsername('github.com/kiran/planner', 'github')).toBe('kiran');
    expect(normalizeUsername('https://www.github.com/kiran?tab=repositories', 'github')).toBe('kiran');
    expect(normalizeUsername('https://leetcode.com/u/kiran_lc/', 'leetcode')).toBe('kiran_lc');
    expect(normalizeUsername('leetcode.com/kiran_lc', 'leetcode')).toBe('kiran_lc');
    expect(normalizeUsername('kiran_lc', 'leetcode')).toBe('kiran_lc');
  });

  it('rejects links to other sites and anything that is not a username', () => {
    expect(normalizeUsername('https://gitlab.com/kiran', 'github')).toBeNull();
    expect(normalizeUsername('github.com/kiran', 'leetcode')).toBeNull();
    expect(normalizeUsername('kiran dev', 'github')).toBeNull();
    expect(normalizeUsername('', 'github')).toBeNull();
    expect(normalizeUsername('javascript:alert(1)', 'github')).toBeNull();
  });

  it('builds profile links only for valid usernames', () => {
    expect(profileUrl('github', 'kiran')).toBe('https://github.com/kiran');
    expect(profileUrl('leetcode', 'kiran_lc')).toBe('https://leetcode.com/u/kiran_lc/');
    expect(profileUrl('github', 'kiran/../x')).toBeNull();
  });
});
