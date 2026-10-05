import { useCallback, useEffect, useState } from 'react';
import type { ZodType, ZodTypeDef } from 'zod';
import {
  browserStorage,
  cacheKey,
  isStale,
  readCache,
  shareRequest,
  writeCache,
  type CacheEntry,
} from '../utils/integrations/cache';
import { fetchGitHubStats, gitHubStatsSchema, type GitHubStats } from '../utils/integrations/github';
import { IntegrationError, toIntegrationError } from '../utils/integrations/http';
import { fetchLeetCodeStats, leetCodeStatsSchema, type LeetCodeStats } from '../utils/integrations/leetcode';
import { isValidUsername, SERVICE_NAMES, type Service } from '../utils/integrations/usernames';

/** After this long, loading shows "this can take a while" (free APIs cold-start). */
export const SLOW_AFTER_MS = 3000;

export interface CodingStatsState<T> {
  data: T | null;
  /** Epoch ms of the shown data. */
  fetchedAt: number | null;
  loading: boolean;
  /** Still loading after a few seconds. */
  slow: boolean;
  /** Last load failed (cached data, if any, is still shown). */
  error: IntegrationError | null;
  offline: boolean;
}

interface Source<T> {
  service: Service;
  fetcher: (username: string) => Promise<T>;
  schema: ZodType<T, ZodTypeDef, unknown>;
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

function fromCache<T>(source: Source<T>, username: string | null): CodingStatsState<T> {
  const cached = username ? readCache(browserStorage(), cacheKey(source.service, username), source.schema) : null;
  return { data: cached?.data ?? null, fetchedAt: cached?.fetchedAt ?? null, loading: false, slow: false, error: null, offline: isOffline() };
}

/**
 * Stats for one username: cached data first (instantly), then a background
 * refresh when it's older than 6 h, when the app comes back online or is reopened,
 * or when `refresh()` is called. Errors never wipe what's already shown.
 */
function useCodingStats<T>(source: Source<T>, username: string | null) {
  const user = username && isValidUsername(username) ? username : null;
  const [state, setState] = useState(() => fromCache(source, user));
  const [shownUser, setShownUser] = useState(user);
  if (shownUser !== user) {
    // Username changed: show its cache right away (render-time reset, no flash of old data).
    setShownUser(user);
    setState(fromCache(source, user));
  }
  const [request, setRequest] = useState({ n: 0, force: false });

  useEffect(() => {
    if (!user) return;
    const key = cacheKey(source.service, user);
    const cached = readCache(browserStorage(), key, source.schema);
    if (!request.force && cached && !isStale(cached.fetchedAt, Date.now())) return;
    if (isOffline()) {
      setState((s) => ({ ...s, offline: true, loading: false }));
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true, slow: false, offline: false }));
    const slowTimer = window.setTimeout(() => alive && setState((s) => ({ ...s, slow: true })), SLOW_AFTER_MS);
    shareRequest<CacheEntry<T>>(key, async () => {
      const data = await source.fetcher(user);
      const entry = { fetchedAt: Date.now(), data };
      writeCache(browserStorage(), key, entry);
      return entry;
    })
      .then((entry) => {
        if (alive) setState({ data: entry.data, fetchedAt: entry.fetchedAt, loading: false, slow: false, error: null, offline: false });
      })
      .catch((err: unknown) => {
        if (alive) {
          setState((s) => ({ ...s, loading: false, slow: false, error: toIntegrationError(err, SERVICE_NAMES[source.service]) }));
        }
      })
      .finally(() => window.clearTimeout(slowTimer));
    return () => {
      alive = false;
      window.clearTimeout(slowTimer);
    };
  }, [user, request, source]);

  // Check again when the phone comes back online or the app is reopened (stale data refreshes).
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === 'visible') setRequest((r) => ({ n: r.n + 1, force: false }));
    };
    const online = () => {
      setState((s) => ({ ...s, offline: false }));
      recheck();
    };
    const offline = () => setState((s) => ({ ...s, offline: true }));
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, []);

  const refresh = useCallback(() => setRequest((r) => ({ n: r.n + 1, force: true })), []);
  return { ...state, refresh };
}

const GITHUB: Source<GitHubStats> = { service: 'github', fetcher: (u) => fetchGitHubStats(u), schema: gitHubStatsSchema };
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
