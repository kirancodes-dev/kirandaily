import type { ZodType, ZodTypeDef } from 'zod';
import { formatTime12, minutesToTime } from '../date';

/**
 * Small fetch wrapper for the public (CORS-enabled) stats APIs: 8 s timeout,
 * only HTTP 200 counts, and every body is checked with a Zod schema before use.
 * Nothing but the username in the URL is ever sent (no cookies, no referrer).
 */

export const REQUEST_TIMEOUT_MS = 8000;

export type IntegrationErrorKind =
  | 'invalid_username'
  | 'not_found'
  | 'rate_limited'
  | 'timeout'
  | 'network'
  | 'http'
  | 'invalid_response'
  | 'aborted';

export class IntegrationError extends Error {
  readonly kind: IntegrationErrorKind;
  readonly status?: number;
  /** When the API says requests work again (epoch ms), for rate limits. */
  readonly retryAt?: number;

  constructor(kind: IntegrationErrorKind, message: string, extra: { status?: number; retryAt?: number } = {}) {
    super(message);
    this.name = 'IntegrationError';
    this.kind = kind;
    this.status = extra.status;
    this.retryAt = extra.retryAt;
  }
}

/** Anything thrown while loading → an IntegrationError with a friendly message. */
export function toIntegrationError(err: unknown, service = 'The service'): IntegrationError {
  if (err instanceof IntegrationError) return err;
  if (err instanceof Error && err.name === 'AbortError') return new IntegrationError('aborted', 'Loading was cancelled.');
  return new IntegrationError('network', `Couldn’t load data from ${service}. Try again in a moment.`);
}

export interface RequestOptions {
  /** Cancels the request (e.g. a newer request replaced it). */
  signal?: AbortSignal;
  timeoutMs?: number;
}

interface FetchJsonOptions extends RequestOptions {
  /** Shown in messages, e.g. "GitHub". */
  service: string;
  headers?: Record<string, string>;
  /** Message for HTTP 404, e.g. "No GitHub user named “x”." */
  notFound?: string;
}

function rateLimitError(res: Response, service: string): IntegrationError {
  const reset = Number(res.headers.get('x-ratelimit-reset'));
  if (Number.isFinite(reset) && reset > 0) {
    const at = new Date(reset * 1000);
    const time = formatTime12(minutesToTime(at.getHours() * 60 + at.getMinutes()));
    return new IntegrationError('rate_limited', `${service}’s hourly limit for this network was reached. Try again after ${time}.`, {
      status: res.status,
      retryAt: at.getTime(),
    });
  }
  return new IntegrationError('rate_limited', `${service} is getting too many requests right now. Try again in a few minutes.`, {
    status: res.status,
  });
}

/** GET a URL and return its parsed JSON body (unvalidated – use fetchValidated). */
export async function fetchJson(url: string, opts: FetchJsonOptions): Promise<unknown> {
  const { service, signal } = opts;
  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;
  if (signal?.aborted) throw new IntegrationError('aborted', 'Loading was cancelled.');
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  const failed = () =>
    timedOut
      ? new IntegrationError('timeout', `${service} didn’t answer within ${Math.round(timeoutMs / 1000)} seconds.`)
      : signal?.aborted
        ? new IntegrationError('aborted', 'Loading was cancelled.')
        : null;
  try {
    let res: Response;
    try {
      res = await fetch(url, {
        signal: ctrl.signal,
        headers: opts.headers,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
    } catch {
      throw failed() ?? new IntegrationError('network', `Couldn’t reach ${service}. Check your internet connection.`);
    }
    if (res.status === 404) {
      throw new IntegrationError('not_found', opts.notFound ?? `${service} has no data for that username.`, { status: 404 });
    }
    if (res.status === 403 || res.status === 429) throw rateLimitError(res, service);
    if (res.status !== 200) {
      throw new IntegrationError('http', `${service} answered with an error (${res.status}). Try again later.`, { status: res.status });
    }
    try {
      return await res.json();
    } catch {
      throw failed() ?? new IntegrationError('invalid_response', `${service} sent something that isn’t valid data.`);
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** GET + JSON + Zod validation. Unexpected data is rejected, never shown. */
export async function fetchValidated<T>(url: string, schema: ZodType<T, ZodTypeDef, unknown>, opts: FetchJsonOptions): Promise<T> {
  const body = await fetchJson(url, opts);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new IntegrationError('invalid_response', `${opts.service} sent data in an unexpected format.`);
  }
  return parsed.data;
}
