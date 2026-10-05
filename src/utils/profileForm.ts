/**
 * Profile form: validation, friendly clean-up of pasted usernames/URLs and
 * safe link building for the profile header. Pure (unit tested).
 */
import type { ProfileExtra } from '../types/extras';
import { normalizeUsername as profileUsername } from './integrations/usernames';

/** GitHub / LeetCode usernames: letters, digits, "_" and "-", up to 39 chars. */
export const USERNAME_RE = /^[A-Za-z0-9_-]{1,39}$/;

/** Same limits as the data schema. */
export const PROFILE_LIMITS = {
  name: 60,
  headline: 120,
  college: 160,
  bio: 1000,
  url: 300,
} as const;

export interface ProfileFormValues {
  name: string;
  headline: string;
  college: string;
  /** '' = not set, otherwise '1'…'12'. */
  semester: string;
  bio: string;
  github: string;
  leetcode: string;
  linkedin: string;
  portfolio: string;
}

export type ProfileFormErrors = Partial<Record<keyof ProfileFormValues, string>>;

export interface ProfileFormResult {
  errors: ProfileFormErrors;
  /** Present only when there are no errors. */
  value?: { name: string; extra: Omit<ProfileExtra, 'photo'> };
}

export function formValuesFrom(name: string, extra: ProfileExtra): ProfileFormValues {
  return {
    name,
    headline: extra.headline,
    college: extra.college,
    semester: extra.semester === null ? '' : String(extra.semester),
    bio: extra.bio,
    github: extra.links.github,
    leetcode: extra.links.leetcode,
    linkedin: extra.links.linkedin,
    portfolio: extra.links.portfolio,
  };
}

/**
 * "https://github.com/kiran/" or "@kiran" → "kiran". Anything that isn't a
 * link to one of `hosts` is returned trimmed (and then validated as is).
 */
export function normalizeUsername(input: string, hosts: string[]): string {
  let s = input.trim();
  if (!s) return '';
  const withScheme = /^https?:\/\//i.test(s) ? s : /^(www\.)?[a-z0-9.-]+\.[a-z]{2,}\//i.test(s) ? `https://${s}` : '';
  if (withScheme) {
    try {
      const url = new URL(withScheme);
      const host = url.hostname.toLowerCase().replace(/^www\./, '');
      if (hosts.includes(host)) {
        // leetcode.com/u/name/ and leetcode.com/name/ both work.
        const parts = url.pathname.split('/').filter(Boolean);
        const user = parts[0] === 'u' ? parts[1] : parts[0];
        if (user) s = user;
      }
    } catch {
      /* not a URL — validate as typed */
    }
  }
  return s.replace(/^@/, '');
}

export function isValidUsername(value: string): boolean {
  return USERNAME_RE.test(value);
}

/** True for absolute http(s) URLs with a real-looking host. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && /^[^.\s]+(\.[^.\s]+)+$|^localhost$/i.test(url.hostname);
  } catch {
    return false;
  }
}

/** "linkedin.com/in/kiran" → "https://linkedin.com/in/kiran" (only when there's no scheme yet). */
export function normalizeUrl(input: string): string {
  const s = input.trim();
  if (!s) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(s)) return `https://${s}`;
  return s;
}

export const githubUrl = (user: string) => `https://github.com/${encodeURIComponent(user)}`;
export const leetcodeUrl = (user: string) => `https://leetcode.com/u/${encodeURIComponent(user)}/`;

const cleanName = (input: string) => input.trim().replace(/\s+/g, ' ');

/**
 * The display name (used by Edit profile and Settings): trimmed, spaces
 * collapsed, not empty, at most PROFILE_LIMITS.name characters. A longer name
 * that is already saved (`current`, e.g. from an older version) is accepted
 * as it is, so it never blocks saving the other fields.
 */
export function validateName(input: string, current?: string): { name: string; error: string | null } {
  const name = cleanName(input);
  if (!name) return { name, error: 'Name can’t be empty.' };
  if (name.length > PROFILE_LIMITS.name && (current === undefined || name !== cleanName(current))) {
    return { name, error: `Keep it under ${PROFILE_LIMITS.name} characters.` };
  }
  return { name, error: null };
}

const NOT_A_PROFILE = 'That link isn’t a profile — enter just your username.';

/** Checks and cleans the form. Empty optional fields are fine. `currentName` = the name saved now. */
export function validateProfileForm(v: ProfileFormValues, currentName?: string): ProfileFormResult {
  const errors: ProfileFormErrors = {};
  const { name, error: nameError } = validateName(v.name, currentName);
  if (nameError) errors.name = nameError;

  const headline = v.headline.trim();
  if (headline.length > PROFILE_LIMITS.headline) errors.headline = `Keep it under ${PROFILE_LIMITS.headline} characters.`;
  const college = v.college.trim();
  if (college.length > PROFILE_LIMITS.college) errors.college = `Keep it under ${PROFILE_LIMITS.college} characters.`;
  const bio = v.bio.trim();
  if (bio.length > PROFILE_LIMITS.bio) errors.bio = `Keep it under ${PROFILE_LIMITS.bio} characters.`;

  let semester: number | null = null;
  if (v.semester.trim()) {
    const n = Number(v.semester);
    if (!Number.isInteger(n) || n < 1 || n > 12) errors.semester = 'Semester must be between 1 and 12.';
    else semester = n;
  }

  // The coding-profile cards read the same fields, so a link to a page that isn't a
  // profile ("github.com/settings", a LeetCode problem) is refused here as it is there.
  const github = normalizeUsername(v.github, ['github.com']);
  if (github && !isValidUsername(github)) errors.github = 'Use only letters, numbers, - and _ (max 39).';
  else if (github && profileUsername(v.github, 'github') === null) errors.github = NOT_A_PROFILE;
  const leetcode = normalizeUsername(v.leetcode, ['leetcode.com']);
  if (leetcode && !isValidUsername(leetcode)) errors.leetcode = 'Use only letters, numbers, - and _ (max 39).';
  else if (leetcode && profileUsername(v.leetcode, 'leetcode') === null) errors.leetcode = NOT_A_PROFILE;

  const linkedin = normalizeUrl(v.linkedin);
  if (linkedin && (!isHttpUrl(linkedin) || linkedin.length > PROFILE_LIMITS.url)) errors.linkedin = 'Enter a full link starting with https://';
  const portfolio = normalizeUrl(v.portfolio);
  if (portfolio && (!isHttpUrl(portfolio) || portfolio.length > PROFILE_LIMITS.url)) errors.portfolio = 'Enter a full link starting with https://';

  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    value: { name, extra: { headline, college, semester, bio, links: { github, leetcode, linkedin, portfolio } } },
  };
}

export type ProfileLinkId = 'github' | 'leetcode' | 'linkedin' | 'portfolio';

export interface ProfileLink {
  id: ProfileLinkId;
  label: string;
  /** Short text shown on the chip. */
  detail: string;
  href: string;
}

/** Links to show on the profile. Anything invalid (e.g. edited by hand in a backup) is left out. */
export function profileLinks(links: ProfileExtra['links']): ProfileLink[] {
  const out: ProfileLink[] = [];
  if (isValidUsername(links.github)) out.push({ id: 'github', label: 'GitHub', detail: links.github, href: githubUrl(links.github) });
  if (isValidUsername(links.leetcode)) out.push({ id: 'leetcode', label: 'LeetCode', detail: links.leetcode, href: leetcodeUrl(links.leetcode) });
  if (isHttpUrl(links.linkedin)) out.push({ id: 'linkedin', label: 'LinkedIn', detail: shortUrl(links.linkedin), href: links.linkedin });
  if (isHttpUrl(links.portfolio)) out.push({ id: 'portfolio', label: 'Portfolio', detail: shortUrl(links.portfolio), href: links.portfolio });
  return out;
}

/** "https://www.kiran.dev/work/" → "kiran.dev/work" */
export function shortUrl(href: string): string {
  try {
    const url = new URL(href);
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.hostname.replace(/^www\./, '')}${path}`;
  } catch {
    return href;
  }
}
