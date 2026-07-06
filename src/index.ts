/**
 * @pulsight-xyz/sdk — official JavaScript/TypeScript client for the Pulsight
 * public API (data reads, backtests, strategies).
 *
 * Three layers re-exported to consumers:
 *   1. {@link createPulsightClient} — an authenticated fetch client (api-token
 *      auth + 429 retry) to hand to the generated operations via `{ client }`.
 *   2. Generated operations + types (from ./generated) — one typed async fn per
 *      OpenAPI operation. Produced by `make sdk-js`; never hand-edited.
 *   3. Typed errors ({@link CreditExhaustedError}, …) + `creditsRemaining` /
 *      `raiseForResponse` helpers mapping the 402/429/403 wire contract.
 *
 *   import { createPulsightClient, getApiTraders, CreditExhaustedError } from '@pulsight-xyz/sdk';
 */
export { createPulsightClient, DEFAULT_BASE_URL } from './client';
export type { CreatePulsightClientOptions } from './client';
export { submitAndWait } from './backtest';
export type { SubmitAndWaitOptions } from './backtest';
export {
  PulsightError,
  CreditExhaustedError,
  RateLimitedError,
  MissingScopeError,
  ApiError,
  creditsRemaining,
  retryAfterSeconds,
  raiseForResponse,
} from './errors';
export * from './generated';
