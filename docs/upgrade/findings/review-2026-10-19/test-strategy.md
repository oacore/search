# Adversarial review: 40-test-strategy.md (key: test-strategy)

Reviewer scope: the safety net that has to back the "≥95% confidence" claim (M7), the "nothing is broken before antd" gate (M5), and "every critical point is covered by tests" (M2). Subject repo at f5cfc20 (branch docs/upgrade-plan). Date: 2026-10-19. All experiments ran in scratch only (`<scratch>/exp/test-strategy/`). No repo file was modified.

## 0. Verdict

The inventory is detailed and the traceability is internally consistent: 114 tests, 61 P0, and the regeneration snippet prints only `GAP R-065`. But the strategy **cannot back M7 or M5 as written**:

1. **The 95% figure has no measurement.** It appears only in README:13 and in 40 §3.1 ("the table shows how the ~95% confidence target is built up"). "Coverage" means a test ID is listed next to a risk. Nothing proves that the listed test **fails** when the risk happens. There is no fault injection, no mutation score, no code-coverage figure, no flake budget, no corpus or differential testing, and no binary staging or canary thresholds.
2. **The harness is not executable as written on the baseline stack.** The latest MSW 2.x (2.15.0) cannot load on Node 18 and cannot load under Jest CJS. "jest-dom 6.x" now resolves to 6.10.0, which needs Node ≥22 and `@testing-library/dom` 10. The `jest.config.js` sketch puts `transform` at the top level, and Jest ignores it inside `projects`. All three were verified by running them.
3. **The thing under test is not what ships, in four ways:**
   - `build:test` drops the Dockerfile's post-build `cp` of `icons.svg` and `images/*`.
   - The golden image, built from the production Dockerfile, runs the live data-loader, so its data is not the frozen snapshot.
   - The default harness never sets the production `Internal_API` path.
   - The in-process MSW SSR recorder records the `Host` header the app set, not the one sent on the wire. So R-016-class changes, including the phase-6 axios change, are invisible to the "Network (server)" parity row.
4. **Several detectors cannot fire for the failure they are mapped to:**
   - T-605 misses the 251 `className={styles.x}` sites. React omits the attribute when the value is `undefined`, so there is no `class=""` to find.
   - T-701 is blind on the baseline. React 17 production builds print no hydration-mismatch warnings.
   - The Jest store and hook tests (T-202, T-204, T-302) use a static router mock, so they cannot see the Next-router triggers of R-018 and R-019.
   - T-209 and T-203 are MobX-API tests that must be rewritten in phase 6. They cannot be "re-run against zustand".
5. **Ops gates are not implementable:**
   - Staging differs from prod in replicas, limits and HPA. It also differs in SSR routing: on staging the main API calls go to the public `api-stg` host, not `Internal_API`.
   - The manifests have no canary mechanism.
   - The nightly G6 gate contradicts the frozen-data 0-px baselines.

The Playwright black-box layer (G/H/I) is the right backbone. Most fixes move confidence onto that layer and make it measurable.

---

## 1. Resolved VERIFY items (with evidence)

| # | Item | Answer | Evidence |
|---|---|---|---|
| V1 | Which fetch the Next 10 server uses on Node 18 | **Native (undici).** The polyfill is conditional. | `node_modules/next/dist/next-server/server/node-polyfill-fetch.js`: `if(!global.fetch){global.fetch=_nodeFetch.default;…}` |
| V2 | Does the MSW `--require` preload intercept SSR fetches under `next start` on Next 10? | **Yes, with msw 2.11.1 on Node 18.20.8.** | Minimal Next 10.2.3 app in scratch, gSSP fetch → page rendered `{"mocked":true}`. The preload log shows interception for both the public URL and the `Internal_API` URL. |
| V3 | Same question for Next 13.5–16 | **In-process. The preload is inherited.** `patchFetch` is applied only for app-router paths. | `next@16.4.2 dist/server/next-server.js:549` `ComponentMod.patchFetch()` inside the `appPathsManifest` loop; `router-server.js` requires `./render-server` (13.5.11, 14.2.35, 16.4.2). Note: 13.4.x used render workers, but the track skips it. |
| V4 | RouterContext module path per version | 10: `next/dist/next-server/lib/router-context.js`; 12.3.7: `dist/shared/lib/router-context.js`; 13.5.11 / 14.2.35 / 16.4.2: `dist/shared/lib/router-context.shared-runtime.js` | `ls` of the packed tarballs |
| V5 | Does `next/jest` honour a custom Babel config? | **No.** It always uses `../swc/jest-transformer`. It also maps `*.module.css` to `object-proxy.js` **before** custom mappers, puts `.module.css` in `transformIgnorePatterns`, and its fileMock returns `{src,height,width,…}`. | `next@16.4.2 dist/build/jest/jest.js:173-227`; `__mocks__/fileMock.js` |
| V6 | Latest MSW 2.x | 2.15.0 (2026-07-08). From **2.11.2** on, the CJS build `require()`s ESM-only `rettime` / `until-async`, so it **fails on Node 18** (`ERR_REQUIRE_ESM`) and **fails under Jest 29 CJS even on Node 22** ("Cannot use import statement outside a module"). Last safe version is **2.11.1**. msw latest is **3.0.3**: `type: module`, `engines.node >=22.12.0`. | `npm view msw@2.11.2 dependencies` (rettime appears); runs in `exp/test-strategy/msw-node18`, `jestmsw`, `jestmsw2111` |
| V7 | jest-fixed-jsdom latest | 0.0.11, peer `jest-environment-jsdom >=28`. Sets `customExportConditions ['']`. | `npm view`; `package/index.js:16` |
| V8 | Can Jest 30 run on the React 17 stack? | **Yes.** jest 30.5.2 + babel-jest 30 + jest-fixed-jsdom 0.0.11 + msw 2.11.1 + RTL 12.1.5 + jest-dom 6.9.1 + React 17.0.2 passes on Node 18.20.8. | `exp/test-strategy/jest30stack` (1 passed) |
| V9 | jest-dom 6.x | 6.9.1 is the last version with `node >=14` and no peer. **6.10.0 needs `node >=22` and peers `@testing-library/dom >=10 <11`.** 7.0.1 is the same. | `npm view @testing-library/jest-dom@6.10.0 engines peerDependencies` |
| V10 | Q-022 on Node 18: does native fetch honour `Host`? | **No**, on Node 18.20.8 / 20.19 / 22.18 / 24.18. The wire `Host` is `127.0.0.1:<port>`. | `exp/test-strategy/hosttest/h.js` |
| V11 | Playwright latest | 1.64.1 (2026-10-14). `engines.node >=20`. MCR has arch-specific tags `v1.64.0-noble-arm64` / `-amd64`, plus a new `resolute` base. | `npm view`; `https://mcr.microsoft.com/v2/playwright/tags/list` |
| V12 | Does the React 17 prod build print hydration warnings? | **No.** `react-dom.production.min.js` has 0 occurrences of "did not match"; the development build has 2. | grep in `node_modules/react-dom/cjs` |
| V13 | ICU region names, Node 18 → 22 → 24 | Identical for all 676 two-letter codes. md5 `90601c37…` for 18.20.8, 22.18.0 and 24.18.1. TR is already "Türkiye" on Node 18. These were macOS nvm builds; node:alpine is **UNCONFIRMED**. | `exp/test-strategy` inline run |
| V14 | Do inline `projects` inherit a top-level Jest `transform`? | **No.** A top-level `transform` gives `SyntaxError` on `.module.css`; the same transform inside the project passes. | `exp/test-strategy/projtx2` |
| V15 | CSS-module class-name format across Next versions (webpack) | Identical: `[name]_[local]__` + md5(`filePath:…#className:…`) base64 5 chars, in 10.2.3, 12.3.7, 14.2.35 and 16.4.2. **So class names in the HTML are byte-stable across the track** (until Turbopack or path moves). | `dist/build/webpack/config/blocks/css/loaders/getCssModuleLocalIdent.js` in each version |
| V16 | Uncaught-exception semantics today | With `SENTRY_DSN` set, Sentry 5's `OnUncaughtException` calls `logAndExitProcess` → `process.exit(1)` after flushing. The app's own `process.on` handler does not prevent this. Sentry 7.119 keeps `exitEvenIfOtherHandlersAreRegistered: true`. | `node_modules/@sentry/node/dist/integrations/onuncaughtexception.js:40-70`, `dist/handlers.js:240-258`; `@sentry/node@7.119.0 cjs/integrations/onuncaughtexception.js:12` |

---

## 2. Black-box vs white-box classification (feasibility across Next 10/React 17 → Next 16/React 19)

| Group | Kind | Coupled to | Valid detector for | Blind to / breaks for non-app reasons |
|---|---|---|---|---|
| A T-001 lint | tool | ESLint 7 / stylelint 13 until W1 | R-049/R-050 | Retired at W1 (new baseline) |
| A T-002 (source part) | static | none | typos in `styles.x` keys | The actual R-001 trigger (the build no-op) |
| A T-003 / T-005 / T-007 / T-010 | build-artifact white-box | `.next/` layout and manifest formats (routes-manifest shape, `build-manifest`, `.next/server/pages` vs chunks, Next 16 prints no sizes) | CSS drift (R-008/R-009/R-043), assets | **Needs a per-Next-version adapter.** Adapter changes must be proven on the golden build (see F-08) |
| A T-004 | build white-box | server bundle layout per Next major | R-032/R-040/R-044 | Same |
| B unit | white-box, version-light | Node (T-104/T-108), babel-jest | pure logic | Mostly stable; T-104 must run with MSW disabled (MSW would intercept the localhost echo) |
| C store | white-box | MobX, Babel, **static `next/router` mock** | R-011/R-046 (W3, W9) | **Blind to Next-router changes (R-018/R-019 triggers, W4/W6/W7)**. Rewritten in phase 6 (module APIs replaced) |
| D hooks | white-box | RTL / React / router mock | React scheduling (StrictMode, R18 batching) | Router event timing (mocked) |
| E components | white-box | React, RTL→dom version, jsdom, real `next/link` + RouterContext path, CSS transform | R-012, R-013, R-037, R-056 | All build/CSS/asset risks (R-001, R-007, R-008, R-021, R-022): the Jest transform and mocks emulate the convention, so they **cannot** see the build regress |
| F gSSP in-process | white-box | page module import via babel-jest, MSW, Node | exact request building / props (phase 6) | Next's renderer: R-045 validation, redirect / notFound handling, serialization, trailing slash |
| G/H/I Playwright | **black-box** | Playwright + Chromium + container pin, proxy, fixture resolver | Everything user-visible | Only tool pins (handled by §7.5) |
| J ops | black-box | cluster | real gateway / CF / traffic | See F-17/F-18 |

**Consequence.** Only G/H/I (plus the version-agnostic parts of B) are oracles that stay trustworthy across every wave. The Jest layer is valuable for W3, W9 and phase 6, but it must not be counted as an "independent layer" for build, CSS, routing or SSR-framework risks.

---

## 3. Findings

### F-01 (critical, M7/M5) — "≥95%" is not measured; propose a binary confidence model
- **Evidence:** README.md:13 states the goal. 40 §3.1 calls the coverage table "how the ~95% confidence target is built up". §3.3's gate lists "P0 green, pixel 0, SEO identical…". No document defines a metric, a sample size, a fault-injection proof, mutation or coverage targets, a flake budget, or soak/canary thresholds. `grep -n "95%\|confidence\|mutation\|coverage\|flak"` over the plan finds only those lines.
- **Why it matters:** the traceability snippet proves a test ID is *listed* for each risk. It does not prove the test *fails* when the risk happens (see F-05, F-06, F-07 for listed tests that cannot fail).
- **Recommendation:** add a new §3.4 "Confidence model". It is binary per wave and recorded in the README status:
  - **CM-1 Detector proof (fault injection, "risk mutants").** `test/mutants/R-xxx.patch` holds ≥1 scripted mutant per Critical/High risk (33) and per SILENT Medium risk (15). Each is applied to the baseline commit in CI and never merged. Examples:
    - R-001: `return config` before the css-loader patch.
    - R-002: drop `useInterceptNextDataHref`.
    - R-003: drop or reorder one `citation_*` meta.
    - R-004: module-singleton store.
    - R-007: image import returns `{src}`.
    - R-008: a custom-media rule that never matches.
    - R-011: remove one `@observable`.
    - R-012: strip `Histoslider.defaultProps`.
    - R-013: nest an `<a>`.
    - R-016: use node-fetch, which honours `Host`.
    - R-019: `pathname:'/search'`.
    - R-020: `trailingSlash:false`.
    - R-021: drop the `/static` rewrite.
    - R-022: remove a symbol from the sprite.
    - R-023: reorder CSS imports in `_app`.
    - R-026: remove a CSP host.
    - R-028: send the claim with a JSON content type.
    - R-030: immutable facet update.
    - R-041: skip the consent check.

    **Gate:** the P0 suite kills 100% of Critical and High mutants and ≥90% of Medium ones. A mutant killed only by T-801 is flagged "single-layer". The kill matrix is published per wave.
  - **CM-2 Mutation score.** Stryker on `api/ utils/ store/ hooks/ lib/ templates/**/{utils,hooks}`: ≥80% overall and ≥90% for `api/index.js`, `api/internalize.js`, `utils/filters-transform.js`, `store/filters.js` and `hooks/use-sync-url-params-with-store`. Measure at the end of phase 2 and again before phase 6. This needs a spike: Stryker 10 parses with Babel 8 and the stage-3 `decorators` plugin (`@stryker-mutator/instrumenter@10.0.0 dist/src/parsers/js-parser.js:7-18`), while the app uses Babel 7 legacy decorators, so set `mutator.plugins` explicitly. **UNCONFIRMED** whether it loads `babel.config.js`.
  - **CM-3 Coverage.** Merge V8 coverage from Jest, the Playwright browser (`page.coverage`) and the server (`NODE_V8_COVERAGE` on `next start`). Gate: ≥90% of app-source statements, and 100% of the files listed in 20 for the wave executed by at least one black-box test.
  - **CM-4 Differential corpus.**
    - Take N ≥ 1,000 real paths stratified from 30 days of gateway or Cloudflare logs (works / outputs / search / data-providers plus edge URLs).
    - Record API responses once through the SSR stub (F-03) and replay them to the **golden image and the candidate image side by side**.
    - Per URL, compare: status, allow-listed headers, normalised SSR HTML, the class census (F-05), `__NEXT_DATA__.props` (F-22), the `_next/data` JSON, console and pageerror output, and the browser request trace. Compare screenshots at 1440/768/375 for a 10% subsample.
    - **Gate:** 0 unexplained diffs. **Statistic:** 0 failures in N independent URLs gives a 95% upper bound on the per-URL defect rate of ≈3/N (rule of three), i.e. 0.3% at N=1,000. This is the literal "95% confidence" statement M7 asks for.
  - **CM-5 Determinism.** See F-12. The gate runs with `retries: 0`.
  - **CM-6 Staging.** See F-17. Prod-equivalent configuration plus traffic replay, with numeric thresholds.
  - **CM-7 Canary.** See F-18. Weighted traffic split, a minimum of 24 h and 100k requests, numeric thresholds and auto-rollback.
  - **M5 gate S** = CM-1…CM-7 all green at the final versions (CM-4 at N ≥ 2,000), all P0 and P1 green, 0 px against golden, a signed accepted-diff ledger (F-24), and 2 weeks of production with no regression issue.

### F-02 (critical) — The MSW versions as written break the harness on the baseline stack; no path to latest (M1)
- **Evidence:**
  - 40 §2.4/§2.7 say "msw 2.x (≥2.4) [VERIFY latest 2.x] … Node 18–22".
  - msw@2.15.0 on Node 18.20.8 fails with `ERR_REQUIRE_ESM … rettime/build/index.mjs`.
  - Under Jest 29 on Node 22 it fails with `SyntaxError: Cannot use import statement outside a module (rettime)`.
  - The ESM-only dependencies first appear in 2.11.2 (rettime) and 2.11.3 (until-async).
  - msw@2.11.1 passes on Node 18 and 22, in Jest and as a `next start` preload (V2, V6).
  - msw@3.0.3 is `type: module` with `node >=22.12.0`.
- **Recommendation:**
  - Pin `msw@2.11.1` exactly from phase 2 to W4d, and note why.
  - After Node 22 (W4e), move to msw 3 in a "test-tooling bump" step. Prove it by running the old harness and the new harness against the golden baseline commit and getting identical results. In Jest, msw 3 needs `transformIgnorePatterns` for `msw|@mswjs|rettime|until-async|headers-polyfill|@msw` plus a Babel transform, or Jest ESM mode (spike).
  - Preferably remove MSW from the SSR path altogether (F-03).

### F-03 (high) — SSR mocking: the in-process MSW recorder hides wire-level differences, and the default harness skips the production `Internal_API` path
- **Evidence:**
  - Prod sets `Internal_API=http://core-frontend-api.core-frontend.svc.cluster.local` and `Internal_API_HOST=api.core.ac.uk` (`kube/prod/deployment.yaml` env).
  - `api/index.js:63-66` and `lib/loader.js:30-34` then rewrite every SSR call and add `Host`.
  - 40 §2.5 runs `next start` without these variables. They are set only in T-607 (P1).
  - Under the MSW preload, a request sent with `headers:{Host:'api.core.ac.uk'}` is recorded as `recordedHost: "api.core.ac.uk"`, but the real wire `Host` is the service host (V10; `exp/test-strategy/hosttest/m.js`).
  - The parity row "Network (server) … headers … Host" (40 §1) is therefore not what prod sends. A phase-6 axios swap would change the wire `Host` (06 says axios honours it) while the MSW record stays the same.
  - MSW also synthesises responses in its own way (`response.url`, compression, keep-alive, redirects).
- **Recommendation:**
  - Make the **primary** SSR mock a real HTTP stub process. It shares the one fixture resolver, records method, URL, headers and raw body at socket level, and is reached through `Internal_API=http://stub:8001` and `Internal_API_HOST=api.core.ac.uk` **in every run**, which mirrors prod.
  - Keep MSW only for Jest. This is version-independent: it works for node-fetch, undici and axios alike, and needs no preload inside the image.
  - Calls to hard-coded hosts that are not `api.core.ac.uk` (doi.org, logo hosts) are resolved by giving the app container a DNS override or `HTTPS_PROXY`-style egress to the stub, or are recorded as "blocked" and counted. Pick one mechanism. **UNCONFIRMED** which hosts the server contacts beyond `api.core.ac.uk`; capture this with a network namespace that denies egress during baseline.

### F-04 (high) — The tested build differs from the shipped image (build:test, the golden image and the runtime env)
- **Evidence:**
  - The Dockerfile post-build step `cp public/design/icons.svg public/icons.svg && mkdir -p public/images && cp -r public/static/images/* public/images/` (Dockerfile:24-27) is absent from `build:test` (40 §2.5).
  - `iconsPublicPath=/static/search/icons.svg` (`node_modules/@oacore/design/lib/config.js`). The gateway strips `/static/search`, so the icon request is `/icons.svg`, which exists only after the Docker `cp`. A local `build:test` + `next start` baseline would 404 every icon, and T-418/T-721/T-801 would pin a broken baseline.
  - §6.2 builds the golden image from "the production Dockerfile with the test build args". That Dockerfile runs `npm run build` = `node ./data/data-loader.js && …` (package.json scripts.build), which fetches live data with no auth header (`data/data-loader.js:15-27`). Either the golden image gets fresh data that is **not** the frozen snapshot used by CI's `build:test`, or, offline, the build crashes (an unhandled rejection exits non-zero).
  - At runtime prod overrides `NODE_OPTIONS=--max-old-space-size=1024` and sets `UV_THREADPOOL_SIZE=32` (`kube/prod/deployment.yaml`). 40 §2.5 replaces `NODE_OPTIONS` with `--require …`.
- **Recommendation:**
  - Add `Dockerfile.test`, identical to the Dockerfile except that it (a) copies `test/fixtures/data-snapshot/*` over `data/` and (b) runs `design build icons && next build` plus the **same `cp` lines**. A CI diff check keeps the two files aligned.
  - Build the golden image and every candidate with it.
  - Run every Playwright test against that image with prod's runtime env plus `Internal_API` pointing at the stub. Append to `NODE_OPTIONS`; never replace it.
  - Specify the docker-compose topology: app image (`node:<wave>-alpine`), proxy, SSR stub, and the Playwright runner container.

### F-05 (high) — R-001 detectors cannot see the most common failure shape
- **Evidence:**
  - 251 direct `className={styles.x}` sites and 53 `classNames.use(styles…)` sites (grep over `pages templates modules main`).
  - When `styles.x === undefined`, React omits the attribute, so there is no `class=""` and no `class="undefined"`.
  - The design `classNames…toString()` filters falsy values, giving `''` → `class=""` only when **all** of its classes are missing (`node_modules/@oacore/design/lib/utils/class-names.js`).
  - T-605 looks for `class=""` / `class="undefined"` only (40 T-605).
  - The Jest CSS transform (40 §2.3) always emits camelCase keys, so the Jest layer cannot see the webpack patch no-op.
  - T-002's "built class map" part is `[VERIFY]`.
- **Recommendation:** replace T-605 with a **class census**. For every SSR HTML response and every post-hydration DOM state in the matrix, store `(DOM path, ordered class tokens)` and compare it exactly with the baseline. This is feasible because local class names are byte-stable across Next 10→16 with webpack (V15). It catches R-001 in any shape, as well as R-007 attribute values, R-012 NaN attributes and R-013 nesting. Mutant M-R001 (F-01) must be killed by this census without relying on T-801.

### F-06 (high) — The hydration detector is blind on the baseline, and 40 states the wrong expectation
- **Evidence:**
  - V12: the React 17 production bundle has no mismatch warnings.
  - 40 T-701 says "On React 17 the allow-list includes today's 'Text content did not match' warnings (Q-050/Q-051 pinned)". In a `next build && next start` run these never print, so the baseline cannot characterise which nodes mismatch.
  - The dev mode alternative is unavailable: `NextApp` returns `null` on the server in dev (`pages/_app.jsx:148-155`, Q-052).
- **Recommendation:** add a black-box **SSR-vs-hydrated DOM diff**:
  1. `request.get(url)` the SSR HTML.
  2. Load the same URL in browser TZ UTC, LA and Tokyo.
  3. After hydration, diff text and attributes per node.

  React 17 silently patches mismatches, so the diff *is* the mismatch census (Q-050, Q-051, and the `Intl.DisplayNames` part of R-010). From W6 onward, `pageerror` and recoverable errors are an extra signal. Correct the T-701 wording. Run the same check on the WebKit and Firefox engines (CLDR differs; T-724 is P2 today).

### F-07 (high) — "Two independent layers per Critical/High risk" is false, and several listed tests cannot fire
- **Evidence:**
  - 40 §3.1: "Every Critical/High risk is covered by at least two independent layers". 40 §5 lists R-004 → T-209 only and R-014 → T-008 only.
  - R-018 (T-302/T-722) and R-019 (T-202/T-204/T-704/T-706) are triggered by Next-router internals, but T-302/T-202/T-204 run against the static mock in `test/mocks/next-router.js` (40 §2.2), so only the Playwright journeys can fire.
  - R-045 (stricter gSSP validation in Next's renderer) cannot be seen by in-process gSSP calls (T-501/T-504). Only T-601 can.
  - T-203 checks `isObservableProp/isComputedProp/isAction`, and T-209 calls `initStore/useStore`. Both are MobX-specific (40 T-203, T-209), so they cannot be "re-run against zustand" in phase 6.
- **Recommendation:**
  - Add per-risk columns: "black-box detector", "white-box detector", "mutant killed by".
  - Add a black-box concurrency test for R-004 (F-23) and a peer-dependency gate for R-014: `npm ls --all` problems equal the baseline set.
  - Restate the claim as "≥1 black-box detector proven by its mutant, for every Critical and High risk".

### F-08 (high) — No protocol for changing test infrastructure mid-track; the suite becomes an untrustworthy oracle
- **Evidence:**
  - **Router mock.** It must track the public router interface of each Next version: Next 10 `next/link` calls `router.prefetch` after `useIntersection`, but the mock lists only push/replace/query/asPath/pathname/events (40 §2.2).
  - **RouterContext path** changes three times (V4).
  - **RTL 12 → 16.** RTL 16 requires a peer `@testing-library/dom ^10.0.0` (`npm view @testing-library/react@16.3.3 peerDependencies`), while RTL 12 bundles dom ^8. dom 9 changed `ByRole` options and dom 10 changed roles through aria-query 5.3.0 (https://github.com/testing-library/dom-testing-library/releases/tag/v9.0.0, …/v10.0.0). So "swap in one file, test bodies unchanged" does not hold.
  - **React 18.3 warnings.** React 18.3 dev prints "Support for defaultProps will be removed from function components" (`react-dom@18.3.1 cjs/react-dom.development.js`). The design lib has 2 files with `defaultProps` (Histoslider, MathMarkdown), so the `setup-dom.js` console gate (seeded from the React 17 baseline) fails W6 for a known, already-registered risk.
  - **Baseline rule.** §9.5 forbids changing baselines.
- **Recommendation:** add §2.8 "Harness change protocol":
  1. Changes are allowed only in `test/{utils,mocks,transforms}/**`, `jest.config.js` and `playwright.config.*`, each in its own PR.
  2. Each change must produce identical results when run against the **golden baseline commit** (old app + new harness). This is the oracle-equivalence proof.
  3. Use `@testing-library/dom@10.4.2` queries from day one: `screen`/`within` imported from dom 10, with dom 10 configured to use the React 17 `act`. Then the RTL swap at W6 touches only `render`.
  4. A generated mock-contract test asserts that the router mock has every public member of `require('next/router').default` for the installed version.
  5. Console allow-lists are versioned: entries are added per React or Next version, and only with a reference to an R-/Q- ID (see the ledger in F-24).

### F-09 (high) — The `next/jest` migration note does not work
- **Evidence:**
  - 40 §2.2: "When moving to next/jest, keep moduleNameMapper and the CSS transform from this section."
  - `next@16.4.2 dist/build/jest/jest.js:173-192` puts `'^.+\.module\.(css|sass|scss)$' → object-proxy.js` first; "custom config comes last".
  - The same file at `:222-227` puts `.module.css` in `transformIgnorePatterns`, which "custom config can append to … but not modify".
  - `__mocks__/fileMock.js` returns `{src:'/img.jpg',height:40,width:40,…}`, while today's mock returns a URL string.
  - The result is that `next/jest` silently reinstates identity-proxy behaviour, which is exactly what §2.3 forbids because it hides R-001.
- **Recommendation:** document a wrapper that post-processes the resolved config. `module.exports = async () => { const c = await createJestConfig(base)(); …}`. Inside it: delete the `.module.css` and image mapper keys, remove `'^.+\\.module\\.(css|sass|scss)$'` from `transformIgnorePatterns`, and re-add the camelCase transform and the string image mock. Add a self-test that fails if `styles.anyUnknownKey !== undefined`.

### F-10 (medium) — The `jest.config.js` sketch is wrong as written
- **Evidence:** 40 §2.2 declares `transform: {…'\\.module\\.css$': …}` at the top level, beside inline `projects`. Verified in `exp/test-strategy/projtx2`: a top-level transform gives `SyntaxError: Unexpected token '.'`, and the same transform inside the project passes.
- **Recommendation:** move `transform` (and `testEnvironmentOptions`) into each project. Add a smoke test that imports one real `*.module.css` file per project.

### F-11 (medium) — Test-tooling versions: some "x.y" ranges are broken today, Jest 29 is an unnecessary later migration, and there is no path to latest (M1)
- **Evidence:**
  - Latest versions: `jest` 30.5.2 (node ^18.14), `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/jest-dom` 7.0.1 (node ≥22), `@testing-library/user-event` 14.6.8, `jest-fixed-jsdom` 0.0.11, `msw` 3.0.3 (node ≥22.12), `@playwright/test` 1.64.1 (node ≥20), `@axe-core/playwright` 4.14.0, Stryker 10.0.0 (node ≥22).
  - jest-dom "6.x" now resolves to 6.10.0, which breaks on Node 18 / dom 8 (V9).
  - Jest 30 already works on the React 17 stack (V8).
- **Recommendation:**
  - Phase 2 uses Jest 30.5.2 (latest), msw 2.11.1, jest-dom 6.9.1, RTL 12.1.5 with dom 10.4.2 queries, user-event 14.6.8, and Playwright/axe pinned by exact version and container digest.
  - Add a "test-tooling to latest" step after W4e (Node 22): msw 3 and jest-dom 7.
  - Add another after W6 (React 18): RTL 16.
  - Add a final one after S: Playwright latest, re-captured from golden.
  - Each step follows the F-08 protocol.

### F-12 (high) — Pixel-exact determinism: container architecture, fonts, the stability proof and the flake policy are unspecified
- **Evidence:**
  - Prod builds on `ubuntu-24.04-arm` with `--platform linux/arm64` (`.github/workflows/aks_deploy.yml`). Dev Macs are arm64.
  - 40 §2.5 says only `mcr.microsoft.com/playwright:v<X.Y.Z>-noble`. MCR publishes `-noble-arm64` / `-noble-amd64` variants (V11).
  - §6.2 builds golden images for both architectures, without saying which one the screenshots come from.
  - Playwright docs: "Browser rendering can vary based on the host OS, version, settings, hardware…" and "run tests in the same environment where the baseline screenshots were generated" (https://playwright.dev/docs/test-snapshots).
  - The font stack starts with `roboto, -apple-system, blinkmacsystemfont, "Segoe UI", "Helvetica Neue", arial, "Noto Sans", sans-serif` (`node_modules/@oacore/design/lib/foundation/type.css:3-11`), and no web fonts are loaded (grep finds no `@font-face`). The container therefore renders with whatever fallback it ships, not with what users see.
  - §6.7 accepts "3 runs in a row byte-identical", on the same host and the same day.
  - Retries and the flake policy are not specified.
- **Recommendation:**
  - Fix **one** architecture, arm64, everywhere. Pin the Playwright image by **digest**, in a derived image that adds a pinned font set (e.g. `fonts-roboto`, `fonts-noto-core`) so the first family in the stack is the one exercised.
  - Run CI on `ubuntu-24.04-arm`. Drop the amd64 golden image or keep it for smoke tests only.
  - Stability proof: 10 runs over 2 days on 2 hosts (CI runner and dev Mac Docker), with shuffled order and workers 1 and 4, all identical.
  - Gate: `retries: 0`; a "flaky" result counts as a failure; flake budget <1 per 100 runs over the trailing 2 weeks, otherwise wave entry is blocked.
  - Prefer the `toHaveScreenshot` options `animations:'disabled'` and `caret:'hide'` over a global `transition:none`. Leaflet zoom and markercluster rely on `transitionend`, so a global override could freeze map states (**UNCONFIRMED**; the 10-run proof will show it).

### F-13 (high) — Randomness and clock determinism: the seeding approach is not stable across versions, and the server clock is not frozen
- **Evidence:**
  - `pickFeaturedMember` uses `Math.random` in gSSP (`templates/search/utils/featured-member.js:24-32`, called from `pages/search/index.jsx:103`).
  - Earlier in the same request, gSSP consumes another random number (`pages/search/index.jsx:49` `reqId`), and so can any library in the server process.
  - With a seeded PRNG in the preload (40 §2.5/§7.3), the member chosen depends on how many `Math.random` calls happened before it in the process. That changes with test order, worker count, Next version and Sentry version.
  - 07 §5 V1 instead says to "mask member card (random pick; fixture 1 member…)". 40 §7.6 says the mask list is empty.
  - The server clock is real, while only the browser uses `page.clock`. `MAX_YEAR` is computed at module load (`modules/filters/year/hooks/use-year-filter-controller.js:6`, cited as `:4` in 40), and `lib/loader.js:37` uses `getDate()`.
  - `page.clock.install()` fakes `setTimeout` and `requestAnimationFrame`, which stalls Leaflet, debounce and toast code unless the clock is advanced explicitly.
- **Recommendation:**
  - Make the `/members` fixture return exactly one eligible member for every page-level test. Then `floor(r*1)=0` for any `r`, independent of the RNG.
  - Test the multi-member selection only in Jest (T-113), with a seeded stub.
  - Freeze `Date` in the server process by preloading `@sinonjs/fake-timers` with `toFake:['Date']`, or prove independence: run the SSR HTML corpus with the server clock shifted by +400 days, and require identical output.
  - Use `setFixedTime` for visual tests and `install()` only in timer journeys.
  - Reconcile 07 §5 with 40 (40 wins).

### F-14 (medium) — The viewport set misses most CSS breakpoint bands
- **Evidence:** breakpoints in the shipped CSS include:
  - `max-width:768px` (16 occurrences; the "tablet 768" viewport is *inside* it)
  - 780px and 876px (`node_modules/@oacore/design/lib/modules/documentation-membership/styles.css:171,207`)
  - 950px (`elements/cookies/cookies.css:36`)
  - 80rem = 1280px (`foundation/layout.css:9`)
  - 85rem = 1360px (`elements/footer/footer.css:7`)
  - 93rem = 1488px with min 768px (`modules/header/advanced-search.css:79`)
  - 22.5rem = 360px (`footer.css:198`)
  - 35rem and 33rem
  - `--screen-until-large-desktop` 1200px (`main/media-queries.css:2`)

  The matrix uses 1440, 768, 767 and 375 (40 T-801). Nothing above 1488 is tested (e.g. 1920, the most common desktop width) and nothing ≤360.
- **Recommendation:**
  - Generate the width list automatically from the built CSS: one width inside every band, plus 1920 and 320.
  - Run full-page pixels at 4–5 representative widths.
  - At all other band widths, run a cheap **geometry census** instead of pixels: `getBoundingClientRect` and `display/visibility` for every element.

### F-15 (medium) — Interaction pseudo-states and non-default cascades are uncovered
- **Evidence:**
  - 07 §5 says "hover state off" (V2).
  - The matrix has no `:hover`, `:focus-visible` or `:active` captures.
  - R-023 and R-043 (cascade and ordering drift) and phase-7 focus-ring parity (50 §5: "focus rings … main cost driver") live exactly in those states.
- **Recommendation:** add T-805, a computed-style census. For each page or state, record `getComputedStyle` for a fixed property list on every element, then again with CDP `CSS.forcePseudoState` (`hover`, `focus`, `focus-visible`, `active`) on interactive elements, and diff exactly. This is deterministic, version-independent, and directly reusable for D5. Add T-806, ARIA snapshots (`toMatchAriaSnapshot`) per page and state, as the semantic oracle for phase 7.

### F-16 (high) — The nightly gate (G6) contradicts the frozen baselines, and the tested image is not the deployed image
- **Evidence:**
  - G6: "The nightly cron must run G2–G4 on the fresh build before pushing the image". But §7.4 says test builds use the frozen snapshot and that "Data-refresh commits … must not change test builds".
  - The prod nightly (`cron: '0 3 * * *'`) rebuilds from `main`, with the live data-loader and with secrets inlined at build (`env.config.js` puts `API_KEY`, `SENTRY_DSN`, `GA_TRACKING_CODE` and `API_URL` in `next.config.js` `env`).
  - So the deployed image is never the image G4 tested, and a 0-px or SEO gate against fresh data would fail on every data change.
- **Recommendation:** define two artefacts.
  - **(a)** The parity image (`Dockerfile.test`, frozen data) runs the 0-px, SEO and network parity gates.
  - **(b)** The release image is built **once** per commit and promoted by digest to staging and prod. The nightly data refresh then runs only data-independent black-box checks against it: status matrix, class census on fixed IDs, console/CSP, the asset 4xx check, and SEO tag presence/shape (not content).
  - Add a check that the parity image and the release image share the same `.next/server` and `.next/static` file list modulo data chunks.

### F-17 (high) — The staging soak does not reflect prod, and has too little traffic to detect anything
- **Evidence:**
  - Staging runs `replicas: 1` with no HPA and limits of 1500m CPU / 1Gi memory. Prod runs HPA min 4 / max 15 with limits of 600m / 768Mi (`kube/stage/deployment.yaml` vs `kube/prod/*`).
  - The staging build uses `APP_ENV=staging` (`aks_stage_deploy.yml`), so the main SSR calls go to `https://api-stg.core.ac.uk/internal`. That host does not match `Internal_API_HOST=api.core.ac.uk`, so they are **not** internalised (`api/internalize.js:24`).
  - Only the hard-coded `api.core.ac.uk` URLs (loaders, logos) take the in-cluster path.
  - T-902's "Host header seen by the internal API" and "RSS vs 768 Mi" therefore cannot be observed on staging. 40 §3.2.1 says "against the real staging API".
- **Recommendation:**
  - Soak the **production-config** image (`APP_ENV=production`) in the staging namespace with prod limits and ≥2 replicas.
  - Replay sampled prod traffic (CM-4 corpus, at prod rate) against the baseline image and the candidate image in turn.
  - Gate: 0 restarts or OOMKills; 5xx count no higher than the baseline image's on the same replay; p95 ≤ 1.10× baseline; max RSS ≤ 1.10× baseline and < 700 Mi.
  - Record in 10/40 that R-016 can only be verified in prod or on a prod-config pod.

### F-18 (high) — The canary (T-903) cannot be implemented as written, and its telemetry is unverified
- **Evidence:**
  - The manifests have one Deployment with an HPA and `RollingUpdate maxSurge 2` (`kube/prod/deployment.yaml`). There is no second backend and no `weight` in `httproute.yaml`. "Roll out by image digest; observe 1 h" (T-903) is a rolling update, not a canary.
  - With two versions live, `_next/data/<buildId>` requests hitting the other version return 404 and trigger a hard reload. This confounds R-002 and GA metrics.
  - Browser Sentry may already be blocked by CSP: `connect-src … sentry.io` does not match `*.ingest.sentry.io` (csp.config.js). The prod DSN host is **UNCONFIRMED**.
  - The app collects no Web Vitals (no `reportWebVitals` in `pages/_app.jsx`).
- **Recommendation:**
  - Add a `core-frontend-search-canary` Deployment and Service, and use HTTPRoute `backendRefs` weights (10%, then 50%).
  - Optionally pin users by matching a canary cookie header, to avoid buildId skew.
  - Run for ≥24 h and ≥100k requests. Gates against the stable backend in the same window: SSR 5xx ratio ≤1.0× (two-proportion test, α=0.05), 0 new Sentry server issues, 0 restarts, GA pageviews per session within ±2% (detects R-002 hard reloads), `_next/data` 404 rate at baseline. Roll back automatically on any breach.
  - Before relying on any metric, verify that the telemetry pipelines actually receive data today (part of T-904).
  - Web Vitals come from synthetic Lighthouse runs of both images on the same host. Adding RUM would change GA hits, so it needs an owner decision.

### F-19 (medium) — The test Sentry DSN hides the production CSP behaviour (R-026)
- **Evidence:**
  - The test DSN is `https://k@sentry.io/1` (40 §2.5).
  - `connect-src` lists the exact host `sentry.io` (csp.config.js `'connect-src'`), which matches the test DSN but not an `oNNN.ingest.sentry.io` host.
  - The baseline "0 CSP violations" (T-720) is therefore computed on a DSN shape that prod may not use.
- **Recommendation:** use a DSN with the **same host shape** as the prod secret (e.g. `https://public@o0.ingest.sentry.io/0`). Route that host to a counting stub in Playwright and the SSR stub. The baseline then shows prod's real CSP outcome, which is a PRESERVE quirk if it is blocked.

### F-20 (medium) — GA hit assertions contradict "third parties blocked"
- **Evidence:**
  - §2.5: "Third parties are blocked and counted: GA (`*.google-analytics.com`, `*.googletagmanager.com`)…".
  - T-719 asserts "GA `collect` hits on load and on client navigation with the baseline params (`en`, `dl`, `dt`)".
  - With gtag.js blocked, no `collect` request is ever made.
- **Recommendation:** either serve a **pinned copy of gtag.js** through `route.fulfill` and capture `collect` requests (pinning their parameter set), or assert on `window.dataLayer` / `gtag` call arguments through an init-script spy. Do both for W2 (react-ga4) and W5 (consent).

### F-21 (medium) — Crash semantics are untested, and R-055's premise is wrong
- **Evidence:**
  - V16: with a DSN set, Sentry 5 exits the process on `uncaughtException`, despite `pages/_app.jsx:21-27`.
  - R-055 says the "handlers keep the server alive after uncaughtException".
  - No test covers process survival or exit. A Sentry 7 or 8 bump (W2), or a DSN change, alters pod restart behaviour.
- **Recommendation:**
  - Add T-608. A test-only preload exposes a trigger (e.g. a SIGUSR2 handler that throws asynchronously). The test asserts today's outcome (exit code 1 after the Sentry flush, k8s restart) with a prod-shaped DSN, and asserts the outcome without a DSN.
  - Also assert the `unhandledRejection` path: the server survives and one Sentry event is sent.
  - Correct R-055.

### F-22 (medium) — Server-side observables are not compared: server logs, `__NEXT_DATA__` props, `_next/data` bodies
- **Evidence:**
  - The parity contract strips `<script>` tags for Next chunks (40 §1) and says nothing about `__NEXT_DATA__`.
  - T-604 checks only "200 JSON with pageProps".
  - gSSP logs with `console.time` and `log(error)` (`pages/search/index.jsx:49-75`).
  - Errors swallowed in `lib/loader.js:63-70` are visible only in logs.
- **Recommendation:**
  - Compare `__NEXT_DATA__.props` (deep-equal, with framework keys normalised) for every corpus URL, and the normalised `_next/data` JSON for the client-navigation set.
  - Add a server-log census: capture the app container's stdout/stderr per test, normalise timings and IDs, and allow only the baseline set.
  - Count server-side Sentry events sent to the stub (expected: 0).

### F-23 (medium) — No black-box isolation or concurrency test for R-004 / R-018
- **Evidence:**
  - R-004's only detector is Jest T-209 (40 §5), which is tied to the MobX `initStore` API (`store/index.jsx:12-21`).
  - The phase-6 risk is a module-singleton zustand store that leaks state across SSR requests.
- **Recommendation:** add T-609. Fire 200 interleaved parallel SSR requests (q=A / q=B, works 1001 / 1002) with randomised fixture latency. Assert that every HTML and `__NEXT_DATA__` contains only its own request's data. This works on any store implementation and any Next version.

### F-24 (medium) — Accepted differences have no mechanism; the "never update a baseline" rule conflicts with the open decisions
- **Evidence:**
  - §9.5 allows a baseline change only "through §6 re-capture … or an explicitly documented owner decision".
  - OD-05 (90:78-79) recommends accepting ICU diffs.
  - T-108 keeps "per-Node-major" snapshots, which is an implicit re-baseline.
  - Console allow-lists must change at React 18.3 and 19 (F-08).
  - The ESCALATES fixes (Q-050/051/052) change console output.
  - There is no file format for any of this.
- **Recommendation:**
  - Add `test/baseline/ACCEPTED-DIFFS.yml`. Each entry has: test ID, selector or key, expected old value, expected new value, the OD/Q reference, the wave, and approval initials.
  - Comparators apply the ledger. Baselines are never edited. Any diff not in the ledger fails.
  - Note that V13 shows identical region names across Node 18/22/24 on macOS. Run the same check inside `node:18-alpine` and `node:22-alpine` before deciding OD-05 (**UNCONFIRMED** for alpine).

### F-25 (medium) — The T-802 harness page inside the app build changes the gate build
- **Evidence:**
  - T-802 uses `/__design-harness`, "built only in test builds" (40 T-802).
  - OD-30 (90:229-231) proposes compiling it only when `NEXT_PUBLIC_TEST_HARNESS` is set. Every file under `pages/` is built, so this needs a `pageExtensions` switch in `next.config.js` (an app config change).
  - A page importing all design components changes webpack's splitChunks and CSS-chunk composition and order in the parity build. This conflicts with the §6.1 inertness proof and with T-003/T-801.
- **Recommendation:** build the harness as a **separate Next app** (`e2e/harness/`) that imports the app's `postcss.config.js`, the webpack patch (`next.config.js` `webpack()`), the aliases and the design modules. It gets its own build output, and the parity build stays untouched. For phase 7 the same harness renders the antd units.

### F-26 (medium) — The proxy replica's semantics and the URL edge-case matrix are underspecified
- **Evidence:**
  - `kube/prod/httproute.yaml` uses Gateway API `PathPrefix` (element-wise: `/search` matches `/search/x` but not `/searchx`) and `ReplacePrefixMatch`. It has a request timeout of 35 s and a backend timeout of 30 s.
  - 40 §2.5 writes `/search*` (string-glob semantics).
  - Cloudflare sits in front (the "skips Cloudflare" comment in `kube/prod/deployment.yaml`; `cloudflareinsights` in the CSP).
  - T-601 cases are limited to trailing slashes and queries.
- **Recommendation:**
  - Give the proxy its own conformance table (`/searchx` → other service, `/static/search` exact → `/`, `/display` exact → `/outputs`, `/display/123/` → `/outputs/123/`, case sensitivity, `//works/1`, `%2F`, unicode `q`, `q=a+b`, a long URL), and test the proxy against it.
  - Add the same URLs to T-601 and T-602.
  - Identify the gateway implementation (**UNCONFIRMED**) and, if feasible, run that same implementation locally (kind) for the parity runs.

### F-27 (medium) — The inertness proof for test-only additions is incomplete
- **Evidence:**
  - §6.1 compares only `.next/static` hashes.
  - The prod image installs devDependencies (`npm ci --include=dev`, Dockerfile:19), so the test packages ship in the prod image and their install scripts run there (msw postinstall).
  - Runtime code resolves undeclared hoisted packages (`node-fetch`, `@babel/runtime`, `@mdi/svg`; R-054).
  - Build reproducibility (two builds of the same tree identical) is assumed, not proven (**UNCONFIRMED**).
- **Recommendation:**
  - First build the unchanged tree twice and diff, to prove reproducibility.
  - Then, with and without the test devDependencies, require identical `.next/static` **and** `.next/server`, identical `npm ls --all --omit=dev --json`, and identical runtime `require` resolution of the R-054 packages.
  - Record the image size delta.

### F-28 (medium) — Later library versions break Jest for non-app reasons (ESM-only packages, export conditions)
- **Evidence:**
  - `react-ga4@3.0.1` exports only `./dist/index.mjs`, so it is ESM-only.
  - `axios@1.20.0` resolves `default.require → dist/node/axios.cjs` under jest-fixed-jsdom's `customExportConditions ['']` (`jest-fixed-jsdom/index.js:16`). Phase-6 Jest tests would therefore exercise the Node http adapter, while browsers use XHR (credentials, preflight, `Content-Type` of string bodies).
  - msw 3 is ESM-only (V6).
- **Recommendation:**
  - Use `jest.mock(<pkg>, factory)` only, never automock, for ESM-only SDKs.
  - Keep a maintained `transformIgnorePatterns` allow-list with a self-test.
  - In phase 6, assert client-side request semantics only in Playwright (the T-702 browser request log), not in Jest.
  - Spike whether Playwright `route.fulfill` enforces CORS and preflight (**UNCONFIRMED**; https://playwright.dev/docs/api/class-route is silent). Make recorded fixtures keep the real CORS and cache headers.

### F-29 (low) — Inventory balance: P0 includes phase-6-only tests while whole classes of oracle are missing
- **Evidence:**
  - P0 includes T-101, T-102, T-106 and T-205, whose "Wave" column is "phase 6" (40 §4), and T-121 (W9, phase 6).
  - P0 = 61, effort 15–25 person-days (50 §3).
  - Missing classes: fault-injection mutants, class census, SSR-vs-hydration diff, computed-style and pseudo-state census, the breakpoint-band geometry census, ARIA snapshots, server-log census, `__NEXT_DATA__` / `_next/data` diffs, the concurrency/isolation test, crash semantics, the URL edge matrix, the differential corpus, and coverage measurement.
- **Recommendation:**
  - Move the phase-6-only white-box tests to "P1 (before phase 6)".
  - Spend the freed effort on the black-box oracles above, which are mostly generic and run over all routes and states, so they are cheaper per risk.
  - Re-estimate phase 2. The current number does not include the corpus, the mutants or the derived containers.

### F-30 (low) — Clarity and consistency errors a fresh session would trip on (M8)
- **Evidence:**
  - 40 §2.2 cites "(R-010)" for "tests changed together with the code", but R-010 is hydration.
  - `MAX_YEAR` is at `use-year-filter-controller.js:6`, not `:4`.
  - 07 §5 tolerances (`maxDiffPixelRatio: 0.002`, maps `threshold 0.2`, member-card mask) contradict 40 (0 px, `threshold 0`, empty mask).
  - T-004 is not tagged for W2 although R-040 (W2) lists it.
  - The 40 §4 "Wave" column (e.g. T-003 "W4–W8") conflicts with "all P0 tests green" in every wave (§3.3).
  - The container tag needs an architecture and a digest.
- **Recommendation:**
  - Fix the references.
  - State explicitly that 40 overrides the tolerances and masks in 07 §5.
  - Define the "Wave" column as "the waves where a failure is *expected* to be triggered (all P0 tests still run every wave)".

---

## 4. Concrete per-risk detector check (Critical/High)

For each risk: the failure mode, whether the listed detector fires, and the fix.

- **R-001** (CSS camelCase no-op). The detector is partial: T-605 misses attribute omission and the Jest layer is blind. Fix: class census (F-05), plus mutant.
- **R-002** (getDataHref → full reload). T-702's single-`document` plus `window.__marker` check fires. It needs `NODE_ENV=production` (the patch is gated at `_app.jsx:93`) and the proxy. Add GA pageview counts (T-719) as a second signal. **OK.**
- **R-003** (meta tags). T-602 and T-708 fire. Add `__NEXT_DATA__` props (F-22). **OK.**
- **R-004.** Only Jest, which is rewritten in phase 6. Fix: T-609 (F-23).
- **R-005.** T-601 and T-602 fire (black-box). **OK.**
- **R-006.** T-701 `pageerror` fires. **OK.**
- **R-007.** T-605 catches `src="[object Object]"` only in SSR HTML. Modal states such as the claim-success `<image href>` (`claim-success-modal.jsx`) are client-only, so the census must also run on post-interaction DOM. T-721 fires on the resulting 404 behind the proxy.
- **R-008 / R-009.** T-003 (string checks) and T-801 at 375/767 fire. Add band widths (F-14).
- **R-010.** Blind on the baseline; fires only from W6. Fix: F-06.
- **R-011.** T-203 fires for W3 and W9 as long as Jest uses the same compiler as the app. T-704 is the black-box backstop. **OK.**
- **R-012.** T-404 (Jest on React 19) and T-801 fire. **OK.**
- **R-013.** T-406 / T-407 (Jest, real `next/link`) fire. The T-701 hydration check fires on nested `<a>` in React 18+. **OK.**
- **R-014.** T-008 alone. Add `npm ls` problem-set parity (F-07).
- **R-015.** The tests run on a different build than the one deployed. Fix: F-16 build-once-promote.
- **R-016.** MSW masks it, and staging cannot observe it. Fix: F-03, F-17. T-104 and T-607 fire.
- **R-017.** T-117 and T-901 fire. **OK.**
- **R-018 / R-019.** Only the Playwright journeys fire (F-07).
- **R-020.** T-601 fires. Add the URL edge matrix (F-26).
- **R-021.** T-721 fires only if the build replicates the Dockerfile `cp` (F-04).
- **R-022.** T-418 fires against the served sprite only with the Dockerfile `cp`, and only once T-802 is in place (F-04, F-25).
- **R-023 / R-024 / R-025.** T-003, T-417, T-801 and T-802 fire. Add the pseudo-state census (F-15).
- **R-026.** The test DSN masks it (F-19). T-720 fires otherwise.
- **R-027.** T-901 fires on the arm64 image. **OK.**
- **R-028 / R-029 / R-030.** These are phase-6 risks. Wire-level SSR assertions need F-03, and browser assertions belong in T-702 (F-28).
- **R-031.** T-108 and T-801 fire. **OK.**
- **R-032.** T-004 (P1) only. Add mutant proof.
- **R-033.** T-401 fires. **OK.**

## 5. Files referenced
- Plan: docs/upgrade/40-test-strategy.md, 10-risk-register.md, 50-roadmap.md, 90-open-decisions.md, findings/07-ui-features-flows.md
- Code: Dockerfile, package.json, kube/prod/deployment.yaml, kube/stage/deployment.yaml, kube/prod/httproute.yaml, .github/workflows/aks_deploy.yml, aks_stage_deploy.yml, api/index.js, api/internalize.js, lib/loader.js, data/data-loader.js, pages/_app.jsx, pages/search/index.jsx, templates/search/utils/featured-member.js, modules/filters/year/hooks/use-year-filter-controller.js, csp.config.js, next.config.js, utils/sentry.js, node_modules/next/dist/next-server/server/node-polyfill-fetch.js, node_modules/@sentry/node/dist/integrations/onuncaughtexception.js
- Experiments: <scratch>/exp/test-strategy/ (msw-node18, jestmsw, jestmsw2111, jest30stack, projtx2, hosttest, next10app, nextpk, stryker, rd183)
