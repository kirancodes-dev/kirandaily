import { afterEach, beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { CACHE_MAX_AGE_MS } from './cache';
import {
  eventsCoverageStart,
  EVENTS_MAX_PAGES,
  fetchGitHubCalendar,
  fetchGitHubRepos,
  fetchGitHubStats,
  gitHubMaxAge,
  gitHubStatsSchema,
  mergeGitHubStats,
  PARTIAL_RETRY_MS,
  pushEventsToDays,
  type GitHubStats,
} from './github';
import { IntegrationError } from './http';
import { fakeFetch, type Reply } from './testing';

const USER = 'https://api.github.com/users/kiran-dev';
const REPOS = `${USER}/repos?sort=pushed&per_page=5`;
const EVENTS = `${USER}/events/public?per_page=100`;
const GRAPH = 'https://github-contributions-api.jogruber.de/v4/kiran-dev?y=last';

const profile = {
  login: 'kiran-dev',
  name: 'Kiran',
  avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
  html_url: 'https://github.com/kiran-dev',
  public_repos: 12,
  followers: 34,
  following: 5,
  bio: 'ignored',
};
const repo = (name: string, pushed: string, extra: object = {}) => ({
  name,
  html_url: `https://github.com/kiran-dev/${name}`,
  description: `${name} description`,
  language: 'TypeScript',
  stargazers_count: 2,
  pushed_at: pushed,
  fork: false,
  ...extra,
});
const graph = {
  total: { lastYear: 7, 2026: 7 },
  contributions: [
    { date: '2026-10-03', count: 2, level: 1 },
    { date: '2026-10-04', count: 5, level: 3 },
    { date: 'not-a-date', count: 1, level: 1 },
  ],
};

function stub(routes: Record<string, Reply>) {
  const f = fakeFetch(routes);
  vi.stubGlobal('fetch', f.fetchImpl);
  return f.calls;
}

// Push events are bucketed by local day; pin the zone and "today" (Mon Oct 5, 2026, 7:45 PM in India)
// so the test means the same everywhere and on any date.
const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Asia/Kolkata';
});
afterAll(() => {
  process.env.TZ = zone;
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T19:45:00+05:30'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('GitHub stats', () => {
  it('loads and maps profile, recent repos and the contribution graph', async () => {
    const calls = stub({
      [USER]: { body: profile },
      [REPOS]: { body: [repo('old', '2026-09-01T10:00:00Z'), repo('new', '2026-10-04T10:00:00Z')] },
      [GRAPH]: { body: graph },
    });
    const stats = await fetchGitHubStats('kiran-dev');
    expect(stats.profile).toEqual({
      login: 'kiran-dev',
      name: 'Kiran',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      htmlUrl: 'https://github.com/kiran-dev',
      publicRepos: 12,
      followers: 34,
      following: 5,
    });
    expect(stats.repos!.map((r) => r.name)).toEqual(['new', 'old']);
    expect(stats.repos![0]).toEqual({
      name: 'new',
      htmlUrl: 'https://github.com/kiran-dev/new',
      description: 'new description',
      language: 'TypeScript',
      stars: 2,
      pushedAt: '2026-10-04T10:00:00Z',
    });
    expect(stats.calendar).toEqual({
      source: 'contributions',
      total: 7,
      days: [
        { date: '2026-10-03', count: 2 },
        { date: '2026-10-04', count: 5 },
      ],
    });
    expect(calls.map((c) => c.url).sort()).toEqual([GRAPH, USER, REPOS].sort());
    // The result is exactly what the cache schema accepts.
    expect(gitHubStatsSchema.safeParse(stats).success).toBe(true);
  });

  it('never builds a URL from an invalid username', async () => {
    const calls = stub({});
    for (const bad of ['../orgs/x', 'kiran dev', 'a?b=c', '']) {
      await expect(fetchGitHubStats(bad)).rejects.toMatchObject({ kind: 'invalid_username' });
    }
    expect(calls).toHaveLength(0);
  });

  it('only uses avatars from GitHub and links to github.com', async () => {
    stub({
      [USER]: { body: { ...profile, avatar_url: 'https://evil.example/a.png', html_url: 'javascript:alert(1)', name: null } },
      [REPOS]: { body: [repo('ok', '2026-10-01T00:00:00Z'), repo('bad', '2026-10-02T00:00:00Z', { html_url: 'javascript:alert(1)' })] },
      [GRAPH]: { body: graph },
    });
    const stats = await fetchGitHubStats('kiran-dev');
    expect(stats.profile.avatarUrl).toBeNull();
    expect(stats.profile.htmlUrl).toBe('https://github.com/kiran-dev');
    expect(stats.profile.name).toBeNull();
    expect(stats.repos!.map((r) => r.name)).toEqual(['ok']);
  });

  it('rejects a profile response in the wrong shape', async () => {
    stub({ [USER]: { body: { ...profile, followers: 'lots' } }, [REPOS]: { body: [] }, [GRAPH]: { body: graph } });
    await expect(fetchGitHubStats('kiran-dev')).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('says clearly when the user does not exist or the hourly limit is hit', async () => {
    stub({ [USER]: { status: 404 }, [REPOS]: { status: 404 }, [GRAPH]: { status: 404 } });
    await expect(fetchGitHubStats('kiran-dev')).rejects.toThrow('There’s no GitHub user named “kiran-dev”. Check the spelling.');

    stub({ [USER]: { status: 403 }, [REPOS]: { status: 403 }, [GRAPH]: { body: graph } });
    const err = await fetchGitHubStats('kiran-dev').catch((e: IntegrationError) => e);
    expect(err).toMatchObject({ kind: 'rate_limited' });
  });

  it('falls back to public push events (last 90 days) when the graph API fails', async () => {
    const calls = stub({
      [GRAPH]: { status: 502 },
      [EVENTS]: {
        body: [
          { type: 'PushEvent', created_at: '2026-10-04T18:30:00Z', payload: { size: 3 } }, // 00:00 Oct 5 in India
          { type: 'PushEvent', created_at: '2026-10-05T10:00:00Z', payload: { size: 2, commits: [{}, {}] } },
          { type: 'PushEvent', created_at: '2026-10-03T10:00:00Z', payload: { commits: [{}, {}, {}, {}] } },
          { type: 'PushEvent', created_at: '2026-10-02T10:00:00Z', payload: {} }, // no counts sent: one push = at least one commit
          { type: 'WatchEvent', created_at: '2026-10-05T11:00:00Z', payload: {} },
        ],
      },
    });
    const cal = await fetchGitHubCalendar('kiran-dev');
    expect(cal).toEqual({
      source: 'events',
      total: 10,
      days: [
        { date: '2026-10-02', count: 1 },
        { date: '2026-10-03', count: 4 },
        { date: '2026-10-05', count: 5 },
      ],
      // Fewer than 100 events: that's everything GitHub keeps (90 days).
      from: '2026-07-08',
    });
    expect(calls.map((c) => c.url)).toEqual([GRAPH, EVENTS]);
  });

  it('reads more pages of events for a busy account and says how far back they really go', async () => {
    // 100 events per page, 3 per day going back from Oct 5: page 1 reaches Oct 5 - 33 days, and so on.
    const page = (n: number) =>
      Array.from({ length: 100 }, (_, i) => {
        const k = (n - 1) * 100 + i;
        const day = Math.floor(k / 3);
        const at = new Date(Date.UTC(2026, 9, 5, 6) - day * 86_400_000).toISOString();
        return { type: k % 3 === 2 ? 'WatchEvent' : 'PushEvent', created_at: at, payload: { size: 1 } };
      });
    const calls = stub({
      [GRAPH]: { status: 502 },
      [EVENTS]: { body: page(1) },
      [`${EVENTS}&page=2`]: { body: page(2) },
      [`${EVENTS}&page=3`]: { body: page(3) },
    });
    const cal = await fetchGitHubCalendar('kiran-dev');
    expect(calls.map((c) => c.url)).toEqual([GRAPH, EVENTS, `${EVENTS}&page=2`, `${EVENTS}&page=3`]);
    expect(EVENTS_MAX_PAGES).toBe(3);
    // 300 events = 100 days of 3 (Oct 5 back to Jun 28) – capped at 90 days anyway.
    expect(cal.from).toBe('2026-07-08');

    // Page 2 fails: page 1 alone goes back to Sep 2 – cut off there, so the graph starts on Sep 3.
    stub({ [GRAPH]: { status: 502 }, [EVENTS]: { body: page(1) }, [`${EVENTS}&page=2`]: { status: 500 } });
    const partial = await fetchGitHubCalendar('kiran-dev');
    expect(partial.from).toBe('2026-09-03');
    expect(partial.days[0].date).toBe('2026-09-03');
    expect(partial.days).toHaveLength(33);
    expect(partial.days.every((d) => d.count === 2)).toBe(true);
    expect(partial.total).toBe(partial.days.length * 2);
  });

  it('works out the first day the events fully cover', () => {
    const ev = (at: string) => ({ type: 'PushEvent', created_at: at, payload: { size: 1 } });
    const today = '2026-10-05';
    expect(eventsCoverageStart([], false, today)).toBe('2026-07-08');
    expect(eventsCoverageStart([ev('2026-10-01T05:00:00Z')], true, today)).toBe('2026-07-08');
    // Cut off: the oldest event's day may be missing some, so it starts the day after.
    expect(eventsCoverageStart([ev('2026-10-04T05:00:00Z'), ev('2026-09-20T05:00:00Z')], false, today)).toBe('2026-09-21');
    // Never later than today, never earlier than 90 days.
    expect(eventsCoverageStart([ev('2026-10-05T05:00:00Z')], false, today)).toBe(today);
    expect(eventsCoverageStart([ev('2026-05-01T05:00:00Z')], false, today)).toBe('2026-07-08');
  });

  it('falls back when the graph API answers with something unexpected', async () => {
    stub({ [GRAPH]: { body: { error: 'oops' } }, [EVENTS]: { body: [] } });
    expect(await fetchGitHubCalendar('kiran-dev')).toEqual({ source: 'events', total: 0, days: [], from: '2026-07-08' });
  });

  it('still shows the profile when the repo list or the graph fail', async () => {
    stub({ [USER]: { body: profile }, [REPOS]: { status: 500 }, [GRAPH]: { status: 500 }, [EVENTS]: 'network-error' });
    const stats = await fetchGitHubStats('kiran-dev');
    expect(stats.profile.login).toBe('kiran-dev');
    expect(stats.repos).toBeNull();
    expect(stats.calendar).toBeNull();
  });

  it('keeps at most 5 repos', async () => {
    stub({ [REPOS]: { body: Array.from({ length: 8 }, (_, i) => repo(`r${i}`, `2026-10-0${i + 1}T00:00:00Z`)) } });
    expect(await fetchGitHubRepos('kiran-dev')).toHaveLength(5);
  });

  it('counts push commits per local day', () => {
    expect(
      pushEventsToDays([
        { type: 'PushEvent', created_at: '2026-10-05T01:00:00Z', payload: { size: 0 } },
        { type: 'PushEvent', created_at: '2026-10-05T02:00:00Z', payload: null },
      ]),
    ).toEqual([{ date: '2026-10-05', count: 1 }]);
  });
});

describe('keeping parts that failed to refresh', () => {
  const HOUR = 60 * 60 * 1000;
  const T = new Date('2026-10-05T19:45:00+05:30').getTime();
  const base: GitHubStats = {
    username: 'kiran-dev',
    profile: { login: 'kiran-dev', name: 'Kiran', avatarUrl: null, htmlUrl: 'https://github.com/kiran-dev', publicRepos: 1, followers: 1, following: 0 },
    repos: [{ name: 'a', htmlUrl: 'https://github.com/kiran-dev/a', description: null, language: null, stars: 0, pushedAt: null }],
    calendar: { source: 'contributions', total: 3, days: [{ date: '2026-10-04', count: 3 }] },
  };
  const next: GitHubStats = { ...base, profile: { ...base.profile, followers: 99 }, repos: null, calendar: null };

  it('keeps the cached graph and repos (and how old they are) when they fail', () => {
    const merged = mergeGitHubStats(next, { fetchedAt: T - 7 * HOUR, data: base });
    expect(merged.profile.followers).toBe(99);
    expect(merged.calendar).toEqual(base.calendar);
    expect(merged.repos).toEqual(base.repos);
    expect(merged.staleParts).toEqual({ calendar: T - 7 * HOUR, repos: T - 7 * HOUR });
    expect(gitHubStatsSchema.safeParse(merged).success).toBe(true);

    // Failing again later: the copy is still from 7 h before, not from the last attempt.
    const again = mergeGitHubStats(next, { fetchedAt: T - HOUR, data: merged });
    expect(again.staleParts).toEqual({ calendar: T - 7 * HOUR, repos: T - 7 * HOUR });
  });

  it('uses every part that did load, and drops the old-copy marks once all load', () => {
    const graphOnly = mergeGitHubStats({ ...next, repos: [] }, { fetchedAt: T - 7 * HOUR, data: base });
    expect(graphOnly.repos).toEqual([]);
    expect(graphOnly.staleParts).toEqual({ calendar: T - 7 * HOUR });
    const all = mergeGitHubStats(base, { fetchedAt: T - HOUR, data: graphOnly });
    expect(all.staleParts).toBeUndefined();
    expect(all).toEqual(base);
  });

  it('never mixes in another username’s data, and has nothing to keep on a first load', () => {
    expect(mergeGitHubStats(next, { fetchedAt: T, data: { ...base, username: 'someone-else' } })).toEqual(next);
    expect(mergeGitHubStats(next, null)).toEqual(next);
  });

  it('refreshes after 6 hours, or after 30 minutes when a part is missing or old', () => {
    expect(gitHubMaxAge(base)).toBe(CACHE_MAX_AGE_MS);
    expect(gitHubMaxAge(next)).toBe(PARTIAL_RETRY_MS);
    expect(gitHubMaxAge(mergeGitHubStats(next, { fetchedAt: T, data: base }))).toBe(PARTIAL_RETRY_MS);
    expect(gitHubMaxAge({ ...base, calendar: { source: 'events', total: 0, days: [], from: '2026-07-08' } })).toBe(PARTIAL_RETRY_MS);
    expect(PARTIAL_RETRY_MS).toBe(30 * 60 * 1000);
  });
});
