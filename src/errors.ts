/**
 * Typed errors for the Pulsight API wire contract.
 *
 * Mirrors sdks/go/errors.go, sdks/python/pulsight/errors.py and
 * sdks/rust/src/errors.rs — the 402 / 429 / 403 responses map to first-class
 * classes so callers branch on `instanceof` instead of string-matching a body.
 */

/** Base class for every Pulsight client error. */
export class PulsightError extends Error {}

/** HTTP 402 CREDIT_EXHAUSTED — the api credit pool is empty this cycle. */
export class CreditExhaustedError extends PulsightError {
  readonly pool: string;
  constructor(pool: string) {
    super(`credit pool ${JSON.stringify(pool)} exhausted (HTTP 402)`);
    this.name = 'CreditExhaustedError';
    this.pool = pool;
  }
}

/** HTTP 429 — too many requests. `retryAfter` is seconds (0 when absent). */
export class RateLimitedError extends PulsightError {
  readonly retryAfter: number;
  constructor(retryAfter: number) {
    super(`rate limited, retry after ${retryAfter}s (HTTP 429)`);
    this.name = 'RateLimitedError';
    this.retryAfter = retryAfter;
  }
}

/** HTTP 403 — the api token lacks a required scope. */
export class MissingScopeError extends PulsightError {
  readonly reason: string;
  constructor(reason: string) {
    super(`${reason} (HTTP 403)`);
    this.name = 'MissingScopeError';
    this.reason = reason;
  }
}

/** Any other non-2xx response. */
export class ApiError extends PulsightError {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string) {
    super(`unexpected status ${status}: ${body}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** Remaining api credits from the `X-Credits-Remaining` header, or null. */
export function creditsRemaining(headers: Headers): number | null {
  const raw = headers.get('X-Credits-Remaining');
  if (raw === null) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

/** Seconds from the `Retry-After` header (0 when absent/unparseable). */
export function retryAfterSeconds(headers: Headers): number {
  const raw = headers.get('Retry-After');
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Throw a typed error for a non-2xx {@link Response}; no-op on 2xx. Clones the
 * response to read the body, so the caller can still consume `response` after.
 */
export async function raiseForResponse(response: Response): Promise<void> {
  if (response.ok) return;
  const text = await response
    .clone()
    .text()
    .catch(() => '');
  const json = safeJson(text);
  switch (response.status) {
    case 402:
      throw new CreditExhaustedError(typeof json?.pool === 'string' ? json.pool : '');
    case 429:
      throw new RateLimitedError(retryAfterSeconds(response.headers));
    case 403:
      throw new MissingScopeError(typeof json?.error === 'string' ? json.error : 'forbidden');
    default:
      throw new ApiError(response.status, text);
  }
}

function safeJson(text: string): { pool?: unknown; error?: unknown } | undefined {
  try {
    return JSON.parse(text) as { pool?: unknown; error?: unknown };
  } catch {
    return undefined;
  }
}
