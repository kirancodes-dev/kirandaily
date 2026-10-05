import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  cacheKey,
  CACHE_MAX_AGE_MS,
  formatAgo,
  formatUpdatedAgo,
  isStale,
  msUntilStale,
  pruneCache,
  readCache,
  restoreCache,
  runningRequest,
  shareRequest,
  writeCache,
  type CacheStorage,
} from './cache';

class MemoryStorage implements CacheStorage {
  map = new Map<string, string>();
  failWrites = false;
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const schema = z.object({ total: z.number() });
const HOUR = 60 * 60 * 1000;
const NOW = new Date(2026, 9, 5, 19, 45).getTime();

describe('stats cache', () => {
  it('uses one key per service and (case-insensitive) username', () => {
    expect(cacheKey('github', 'Kiran-Dev')).toBe('kiran-planner:cache:github:kiran-dev');
    expect(cacheKey('leetcode', 'kiran_lc')).toBe('kiran-planner:cache:leetcode:kiran_lc');
  });

  it('round-trips entries and validates what it reads back', () => {
    const s = new MemoryStorage();
    const key = cacheKey('github', 'kiran');
    expect(writeCache(s, key, { fetchedAt: NOW, data: { total: 5 } })).toBe(true);
    expect(readCache(s, key, schema)).toEqual({ fetchedAt: NOW, data: { total: 5 } });

    s.map.set(key, JSON.stringify({ fetchedAt: NOW, data: { total: 'five' } }));
    expect(readCache(s, key, schema)).toBeNull();
    s.map.set(key, '{broken');
    expect(readCache(s, key, schema)).toBeNull();
    s.map.set(key, JSON.stringify({ data: { total: 5 } }));
    expect(readCache(s, key, schema)).toBeNull();
    expect(readCache(s, cacheKey('github', 'nobody'), schema)).toBeNull();
    expect(readCache(null, key, schema)).toBeNull();
  });

  it('drops the cache of a previous username, but not other services or data', () => {
    const s = new MemoryStorage();
    s.map.set('kiran-planner:data', '{}');
    writeCache(s, cacheKey('leetcode', 'kiran_lc'), { fetchedAt: NOW, data: { total: 1 } });
    writeCache(s, cacheKey('github', 'old-name'), { fetchedAt: NOW, data: { total: 1 } });
    writeCache(s, cacheKey('github', 'new-name'), { fetchedAt: NOW, data: { total: 2 } });
    pruneCache(s, 'github', 'New-Name');
    expect([...s.map.keys()].sort()).toEqual([
      'kiran-planner:cache:github:new-name',
      'kiran-planner:cache:leetcode:kiran_lc',
      'kiran-planner:data',
    ]);
  });

  it('never removes another username’s cache when writing (a late answer for an old name)', () => {
    const s = new MemoryStorage();
    writeCache(s, cacheKey('github', 'new-name'), { fetchedAt: NOW, data: { total: 2 } });
    writeCache(s, cacheKey('github', 'old-name'), { fetchedAt: NOW + 1, data: { total: 1 } });
    expect(readCache(s, cacheKey('github', 'new-name'), schema)).toEqual({ fetchedAt: NOW, data: { total: 2 } });
  });

  it('clears a disconnected service and can put it back (Undo)', () => {
    const s = new MemoryStorage();
    s.map.set('kiran-planner:data', '{}');
    writeCache(s, cacheKey('github', 'kiran'), { fetchedAt: NOW, data: { total: 3 } });
    writeCache(s, cacheKey('leetcode', 'kiran_lc'), { fetchedAt: NOW, data: { total: 4 } });
    const removed = pruneCache(s, 'github', null);
    expect(removed.map(([k]) => k)).toEqual(['kiran-planner:cache:github:kiran']);
    expect([...s.map.keys()].sort()).toEqual(['kiran-planner:cache:leetcode:kiran_lc', 'kiran-planner:data']);
    restoreCache(s, removed);
    expect(readCache(s, cacheKey('github', 'kiran'), schema)).toEqual({ fetchedAt: NOW, data: { total: 3 } });
    // Only cache keys are ever restored.
    restoreCache(s, [['kiran-planner:data', '{"evil":true}']]);
    expect(s.map.get('kiran-planner:data')).toBe('{}');
    expect(pruneCache(null, 'github', null)).toEqual([]);
  });

  it('never throws when storage is full or missing', () => {
    const s = new MemoryStorage();
    s.failWrites = true;
    expect(writeCache(s, cacheKey('github', 'kiran'), { fetchedAt: NOW, data: {} })).toBe(false);
    expect(writeCache(null, cacheKey('github', 'kiran'), { fetchedAt: NOW, data: {} })).toBe(false);
  });

  it('is fresh for 6 hours, then refreshes', () => {
    expect(CACHE_MAX_AGE_MS).toBe(6 * HOUR);
    expect(isStale(NOW - 6 * HOUR + 60_000, NOW)).toBe(false);
    expect(isStale(NOW - 6 * HOUR, NOW)).toBe(true);
    expect(isStale(NOW - 30 * HOUR, NOW)).toBe(true);
    expect(isStale(NOW, NOW)).toBe(false);
    // Saved "in the future" (the device clock was wrong): refresh rather than trust it.
    expect(isStale(NOW + 10 * 60_000, NOW)).toBe(true);
    expect(isStale(NOW + 60_000, NOW)).toBe(false);
  });

  it('says how long until the data is due', () => {
    expect(msUntilStale(NOW - 2 * HOUR, NOW)).toBe(4 * HOUR);
    expect(msUntilStale(NOW - 6 * HOUR, NOW)).toBeNull();
    expect(msUntilStale(NOW - 10 * 60_000, NOW, 30 * 60_000)).toBe(20 * 60_000);
    expect(msUntilStale(NOW + 10 * 60_000, NOW)).toBeNull(); // from the future: due now
  });

  it('describes how old the data is', () => {
    expect(formatUpdatedAgo(NOW - 20_000, NOW)).toBe('Updated just now');
    expect(formatUpdatedAgo(NOW + 5_000, NOW)).toBe('Updated just now');
    expect(formatUpdatedAgo(NOW - 5 * 60_000, NOW)).toBe('Updated 5 min ago');
    expect(formatUpdatedAgo(NOW - 3 * HOUR - 59 * 60_000, NOW)).toBe('Updated 3 h ago');
    expect(formatUpdatedAgo(NOW - 25 * HOUR, NOW)).toBe('Updated 1 day ago');
    expect(formatUpdatedAgo(NOW - 3 * 24 * HOUR, NOW)).toBe('Updated 3 days ago');
    expect(formatAgo(new Date(2026, 2, 5, 12).getTime(), NOW)).toBe('on Mar 5');
    expect(formatAgo(new Date(2025, 2, 5, 12).getTime(), NOW)).toBe('on Mar 5, 2025');
  });

  it('shares one running request per key', async () => {
    let runs = 0;
    let finish: (v: number) => void = () => undefined;
    const run = () => {
      runs++;
      return new Promise<number>((resolve) => (finish = resolve));
    };
    expect(runningRequest('k')).toBeNull();
    const a = shareRequest('k', run);
    const b = shareRequest('k', run);
    expect(runs).toBe(1);
    expect(runningRequest('k')).toBe(a);
    finish(7);
    expect(await a).toBe(7);
    expect(await b).toBe(7);
    // Once it settled, the next call starts a new request.
    const c = shareRequest('k', run);
    expect(runs).toBe(2);
    finish(8);
    expect(await c).toBe(8);
    expect(runningRequest('k')).toBeNull();

    const failing = shareRequest('f', () => Promise.reject(new Error('down')));
    await expect(failing).rejects.toThrow('down');
    await expect(shareRequest('f', () => Promise.resolve(1))).resolves.toBe(1);
  });
});
