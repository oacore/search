# 70 — Phase 6: dashboard libraries on the pages router

**Purpose.** Adopt the dashboard's libraries and tooling (D11, M6) in a Next pages-router SSR app without changing behaviour (D1).
**Read it** from GATE-S to GATE-A, at every 6.x step start, with [01](01-playbook.md) (runbook, DoD) and [41](41-test-inventory.md) rows whose Wave lists the step (`6.x` = all).
**Owns:** Adopt/Adapt/Reject table; behaviour-contract additions; specs; steps 6.0–6.10; the CS rows of §4.2. Elsewhere: versions [02](02-version-matrix.md); endpoints, per-action counts 41 §2.1–§2.2; gates [55](55-gates-and-confidence.md); DV7 [60](60-design-ownership.md); antd [80](80-phase7-antd.md).

Evidence: `X…` = review:00; `BL`, `DT` = review:business-logic, review:dashboard-target. `path:line` = tree `a825839`; re-anchor files earlier steps changed (01 §9).

## 0. Entry and rules

**Entry (binary).** (1) `records/gate-S.md` signed (55 §3). (2) Stack as GATE-S left it (02 §3): Next 16 `--webpack`, React 19, runtime Node 24, mobx 6, Babel 7.29, `@sentry/*` 7, TypeScript 6.0.3 (W1), msw 2. (3) ODs usable with defaults ([90](90-open-decisions.md)): OD-02, -05 (6.10), -07, -12, -14, -20, -33, -43, -44, -45, -48; `records/6.0.md` lists those still OPEN ([STATUS](STATUS.md) §2).

**Rules.**
1. D1/D1a apply unchanged (D11): identical logic, no fixes, no clean-ups; a port reproduces quirks it would fix (Q-055, Q-091, Q-094).
2. 6.0 is test-only; 6.1–6.10 are deployable steps through 01 §4 (CS PRs into the step branch; one deployable step in flight, OC-21).
3. Parity reference = chain head at GATE-S ([42](42-baselines-and-ci.md) §9); diffs only as AD rows (42 §8) where the parity contract allows; product changes only via D15.
4. Each step adds fault patches `test/faults/R-###-*.patch` for its risks and records the kill matrix (55 C1): 6.3 R-016, R-028; 6.4 R-029; 6.5 R-073, R-030, R-004; 6.6/6.7 R-090; 6.8 R-076, R-055; 6.9 R-086.
5. New modules from 6.3 on are `.ts`; existing files stay `.js/.jsx` until 6.6; a MobX store file is deleted by its port, never renamed (OC-23).

## 1. Conventions: Adopt / Adapt / Reject

`../dashboard` (`48e3466`) is a client-only Vite SPA without tests: its library choices apply, much of its usage does not (X70.1; DT §2, §5). Versions: 02 §1.

| Area | Decision | Search rule (evidence) |
|---|---|---|
| TypeScript | Adapt | §3.1; not the references-only root of `../dashboard/tsconfig.json`, which checks no file under Next (DT §5.6) |
| ESLint | Adapt | Latest since W1 with Prettier, husky, lint-staged (M1 work, [50](50-roadmap.md) §4.1; typescript-eslint parser, CS-LINT-1); 6.2 adds §3.2. Not copied: TS-only block, `tseslint.config`, `react-refresh` (`../dashboard/eslint.config.js:8-35`) |
| react-hooks | Adapt | `rules-of-hooks: error` + bulk suppressions (CS-LINT-2); `exhaustive-deps: off` (dashboard `warn`; OD-15) |
| Prettier, husky, lint-staged | Adapt (husky: Adopt) | Prettier 3, inlined org options (CS-PRET-1; dashboard has none). Pre-commit `npx lint-staged` without the deprecated `husky.sh` line (`../dashboard/.husky/pre-commit:2`). Never `eslint --fix`/`stylelint --fix` (dashboard: `../dashboard/package.json:77-81`; R-049); `prettier --write` JS/TS/JSON/MD, `--check` CSS (CS-HUS-1) |
| HTTP | Adapt | §3.3. Rejected `../dashboard/src/config/axios.ts:6-14` (JSON Content-Type, custom header, 15-min timeout, `baseURL`) and its 401 interceptor |
| Data fetching | Adapt, conditional | §3.4 (OD-43). Rejected the `../dashboard/src/config/swr.ts` defaults |
| State | Adapt | §3.5. Rejected module-singleton `create()` (R-004), `persist`, prod `devtools`, whole-store reads, resets in render, SWR→store mirroring |
| Monitoring, compiler | Adapt; Adopt | §3.6, rejected `@sentry/react` (client only; X02.7). SWC mandatory (§3.7; OD-12, X02.9) |
| CSS | Adapt | §3.8 (OD-33 P1). Rejected per-component global `.css`: Next fails the build ("Global CSS cannot be imported from files other than your Custom <App>", DT §4 E1) |
| Everything else | Reject | react-router, Vite, react-refresh, `tsc -b`, pnpm (OD-06), dashboard Dockerfile + nginx (`try_files` SPA, review:http-contract HC-26), image `ENV` secrets, `src/config/env.ts` (§3.9), React Hook Form (D3), `features/`/`stores/` layout, folder moves (OD-48 (c)), `@oacore/core-ui` (OD-34); antd static `message.*` (80) |
| Org guide | Not the target | `../core-fe-architecture/index.html` (`d010de4`) prescribes a client-first React Router SPA; search keeps the pages router (R-005, OD-02, X70.12) |

## 2. Behaviour contract additions

Oracle for T-702, T-122, T-212, T-5xx, on top of 41 §2.1–§2.2.

### 2.1 SSR vs client split (BL §6.2)

SSR only: E1, E4, E5, E6 (page), E7, E9, E11–E15, E18 un-awaited in `/data-providers/{id}` gSSP (Q-087). Browser only: E2, E3, E6 (report), E8, E10, E16, E17, E18, E19 (Q-011), E21, E22. Each call keeps its side and count; SWR never fetches on the server; client code never sees `Internal_API*` (`api/internalize.js:5-13`).

### 2.2 Error → UI and loading (BL §6.3)

| Flow | Error → UI | Loading |
|---|---|---|
| E1 | `status` → ErrorCard (200); none or no results → "no results" | route LoadingBar |
| E4, E6, E7 | soft-404 (200) by `error.status`; works 410 → HTTP 500 (Q-001) | — |
| E2 | nothing; facets empty | LoadingBlock while `initialData` empty, else "…" counts |
| E8 | `similarWorks.error` → "Sorry, we are unable to process this request…" | "Loading suggested articles..." |
| E16 | "We cannot detect…"; 409 → duplicate text (`JSON.parse(message)` throws on non-JSON) | `{variant:'progress'}` |
| E3, E10, E17, E18 | silent | `report.isLoading`, `search.isLoading` → LoadingBar; Download disabled |
| E21, E22 | logo omitted (console, LogRocket) | — |

### 2.3 Library defaults that differ silently

Measured on axios 1.20.0, swr 2.5.1, zustand 5.0.15 (BL §6.4; X10.10, X10.11, X10.13).

| Area | Today | Library default | Phase 6 |
|---|---|---|---|
| SSR `Host` | dropped by undici (Q-022) | http adapter sends it; also UA `axios/…`, more encodings | `adapter: 'fetch'` |
| Text bodies | Blob | http adapter returns a String: `blob.text()` throws, SSR citations `[]` (`api/outputs.js:36-49`) | fetch adapter, `responseType: 'blob'` |
| JSON | regex `api/index.js:93` (Q-017); bad JSON → `SyntaxError` | any JSON-looking body parsed; bad JSON → string | identity transforms |
| String body | `text/plain;charset=UTF-8` (Q-019) | `x-www-form-urlencoded`, fetch adapter too | `Content-Type: false` |
| Query | `URLSearchParams` (Q-016) | `arr[]=`, drops `undefined` | no `params` |
| Errors | `{name,response:{},data,type,status,headers:{}}` as JSON; `AbortError`; `TypeError: fetch failed` | `AxiosError` (no `data`; `toJSON` ~1.9 kB with `Authorization`, internal URL); `CanceledError`; `Network Error` | §3.3 |
| XSRF | none | `X-XSRF-TOKEN` same-origin | `withXSRFToken: false` |
| SWR | none | revalidate on focus/reconnect/stale, 2 s dedupe, retries; with `fallback` +1 request per key after hydration | all off (§3.4) |
| Store lifetime | per request (server), singleton (client) | `create()` = module singleton | vanilla `createStore` |
| SSR snapshot | current state | `getInitialState()` (`esm/react.mjs:6-10`): `/data-providers` SSR 500 or #418; new-reference selectors loop | seed at creation; `useShallow` |

### 2.4 Store contract (BL §3)

Observable fields, computeds, actions: T-203's generated table (41). Traps:

| Store | Non-reactive today (keep it so) | Must survive the port |
|---|---|---|
| Root `store/root.js` | plain fields `similarWorks`, `search`, `report` | `extend` runs in render, once (`:37-40`; Q-048.U3) |
| Claim | `duplicated` (409 text appears only via the `isLoading` flip) | only `retrieve` uses its signal; Q-019, Q-091 |
| SimilarWorks | — | fetched once per mount (Q-055); also read by `templates/output/related-search.jsx:10-11` |
| Search | `setActiveLimit`, `setActiveDownloadModal`, `setActiveSortOptionData` are not actions | mutates `Router.query` and module-level `sortFilterValues` (Q-043) |
| Filters | — | signal lands in the `sortType` slot (Q-020); `activeFilterSuggestions` aliases `data[i].items` (R-030); Q-092 |
| Report | `submit`, `fetchOutput` are not actions | `report.error` survives navigation (Q-094) |
| DataProviders + Params | — | `data` 15,672 deep objects, computed `results`; in-place writes `pages/data-providers/index.jsx:54-79`; Q-028 |

**Port rules.** (1) Non-reactive fields stay outside reactive state. (2) One `set` per MobX action, one per write outside an action (R-081). (3) In-place writes become `set` calls that leave the same values visible to every reader at once, aliases included. (4) A component subscribes to exactly the fields its observer read, so render counts and render-driven requests stay equal (E18 per ClaimCard render, Q-087). (5) Side effects outside stores stay. (6) The client singleton keeps state across navigations.

## 3. Specs

### 3.1 TypeScript (6.1, 6.6; X70.6, X02.10, X20.19)

- **`tsconfig.json`**, flat (no `extends`/`references`): `lib` dom, dom.iterable, esnext; `module` esnext; `moduleResolution` bundler; `jsx` react-jsx (forced by Next); `allowJs`; `checkJs`, `strict` false; `noEmit`, `isolatedModules`, `erasableSyntaxOnly`, `esModuleInterop`, `resolveJsonModule`, `skipLibCheck`; `noUnusedLocals` false (`import React` lines stay). `paths` = the 9 live aliases of `next.config.js:87-96` as `"x": ["./x"]`, `"x/*": ["./x/*"]` (not the dead `config`), no `baseUrl`; webpack aliases stay. `include`: `next-env.d.ts`, `types/**/*.d.ts`, `**/*.ts`, `**/*.tsx`; `exclude`: `node_modules`, `.next`, `vendor`, `e2e`.
- Commit both files after one `next build`; CI-3 fails if a build changes them (`git diff --exit-code`). `next-env.d.ts` has no `next/image-types/global` reference (CS-N11-3). `types/assets.d.ts`: `*.module.css` → `{ readonly [key: string]: string }`, `*.css`, `*.svg|png|jpg|gif` → `string` (next-images).
- **`tsconfig.strict.json`:** `extends`, `strict: true`; `include` starts with the 6.3–6.5 `.ts` modules, grows per folder in 6.6 (OD-48 (a)), never shrinks (T-017).
- **Compilers** (per 02 §3.6): `typescript` 6.0.3 stays what Next, Jest and typescript-eslint (peer `<6.1.0`) load; add `"@typescript/native": "npm:typescript@7.0.2"`. Both ship a `tsc` bin, so `typecheck` runs `node_modules/typescript/bin/tsc --noEmit -p` on each tsconfig and `typecheck:7` the same with `node_modules/@typescript/native/bin/tsc`, both in CI-3. Plain TS 7 when typescript-eslint allows it (checked at 6.0 and each gate).
- **Babel until 6.7** (X20.19): with a user `babel.config.js`, Next 16 uses only its presets and also compiles `node_modules` with it (`babel/loader/get-config.js:325-337`, DT §4 E1). Hence, before 6.3 adds dependencies: CS-BAB-7 (`import type`), CS-R19-1 (TSX without `import React`), CS-BAB-6 (CJS packages through `transform-runtime`). Jest (harness PR, [40](40-test-strategy.md) §8): transforms match `\.[jt]sx?$`, `moduleFileExtensions` gain `ts`, `tsx`.
- **Stay-JS list** (6.6): root `*.config.js`, `data/data-loader.js` (run by `node`), `utils/helpers.js` (`next.config.js:8`), `utils/sentry.js` (gone at 6.8), `test/**`, `e2e/**`.

### 3.2 ESLint (6.2; X70.7)

`defineConfig` + `globalIgnores` (`eslint/config`). `**/*.{js,jsx}`: W1 rules. `**/*.{ts,tsx}`: W1 rules + typescript-eslint `recommended`, `@typescript-eslint/no-explicit-any: 'off'` (OD-48 (b)). Plus `@next/eslint-plugin-next` `recommended` (no `next lint` in 16). New findings on existing code go to `eslint-suppressions.json` (`npx eslint --suppress-all`) in the same PR, source untouched; in 6.6 the rename PR does the same (T-001 maps old to new paths).

### 3.3 axios transport (6.3; X70.4, X10.10; OD-20, OD-44, OD-45)

- `api/http.ts` exports `transport(url, init)` with `fetch`'s signature (`api/index.js:112`), returning a fetch-`Response`-compatible object. `prepareRequest`, `processStatus`, `processBody`, `processError`, `LogRocket.captureException` stay verbatim (OD-44). Same code on server and browser.
- Instance: `axios.create({ adapter: 'fetch', responseType: 'blob', transformRequest: [(d) => d], transformResponse: [(d) => d], validateStatus: () => true, withCredentials: true, withXSRFToken: false })`; no `baseURL`, `timeout`, default headers or `params`.
- Request: `method`, `headers` from `prepareHeaders` (Authorization on every host, S-2; internalised `Host` dropped by fetch, Q-022), `data = init.body`, `signal` (50 s abort, `api/search.js:16`). String body without `Content-Type` → `Content-Type: false`, so fetch sends `text/plain;charset=UTF-8` (Q-018, Q-019).
- Response: `new Response(blob, { status, statusText, headers })` (`null` body for 204, 205, 304) + non-enumerable own `url` = final URL; `JSON.stringify` of it stays `{}`.
- Errors: no `AxiosError` escapes (it would put `Authorization` and the `svc.cluster.local` URL into `__NEXT_DATA__` via `pages/data-providers/[id].jsx:113-118`). Abort → rethrow `signal.reason`, what native fetch rejects with (Q-091). Network → the native `TypeError` (Node `fetch failed` with its `cause`; browser the original).
- Wire = today (UA `node`, `accept-encoding: gzip, deflate`); a header the adapter adds is deleted in the transport (OD-20 item 6).
- Stay on native `fetch`: `data/data-loader.js` (CS-N12-1), `lib/loader.js:31` (E19), `modules/dropdown/index.jsx:59` (E22), E21 (OD-45; VF-13 only if OD-45 changes).

### 3.4 SWR (6.4; X70.5, OD-43)

- All other flows stay axios + store actions: they are event-driven or per render/card (E18, E21/E22, 2× E2 on clear-all), so dedupe or caching changes counts (X10.13).
- Only candidate: SimilarWorks (`templates/output/similar-works.jsx:29-31`, the only read-on-mount flow). It keeps Q-055 (no refetch on A → B), reset + loader on every mount, and the data RelatedSearch reads across navigations.
- `utils/swr.ts`: `SWRConfig` with `revalidateOnMount: true`; `revalidateIfStale`, `revalidateOnFocus`, `revalidateOnReconnect`, `shouldRetryOnError`, `keepPreviousData` false; `errorRetryCount: 0`; `dedupingInterval: 0`; `fallback` only from gSSP props; no `@experimental` options.
- Gate: a ≤2-day spike on an unmerged branch shows T-207, T-419, T-712 (incl. its remount path with a 1 s E8 delay: loader before E8 resolves, E8 = 1 per mount), T-702 (both with their window-event clauses: `visibilitychange`, `blur`/`focus`, offline/online) and the 41 §2.2 works/outputs rows identical, T-801 0 px incl. the loading state. Else: no CS-SWR PR, swr not installed, "SWR: 0 flows" recorded, OD-43 to the owner (STATUS §2), CS-ZU-3 ports similarWorks.

### 3.5 zustand (6.5; X70.3, X10.11, R-073)

- One factory per store (`store/<name>.ts`, `createStore` from `zustand/vanilla`); `initStore` keeps `store/index.jsx:12-21` (new root per server call, one client singleton).
- **Seed at creation:** `pages/_app.jsx:108` passes `{ statistics, dataProviders: pageProps.initialState?.dataProviders }`, so the creation state (server and hydration snapshot) holds what SSR renders; `useStore(initialState)` keeps extend-once for client navigations. Seeding only the server store gives React #418 (DT verdicts V-01).
- `useRootStore(selector)`; collection selectors use `useShallow`; computeds become memoised selectors; no `persist`; no `devtools` in production.
- **CS-BAB-2:** `invalidatePreviousRequests(fn)` returns a wrapper with one `AbortController` per wrapped function, created at module scope (shared by all instances, as the decorator closure is today), signal appended after the arguments (Q-020, T-121).
- Order, each PR through T-212's zustand driver: CS-ZU-1 claim (+CS-BAB-2), -2 report, -3 similarWorks (unless 6.4 removed it), -4 dataProviders + params (+ `_app` seed), -5 search, -6 filters (its 26 MobX decorators go = CS-BAB-1), -7 root + provider, then CS-ZU-8. Until CS-ZU-7 `Root` holds each ported store's api as a plain field; consumers switch to the hook in the same PR.

### 3.6 Sentry (6.8; X02.7, X10.4, X10.16, OD-14)

- `@sentry/nextjs` (per 02) replaces both SDKs, `utils/sentry.js` and the `next.config.js:97` alias: `instrumentation.ts` (`register()` inits when `NEXT_RUNTIME === 'nodejs'`), `instrumentation-client.ts`, `withSentryConfig`; `pages/_app.jsx:14,21-42` import from it. Init only with a build-time `SENTRY_DSN` (Q-096); CSP unchanged (`csp.config.js:52`).
- Keep-behaviour: `onUncaughtExceptionIntegration({ exitEvenIfOtherHandlersAreRegistered: true })` (exit 1 with a DSN; R-055, Q-009); `tracePropagationTargets: []` (R-076); no traces, replay, profiling; client integrations = the names 7.120.4 runs (recorded at 6.8 start); no `onRequestError`, no `captureUnderscoreErrorException`, no `_error` change (OD-38).
- `withSentryConfig`: no source-map upload or deletion (OD-42), `autoInstrumentServerFunctions: false`, no `tunnelRoute`, telemetry off [VERIFY: option names against the installed 11.x types; settled in the first 6.8 PR].

### 3.7 Babel → SWC (6.7; X70.9, X02.9)

- Delete `babel.config.js` (SWC; targets from `.browserslistrc`; `--webpack` stays, OD-10). Jest: `jest.babel.config.js` (a name Next ignores) via `['babel-jest', { configFile: './jest.babel.config.js' }]` with preset-env (no `useBuiltIns`), preset-react automatic, preset-typescript, `sourceType: 'unambiguous'`, no plugins; `jest.swc.config.js` (same projects, transform `@swc/jest` with Next's SWC settings) runs `test:unit:swc` (40 §2.1).
- Reader check for CS-BAB-4: `git grep -nE "\.displayName|constructor\.name|type\.name" -- '*.ts' '*.tsx' '*.js' '*.jsx' ':!docs'` may hit only `modules/show-more/index.jsx:39` and `templates/output/thumbnail-card.jsx:104` (assignments, unaffected by dropping the plugin) and `api/errors.js:6` (`this.constructor.name` → serialised `error.name`, T-504, T-610).
- CS-BAB-5: diff the `core-js/modules/*` list of the 6.6 vs 6.7 client chunks; each polyfill no longer shipped needs T-724 green on the engines at the OD-16 floor. `@babel/runtime` stays (the vendored design requires `@babel/runtime/regenerator`, 02 §3.3).
- T-018 6.7 report allows only: helpers inlined instead of `@babel/runtime` imports; removed core-js imports; removed `displayName` assignments; class/module emit with identical runtime semantics, shown by `test:unit:swc` passing the same set as the babel-jest run. Anything else stops the step.

### 3.8 Pure CSS P1 (6.9; X70.2, OD-33, OC-22, R-086)

- P1 = standard CSS syntax, no PostCSS plugins, CSS Modules kept, global CSS only from `pages/_app` (`:15-19`). Order: DV7 (CS-DSN-6, 60; design CSS still needs `@extend` and custom media) → CS-CSS-1 → -2 → -3 → -4.
- CS-CSS-1 writes PostCSS-only syntax as its output: custom media → `@media (max-width: 767px)` (`main/media-queries.css:1`); nested `&` flattened; any other declaration T-003 shows changing with the plugins off (e.g. autoprefixer output) written by hand. CS-CSS-2 leaves CSS and HTML class names unchanged; T-002 switches to dashed keys with it. CS-CSS-3 also drops camelCase keys from Jest's CSS-module transform (40 §2.1).
- CS-CSS-4 keeps `postcss.config.js` as `module.exports = { plugins: {} }`: with no file Next applies its defaults, flexbugs-fixes + preset-env with autoprefixer (`getPostCssPlugins` in `next/dist/build/webpack/config/blocks/css/plugins.js`, read on 10.2.3; re-read on 16.4.2 in this PR).
- Gates: T-003 declaration sequence identical per (source file, local class), minifier-only categories as AD rows under OD-37 at 0 px; T-801 0 px at every viewport; stylelint ratchet may only fall.

### 3.9 Env and assets (X20.20)

Keep `env.config.js` and literal `process.env.X` reads (`api/index.js:6-15`); `Internal_API*` stay runtime-only. The dashboard `src/config/env.ts` (`import.meta.env`, throws at import) would crash the client bundle. next-images strings stay until 7.F (CS-AN-5).

## 4. Steps 6.0–6.10

### 4.1 Step table

Entry = previous step DONE (50 §1) + the column; exit = 01 §6 DoD, incl. the 55 §1 step column (C1/C1-Q at every deployable step, C4 N ≥500 at 6.3, 6.5, 6.6, 6.7), + the column; rollback = 01 §5 + the note.

| Step | Ordered scope | Extra entry | Exit beyond DoD (binary) | Rollback note | pd |
|---|---|---|---|---|---|
| 6.0 Store contract (no deploy) | T-212 MobX driver for T-2xx (T-203 effects), T-209, T-210; 02 §5 for 02 §3.6; msw 3 on Jest 30 + Node 24 (VF-07); unmerged spike: TS scaffold, transport, one store (VF-17) | GATE-S signed | T-212 green 3×, = direct T-2xx (kept to 6.5); msw 3 merged or new OD; 6.1–6.10 re-estimated | revert | 4–6 |
| 6.1 TS infra | CS-BAB-6 + CS-BAB-7 → CS-TS-1..3 (+ `@types/*` per 02 §3.6, Jest) → CS-R19-1 alone | — | T-018 identical for the first two PRs; T-017 on tsc 6 and 7; CS-R19-1: T-404 both runtimes, T-601/T-602 identical, T-801 0 px, T-701 | CS-R19-1 alone | 2–3 |
| 6.2 Lint | CS-LINT-5 | — | T-001 unsuppressed = W1 baseline; `.next` identical (T-014 method); hook covers `*.{ts,tsx}` | — | 2–3 |
| 6.3 axios | CS-AX-1 + T-122 → CS-AX-2 | T-122 green old vs old | T-122 identical in every case; T-101–T-104, T-115, T-205, T-501–T-504, T-607, T-610, T-702; axios imported only by `api/http.ts`; Host/Authorization check on first rollout (01 §4 step 8, VF-02) | revert CS-AX-2 | 4–6 |
| 6.4 SWR (conditional) | spike → CS-SWR-1 + -2 | — | §3.4 gate met and merged, or "SWR: 0 flows" recorded + OD-43 escalated (no deploy) | — | 2–6 |
| 6.5 zustand | CS-ZU-1..7 → CS-ZU-8 | — | T-212 zustand = MobX driver, every case; T-209, T-609, T-742, T-734, T-735, T-412, T-702; `npm ls mobx mobx-react-lite` empty; `git grep -nE '^[[:space:]]*@[a-zA-Z]' -- store utils` = 0 | store PRs, before the prod merge | 8–12 |
| 6.6 TS conversion | CS-TS-4 per directory: utils, api, hooks, lib, store, modules, templates, main, pages | — | per PR T-018, T-017 (strict `include` grows); `git ls-files '*.js' '*.jsx'` = stay-JS list | per directory | 8–12 |
| 6.7 SWC | CS-BAB-4 + CS-BAB-5 + CS-SWC-1 | — | §3.7 checks; build log without "Using external babel configuration"; T-003, T-004, T-007 (B0 +10% cumulative), T-605, T-724 (P1); `test:unit:swc` pass set = babel-jest's | restore `babel.config.js` | 2–4 |
| 6.8 Sentry | CS-SEN-2 | — | T-608 (same 4 outcomes), T-607, T-610 (0 server events, stdout census), T-116, T-120, T-415, T-702 (Sentry requests per page), T-601 `.map` set; T-904 Sentry event (VF-04); SDK calibration (55 C6-NI) | back to 7.120.4 | 2–3 |
| 6.9 Pure CSS P1 | CS-DSN-6 (DV7) → CS-CSS-1..4 | W8 DONE | §3.8 gates; T-605, T-005, T-006, T-418; 0 `@media (--`, 0 nested `&`; 02 PostCSS and design-build rows closed | CSS PRs; DV7 stays if VG-3 passed | 3–5 |
| 6.10 L1 sweep | 02 §5 on every row, the GATE-A sweep (its last commit sets Tr, 55 GATE-x.1): CS-W0-11, CS-NODE-6, 02 §4 rows due at GATE-A (Jest-only Babel 8 if its peers allow, 02 §3.3; `@types/node`; TS 7 if typescript-eslint allows, 02 §3.6; CS-ID `02`, 01 §3), test tools via 42 §9; VF-15 | — | `scripts/outdated-at.mjs <Tr>` lists only rows 02 §4 allows open at GATE-A; strict `npm ls --all` problem set ⊆ the 02 §4 allow-list | that row's commit | 3–5 |
| GATE-A | prepare and run 55 §4 (C1/C2 on the phase-6 code, antd-readiness items, OD-49 budget, rollback readiness) | 6.10 DONE + 14 d prod (55 C6) | `records/gate-A.md` signed by the Owner (D10) | — | 3–5 |

Total 43–70 pd; calendar = pd + 2 d per deployed step + 14 d (50 §6).

### 4.2 Change sites

| ID | Where (Anchor) | Change |
|---|---|---|
| CS-BAB-6 | `babel.config.js:28` (`return {`) | `sourceType: 'unambiguous'` |
| CS-BAB-7 | `babel.config.js:4` (`const presets = [`) | `['@babel/preset-typescript', { onlyRemoveTypeImports: true }]` |
| CS-TS-1 | `tsconfig.json`, `next-env.d.ts`, `types/assets.d.ts` (new); mirrors `next.config.js:86-96` (`Object.assign(config.resolve.alias`) | §3.1 |
| CS-TS-2 | `tsconfig.strict.json` (new) | §3.1 |
| CS-TS-3 | `package.json` (`"typescript"`); `ci.yml` CI-3 (42 §10) | alias, scripts (§3.1); strict-mode `npm ls --all` problem set unchanged (no new ERESOLVE, T-008) |
| CS-R19-1 | `babel.config.js:12` (`'@babel/react'`) | `['@babel/preset-react', { runtime: 'automatic' }]`, after CS-R19-2/-3 (OC-20); R-057 entry leaves the Jest allow-list |
| CS-LINT-5 | `eslint.config.js` (`export default`); `package.json` `lint-staged` (CS-HUS-1) | §3.2; globs gain `ts,tsx` |
| CS-AX-1 | `api/http.ts` (new) | §3.3 |
| CS-AX-2 | `api/index.js:112` (`fetch(url, options)`) | `transport(url, options)` |
| CS-SWR-1 | `utils/swr.ts` (new) | §3.4 |
| CS-SWR-2 | `templates/output/similar-works.jsx:29-31` (`similarWorks.fetchSimilar(`); `templates/output/related-search.jsx:10-11`; `store/similar-works.js`; `store/root.js:4,13` | `useSWR` keyed on the mount-time `articleId` + params; store removed |
| CS-ZU-1..7 | `store/claim.js` (`class Claim`), `report.js`, `similar-works.js`, `data-providers.js` + `params.js`, `search.js`, `filters.js`, `root.js` + `index.jsx` + 16 `observe(` sites; `pages/_app.jsx:108` (`initialState={{ statistics }}`) in -4 | §3.5, §2.4 |
| CS-BAB-2 | `utils/invalidatePreviousRequests.js:5` (`descriptor.value = function`) + 6 uses | wrapper, §3.5 |
| CS-BAB-1 | `store/filters.js`, 26 MobX decorators | removed by CS-ZU-6 |
| CS-ZU-8 | `package.json` (`"mobx"`, `"mobx-react-lite"`); `babel.config.js:17-22` (`plugin-proposal-decorators`) | uninstall; drop decorators + class-properties plugins (T-018) |
| CS-TS-4 | every app `.js/.jsx` not on the stay-JS list | `git mv` + type annotations (`any` allowed); no statement edits |
| CS-BAB-4 | `babel.config.js:15,23-25` (`add-react-displayname`) | drop `export-default-from`, `syntax-dynamic-import`, `add-react-displayname`, `transform-runtime` |
| CS-BAB-5 | `babel.config.js:6-10` (`useBuiltIns`); `package.json` (`"core-js"`) | drop `useBuiltIns`/`corejs`; uninstall core-js |
| CS-SWC-1 | `babel.config.js` (delete); `jest.babel.config.js` (new); `jest.config.js` | §3.7 |
| CS-SEN-2 | `utils/sentry.js` (delete); `next.config.js:97` (`'@sentry/node':`); `pages/_app.jsx:14` (`from 'utils/sentry'`); `instrumentation.ts`, `instrumentation-client.ts` (new) | §3.6 |
| CS-CSS-1 | `git grep -n '@media (--' -- '*.css'`: 6 hits in 6 module files (e.g. `modules/filters/styles.module.css:240`); `git grep -nE '^[[:space:]]*&' -- '*.css'`: 10 nested lines in 4 files (e.g. `templates/output/thumbnail-card.module.css:6`) | §3.8 |
| CS-CSS-2 | 221 camelCase reads of dashed classes in 50 files (`git grep -noE 'styles\.[a-z]+[A-Z][A-Za-z]*' -- '*.js' '*.jsx' \| wc -l`) | `styles['dashed-name']` |
| CS-CSS-3 | `next.config.js` patch (CS-W0b-2; `exportLocalsConvention`) | delete |
| CS-CSS-4 | `postcss.config.js:1-25` (`'postcss-preset-env'`); `main/media-queries.css` | `{ plugins: {} }`; delete the file; uninstall the plugins (+ cssnano if W8 kept it) |
| CS-W0-11 | `package.json` `overrides` (`"caniuse-lite"`, CS-W0-10) | remove both pins, commit the new `npx browserslist` output; T-003, T-015, T-724, T-801 (diffs only as AD rows at 0 px) |
| CS-NODE-6 | `Dockerfile:1` (`FROM node:`) | `node:26-alpine@sha256:<digest>` if Node 26 is LTS ≥1 month (from 2026-11-28) and T-901, T-104, T-108, T-607, CI-2 pass; else 02 §4 row + an owner-signed OD created before Tr (55 §4 (b); OD-05) |

## 5. Exit

Phase 6 ends when GATE-A is signed by the Owner (55 §4, D10); no antd code merges to `main` before (OC-24). Next: [80](80-phase7-antd.md) §0.
