/**
 * Authenticated fetch client for the Pulsight API.
 *
 * Builds a `@hey-api/client-fetch` client (the same runtime the generated
 * operations in ./generated expect) configured with api-token auth and 429
 * retry. Pass the returned client to any generated operation:
 *
 *   import { createPulsightClient, getApiTraders } from '@pulsight-xyz/sdk';
 *   const client = createPulsightClient('pk_live_…');
 *   const { data } = await getApiTraders({ client });
 *
 * Built on the GENERATED client runtime (`./generated/client`), which
 * @hey-api/openapi-ts vendors into the package — the generated operations
 * expect exactly that `Client` type, so the standalone `@hey-api/client-fetch`
 * npm package (whose types differ subtly) must NOT be used here.
 */
import { createClient, createConfig, type Client } from './generated/client';

import { retryAfterSeconds } from './errors';

/** The production Pulsight API root. */
export const DEFAULT_BASE_URL = 'https://pulsight.xyz';

export interface CreatePulsightClientOptions {
  /** API root override, e.g. a staging URL. Defaults to {@link DEFAULT_BASE_URL}. */
  baseUrl?: string;
  /** Retries for idempotent (GET/HEAD) requests on HTTP 429. Default 2; 0 disables. */
  retries?: number;
  /** Per-request timeout in ms (default 30000). */
  timeoutMs?: number;
}

/**
 * Build an authenticated client for the given api token (`pk_live_…`). The
 * token rides the `Authorization` header on every request; product docs call
 * it an "api token", never a "Bearer token".
 */
export function createPulsightClient(
  apiToken: string,
  opts: CreatePulsightClientOptions = {},
): Client {
  const { baseUrl = DEFAULT_BASE_URL, retries = 2, timeoutMs = 30_000 } = opts;

  const client = createClient(
    createConfig({
      baseUrl,
      fetch: retryingFetch(retries, timeoutMs),
    }),
  );

  client.interceptors.request.use((request) => {
    request.headers.set('Authorization', `Bearer ${apiToken}`);
    return request;
  });

  return client;
}

/**
 * A `fetch` wrapper that retries idempotent (GET/HEAD) requests on HTTP 429,
 * honouring `Retry-After` (else exponential backoff), and applies a per-attempt
 * timeout when the caller did not pass their own `AbortSignal`.
 */
function retryingFetch(retries: number, timeoutMs: number): typeof fetch {
  return async (input, init) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const idempotent = method === 'GET' || method === 'HEAD';
    const attempts = 1 + (idempotent ? Math.max(0, retries) : 0);

    let response: Response | undefined;
    for (let i = 0; i < attempts; i++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        response = await fetch(input, {
          ...init,
          signal: init?.signal ?? controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (response.status !== 429 || i === attempts - 1) return response;
      const waitMs = retryAfterSeconds(response.headers) * 1000 || backoffMs(i);
      await sleep(waitMs);
    }
    // Unreachable (attempts >= 1), but keeps the type checker happy.
    return response as Response;
  };
}

/** Exponential backoff (200ms base) with up to 100ms of jitter. */
function backoffMs(attempt: number): number {
  return (1 << attempt) * 200 + Math.floor(Math.random() * 100);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
