import { useCallback, useEffect, useReducer, useState, type Reducer } from 'react';
import type { ZodType, ZodTypeDef } from 'zod';
import {
  browserStorage,
  CACHE_MAX_AGE_MS,
  cacheKey,
  msUntilStale,
  pruneCache,
  readCache,
  runningRequest,
  shareRequest,
  writeCache,
  type CacheEntry,
} from '../utils/integrations/cache';
import { fetchGitHubStats, gitHubMaxAge, gitHubStatsSchema, mergeGitHubStats, type GitHubStats } from '../utils/integrations/github';
import { toIntegrationError } from '../utils/integrations/http';
import { fetchLeetCodeStats, leetCodeStatsSchema, type LeetCodeStats } from '../utils/integrations/leetcode';
import { initialStatsState, planRefresh, statsReducer, type StatsAction, type StatsState } from '../utils/integrations/statsState';
import { isValidUsername, SERVICE_NAMES, type Service } from '../utils/integrations/usernames';

/** After this long, loading shows "this can take a while" (free APIs cold-start). */
export const SLOW_AFTER_MS = 3000;

export type CodingStatsState<T> = StatsState<T>;

export interface Source<T> {
  service: Service;
  fetcher: (username: string) => Promise<T>;
  schema: ZodType<T, ZodTypeDef, unknown>;
  /** Combines a new answer with the cached one (e.g. keep a part that failed to load). */
  merge?: (next: T, previous: CacheEntry<T> | null) => T;
  /** How long this data stays fresh (default 6 hours). */
  maxAge?: (data: T) => number;
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
const isVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

function cachedFor<T>(source: Source<T>, user: string | null): CacheEntry<T> | null {
  return user ? readCache(browserStorage(), cacheKey(source.service, user), source.schema) : null;
}

/**
 * The username each service's cards show now (they all read the same profile link).
 * Module-level because a request outlives the card that started it.
 */
const shownUser = new Map<Service, string | null>();
const isShown = (service: Service, user: string) => {
  const shown = shownUser.has(service) ? shownUser.get(service)! : user;
  return shown !== null && shown.toLowerCase() === user.toLowerCase();
};

/** Loads, merges with the cache and saves. Runs once per username at a time (shared by every card). */
async function fetchAndStore<T>(source: Source<T>, user: string, key: string): Promise<CacheEntry<T>> {
  const fresh = await source.fetcher(user);
  const storage = browserStorage();
  const data = source.merge ? source.merge(fresh, readCache(storage, key, source.schema)) : fresh;
  const entry = { fetchedAt: Date.now(), data };
  // A late answer for a username that was changed or disconnected meanwhile isn't kept.
  if (isShown(source.service, user)) writeCache(storage, key, entry);
  return entry;
}

/** Drops cached stats of every other username of the service (an old or disconnected one). */
function pruneOthers(service: Service) {
  pruneCache(browserStorage(), service, shownUser.get(service) ?? null);
}

/**
 * Stats for one username: cached data first (instantly), then a background
 * refresh when it's older than 6 hours (checked on open, when the app is shown
 * again, when back online and by a timer while the page stays open) or when
 * `refresh()` is called. Errors never wipe what's already shown.
 */
export function useCodingStats<T>(source: Source<T>, username: string | null) {
  const user = username && isValidUsername(username) ? username : null;
  const [state, dispatch] = useReducer<Reducer<StatsState<T>, StatsAction<T>>, string | null>(statsReducer, user, (u) =>
    initialStatsState(u, cachedFor(source, u), isOffline()),
  );
  if (state.user !== user) {
    // Username changed: show its cache right away (render-time reset, no flash of old data).
    dispatch({ type: 'reset', user, cached: cachedFor(source, user), offline: isOffline() });
  }

  // Before any loading below: requests that finish later check which username is shown.
  useEffect(() => {
    shownUser.set(source.service, user);
    if (user) pruneOthers(source.service);
  }, [user, source]);

  const load = useCallback(
    (force: boolean) => {
      if (!user) return;
      const key = cacheKey(source.service, user);
      const running = runningRequest<CacheEntry<T>>(key);
      const cached = running ? null : cachedFor(source, user);
      const plan = planRefresh({
        inFlight: !!running,
        cachedAt: cached?.fetchedAt ?? null,
        maxAge: cached && source.maxAge ? source.maxAge(cached.data) : CACHE_MAX_AGE_MS,
        now: Date.now(),
        force,
        offline: isOffline(),
      });
      if (plan === 'use-cache') return dispatch({ type: 'cached', user, cached });
      if (plan === 'offline') return dispatch({ type: 'offline', offline: true });
      dispatch({ type: 'start', user });
      // Joining a running request (e.g. Refresh, then the app was reopened) still shows its result.
      (running ?? shareRequest(key, () => fetchAndStore(source, user, key))).then(
        (entry) => {
          dispatch({ type: 'success', user, entry });
          pruneOthers(source.service);
        },
        (err: unknown) => dispatch({ type: 'failure', user, error: toIntegrationError(err, SERVICE_NAMES[source.service]) }),
      );
    },
    [user, source],
  );

  // On open and whenever the username changes.
  useEffect(() => {
    load(false);
  }, [load]);

  // Check again when the phone comes back online or the app is shown again (stale data refreshes).
  useEffect(() => {
    const recheck = () => {
      if (isVisible()) load(false);
    };
    const online = () => {
      dispatch({ type: 'offline', offline: false });
      recheck();
    };
    const offline = () => dispatch({ type: 'offline', offline: true });
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [load]);

  // A page left open (a Mac window) refreshes by itself once the data is due.
  const maxAge = state.data !== null && source.maxAge ? source.maxAge(state.data) : CACHE_MAX_AGE_MS;
  useEffect(() => {
    if (!user || state.fetchedAt === null) return;
    const wait = msUntilStale(state.fetchedAt, Date.now(), maxAge);
    if (wait === null) return; // already due: opening, showing the app or Refresh loads it
    const id = window.setTimeout(() => {
      if (isVisible()) load(false);
    }, wait + 1000);
    return () => window.clearTimeout(id);
  }, [user, state.fetchedAt, maxAge, load]);

  // "This can take a while" after a few seconds of loading.
  useEffect(() => {
    if (!user || !state.loading) return;
    const id = window.setTimeout(() => dispatch({ type: 'slow', user }), SLOW_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [user, state.loading]);

  const refresh = useCallback(() => load(true), [load]);
  return { ...state, refresh };
}

const GITHUB: Source<GitHubStats> = {
  service: 'github',
  fetcher: (u) => fetchGitHubStats(u),
  schema: gitHubStatsSchema,
  merge: mergeGitHubStats,
  maxAge: gitHubMaxAge,
};
const LEETCODE: Source<LeetCodeStats> = { service: 'leetcode', fetcher: (u) => fetchLeetCodeStats(u), schema: leetCodeStatsSchema };

export function useGitHubStats(username: string | null) {
  return useCodingStats(GITHUB, username);
}

export function useLeetCodeStats(username: string | null) {
  return useCodingStats(LEETCODE, username);
}

/** Current time, re-rendering every `intervalMs` (for "Updated 5 min ago"). */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    const onVisible = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}
