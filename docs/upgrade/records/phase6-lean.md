# Phase 6 (lean): summary

Summary for the owner of phase 6 (dashboard libraries), from `978c6e4` (the jump 5 tip plus the owner commit "CORE: error fixes") to the tip of `upgrade/phase6-dashboard-libs` (2026-11-18). It replaces the GATE-A record of `docs/upgrade/70-phase6.md` for the lean track. The work followed `.p2-work/LEAN-PLAN.md`: no sign-off rounds, no fault patches, kill matrices or prod windows; decisions were taken during the work and are in the commit messages and in §4. Nothing was pushed or deployed and no Docker was used. `git diff 978c6e4 -- .github kube Dockerfile .dockerignore` is empty.

Rules held in every step: the same logic (quirks kept, no fixes), the same UI (0 px on T-801 and T-802), the same requests on the wire.

## 1. Versions

| Package | At `978c6e4` | Now |
|---|---|---|
| `next`, `react`, `react-dom` | 16.4.6, 19.3.1 | unchanged |
| `mobx`, `mobx-react-lite` | 7.1.7, 5.1.3 | removed |
| `zustand` | — | 5.1.0 |
| `axios` | — | 1.21.1 (only in `api/http.ts`) |
| `@sentry/browser`, `@sentry/node` | 11.12.0 | removed |
| `@sentry/nextjs` | — | 11.14.0 |
| Babel (build) | `babel.config.js`, Babel 7.29 | removed: Next's SWC builds the app |
| `@swc/core`, `@swc/jest` | — | 1.16.22, 0.2.39 (`test:unit:swc`) |
| `@babel/core`, `@babel/preset-env` | 7.29.13, 7.29.14 | unchanged, Jest only (`jest.babel.config.js`) |
| `core-js` | 3.51.0 | 3.51.0, injected by SWC's usage mode |
| `typescript` | 6.0.3 | 6.0.3; 7.0.2 beside it as `typescript-7` (`typecheck:7`) |
| `@types/react`, `@types/react-dom`, `@types/node` | — | 19.3.0, 19.3.0, 24.19.2 |
| `typescript-eslint` | 8.72.2 | 8.73.0 |
| `@next/eslint-plugin-next` | — | 16.4.6 |
| `cssnano`, `cssnano-simple`, `postcss-preset-env`, `postcss-custom-media`, `postcss-extend-rule`, `@csstools/postcss-global-data` | 9.9.0, 2.0.0, 11.6.2, 12.0.3, ^4.0.0, 4.0.0 | removed (Next's own CSS minifier, no PostCSS plugins) |
| `caniuse-lite`, `browserslist` | pinned 1.0.30001754, 4.27.0 | unpinned: 1.0.30001826, 4.27.0 |
| `html-validate` (`e2e/`) | 11.16.4 | 11.21.1 |
| `@playwright/test` (`e2e/`) | 1.64.1 | 1.64.1 (1.65 held, §5) |
| `msw` | 2.15.0 | 2.15.0 (3 held, §5) |

Every build and test ran on Node 24.18.1.

## 2. What each step changed, by change site

| Step | Change sites | What changed |
|---|---|---|
| 6.0 | — | Folded: the T-212 store contract was built as the first commit of 6.5; msw 3 stays held. |
| 6.1 | CS-BAB-7, CS-TS-1..3, CS-R19-1 | Babel TypeScript preset (type imports only); `tsconfig.json` with the webpack aliases as paths, `tsconfig.strict.json`, asset types, typecheck scripts on TypeScript 6 and 7; React automatic JSX runtime. CS-BAB-6 held (§5). |
| 6.2 | CS-LINT-5 | ESLint TypeScript block (typescript-eslint recommended, `@next/eslint-plugin-next` recommended); new findings on existing code as bulk suppressions; lint-staged covers `ts,tsx`. |
| 6.3 | CS-AX-1, CS-AX-2 | `api/http.ts`: a fetch-signature transport on axios's fetch adapter; `api/index.js` calls it instead of `fetch`. T-122 compares it with native fetch. axios is compiled for the client to the app's syntax floor. |
| 6.4 | — | SWR: 0 flows (the plan's own "else" path); similar works went to zustand in 6.5 (CS-ZU-3). |
| 6.5a | CS-BAB-2, CS-ZU-1..4 | `invalidatePreviousRequests` as a named wrapper; claim, report, similar-works and data-providers/params stores ported to vanilla zustand stores; the components select what they render. |
| 6.5b | CS-ZU-5..8, CS-BAB-1 | Search and filters stores ported (MobX copy semantics kept, so Q-043, Q-020 and R-030 stay); Root and the provider without MobX; mobx and mobx-react-lite uninstalled. The decorator Babel plugins stayed until 6.7 because removing them changed the client chunks. |
| 6.6a, 6.6b | CS-TS-4 | Every app `.js/.jsx` in utils, api, hooks, lib, store, modules, templates, main and pages moved to `.ts/.tsx` with type annotations only; the strict config's `include` grows with each directory. |
| 6.7 | CS-BAB-4, CS-BAB-5, CS-SWC-1 | `babel.config.js` deleted: the app builds with SWC; usage-based core-js 3 polyfills of the client kept through `swcEnvOptions`; class fields with define semantics. Jest runs babel-jest with `jest.babel.config.js`, and `test:unit:swc` runs the same projects through `@swc/jest`. |
| 6.8 | CS-SEN-2 | `@sentry/nextjs` replaces `@sentry/browser`, `@sentry/node` and `utils/sentry.js`: `instrumentation.ts`, `instrumentation-client.ts`, `withSentryConfig`. Same integration set, sessions off, exit on uncaught exceptions, request data dropped (SENTRY-REQDATA-1), no browser tracing. Review fix SEN2-ENV-DEV: the environment is the SDK default on the client and `SENTRY_ENVIRONMENT` or the default on the server, as before. |
| 6.9 | CS-DSN-6, CS-CSS-1..4, CS-N12-10 | Design global CSS frozen under `styles/global/design`; app CSS in standard syntax (no custom media, no nesting, prefixes written out); CSS-module reads by the dashed class name; `exportLocalsConvention` patch removed; `postcss.config.js` is `{ plugins: {} }`; Next's own CSS minifier instead of cssnano-simple. The same rendered CSS (T-003 rows AD-753..AD-838, T-801 and T-802 0 px). |
| 6.10 | CS-W0-11, L1 sweep | caniuse-lite and browserslist unpinned; `@sentry/nextjs` 11.14.0, typescript-eslint 8.73.0, html-validate 11.21.1. |
| 6.F | review fixes | P6-SEN-SERVER-TIMING: `@sentry/nextjs`'s server init adds the request's trace to a `Server-Timing` header of uncached HTML responses, with no option to turn it off. A hook in `instrumentation.ts` that runs after the SDK's drops it, so the HTML responses carry no `Server-Timing` header, as before. T-120 c3 checks it. T-602 c4 turns off the `presentation-role-style` rule that html-validate 11.21 added (the markup is the same). |

## 3. Decisions taken during the phase

- 6.0 folded into 6.5; no spike branch.
- 6.4: SWR not adopted (0 flows); zustand ports similar works.
- CS-NODE-6 (Node 26) not due: it needs Node 26 LTS plus one month (from 2026-11-28), and the Dockerfile is DevOps.
- `ci.yml` (CS-TS-3, CI-3) not touched: DevOps.
- No prod deploys, 14-day windows, C4 or kill matrices: GATE-A becomes this summary.
- 6.7 kept the usage-based core-js polyfills through SWC's env options rather than dropping core-js, so older browsers in `.browserslistrc` still get polyfills.
- 6.F: the T-728 dev inventory was regenerated once on the final tree (T-728 c4 requires an inventory of the current app tree); the same 396 loads and warning signatures.
- 6.F: the e2e run did not use the record pass, so the baselines still pin the behaviour before `978c6e4` (§6).

## 4. Held, and why

- **CS-BAB-6 (`sourceType: 'unambiguous'`):** it recompiled Next's own CommonJS client files with other helper imports, so the client output changed. Moot since 6.7 removed `babel.config.js`.
- **Babel 8:** the lock and peer set did not allow it in 6.10 (Jest-only Babel 8 had unmet peers).
- **typescript 7 as `typescript`:** typescript-eslint 8.73 needs TypeScript below 6.1 and TypeScript 7 has no compiler API; 7.0.2 runs beside it as `typescript-7` for `typecheck:7`.
- **msw 3:** 20 unit reds (network errors from another realm, fake-timer hangs in T-501 and T-504).
- **@playwright/test 1.65:** its Chromium renders T-801 V34 (overflow, 320 px) differently from the baselines. A test tool change that would need new visual baselines.

## 5. Test totals at the end of the phase

Final suite on the 6.10 tip `f1d1fbe` (builds `1fe1f39c6ac9e8d5` default, `811d7ecff9fa6e55` no DSN, `697a55b7d0ab8f62` harness):

| Tier | Result |
|---|---|
| Jest unit | 1154 passed, 4 failed (T-502 c1, §6 A) |
| Jest static | 93 passed, 1 failed (T-004 c6, §6 B) |
| Playwright chromium | 949 passed, 17 failed (§6 A; T-603 c1 and T-602 c4 also carried the two 6.10 regressions fixed in 6.F) |
| Playwright wire (`--no-deps`) | 28 of 28 |
| Visual T-801 (default stack) | 303 passed, 6 failed (§6 A, status checks before any pixel compare; 0 px differences) |
| Visual T-802 (harness build) | 73 of 73 |
| CS-OPS-1 overlay (T-604, T-702) | 26 of 26 |
| T-728 | 90 of 90 |
| Lint | eslint 18 findings (baseline 18), stylelint 12 (expected 12), Prettier 0, inline disables 36, lint:parity OK |

6.F reran on its own builds (default `cab49a887423a3c4`; the client output is byte-identical to `1fe1f39c6ac9e8d5`, only `server/instrumentation.js` and source maps differ):

| Tier | Result |
|---|---|
| Jest unit | 1154 passed, 4 failed (T-502 c1, §6 A) |
| Jest static | 93 passed, 1 failed (T-004 c6, §6 B) |
| Playwright chromium | 943 passed, 23 failed: the 17 of §6 A (T-603 c1 and T-602 c4 now fail only on the 500 status of §6 A; no `Server-Timing` entry left) and 6 of T-728, which passed 90 of 90 when rerun alone on a new dev inventory (the first run overlapped a full Jest run and timed out) |
| Playwright wire (`--no-deps`) | 28 of 28 |

T-801 and T-802 were not rerun: 6.F changes no CSS, markup or client code.

Not run: WebKit and Firefox, `e2e/ops/t901-container` and `test/ops/t901.sh` (all need Docker).

## 6. Open before GATE-A / phase 7

- **A. Tests pinned before the owner commit `978c6e4`.** That commit changes `pages/works/[id].jsx` and `modules/meta/index.jsx`. The tests still pin the old behaviour and are red in every run of the phase:
  - unit T-502 c1 (4 cases: the Q-001 messages are now strings, not a parsed object or a Blob);
  - e2e: `/works/4100`, `4101`, `4102` and `6948813` answer 200 instead of 500, and `citation_publication_date` is `2023` instead of `2023/NaN/undefined` (T-803 c1, T-806, T-601 c1/c3, T-602 c1/c2/c3/c4, T-603 c1, T-610 c2/c3, T-721 c1, T-731 c1/c2, T-729 c1/c2);
  - T-801 V31 (500 page, four variants) and V23-none (two variants): status checks only.

  The owner decides whether these are the intended new behaviour; if so, re-record the baselines (one record pass) and update T-502 c1.
- **B. T-004 c6 (client core-js polyfills).** Two causes, both since the phase began (green at `75a88ea`):
  - `978c6e4`: `/works/[id]`, `/outputs/[id]` and the all-scripts set gain 13 polyfill modules (for example `es.promise.finally`, `es.weak-set`, `es.global-this`);
  - 6.7 (SWC's usage mode instead of Babel's): 12 routes differ; gained `es.array.fill`, `es.math.imul`, `es.object.values`, `es.promise.finally`, `es.weak-set` and others; lost `es.reflect.construct`, `es.object.get-own-property-descriptor(s)`, `web.timers`, `web.set-timeout`, `web.set-interval`.

  Chromium has all of them natively, so nothing shows in the suite. The lost ones matter only for engines older than the code's other needs (`web.timers` is for IE 9's extra timer arguments; `Reflect.construct` exists from Firefox 42). Needs an accepted-diff row, or a check on the oldest `.browserslistrc` targets, before the deploy.

## 7. Before the deploy (owner)

- Everything in `lean-final.md` §7 still applies (Node 24 memory, gateway rule, mention sweep).
- §6 A and B above.
- Sentry: the server now initialises through `instrumentation.ts` (Next's instrumentation hook) and the browser through `instrumentation-client.ts`. Check one real error event from each side in Sentry after the first deploy.
- Push and deploy only after the items above.
