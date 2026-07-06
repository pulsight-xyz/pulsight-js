/**
 * `submitAndWait` — submit a backtest and poll until it reaches a terminal
 * state, the ergonomic counterpart to the raw submit/poll operations. Kept
 * self-contained (plain `fetch`) so it typechecks before generation and does
 * not couple to the generated operation names.
 */
import { DEFAULT_BASE_URL } from './client';
import { raiseForResponse } from './errors';

const TERMINAL = new Set(['done', 'completed', 'failed', 'cancelled', 'canceled', 'error']);

export interface SubmitAndWaitOptions {
  /** API root override. Defaults to {@link DEFAULT_BASE_URL}. */
  baseUrl?: string;
  /** Poll cadence in ms (default 2000). */
  pollIntervalMs?: number;
  /** Give up after this many ms (default 300000 = 5 min). */
  timeoutMs?: number;
  /** Invoked with the backtest status each poll (e.g. for progress UI). */
  onProgress?: (status: string) => void;
}

/**
 * Submit a backtest (`POST /api/backtests`) and poll `GET /api/backtests/{id}`
 * with backoff until the record reaches a terminal status, returning it.
 * Throws a typed error (see ./errors) on any non-2xx, or a plain Error if the
 * run does not finish within `timeoutMs`.
 */
export async function submitAndWait(
  apiToken: string,
  body: unknown,
  opts: SubmitAndWaitOptions = {},
): Promise<Record<string, unknown>> {
  const {
    baseUrl = DEFAULT_BASE_URL,
    pollIntervalMs = 2000,
    timeoutMs = 300_000,
    onProgress,
  } = opts;
  const headers = {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };

  const submit = await fetch(`${baseUrl}/api/backtests`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  await raiseForResponse(submit);
  const submitted = (await submit.json()) as { id?: string | number };
  const id = submitted?.id;
  if (id === undefined || id === null) {
    throw new Error('pulsight: backtest submit returned no id');
  }

  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const poll = await fetch(`${baseUrl}/api/backtests/${id}`, { headers });
    await raiseForResponse(poll);
    const record = (await poll.json()) as Record<string, unknown>;
    const status = String(record?.status ?? '').toLowerCase();
    onProgress?.(status);
    if (TERMINAL.has(status)) return record;
    if (Date.now() > deadline) {
      throw new Error(
        `pulsight: backtest ${id} did not finish within ${timeoutMs}ms (last status: ${status || 'unknown'})`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}
