import { defineConfig } from '@hey-api/openapi-ts';

/**
 * Public JS SDK generation config — the same toolchain as the in-app
 * `pulsight-sdk`, but pointed at the committed PUBLIC spec and emitting a
 * standalone published package (`@pulsight-xyz/sdk`).
 *
 * Input:  ../openapi/public.json (the filtered public surface, committed;
 *         `make sdk-public-spec` refreshes it from the backend's public doc).
 * Output: src/generated/{client,sdk,types,index}.gen.ts — COMMITTED, so the
 *         mirrored pulsight-xyz/pulsight-js repo and the published package are
 *         self-contained (consumers never regenerate). Never hand-edit them.
 *
 * Run via `make sdk-js`. The handwritten ergonomic layer (src/client.ts,
 * src/errors.ts, src/backtest.ts) is kept separate and never regenerated.
 */
export default defineConfig({
  input: '../openapi/public.json',
  output: {
    path: 'src/generated',
  },
  plugins: [
    '@hey-api/typescript',
    '@hey-api/client-fetch',
    '@hey-api/sdk',
  ],
});
