// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { cacheKey, type CacheEntry } from '../utils/integrations/cache';
import { IntegrationError } from '../utils/integrations/http';
import { useCodingStats, type CodingStatsState, type Source } from './useCodingStats';

/**
 * The hook in a real (jsdom) React tree, with a fetcher the test answers by hand:
 * what the card shows while requests overlap, the app is reopened, the username
 * changes or the page stays open.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Data = { username: string; followers: number };
type Result = CodingStatsState<Data> & { refresh: () => void };

const HOUR = 60 * 60 * 1000;
const schema = z.object({ username: z.string(), followers: z.number() });

/** A fetcher whose answers the test controls: each call waits until answered. */
function controlledSource(extra: Partial<Source<Data>> = {}) {
  const pending: { user: string; resolve: (d: Data) => void; reject: (e: unknown) => void }[] = [];
  const fetcher = vi.fn(
    (user: string) =>
      new Promise<Data>((resolve, reject) => {
        pending.push({ user, resolve, reject });
      }),
  );
  const source: Source<Data> = { service: 'github', fetcher, schema, ...extra };
  /** Answers the oldest open request for `user`. */
  const answer = async (user: string, data: Data | Error) => {
    const i = pending.findIndex((p) => p.user === user);
    if (i < 0) throw new Error(`no open request for ${user}`);
    const [p] = pending.splice(i, 1);
    await act(async () => {
      if (data instanceof Error) p.reject(data);
      else p.resolve(data);
    });
  };
  return { source, fetcher, answer, pending };
}

function render(source: Source<Data>, username: string | null) {
  const result: { current: Result | null } = { current: null };
  function Probe({ user }: { user: string | null }) {
    result.current = useCodingStats(source, user);
    return null;
  }
  const root = createRoot(document.createElement('div'));
  act(() => root.render(createElement(Probe, { user: username })));
  return {
    get state(): Result {
      return result.current!;
    },
    rerender: (user: string | null) => act(() => root.render(createElement(Probe, { user }))),
    unmount: () => act(() => root.unmount()),
  };
}

const seed = (user: string, entry: CacheEntry<Data>) => localStorage.setItem(cacheKey('github', user), JSON.stringify(entry));
const cached = (user: string) => JSON.parse(localStorage.getItem(cacheKey('github', user)) ?? 'null') as CacheEntry<Data> | null;
const reopenApp = () => act(() => void document.dispatchEvent(new Event('visibilitychange')));

let unmount: (() => void) | null = null;
beforeEach(() => localStorage.clear());
afterEach(() => {
  unmount?.();
  unmount = null;
  vi.useRealTimers();
});

describe('useCodingStats', () => {
  it('shows a fresh cache without any request', () => {
    seed('fresh-user', { fetchedAt: Date.now() - HOUR, data: { username: 'fresh-user', followers: 1 } });
    const { source, fetcher } = controlledSource();
    const view = render(source, 'fresh-user');
    unmount = view.unmount;
    expect(view.state).toMatchObject({ data: { followers: 1 }, loading: false, error: null });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('Refresh, then reopening the app while it runs, still shows the new numbers', async () => {
    seed('refresh-user', { fetchedAt: Date.now() - HOUR, data: { username: 'refresh-user', followers: 1 } });
    const { source, fetcher, answer } = controlledSource();
    const view = render(source, 'refresh-user');
    unmount = view.unmount;
    act(() => view.state.refresh());
    expect(view.state.loading).toBe(true);
    // Switch to LeetCode and back: the check joins the running refresh instead of ending it.
    reopenApp();
    expect(view.state.loading).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await answer('refresh-user', { username: 'refresh-user', followers: 99 });
    expect(view.state).toMatchObject({ data: { followers: 99 }, loading: false, slow: false, error: null });
    expect(Date.now() - view.state.fetchedAt!).toBeLessThan(60_000);
    expect(cached('refresh-user')!.data.followers).toBe(99);
  });

  it('a failed refresh keeps the shown data and says why', async () => {
    seed('fail-user', { fetchedAt: Date.now() - 7 * HOUR, data: { username: 'fail-user', followers: 1 } });
    const { source, answer } = controlledSource();
    const view = render(source, 'fail-user');
    unmount = view.unmount;
    expect(view.state.loading).toBe(true); // 7 h old: refreshes on open
    await answer('fail-user', new IntegrationError('rate_limited', 'GitHub is busy.'));
    expect(view.state).toMatchObject({ data: { followers: 1 }, loading: false, error: { kind: 'rate_limited' } });
    expect(cached('fail-user')!.data.followers).toBe(1);
  });

  it('merges a new answer with the cached one before saving it', async () => {
    seed('merge-user', { fetchedAt: Date.now() - 7 * HOUR, data: { username: 'merge-user', followers: 5 } });
    const merge = vi.fn((next: Data, prev: CacheEntry<Data> | null) => ({ ...next, followers: next.followers + (prev?.data.followers ?? 0) }));
    const { source, answer } = controlledSource({ merge });
    const view = render(source, 'merge-user');
    unmount = view.unmount;
    await answer('merge-user', { username: 'merge-user', followers: 1 });
    expect(merge).toHaveBeenCalledOnce();
    expect(view.state.data!.followers).toBe(6);
    expect(cached('merge-user')!.data.followers).toBe(6);
  });

  it('a slow answer for a previous username neither shows nor replaces the new one’s cache', async () => {
    const { source, answer } = controlledSource();
    const view = render(source, 'old-name');
    unmount = view.unmount;
    view.rerender('new-name');
    expect(view.state).toMatchObject({ user: 'new-name', data: null, loading: true });
    await answer('new-name', { username: 'new-name', followers: 2 });
    await answer('old-name', { username: 'old-name', followers: 1 });
    expect(view.state).toMatchObject({ user: 'new-name', data: { followers: 2 }, loading: false });
    expect(cached('new-name')!.data.followers).toBe(2);
    expect(cached('old-name')).toBeNull();
  });

  it('a page left open refreshes by itself once the data is due', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date('2026-10-05T19:45:00+05:30'));
    seed('open-user', { fetchedAt: Date.now() - 5 * HOUR, data: { username: 'open-user', followers: 1 } });
    const { source, fetcher, answer } = controlledSource();
    const view = render(source, 'open-user');
    unmount = view.unmount;
    expect(fetcher).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(59 * 60_000));
    expect(fetcher).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(2 * 60_000));
    expect(fetcher).toHaveBeenCalledTimes(1);
    await answer('open-user', { username: 'open-user', followers: 7 });
    expect(view.state).toMatchObject({ data: { followers: 7 }, loading: false });
    // …and again 6 hours after that.
    act(() => void vi.advanceTimersByTime(6 * HOUR + 2000));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('retries sooner when the source says the data is incomplete', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date('2026-10-05T19:45:00+05:30'));
    seed('partial-user', { fetchedAt: Date.now() - 20 * 60_000, data: { username: 'partial-user', followers: 0 } });
    const { source, fetcher } = controlledSource({ maxAge: (d) => (d.followers === 0 ? 30 * 60_000 : 6 * HOUR) });
    const view = render(source, 'partial-user');
    unmount = view.unmount;
    expect(fetcher).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(11 * 60_000));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('says "this can take a while" after a few seconds', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { source, answer } = controlledSource();
    const view = render(source, 'slow-user');
    unmount = view.unmount;
    expect(view.state).toMatchObject({ loading: true, slow: false });
    act(() => void vi.advanceTimersByTime(3000));
    expect(view.state.slow).toBe(true);
    await answer('slow-user', { username: 'slow-user', followers: 1 });
    expect(view.state).toMatchObject({ loading: false, slow: false });
  });

  it('offline: shows the cache and asks nothing', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      seed('offline-user', { fetchedAt: Date.now() - 7 * HOUR, data: { username: 'offline-user', followers: 3 } });
      const { source, fetcher } = controlledSource();
      const view = render(source, 'offline-user');
      unmount = view.unmount;
      expect(view.state).toMatchObject({ data: { followers: 3 }, offline: true, loading: false });
      act(() => view.state.refresh());
      expect(fetcher).not.toHaveBeenCalled();
      expect(view.state.offline).toBe(true);
    } finally {
      onLine.mockRestore();
    }
  });

  it('no username: nothing to load', () => {
    const { source, fetcher } = controlledSource();
    const view = render(source, null);
    unmount = view.unmount;
    act(() => view.state.refresh());
    expect(view.state).toMatchObject({ user: null, data: null, loading: false });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
