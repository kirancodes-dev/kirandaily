import type { ZodType, ZodTypeDef } from 'zod';
import { formatShortDate, toISODate } from '../date';
import type { Service } from './usernames';

/**
 * Device-only cache for the coding stats (never synced): the last good answer
 * is shown instantly and refreshed in the background once it's 6 hours old.
 * A failed refresh never removes it.
 */

export const CACHE_PREFIX = 'kiran-planner:cache:';
export const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export interface CacheEntry<T> {
  /** Epoch ms of the successful fetch. */
  fetchedAt: number;
  data: T;
}

export type CacheStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

/** localStorage, or null where it's blocked (private mode, tests). */
export function browserStorage(): CacheStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** "kiran-planner:cache:github:<user>" – usernames are case-insensitive on both sites. */
export function cacheKey(service: Service, username: string): string {
  return `${CACHE_PREFIX}${service}:${username.toLowerCase()}`;
}

/** The cached entry, or null when missing or malformed (the cache is untrusted too). */
export function readCache<T>(storage: CacheStorage | null, key: string, schema: ZodType<T, ZodTypeDef, unknown>): CacheEntry<T> | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fetchedAt?: unknown; data?: unknown };
    if (typeof parsed?.fetchedAt !== 'number' || !Number.isFinite(parsed.fetchedAt)) return null;
    const data = schema.safeParse(parsed.data);
    return data.success ? { fetchedAt: parsed.fetchedAt, data: data.data } : null;
  } catch {
    return null;
  }
}

/**
 * Saves the entry. Other usernames' entries are left alone here: a slow request for an
 * old username must never remove the new one's cache (see pruneCache).
 */
export function writeCache<T>(storage: CacheStorage | null, key: string, entry: CacheEntry<T>): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(entry));
    return true;
  } catch {
    return false; // storage full or blocked – the data still shows, it just isn't cached
  }
}

/** Removed cache entries as [key, raw value], so an Undo can put them back. */
export type RemovedEntries = [key: string, value: string][];

/**
 * Drops the service's cached stats for every username except `keep` (all of them
 * when `keep` is null, e.g. after Disconnect). Other services and app data are untouched.
 */
export function pruneCache(storage: CacheStorage | null, service: Service, keep: string | null): RemovedEntries {
  if (!storage) return [];
  try {
    const prefix = `${CACHE_PREFIX}${service}:`;
    const keepKey = keep ? cacheKey(service, keep) : null;
    const removed: RemovedEntries = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k !== keepKey && k.startsWith(prefix)) removed.push([k, storage.getItem(k) ?? '']);
    }
    removed.forEach(([k]) => storage.removeItem(k));
    return removed;
  } catch {
    return [];
  }
}

/** Puts back entries removed by pruneCache (Undo of a disconnect). */
export function restoreCache(storage: CacheStorage | null, entries: RemovedEntries): void {
  if (!storage) return;
  for (const [k, v] of entries) {
    try {
      if (k.startsWith(CACHE_PREFIX) && v) storage.setItem(k, v);
    } catch {
      // storage full – the stats load again from the network instead
    }
  }
}

/** Old enough to refresh (or from the future, e.g. after the clock was changed). */
export function isStale(fetchedAt: number, now: number, maxAge = CACHE_MAX_AGE_MS): boolean {
  return now - fetchedAt >= maxAge || fetchedAt - now > 5 * 60 * 1000;
}

/** Milliseconds until `isStale` turns true, or null when it already is. */
export function msUntilStale(fetchedAt: number, now: number, maxAge = CACHE_MAX_AGE_MS): number | null {
  return isStale(fetchedAt, now, maxAge) ? null : fetchedAt + maxAge - now;
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then the date. */
export function formatAgo(then: number, now: number): string {
  const mins = Math.floor(Math.max(0, now - then) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const date = toISODate(new Date(then));
  const sameYear = new Date(then).getFullYear() === new Date(now).getFullYear();
  return `on ${formatShortDate(date)}${sameYear ? '' : `, ${new Date(then).getFullYear()}`}`;
}

export function formatUpdatedAgo(fetchedAt: number, now: number): string {
  return `Updated ${formatAgo(fetchedAt, now)}`;
}

const inflight = new Map<string, Promise<unknown>>();

/**
 * One request per key at a time: a second caller (another card, a re-render, the
 * Refresh button) joins the running request instead of starting a new one. The
 * request keeps going when the page that started it closes, so its result still
 * lands in the cache.
 */
export function shareRequest<T>(key: string, run: () => Promise<T>): Promise<T> {
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const p = run().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** The request currently running for `key`, if any (to show its result too). */
export function runningRequest<T>(key: string): Promise<T> | null {
  return (inflight.get(key) as Promise<T> | undefined) ?? null;
}
