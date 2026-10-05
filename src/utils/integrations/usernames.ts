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
 * First path segments of links that aren't profiles ("github.com/settings/…",
 * "leetcode.com/problems/two-sum/"). Neither site lets anyone register these names.
 */
const RESERVED: Record<Service, Set<string>> = {
  github: new Set(
    'about account apps blog codespaces collections contact copilot customer-stories dashboard enterprise events explore features gist issues join login logout marketplace new notifications organizations orgs pricing pulls readme search security sessions settings signup site sponsors stars team topics trending users watching'.split(
      ' ',
    ),
  ),
  leetcode: new Set(
    'accounts assessment company contest discuss explore interview jobs list notifications playground premium problems problemset progress store studyplan subscribe submissions support tag'.split(
      ' ',
    ),
  ),
};

/**
 * Turns what people type or paste into a bare username:
 * "@kiran", "github.com/kiran", "https://leetcode.com/u/kiran/" → "kiran".
 * Returns null when the result isn't a valid username, the link is for another site,
 * or it's a link to a page that isn't a profile (e.g. a LeetCode problem).
 */
export function normalizeUsername(input: string, service: Service): string | null {
  let s = input.trim().replace(/^https?:\/\//i, '');
  const isLink = HOSTS[service].test(s);
  s = s.replace(HOSTS[service], '');
  s = s.replace(/^@/, '').split(/[/?#]/)[0];
  if (isLink && RESERVED[service].has(s.toLowerCase())) return null;
  return isValidUsername(s) ? s : null;
}

/** Public profile page. The username is validated and encoded before it goes into the URL. */
export function profileUrl(service: Service, username: string): string | null {
  if (!isValidUsername(username)) return null;
  const u = encodeURIComponent(username);
  return service === 'github' ? `https://github.com/${u}` : `https://leetcode.com/u/${u}/`;
}
