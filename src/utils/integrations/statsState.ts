import { isStale, type CacheEntry } from './cache';
import type { IntegrationError } from './http';

/**
 * What a coding-stats card shows, and when it loads. Pure logic for
 * hooks/useCodingStats: the hook only reads the cache, runs requests and
 * dispatches these actions.
 *
 * Every result carries the username it was loaded for, and a result for a
 * username the card no longer shows is ignored – so a slow answer can never
 * overwrite newer data or leave the card stuck on "Refreshing…".
 */

export interface StatsState<T> {
  /** Username the shown stats belong to (null = nothing connected). */
  user: string | null;
  data: T | null;
  /** Epoch ms of the shown data. */
  fetchedAt: number | null;
  /** A request for `user` is running. */
  loading: boolean;
  /** Still loading after a few seconds. */
  slow: boolean;
  /** Last load failed (cached data, if any, is still shown). */
  error: IntegrationError | null;
  offline: boolean;
}

export type StatsAction<T> =
  /** The card now shows another username (or none): start from its cache. */
  | { type: 'reset'; user: string | null; cached: CacheEntry<T> | null; offline: boolean }
  /** A request started, or the card joined one that was already running. */
  | { type: 'start'; user: string }
  | { type: 'slow'; user: string }
  /** Nothing to load (the cache is fresh): show the newest cached copy. */
  | { type: 'cached'; user: string; cached: CacheEntry<T> | null }
  | { type: 'success'; user: string; entry: CacheEntry<T> }
  | { type: 'failure'; user: string; error: IntegrationError }
  | { type: 'offline'; offline: boolean };

export function initialStatsState<T>(user: string | null, cached: CacheEntry<T> | null, offline: boolean): StatsState<T> {
  return { user, data: cached?.data ?? null, fetchedAt: cached?.fetchedAt ?? null, loading: false, slow: false, error: null, offline };
}

/** Usernames are case-insensitive on both sites. */
const sameUser = (a: string | null, b: string | null) => a === b || (a !== null && b !== null && a.toLowerCase() === b.toLowerCase());

const newer = <T>(entry: CacheEntry<T>, shownAt: number | null) => shownAt === null || entry.fetchedAt >= shownAt;

export function statsReducer<T>(state: StatsState<T>, action: StatsAction<T>): StatsState<T> {
  if (action.type === 'reset') return initialStatsState(action.user, action.cached, action.offline);
  if (action.type === 'offline') return state.offline === action.offline ? state : { ...state, offline: action.offline };
  // Anything below belongs to one username: drop it when the card shows another one now.
  if (!sameUser(action.user, state.user)) return state;
  switch (action.type) {
    case 'start':
      return { ...state, loading: true, slow: state.loading && state.slow, offline: false };
    case 'slow':
      return state.loading ? { ...state, slow: true } : state;
    case 'cached': {
      const done = { ...state, loading: false, slow: false };
      // Another card or an earlier request may have refreshed the cache meanwhile.
      if (action.cached && action.cached.fetchedAt !== state.fetchedAt && newer(action.cached, state.fetchedAt)) {
        return { ...done, data: action.cached.data, fetchedAt: action.cached.fetchedAt, error: null };
      }
      return done;
    }
    case 'success':
      if (!newer(action.entry, state.fetchedAt)) return { ...state, loading: false, slow: false };
      return { ...state, data: action.entry.data, fetchedAt: action.entry.fetchedAt, loading: false, slow: false, error: null, offline: false };
    case 'failure':
      return { ...state, loading: false, slow: false, error: action.error };
  }
}

export type RefreshPlan =
  /** A request for this username is already running: wait for its result. */
  | 'join'
  /** The cache is fresh enough: show it, no request. */
  | 'use-cache'
  /** Due, but the device is offline: keep showing the cache. */
  | 'offline'
  | 'fetch';

/** Decides what a (re)check does: on open, when the app is shown again, when back online, on Refresh or on the timer. */
export function planRefresh(opts: {
  inFlight: boolean;
  /** fetchedAt of the cached entry, null when nothing is cached. */
  cachedAt: number | null;
  /** How long the cached entry stays fresh. */
  maxAge: number;
  now: number;
  /** The Refresh button: load even when the cache is fresh. */
  force: boolean;
  offline: boolean;
}): RefreshPlan {
  if (opts.inFlight) return 'join';
  if (!opts.force && opts.cachedAt !== null && !isStale(opts.cachedAt, opts.now, opts.maxAge)) return 'use-cache';
  if (opts.offline) return 'offline';
  return 'fetch';
}
