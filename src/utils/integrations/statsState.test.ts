import { describe, expect, it } from 'vitest';
import { IntegrationError } from './http';
import { initialStatsState, planRefresh, statsReducer, type StatsAction, type StatsState } from './statsState';

type Data = { followers: number };
const HOUR = 60 * 60 * 1000;
const NOW = new Date(2026, 9, 5, 19, 45).getTime();
const reduce = (state: StatsState<Data>, ...actions: StatsAction<Data>[]) => actions.reduce(statsReducer<Data>, state);
const cachedState = () => initialStatsState<Data>('kiran', { fetchedAt: NOW - HOUR, data: { followers: 1 } }, false);
const down = new IntegrationError('network', 'Couldn’t reach GitHub.');

describe('coding stats state', () => {
  it('starts from the cache', () => {
    expect(cachedState()).toEqual({
      user: 'kiran',
      data: { followers: 1 },
      fetchedAt: NOW - HOUR,
      loading: false,
      slow: false,
      error: null,
      offline: false,
    });
    expect(initialStatsState(null, null, true)).toMatchObject({ user: null, data: null, fetchedAt: null, offline: true });
  });

  it('shows a refresh result and clears an earlier error', () => {
    const s = reduce(
      cachedState(),
      { type: 'start', user: 'kiran' },
      { type: 'failure', user: 'kiran', error: down },
      { type: 'start', user: 'kiran' },
      { type: 'slow', user: 'kiran' },
    );
    expect(s).toMatchObject({ loading: true, slow: true, error: down, data: { followers: 1 } });
    const done = reduce(s, { type: 'success', user: 'kiran', entry: { fetchedAt: NOW, data: { followers: 99 } } });
    expect(done).toMatchObject({ loading: false, slow: false, error: null, data: { followers: 99 }, fetchedAt: NOW });
  });

  it('keeps the shown data when a refresh fails', () => {
    const s = reduce(cachedState(), { type: 'start', user: 'kiran' }, { type: 'failure', user: 'kiran', error: down });
    expect(s).toMatchObject({ loading: false, error: down, data: { followers: 1 }, fetchedAt: NOW - HOUR });
  });

  it('a second check while a refresh runs keeps waiting for it (Refresh, then the app is reopened)', () => {
    // The hook joins the running request: "start" again, then its result arrives.
    const s = reduce(
      cachedState(),
      { type: 'start', user: 'kiran' },
      { type: 'slow', user: 'kiran' },
      { type: 'start', user: 'kiran' },
    );
    expect(s).toMatchObject({ loading: true, slow: true });
    expect(reduce(s, { type: 'success', user: 'kiran', entry: { fetchedAt: NOW, data: { followers: 99 } } })).toMatchObject({
      loading: false,
      data: { followers: 99 },
    });
  });

  it('a check with a fresh cache never leaves the card loading, and picks up a newer cached copy', () => {
    const loading = reduce(cachedState(), { type: 'start', user: 'kiran' });
    expect(reduce(loading, { type: 'cached', user: 'kiran', cached: null })).toMatchObject({ loading: false, data: { followers: 1 } });
    const newer = reduce(loading, { type: 'cached', user: 'kiran', cached: { fetchedAt: NOW, data: { followers: 5 } } });
    expect(newer).toMatchObject({ loading: false, data: { followers: 5 }, fetchedAt: NOW });
    // An older cached copy never replaces what's shown.
    const shown = reduce(newer, { type: 'cached', user: 'kiran', cached: { fetchedAt: NOW - 2 * HOUR, data: { followers: 0 } } });
    expect(shown.data).toEqual({ followers: 5 });
  });

  it('ignores results for a username the card no longer shows', () => {
    const switched = reduce(cachedState(), { type: 'start', user: 'kiran' }, { type: 'reset', user: 'other', cached: null, offline: false });
    expect(switched).toMatchObject({ user: 'other', data: null, loading: false });
    const late = reduce(
      switched,
      { type: 'success', user: 'kiran', entry: { fetchedAt: NOW, data: { followers: 1 } } },
      { type: 'failure', user: 'kiran', error: down },
      { type: 'start', user: 'kiran' },
      { type: 'slow', user: 'kiran' },
    );
    expect(late).toBe(switched);
    // Same account, different capitals: still applies.
    expect(reduce(switched, { type: 'success', user: 'OTHER', entry: { fetchedAt: NOW, data: { followers: 2 } } }).data).toEqual({ followers: 2 });
  });

  it('never replaces shown data with an older answer', () => {
    const s = reduce(cachedState(), { type: 'start', user: 'kiran' }, { type: 'success', user: 'kiran', entry: { fetchedAt: NOW - 3 * HOUR, data: { followers: 0 } } });
    expect(s).toMatchObject({ loading: false, data: { followers: 1 }, fetchedAt: NOW - HOUR });
  });

  it('tracks offline and clears it when a request starts or succeeds', () => {
    const off = reduce(cachedState(), { type: 'offline', offline: true });
    expect(off.offline).toBe(true);
    expect(reduce(off, { type: 'offline', offline: true })).toBe(off);
    expect(reduce(off, { type: 'start', user: 'kiran' }).offline).toBe(false);
  });
});

describe('when to load', () => {
  const base = { inFlight: false, cachedAt: NOW - HOUR, maxAge: 6 * HOUR, now: NOW, force: false, offline: false };

  it('uses a fresh cache, loads a stale or missing one', () => {
    expect(planRefresh(base)).toBe('use-cache');
    expect(planRefresh({ ...base, cachedAt: NOW - 6 * HOUR })).toBe('fetch');
    expect(planRefresh({ ...base, cachedAt: null })).toBe('fetch');
    // A shorter max age (a part failed last time) makes it due sooner.
    expect(planRefresh({ ...base, maxAge: 30 * 60_000 })).toBe('fetch');
  });

  it('Refresh loads even a fresh cache', () => {
    expect(planRefresh({ ...base, force: true })).toBe('fetch');
  });

  it('joins a running request instead of skipping it or starting another', () => {
    expect(planRefresh({ ...base, inFlight: true })).toBe('join');
    expect(planRefresh({ ...base, inFlight: true, force: true })).toBe('join');
  });

  it('stays on the cache while offline', () => {
    expect(planRefresh({ ...base, cachedAt: null, offline: true })).toBe('offline');
    expect(planRefresh({ ...base, force: true, offline: true })).toBe('offline');
    expect(planRefresh({ ...base, offline: true })).toBe('use-cache');
  });
});
