/**
 * Test helpers for the integrations (imported only by *.test.ts files): a fetch
 * stand-in that answers by URL and honours abort signals.
 */

export type Reply = { status?: number; body?: unknown; headers?: Record<string, string> } | 'network-error' | 'hang';

export interface FetchCall {
  url: string;
  init?: RequestInit;
}

/** Returns a fetch function answering each URL from `routes` (exact URL or prefix match), plus the calls made. */
export function fakeFetch(routes: Record<string, Reply | (() => Reply)>) {
  const calls: FetchCall[] = [];
  const fetchImpl = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    calls.push({ url, init });
    const key = url in routes ? url : Object.keys(routes).find((k) => url.startsWith(k));
    const route = key === undefined ? { status: 404, body: { message: 'Not Found' } } : routes[key];
    const reply = typeof route === 'function' ? route() : route;
    return new Promise<Response>((resolve, reject) => {
      const abort = () => reject(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }));
      if (init?.signal?.aborted) return abort();
      init?.signal?.addEventListener('abort', abort);
      if (reply === 'hang') return;
      if (reply === 'network-error') return reject(new TypeError('Failed to fetch'));
      const body = typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body ?? {});
      resolve(new Response(body, { status: reply.status ?? 200, headers: { 'content-type': 'application/json', ...reply.headers } }));
    });
  };
  return { fetchImpl, calls };
}
