import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { fetchJson, fetchValidated, IntegrationError, toIntegrationError } from './http';
import { fakeFetch } from './testing';

const ENDPOINT = 'https://api.example.test/thing';
const schema = z.object({ n: z.number() });

async function failure(p: Promise<unknown>): Promise<IntegrationError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(IntegrationError);
    return e as IntegrationError;
  }
  throw new Error('expected the request to fail');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchValidated', () => {
  it('returns validated data and sends no cookies or referrer', async () => {
    const { fetchImpl, calls } = fakeFetch({ [ENDPOINT]: { body: { n: 3, extra: 'ignored' } } });
    vi.stubGlobal('fetch', fetchImpl);
    await expect(fetchValidated(ENDPOINT, schema, { service: 'Example' })).resolves.toEqual({ n: 3 });
    expect(calls[0].init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' });
  });

  it('rejects data in an unexpected shape', async () => {
    vi.stubGlobal('fetch', fakeFetch({ [ENDPOINT]: { body: { n: 'three' } } }).fetchImpl);
    const e = await failure(fetchValidated(ENDPOINT, schema, { service: 'Example' }));
    expect(e.kind).toBe('invalid_response');
    expect(e.message).toBe('Example sent data in an unexpected format.');
  });

  it('rejects bodies that are not JSON', async () => {
    vi.stubGlobal('fetch', fakeFetch({ [ENDPOINT]: { body: '<html>oops</html>' } }).fetchImpl);
    expect((await failure(fetchJson(ENDPOINT, { service: 'Example' }))).kind).toBe('invalid_response');
  });

  it('treats every non-200 status as a failure with a friendly message', async () => {
    vi.stubGlobal('fetch', fakeFetch({ [ENDPOINT]: { status: 404 } }).fetchImpl);
    const nf = await failure(fetchJson(ENDPOINT, { service: 'Example', notFound: 'No user named “x”.' }));
    expect(nf).toMatchObject({ kind: 'not_found', status: 404, message: 'No user named “x”.' });

    vi.stubGlobal('fetch', fakeFetch({ [ENDPOINT]: { status: 500 } }).fetchImpl);
    expect(await failure(fetchJson(ENDPOINT, { service: 'Example' }))).toMatchObject({ kind: 'http', status: 500 });

    vi.stubGlobal('fetch', fakeFetch({ [ENDPOINT]: { status: 202 } }).fetchImpl);
    expect((await failure(fetchJson(ENDPOINT, { service: 'Example' }))).kind).toBe('http');
  });

  it('explains rate limits, with the reset time when the API sends one', async () => {
    const reset = Math.floor(new Date(2026, 9, 5, 16, 30).getTime() / 1000);
    vi.stubGlobal('fetch', fakeFetch({ [ENDPOINT]: { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) } } }).fetchImpl);
    const limited = await failure(fetchJson(ENDPOINT, { service: 'GitHub' }));
    expect(limited.kind).toBe('rate_limited');
    expect(limited.retryAt).toBe(reset * 1000);
    expect(limited.message).toBe('GitHub’s hourly limit for this network was reached. Try again after 4:30 PM.');

    vi.stubGlobal('fetch', fakeFetch({ [ENDPOINT]: { status: 429 } }).fetchImpl);
    const tooMany = await failure(fetchJson(ENDPOINT, { service: 'Example' }));
    expect(tooMany.kind).toBe('rate_limited');
    expect(tooMany.message).toMatch(/too many requests/);
  });

  it('reports network failures', async () => {
    vi.stubGlobal('fetch', fakeFetch({ [ENDPOINT]: 'network-error' }).fetchImpl);
    const e = await failure(fetchJson(ENDPOINT, { service: 'Example' }));
    expect(e.kind).toBe('network');
    expect(e.message).toBe('Couldn’t reach Example. Check your internet connection.');
  });

  it('gives up after 8 seconds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', fakeFetch({ [ENDPOINT]: 'hang' }).fetchImpl);
    const p = failure(fetchJson(ENDPOINT, { service: 'Example' }));
    await vi.advanceTimersByTimeAsync(7999);
    let settled = false;
    void p.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const e = await p;
    expect(e.kind).toBe('timeout');
    expect(e.message).toBe('Example didn’t answer within 8 seconds.');
  });

  it('stops when the caller cancels', async () => {
    vi.stubGlobal('fetch', fakeFetch({ [ENDPOINT]: 'hang' }).fetchImpl);
    const ctrl = new AbortController();
    const p = failure(fetchJson(ENDPOINT, { service: 'Example', signal: ctrl.signal }));
    ctrl.abort();
    expect((await p).kind).toBe('aborted');
  });

  it('wraps unknown errors', () => {
    expect(toIntegrationError(new Error('boom'), 'GitHub')).toMatchObject({ kind: 'network' });
    const own = new IntegrationError('timeout', 'slow');
    expect(toIntegrationError(own)).toBe(own);
  });
});
