import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { calendarFromUnix, fetchLeetCodeStats, leetCodeStatsSchema, parseSubmissionCalendar } from './leetcode';
import { fakeFetch, type Reply } from './testing';

const ALFA = 'https://alfa-leetcode-api.onrender.com/kiran_lc';
const FAISAL = 'https://leetcode-api-faisalshohag.vercel.app/kiran_lc';
const HEROKU = 'https://leetcode-stats-api.herokuapp.com/kiran_lc';

// 2026-10-05 00:00 UTC (LeetCode's day bucket) and 2026-10-04 18:30 UTC (= 00:00 Oct 5 in India).
const OCT5_UTC = 1791158400;
const OCT4_UTC = 1791072000;
const OCT5_IST_MIDNIGHT = 1791138600;

const alfaSolved = { solvedProblem: 42, easySolved: 25, mediumSolved: 15, hardSolved: 2, totalSubmissionNum: [], acSubmissionNum: [] };
const alfaCalendar = { activeYears: [2026], streak: 2, submissionCalendar: JSON.stringify({ [OCT4_UTC]: 4, [OCT5_UTC]: 3 }) };
const faisal = {
  totalSolved: 40,
  easySolved: 24,
  mediumSolved: 14,
  hardSolved: 2,
  ranking: 123456,
  submissionCalendar: { [OCT5_UTC]: 6 },
};
const heroku = { status: 'success', message: 'retrieved', totalSolved: 39, easySolved: 24, mediumSolved: 13, hardSolved: 2, ranking: 200000, submissionCalendar: { [OCT4_UTC]: 1 } };

function stub(routes: Record<string, Reply>) {
  const f = fakeFetch(routes);
  vi.stubGlobal('fetch', f.fetchImpl);
  return f.calls;
}

const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Asia/Kolkata';
});
afterAll(() => {
  process.env.TZ = zone;
});
afterEach(() => vi.unstubAllGlobals());

describe('LeetCode stats', () => {
  it('uses alfa-leetcode-api first and normalises its answer', async () => {
    const calls = stub({ [`${ALFA}/solved`]: { body: alfaSolved }, [`${ALFA}/calendar`]: { body: alfaCalendar } });
    const stats = await fetchLeetCodeStats('kiran_lc');
    expect(stats).toEqual({
      username: 'kiran_lc',
      totalSolved: 42,
      easy: 25,
      medium: 15,
      hard: 2,
      calendar: { '2026-10-04': 4, '2026-10-05': 3 },
      source: 'alfa-leetcode-api',
    });
    expect(calls.map((c) => c.url).sort()).toEqual([`${ALFA}/calendar`, `${ALFA}/solved`]);
    expect(leetCodeStatsSchema.safeParse(stats).success).toBe(true);
  });

  it('falls back to the next provider, in order, when one fails', async () => {
    const calls = stub({ [`${ALFA}/solved`]: { status: 503 }, [`${ALFA}/calendar`]: { status: 503 }, [FAISAL]: { body: faisal } });
    const stats = await fetchLeetCodeStats('kiran_lc');
    expect(stats).toMatchObject({ source: 'leetcode-api-faisalshohag', totalSolved: 40, ranking: 123456, calendar: { '2026-10-05': 6 } });
    expect(calls.map((c) => c.url)).not.toContain(HEROKU);

    const calls2 = stub({ [`${ALFA}/solved`]: 'network-error', [`${ALFA}/calendar`]: 'network-error', [FAISAL]: { status: 500 }, [HEROKU]: { body: heroku } });
    const last = await fetchLeetCodeStats('kiran_lc');
    expect(last).toMatchObject({ source: 'leetcode-stats-api', totalSolved: 39, easy: 24, medium: 13, hard: 2, ranking: 200000 });
    const order = calls2.map((c) => c.url);
    expect(order.indexOf(FAISAL)).toBeGreaterThan(order.indexOf(`${ALFA}/solved`));
    expect(order.indexOf(HEROKU)).toBeGreaterThan(order.indexOf(FAISAL));
  });

  it('skips a provider whose data is invalid or whose calendar is missing', async () => {
    stub({
      [`${ALFA}/solved`]: { body: { ...alfaSolved, solvedProblem: 'many' } },
      [`${ALFA}/calendar`]: { body: alfaCalendar },
      [FAISAL]: { body: { ...faisal, submissionCalendar: 'not json' } },
      [HEROKU]: { body: heroku },
    });
    expect((await fetchLeetCodeStats('kiran_lc')).source).toBe('leetcode-stats-api');
  });

  it('treats a 404 from a provider as an outage, not a missing user', async () => {
    stub({ [`${ALFA}/solved`]: { status: 404 }, [`${ALFA}/calendar`]: { status: 404 }, [FAISAL]: { body: faisal } });
    expect((await fetchLeetCodeStats('kiran_lc')).source).toBe('leetcode-api-faisalshohag');
  });

  it('stops at the first "user does not exist" answer', async () => {
    const calls = stub({
      [`${ALFA}/solved`]: { body: { errors: [{ message: 'That user does not exist.' }] } },
      [`${ALFA}/calendar`]: { body: { errors: [{ message: 'That user does not exist.' }] } },
      [FAISAL]: { body: faisal },
    });
    await expect(fetchLeetCodeStats('kiran_lc')).rejects.toMatchObject({
      kind: 'not_found',
      message: 'There’s no LeetCode user named “kiran_lc”. Check the spelling.',
    });
    expect(calls.map((c) => c.url)).not.toContain(FAISAL);

    stub({ [`${ALFA}/solved`]: { status: 500 }, [`${ALFA}/calendar`]: { status: 500 }, [FAISAL]: { status: 500 }, [HEROKU]: { body: { status: 'error', message: 'user does not exist' } } });
    await expect(fetchLeetCodeStats('kiran_lc')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('gives one friendly error when every provider fails', async () => {
    stub({ [`${ALFA}/solved`]: { status: 502 }, [`${ALFA}/calendar`]: { status: 502 }, [FAISAL]: { status: 500 }, [HEROKU]: { status: 503 } });
    await expect(fetchLeetCodeStats('kiran_lc')).rejects.toThrow('The free LeetCode stats services aren’t answering right now. Try again in a few minutes.');

    stub({ [`${ALFA}/solved`]: 'network-error', [`${ALFA}/calendar`]: 'network-error', [FAISAL]: 'network-error', [HEROKU]: 'network-error' });
    await expect(fetchLeetCodeStats('kiran_lc')).rejects.toMatchObject({ kind: 'network' });

    stub({ [`${ALFA}/solved`]: { status: 429 }, [`${ALFA}/calendar`]: { status: 429 }, [FAISAL]: { status: 500 }, [HEROKU]: { status: 500 } });
    await expect(fetchLeetCodeStats('kiran_lc')).rejects.toMatchObject({ kind: 'rate_limited' });
  });

  it('validates the username before any request', async () => {
    const calls = stub({});
    await expect(fetchLeetCodeStats('kiran/../admin')).rejects.toMatchObject({ kind: 'invalid_username' });
    expect(calls).toHaveLength(0);
  });

  it('puts the validated username into the provider URL', async () => {
    const calls = stub({ [`https://alfa-leetcode-api.onrender.com/Kiran-LC_1/`]: { body: {} } });
    await fetchLeetCodeStats('Kiran-LC_1').catch(() => undefined);
    expect(calls[0].url).toBe('https://alfa-leetcode-api.onrender.com/Kiran-LC_1/solved');
  });
});

describe('submission calendar', () => {
  it('turns unix seconds into local dates (LeetCode day buckets keep their day)', () => {
    expect(calendarFromUnix({ [OCT5_UTC]: 3, [OCT4_UTC]: 2 })).toEqual({ '2026-10-05': 3, '2026-10-04': 2 });
    // A timestamp that isn't a day bucket uses the local (India) date: 18:30 UTC on Oct 4 is Oct 5 here.
    expect(calendarFromUnix({ [OCT5_IST_MIDNIGHT]: 1 })).toEqual({ '2026-10-05': 1 });
    // Same date twice → added up. Zero, negative and junk entries are dropped.
    expect(calendarFromUnix({ [OCT5_UTC]: 3, [OCT5_IST_MIDNIGHT]: 2, [OCT4_UTC]: 0, abc: 4 })).toEqual({ '2026-10-05': 5 });
  });

  it('accepts the JSON-string and object forms, and rejects junk', () => {
    expect(parseSubmissionCalendar(JSON.stringify({ [OCT5_UTC]: 2 }))).toEqual({ '2026-10-05': 2 });
    expect(parseSubmissionCalendar({ [OCT5_UTC]: 2 })).toEqual({ '2026-10-05': 2 });
    expect(parseSubmissionCalendar('')).toEqual({});
    expect(parseSubmissionCalendar('{not json')).toBeNull();
    expect(parseSubmissionCalendar({ [OCT5_UTC]: 'two' })).toBeNull();
    expect(parseSubmissionCalendar({ '<script>': 1 })).toBeNull();
    expect(parseSubmissionCalendar(null)).toBeNull();
  });
});
