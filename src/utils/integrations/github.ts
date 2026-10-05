import { z } from 'zod';
import { addDays, isValidISODate, toISODate, todayISO } from '../date';
import { CACHE_MAX_AGE_MS, type CacheEntry } from './cache';
import { dayCountSchema, type DayCount } from './contrib';
import { fetchValidated, IntegrationError, type RequestOptions } from './http';
import { isValidUsername, profileUrl } from './usernames';

/**
 * GitHub stats from public, CORS-enabled APIs (no token, 60 requests/hour per network):
 * the REST API for the profile and recent repos, and github-contributions-api.jogruber.de
 * for the contribution graph – falling back to public push events (last 90 days).
 */

const API = 'https://api.github.com';
const CONTRIBUTIONS_API = 'https://github-contributions-api.jogruber.de/v4';
const HEADERS = { Accept: 'application/vnd.github+json' };
const AVATAR_PREFIX = 'https://avatars.githubusercontent.com/';
const GITHUB_PREFIX = 'https://github.com/';

export interface GitHubProfile {
  login: string;
  name: string | null;
  /** Only GitHub's own avatar host is ever used. */
  avatarUrl: string | null;
  htmlUrl: string;
  publicRepos: number;
  followers: number;
  following: number;
}

export interface GitHubRepo {
  name: string;
  htmlUrl: string;
  description: string | null;
  language: string | null;
  stars: number;
  /** ISO timestamp of the last push. */
  pushedAt: string | null;
}

export interface ContributionCalendar {
  /** "contributions" = full last-year graph; "events" = public pushes of the last 90 days. */
  source: 'contributions' | 'events';
  total: number;
  days: DayCount[];
  /**
   * Events only: first local date the events fully cover. GitHub keeps 90 days of
   * events but at most 300 of them, so a busy account's history starts later.
   */
  from?: string;
}

export interface GitHubStats {
  username: string;
  profile: GitHubProfile;
  /** null when the repo list couldn't be loaded. */
  repos: GitHubRepo[] | null;
  /** null when neither the graph API nor the events fallback answered. */
  calendar: ContributionCalendar | null;
  /**
   * Parts that failed in the last refresh and show an older copy instead,
   * with when that copy was loaded (epoch ms). See mergeGitHubStats.
   */
  staleParts?: { repos?: number; calendar?: number };
}

/** A refresh where a part failed is retried this soon (instead of after 6 hours). */
export const PARTIAL_RETRY_MS = 30 * 60 * 1000;
/** Public events per page (the most GitHub allows) and pages read (GitHub keeps at most 300 events). */
export const EVENTS_PER_PAGE = 100;
export const EVENTS_MAX_PAGES = 3;

/* ───────────── API responses (never trusted) ───────────── */

const count = z.number().int().min(0);
const text = (max: number) => z.string().max(max);

const userResponse = z.object({
  login: z.string().regex(/^[A-Za-z0-9-]{1,39}$/),
  name: text(255).nullable().optional(),
  avatar_url: text(500).nullable().optional(),
  html_url: text(500),
  public_repos: count,
  followers: count,
  following: count,
});

const repoResponse = z.object({
  name: text(200),
  html_url: text(500),
  description: text(2000).nullable().optional(),
  language: text(100).nullable().optional(),
  stargazers_count: count,
  pushed_at: z.string().datetime({ offset: true }).nullable().optional(),
});

const contributionsResponse = z.object({
  total: z.object({ lastYear: count }),
  contributions: z
    .array(z.object({ date: z.string(), count, level: z.number().int().min(0).max(4).optional() }))
    .max(800),
});

const eventsResponse = z
  .array(
    z.object({
      type: z.string(),
      created_at: z.string().datetime({ offset: true }),
      payload: z
        .object({ size: count.optional(), commits: z.array(z.unknown()).optional() })
        .nullable()
        .optional(),
    }),
  )
  .max(300);

/* ───────────── Normalised data (also used to validate the device cache) ───────────── */

export const gitHubStatsSchema: z.ZodType<GitHubStats, z.ZodTypeDef, unknown> = z.object({
  username: z.string(),
  profile: z.object({
    login: z.string(),
    name: z.string().nullable(),
    avatarUrl: z.string().startsWith(AVATAR_PREFIX).nullable(),
    htmlUrl: z.string().startsWith(GITHUB_PREFIX),
    publicRepos: count,
    followers: count,
    following: count,
  }),
  repos: z
    .array(
      z.object({
        name: z.string(),
        htmlUrl: z.string().startsWith(GITHUB_PREFIX),
        description: z.string().nullable(),
        language: z.string().nullable(),
        stars: count,
        pushedAt: z.string().nullable(),
      }),
    )
    .nullable(),
  calendar: z
    .object({
      source: z.enum(['contributions', 'events']),
      total: count,
      days: z.array(dayCountSchema),
      from: z.string().refine(isValidISODate).optional(),
    })
    .nullable(),
  staleParts: z.object({ repos: z.number().optional(), calendar: z.number().optional() }).optional(),
});

function checkUsername(username: string): string {
  if (!isValidUsername(username)) {
    throw new IntegrationError('invalid_username', 'That isn’t a valid GitHub username (letters, numbers and - only).');
  }
  return encodeURIComponent(username);
}

const safeLink = (url: string) => (url.startsWith(GITHUB_PREFIX) ? url : null);

export async function fetchGitHubProfile(username: string, opts: RequestOptions = {}): Promise<GitHubProfile> {
  const u = checkUsername(username);
  const res = await fetchValidated(`${API}/users/${u}`, userResponse, {
    ...opts,
    service: 'GitHub',
    headers: HEADERS,
    notFound: `There’s no GitHub user named “${username}”. Check the spelling.`,
  });
  return {
    login: res.login,
    name: res.name?.trim() || null,
    avatarUrl: res.avatar_url && res.avatar_url.startsWith(AVATAR_PREFIX) ? res.avatar_url : null,
    htmlUrl: safeLink(res.html_url) ?? profileUrl('github', res.login)!,
    publicRepos: res.public_repos,
    followers: res.followers,
    following: res.following,
  };
}

/** The 5 most recently pushed public repos. */
export async function fetchGitHubRepos(username: string, opts: RequestOptions = {}): Promise<GitHubRepo[]> {
  const u = checkUsername(username);
  const res = await fetchValidated(`${API}/users/${u}/repos?sort=pushed&per_page=5`, z.array(repoResponse).max(100), {
    ...opts,
    service: 'GitHub',
    headers: HEADERS,
  });
  return res
    .filter((r) => safeLink(r.html_url))
    .map((r) => ({
      name: r.name,
      htmlUrl: r.html_url,
      description: r.description?.trim() || null,
      language: r.language || null,
      stars: r.stargazers_count,
      pushedAt: r.pushed_at ?? null,
    }))
    .sort((a, b) => (b.pushedAt ?? '').localeCompare(a.pushedAt ?? ''))
    .slice(0, 5);
}

type PublicEvent = z.infer<typeof eventsResponse>[number];

/** Commits per local day from public push events (GitHub keeps ~90 days of them). */
export function pushEventsToDays(events: PublicEvent[]): DayCount[] {
  const byDate = new Map<string, number>();
  for (const e of events) {
    if (e.type !== 'PushEvent') continue;
    // GitHub stopped sending commit counts for some events; a push has at least one commit.
    const commits = e.payload?.size ?? e.payload?.commits?.length ?? 1;
    if (commits <= 0) continue;
    const date = toISODate(new Date(e.created_at));
    byDate.set(date, (byDate.get(date) ?? 0) + commits);
  }
  return [...byDate.entries()].map(([date, n]) => ({ date, count: n })).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * First local date the events fully cover. With every event GitHub keeps (`complete`)
 * that's the last 90 days; when the list was cut off, the day of the oldest event may
 * be missing some, so coverage starts the day after it.
 */
export function eventsCoverageStart(events: PublicEvent[], complete: boolean, today: string): string {
  const ninetyDays = addDays(today, -89);
  if (complete || events.length === 0) return ninetyDays;
  const oldest = events.reduce((min, e) => (e.created_at < min ? e.created_at : min), events[0].created_at);
  const from = addDays(toISODate(new Date(oldest)), 1);
  return from > today ? today : from < ninetyDays ? ninetyDays : from;
}

/** Commits per day from public push events, as far back as GitHub still has them. */
async function fetchPushActivity(u: string, opts: RequestOptions): Promise<ContributionCalendar> {
  const events: PublicEvent[] = [];
  let complete = false;
  for (let page = 1; page <= EVENTS_MAX_PAGES; page++) {
    const url = `${API}/users/${u}/events/public?per_page=${EVENTS_PER_PAGE}${page > 1 ? `&page=${page}` : ''}`;
    let batch: PublicEvent[];
    try {
      batch = await fetchValidated(url, eventsResponse, { ...opts, service: 'GitHub', headers: HEADERS });
    } catch (err) {
      if (page === 1) throw err;
      break; // keep what the earlier pages had; the coverage date says how far back it goes
    }
    events.push(...batch);
    if (batch.length < EVENTS_PER_PAGE) {
      complete = true;
      break;
    }
  }
  const from = eventsCoverageStart(events, complete, todayISO());
  const days = pushEventsToDays(events).filter((d) => d.date >= from);
  return { source: 'events', total: days.reduce((s, d) => s + d.count, 0), days, from };
}

/** Last-year contribution graph, or recent push activity when the graph API is down. */
export async function fetchGitHubCalendar(username: string, opts: RequestOptions = {}): Promise<ContributionCalendar> {
  const u = checkUsername(username);
  try {
    const res = await fetchValidated(`${CONTRIBUTIONS_API}/${u}?y=last`, contributionsResponse, {
      ...opts,
      service: 'The GitHub contributions service',
    });
    const days = res.contributions
      .filter((d) => dayCountSchema.safeParse({ date: d.date, count: d.count }).success)
      .map((d) => ({ date: d.date, count: d.count }));
    return { source: 'contributions', total: res.total.lastYear, days };
  } catch (err) {
    if (err instanceof IntegrationError && err.kind === 'aborted') throw err;
    return fetchPushActivity(u, opts);
  }
}

/**
 * Everything the GitHub card shows. The profile is required; the repo list and
 * the graph are optional (null when they fail) so one flaky API doesn't hide the rest.
 */
export async function fetchGitHubStats(username: string, opts: RequestOptions = {}): Promise<GitHubStats> {
  checkUsername(username);
  const [profile, repos, calendar] = await Promise.allSettled([
    fetchGitHubProfile(username, opts),
    fetchGitHubRepos(username, opts),
    fetchGitHubCalendar(username, opts),
  ]);
  if (profile.status === 'rejected') throw profile.reason;
  return {
    username,
    profile: profile.value,
    repos: repos.status === 'fulfilled' ? repos.value : null,
    calendar: calendar.status === 'fulfilled' ? calendar.value : null,
  };
}

/**
 * A refresh where the repo list or the graph failed keeps the previously cached copy
 * of that part (a failed refresh never wipes data), remembering how old it is so the
 * card can say so and the next refresh comes soon.
 */
export function mergeGitHubStats(next: GitHubStats, previous: CacheEntry<GitHubStats> | null): GitHubStats {
  const fresh: GitHubStats = { username: next.username, profile: next.profile, repos: next.repos, calendar: next.calendar };
  const prev = previous && previous.data.username.toLowerCase() === next.username.toLowerCase() ? previous : null;
  const staleParts: NonNullable<GitHubStats['staleParts']> = {};
  let repos = fresh.repos;
  let calendar = fresh.calendar;
  if (repos === null && prev?.data.repos) {
    repos = prev.data.repos;
    staleParts.repos = prev.data.staleParts?.repos ?? prev.fetchedAt;
  }
  if (calendar === null && prev?.data.calendar) {
    calendar = prev.data.calendar;
    staleParts.calendar = prev.data.staleParts?.calendar ?? prev.fetchedAt;
  }
  return { ...fresh, repos, calendar, ...(Object.keys(staleParts).length > 0 ? { staleParts } : {}) };
}

/**
 * How long cached GitHub stats count as fresh: 6 hours, or 30 minutes when a part is
 * missing or old (failed refresh, or the graph came from the 90-day events fallback).
 */
export function gitHubMaxAge(stats: GitHubStats): number {
  const partial = stats.repos === null || stats.calendar === null || stats.calendar.source === 'events' || !!stats.staleParts;
  return partial ? PARTIAL_RETRY_MS : CACHE_MAX_AGE_MS;
}
