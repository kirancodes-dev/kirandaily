import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { fetchGitHubCalendar, fetchGitHubRepos, fetchGitHubStats, gitHubStatsSchema, pushEventsToDays } from './github';
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

// Push events are bucketed by local day; pin the zone so the test means the same everywhere.
const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Asia/Kolkata';
});
afterAll(() => {
  process.env.TZ = zone;
});
afterEach(() => vi.unstubAllGlobals());

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
    });
    expect(calls.map((c) => c.url)).toEqual([GRAPH, EVENTS]);
  });

  it('falls back when the graph API answers with something unexpected', async () => {
    stub({ [GRAPH]: { body: { error: 'oops' } }, [EVENTS]: { body: [] } });
    expect(await fetchGitHubCalendar('kiran-dev')).toEqual({ source: 'events', total: 0, days: [] });
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
