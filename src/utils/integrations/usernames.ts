/**
 * Usernames for the coding-profile integrations. They end up inside API URLs,
 * so only plain usernames are ever accepted.
 */

export type Service = 'github' | 'leetcode';

export const SERVICE_NAMES: Record<Service, string> = { github: 'GitHub', leetcode: 'LeetCode' };

/** Letters, digits, "-" and "_", 1–39 characters (GitHub's limit; LeetCode's is shorter). */
export const USERNAME_RE = /^[A-Za-z0-9_-]{1,39}$/;

export function isValidUsername(value: unknown): value is string {
  return typeof value === 'string' && USERNAME_RE.test(value);
}

const HOSTS: Record<Service, RegExp> = {
  github: /^(www\.)?github\.com\//i,
  leetcode: /^(www\.)?leetcode\.(com|cn)\/(u\/|profile\/)?/i,
};

/**
 * Turns what people type or paste into a bare username:
 * "@kiran", "github.com/kiran", "https://leetcode.com/u/kiran/" → "kiran".
 * Returns null when the result isn't a valid username (or the link is for another site).
 */
export function normalizeUsername(input: string, service: Service): string | null {
  let s = input.trim().replace(/^https?:\/\//i, '');
  s = s.replace(HOSTS[service], '');
  s = s.replace(/^@/, '').split(/[/?#]/)[0];
  return isValidUsername(s) ? s : null;
}

/** Public profile page. The username is validated and encoded before it goes into the URL. */
export function profileUrl(service: Service, username: string): string | null {
  if (!isValidUsername(username)) return null;
  const u = encodeURIComponent(username);
  return service === 'github' ? `https://github.com/${u}` : `https://leetcode.com/u/${u}/`;
}
