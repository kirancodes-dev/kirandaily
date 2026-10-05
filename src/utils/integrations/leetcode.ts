import { z } from 'zod';
import { isValidISODate, toISODate } from '../date';
import { fetchValidated, IntegrationError, type RequestOptions } from './http';
import { isValidUsername } from './usernames';

/**
 * LeetCode stats. LeetCode's own GraphQL API doesn't allow browser requests (no CORS),
 * so free community APIs are tried in order; the first complete, valid answer wins.
 */

export type LeetCodeSource = 'alfa-leetcode-api' | 'leetcode-api-faisalshohag' | 'leetcode-stats-api';

export interface LeetCodeStats {
  username: string;
  totalSolved: number;
  easy: number;
  medium: number;
  hard: number;
  /** Global contest-independent ranking, when the source has it. */
  ranking?: number;
  /** Accepted + rejected submissions per local date (YYYY-MM-DD). */
  calendar: Record<string, number>;
  source: LeetCodeSource;
}

const count = z.number().int().min(0);
const ranking = z.number().int().positive().nullable().optional();
/** { "<unix seconds>": submissions } */
const unixCalendar = z.record(z.string().regex(/^\d{1,11}$/), count);
/** Some APIs send the calendar as a JSON string, others as an object. */
const calendarField = z.union([z.string().max(200_000), unixCalendar]);

export const leetCodeStatsSchema: z.ZodType<LeetCodeStats, z.ZodTypeDef, unknown> = z.object({
  username: z.string(),
  totalSolved: count,
  easy: count,
  medium: count,
  hard: count,
  ranking: z.number().int().positive().optional(),
  calendar: z.record(z.string().refine(isValidISODate), count),
  source: z.enum(['alfa-leetcode-api', 'leetcode-api-faisalshohag', 'leetcode-stats-api']),
});

/**
 * Unix-seconds calendar → local dates. LeetCode keys each day by its UTC midnight;
 * that day is kept as-is (in India the local date is the same), any other timestamp
 * becomes the local date it falls on. Counts on the same date are added up.
 */
export function calendarFromUnix(raw: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, n] of Object.entries(raw)) {
    const seconds = Number(key);
    if (!Number.isFinite(seconds) || !Number.isInteger(n) || n <= 0) continue;
    const d = new Date(seconds * 1000);
    if (Number.isNaN(d.getTime())) continue;
    const date = seconds % 86_400 === 0 ? d.toISOString().slice(0, 10) : toISODate(d);
    out[date] = (out[date] ?? 0) + n;
  }
  return out;
}

/** Accepts the JSON-string or object form; null when it isn't a valid calendar. */
export function parseSubmissionCalendar(raw: unknown): Record<string, number> | null {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = raw.trim() === '' ? {} : JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const parsed = unixCalendar.safeParse(value);
  return parsed.success ? calendarFromUnix(parsed.data) : null;
}

/** Some APIs answer 200 with an error body for unknown users. */
function missingUser(body: unknown): boolean {
  const messages: string[] = [];
  const collect = (v: unknown) => {
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      for (const k of ['message', 'error', 'errors']) {
        const x = o[k];
        if (typeof x === 'string') messages.push(x);
        else if (Array.isArray(x)) x.forEach(collect);
        else if (x && typeof x === 'object') collect(x);
      }
    }
  };
  collect(body);
  return messages.some((m) => /(does not|doesn['’]t) exist|not found|no such user/i.test(m));
}

const lenient = z.unknown();

interface Provider {
  id: LeetCodeSource;
  load(user: string, opts: RequestOptions): Promise<Omit<LeetCodeStats, 'username' | 'source'>>;
}

function notFound(username: string) {
  return new IntegrationError('not_found', `There’s no LeetCode user named “${username}”. Check the spelling.`, { status: 404 });
}

/** Fetches, flags "user does not exist" bodies, then validates. */
async function get<T>(url: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, service: string, username: string, opts: RequestOptions) {
  let body: unknown;
  try {
    body = await fetchValidated(url, lenient, { ...opts, service });
  } catch (err) {
    // A 404 here usually means the free API moved or shut down, not that the user is missing.
    if (err instanceof IntegrationError && err.kind === 'not_found') {
      throw new IntegrationError('http', `${service} isn’t available (404).`, { status: 404 });
    }
    throw err;
  }
  if (missingUser(body)) throw notFound(username);
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new IntegrationError('invalid_response', `${service} sent data in an unexpected format.`);
  return parsed.data;
}

const calendarOrFail = (raw: unknown, service: string) => {
  const cal = parseSubmissionCalendar(raw);
  if (!cal) throw new IntegrationError('invalid_response', `${service} sent an invalid submission calendar.`);
  return cal;
};

export const LEETCODE_PROVIDERS: Provider[] = [
  {
    id: 'alfa-leetcode-api',
    async load(user, opts) {
      const base = `https://alfa-leetcode-api.onrender.com/${encodeURIComponent(user)}`;
      const service = 'alfa-leetcode-api';
      const [solved, calendar] = await Promise.all([
        get(base + '/solved', z.object({ solvedProblem: count, easySolved: count, mediumSolved: count, hardSolved: count }), service, user, opts),
        get(base + '/calendar', z.object({ submissionCalendar: calendarField }), service, user, opts),
      ]);
      return {
        totalSolved: solved.solvedProblem,
        easy: solved.easySolved,
        medium: solved.mediumSolved,
        hard: solved.hardSolved,
        calendar: calendarOrFail(calendar.submissionCalendar, service),
      };
    },
  },
  {
    id: 'leetcode-api-faisalshohag',
    async load(user, opts) {
      const service = 'leetcode-api-faisalshohag';
      const res = await get(
        `https://leetcode-api-faisalshohag.vercel.app/${encodeURIComponent(user)}`,
        z.object({ totalSolved: count, easySolved: count, mediumSolved: count, hardSolved: count, ranking, submissionCalendar: calendarField }),
        service,
        user,
        opts,
      );
      return {
        totalSolved: res.totalSolved,
        easy: res.easySolved,
        medium: res.mediumSolved,
        hard: res.hardSolved,
        ranking: res.ranking ?? undefined,
        calendar: calendarOrFail(res.submissionCalendar, service),
      };
    },
  },
  {
    id: 'leetcode-stats-api',
    async load(user, opts) {
      const service = 'leetcode-stats-api';
      const res = await get(
        `https://leetcode-stats-api.herokuapp.com/${encodeURIComponent(user)}`,
        z.object({
          status: z.literal('success').optional(),
          totalSolved: count,
          easySolved: count,
          mediumSolved: count,
          hardSolved: count,
          ranking,
          submissionCalendar: calendarField,
        }),
        service,
        user,
        opts,
      );
      return {
        totalSolved: res.totalSolved,
        easy: res.easySolved,
        medium: res.mediumSolved,
        hard: res.hardSolved,
        ranking: res.ranking ?? undefined,
        calendar: calendarOrFail(res.submissionCalendar, service),
      };
    },
  },
];

/**
 * Tries each provider in order; the first success wins. Stops early when a
 * provider says the user doesn't exist. Otherwise reports the most useful failure.
 */
export async function fetchLeetCodeStats(
  username: string,
  opts: RequestOptions = {},
  providers: Provider[] = LEETCODE_PROVIDERS,
): Promise<LeetCodeStats> {
  if (!isValidUsername(username)) {
    throw new IntegrationError('invalid_username', 'That isn’t a valid LeetCode username (letters, numbers, - and _ only).');
  }
  const errors: IntegrationError[] = [];
  for (const p of providers) {
    try {
      const { ranking: rank, ...stats } = await p.load(username, opts);
      return { username, ...stats, ...(rank ? { ranking: rank } : {}), source: p.id };
    } catch (err) {
      const e = err instanceof IntegrationError ? err : new IntegrationError('network', `Couldn’t reach ${p.id}.`);
      if (e.kind === 'not_found' || e.kind === 'aborted') throw e;
      errors.push(e);
    }
  }
  const limited = errors.find((e) => e.kind === 'rate_limited');
  if (limited) throw limited;
  if (errors.length > 0 && errors.every((e) => e.kind === 'network')) {
    throw new IntegrationError('network', 'Couldn’t reach the LeetCode stats services. Check your internet connection.');
  }
  throw new IntegrationError('http', 'The free LeetCode stats services aren’t answering right now. Try again in a few minutes.');
}

/**
 * Whole-number percentages of `values` that add up to exactly 100 (largest remainder),
 * e.g. 888 / 1888 / 680 → 26 / 54 / 20 instead of 26 / 55 / 20 = 101. All zeros → all 0.
 */
export function percentShares(values: number[]): number[] {
  const total = values.reduce((s, v) => s + Math.max(0, v), 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((v) => (Math.max(0, v) / total) * 100);
  const shares = exact.map(Math.floor);
  let left = 100 - shares.reduce((s, v) => s + v, 0);
  const order = exact.map((x, i) => ({ i, rest: x - Math.floor(x) })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    shares[i]++;
    left--;
  }
  return shares;
}
