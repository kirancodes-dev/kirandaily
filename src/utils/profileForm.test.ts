import { describe, expect, it } from 'vitest';
import {
  formValuesFrom,
  githubUrl,
  isHttpUrl,
  isValidUsername,
  leetcodeUrl,
  normalizeUrl,
  normalizeUsername,
  profileLinks,
  shortUrl,
  validateName,
  validateProfileForm,
  type ProfileFormValues,
} from './profileForm';
import { createDefaultData } from '../data/defaultData';
import { profileExtraSchema } from './schema';

const base: ProfileFormValues = {
  name: 'Kiran',
  headline: 'B.Tech CSE',
  college: 'My College',
  semester: '5',
  bio: '',
  github: '',
  leetcode: '',
  linkedin: '',
  portfolio: '',
};

describe('usernames', () => {
  it('accepts GitHub/LeetCode style usernames only', () => {
    expect(isValidUsername('kirancodes-dev')).toBe(true);
    expect(isValidUsername('kiran_lc')).toBe(true);
    expect(isValidUsername('a'.repeat(39))).toBe(true);
    expect(isValidUsername('a'.repeat(40))).toBe(false);
    expect(isValidUsername('')).toBe(false);
    expect(isValidUsername('bad name')).toBe(false);
    expect(isValidUsername('../etc')).toBe(false);
    expect(isValidUsername('kiran?tab=repos')).toBe(false);
  });

  it('pulls the username out of a pasted profile link', () => {
    expect(normalizeUsername('https://github.com/kirancodes-dev/', ['github.com'])).toBe('kirancodes-dev');
    expect(normalizeUsername('github.com/kiran', ['github.com'])).toBe('kiran');
    expect(normalizeUsername('https://www.github.com/kiran/repo', ['github.com'])).toBe('kiran');
    expect(normalizeUsername('https://leetcode.com/u/kiran_lc/', ['leetcode.com'])).toBe('kiran_lc');
    expect(normalizeUsername('https://leetcode.com/kiran_lc', ['leetcode.com'])).toBe('kiran_lc');
    expect(normalizeUsername('  @kiran  ', ['github.com'])).toBe('kiran');
    expect(normalizeUsername('https://evil.com/kiran', ['github.com'])).toBe('https://evil.com/kiran');
    expect(normalizeUsername('', ['github.com'])).toBe('');
  });

  it('builds profile URLs safely', () => {
    expect(githubUrl('kiran')).toBe('https://github.com/kiran');
    expect(leetcodeUrl('kiran_lc')).toBe('https://leetcode.com/u/kiran_lc/');
    expect(githubUrl('a/b?c')).toBe('https://github.com/a%2Fb%3Fc');
  });
});

describe('URLs', () => {
  it('accepts only http(s) links with a real host', () => {
    expect(isHttpUrl('https://www.linkedin.com/in/kiran')).toBe(true);
    expect(isHttpUrl('http://kiran.dev')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:text/html,hi')).toBe(false);
    expect(isHttpUrl('ftp://kiran.dev')).toBe(false);
    expect(isHttpUrl('https://kiran')).toBe(false);
    expect(isHttpUrl('kiran.dev')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
  });

  it('adds https:// to bare domains but never touches other schemes', () => {
    expect(normalizeUrl('linkedin.com/in/kiran')).toBe('https://linkedin.com/in/kiran');
    expect(normalizeUrl(' www.kiran.dev ')).toBe('https://www.kiran.dev');
    expect(normalizeUrl('https://kiran.dev')).toBe('https://kiran.dev');
    expect(normalizeUrl('javascript:alert(1)')).toBe('javascript:alert(1)');
    expect(normalizeUrl('not a url')).toBe('not a url');
  });

  it('shortens URLs for chips', () => {
    expect(shortUrl('https://www.kiran.dev/work/')).toBe('kiran.dev/work');
    expect(shortUrl('https://kiran.dev')).toBe('kiran.dev');
  });
});

describe('profile form', () => {
  it('round-trips the stored profile', () => {
    const d = createDefaultData();
    const v = formValuesFrom(d.profile.name, d.profileExtra);
    expect(v.semester).toBe('5');
    const r = validateProfileForm(v);
    expect(r.errors).toEqual({});
    expect(r.value?.name).toBe('Kiran');
    expect(r.value?.extra.semester).toBe(5);
    expect(formValuesFrom('K', { ...d.profileExtra, semester: null }).semester).toBe('');
  });

  it('requires a name and trims everything', () => {
    expect(validateProfileForm({ ...base, name: '   ' }).errors.name).toBe('Name can’t be empty.');
    const r = validateProfileForm({ ...base, name: '  Kiran   Kumar ', headline: ' Student ', bio: ' Hi \n' });
    expect(r.value?.name).toBe('Kiran Kumar');
    expect(r.value?.extra.headline).toBe('Student');
    expect(r.value?.extra.bio).toBe('Hi');
  });

  it('limits the name to 60 characters, but never blocks a longer name that is already saved', () => {
    expect(validateName('x'.repeat(60))).toEqual({ name: 'x'.repeat(60), error: null });
    expect(validateName('x'.repeat(61)).error).toBe('Keep it under 60 characters.');
    expect(validateName('  ').error).toBe('Name can’t be empty.');
    // Saved earlier (e.g. from Settings before it had a limit): editing other fields still works.
    const old = 'K'.repeat(61);
    expect(validateName(old, old).error).toBeNull();
    expect(validateName(` ${old} `, old).error).toBeNull();
    const r = validateProfileForm({ ...base, name: old, headline: 'New headline' }, old);
    expect(r.errors).toEqual({});
    expect(r.value?.name).toBe(old);
    // …but a different long name is still refused.
    expect(validateProfileForm({ ...base, name: `${old}!` }, old).errors.name).toBe('Keep it under 60 characters.');
  });

  it('checks the semester is 1–12 (or empty)', () => {
    expect(validateProfileForm({ ...base, semester: '0' }).errors.semester).toBeTruthy();
    expect(validateProfileForm({ ...base, semester: '13' }).errors.semester).toBeTruthy();
    expect(validateProfileForm({ ...base, semester: '2.5' }).errors.semester).toBeTruthy();
    expect(validateProfileForm({ ...base, semester: '12' }).value?.extra.semester).toBe(12);
    expect(validateProfileForm({ ...base, semester: '' }).value?.extra.semester).toBeNull();
  });

  it('validates usernames and links and cleans pasted values', () => {
    const bad = validateProfileForm({ ...base, github: 'bad name!', leetcode: 'x'.repeat(40), linkedin: 'javascript:alert(1)', portfolio: 'nope' });
    expect(Object.keys(bad.errors).sort()).toEqual(['github', 'leetcode', 'linkedin', 'portfolio']);
    expect(bad.value).toBeUndefined();

    const good = validateProfileForm({
      ...base,
      github: 'https://github.com/kirancodes-dev',
      leetcode: '@kiran_lc',
      linkedin: 'linkedin.com/in/kiran',
      portfolio: 'https://kiran.dev',
    });
    expect(good.value?.extra.links).toEqual({
      github: 'kirancodes-dev',
      leetcode: 'kiran_lc',
      linkedin: 'https://linkedin.com/in/kiran',
      portfolio: 'https://kiran.dev',
    });
  });

  it('refuses links to pages that are not profiles, like the coding-profile cards do', () => {
    const r = validateProfileForm({ ...base, github: 'https://github.com/settings/profile', leetcode: 'https://leetcode.com/problems/two-sum/' });
    expect(r.errors.github).toBe('That link isn’t a profile — enter just your username.');
    expect(r.errors.leetcode).toBe('That link isn’t a profile — enter just your username.');
    // A user who is really called "settings" can still type the bare name.
    expect(validateProfileForm({ ...base, github: 'settings' }).value?.extra.links.github).toBe('settings');
    expect(validateProfileForm({ ...base, leetcode: 'https://leetcode.com/u/kiran_lc/' }).value?.extra.links.leetcode).toBe('kiran_lc');
  });

  it('produces data the schema accepts', () => {
    const r = validateProfileForm({ ...base, github: 'kiran', linkedin: 'https://linkedin.com/in/kiran' });
    expect(profileExtraSchema.safeParse({ photo: '', ...r.value!.extra }).success).toBe(true);
  });

  it('enforces the schema length limits', () => {
    expect(validateProfileForm({ ...base, headline: 'x'.repeat(121) }).errors.headline).toBeTruthy();
    expect(validateProfileForm({ ...base, college: 'x'.repeat(161) }).errors.college).toBeTruthy();
    expect(validateProfileForm({ ...base, bio: 'x'.repeat(1001) }).errors.bio).toBeTruthy();
    expect(validateProfileForm({ ...base, portfolio: `https://kiran.dev/${'x'.repeat(300)}` }).errors.portfolio).toBeTruthy();
  });
});

describe('profile links', () => {
  it('lists only valid links, with safe hrefs', () => {
    const links = profileLinks({ github: 'kiran', leetcode: 'kiran_lc', linkedin: 'https://linkedin.com/in/kiran', portfolio: 'https://kiran.dev/' });
    expect(links.map((l) => [l.id, l.href, l.detail])).toEqual([
      ['github', 'https://github.com/kiran', 'kiran'],
      ['leetcode', 'https://leetcode.com/u/kiran_lc/', 'kiran_lc'],
      ['linkedin', 'https://linkedin.com/in/kiran', 'linkedin.com/in/kiran'],
      ['portfolio', 'https://kiran.dev/', 'kiran.dev'],
    ]);
  });

  it('drops anything unsafe (e.g. edited in a backup file)', () => {
    expect(profileLinks({ github: 'a b', leetcode: '', linkedin: 'javascript:alert(1)', portfolio: 'data:text/html,x' })).toEqual([]);
  });
});
