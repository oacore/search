# 40 - Test strategy: how parity is proven

**Purpose.** What "unchanged" means and the harness that proves it on every PR, step and gate. **Read it** before building the harness (step 2.1), before writing or changing a test or test tool, and when a test is red (§9).
**Owns:** parity contract, harness, layers, hydration detection, determinism, fixtures, test rules, harness-change protocol, triage, commands. **Not here:** T-### rows, catalogues, per-risk index ([41](41-test-inventory.md)); artefacts, golden image, capture, ledger formats, CI ([42](42-baselines-and-ci.md)); thresholds, gates ([55](55-gates-and-confidence.md)); versions ([02](02-version-matrix.md)).

**Lean mode (D18–D20, 2026-10-22; [00](00-decisions.md) §4b).** The harness runs in local mode on one workstation: host parity builds (`scripts/build-parity.mjs`: `git archive` of the commit, the frozen data snapshot, a reused `node_modules`, `build:test`, the image copies; never a from-scratch install per build, 01 §10), host stacks (`scripts/e2e-stack.mjs`: the SSR stub, the Node implementation of the generated gateway proxy, `next start` on the runtime Node), host Chromium; the whole suite is `bash scripts/ci-local.sh` (42 §10). WITHDRAWN (D19): the Docker parts below (compose topology, dnsmasq, the nginx and Playwright images, the container network, the pinned arm64 container, layer J's Docker checks); outside requests of the app other than Internal_API reach the stub through `test/ssr/host-redirect.cjs`. DEFERRED: the WebKit and Firefox legs (browser downloads not approved). Replaced (D18): the 20 + 20 runs of §9 item 1 by one re-run of a red test, and every "3 runs" or "3 green runs" rule by one run per jump (55 §0). Pixel baselines are host baselines (B0-local, macOS arm64). Where a sentence below names an image, a container or CI, read the local equivalent above.

Binding: Jest + RTL in-process, Playwright for anything needing a server or browser (D2, D7); existing bugs are pinned, never fixed (D1, D8). Parity contract + AD ledger: [90](90-open-decisions.md) OD-28, DECIDED 2026-10-20 ((c) OPEN).

## 1. Parity contract

A PR, step or gate passes only if every aspect equals the **approved baseline chain** (B0 = golden image, one link per re-capture/re-baseline; 42 §9, STATUS §1). The normalisation column is the complete list of ignored differences and changes only via §8. Any other difference fails unless a signed AD row covers it (`test/baseline/ACCEPTED-DIFFS.yml`, default deny, 42 §8); baseline files are never edited.

| Aspect | Must be identical | Allowed normalisations (by helpers, never by eye) | Detectors (41) |
|---|---|---|---|
| Pixels | V1–V39 × viewport matrix (41 §2), full page, Chromium; WebKit and Firefox on the 41 §2.5 engine subset (own B0 each); pinned arm64 container. Compare = `e2e/fixtures/pixel-exact.mjs`: both PNGs decoded, RGBA compared exactly, pass = equal size and 0 differing pixels (anti-aliased pixels count; Playwright's comparator skips them), a `diff-pixels` annotation per screenshot (`test.info().annotations`; a screenshot without one fails) and a diff PNG on failure; `toHaveScreenshot` only writes baselines in record mode | None, no masks; overrides the findings/07 §5 masks and tolerances (review:00 X40.13) | T-801, T-802, T-739 |
| SSR head | Raw `<title>` bytes (HTTP body, DOM parser, JS off, comments kept); app-owned tags in order: title, `citation_*`, `DC.*`/`DCTERMS.*`, description, JSON-LD (parsed, deep-equal), favicons; `<html>` attributes | `next-head-count` (10–14), `data-next-head` (15+), `data-reactroot` (12+), charset/viewport swap at 12, React 19 image preloads and non-SEO tag order (R-078), build ID, chunk hashes, Next script/preload tags, inter-tag whitespace, attribute order (review:00 X40.9) | T-602 |
| Post-hydration head | `document.head` per fixture (already corrupted on baseline, Q-069); from 15 also after client navigation | Per-Next-version diff only as an AD row (OD-39, R-071) | T-729 |
| Status, headers | Status, `Location`, every header value per route class (HTML, `_next/data`, `public/`, `_next/static`, `.map`, `icons.svg`, 404, 500, healthz), container and proxy, vs `e2e/http/contract.baseline.json`; `routes-manifest` (source, destination, headers) tuples | `Date`; `ETag` value (presence kept). Framework drift (R-083) only as AD rows (OD-39; review:00 X40.10) | T-601, T-603, T-604, T-010 |
| Server data, output | `__NEXT_DATA__` `props`/`page`/`query`; `_next/data` per client nav; no `svc.cluster.local`, `Bearer `, stack trace in HTML; stdout/stderr line census | `buildId`, other Next-owned keys; `console.time` labels and durations (`pages/search/index.jsx:49-66`); allow-listed Next 13.5/16 `uncaughtException` lines; line:column numbers of stack frames in the stdout/stderr census, function and file names kept (owner `SIGNED:` 2026-10-27, §8 rule 8) | T-610, T-604 |
| Network (server) | Every SSR outbound request at the wire (§2.2): method, URL, body bytes, all headers incl. `Host`, `User-Agent`, `Accept-Encoding`, `Authorization`, `Accept`, `Content-Type`, `sentry-trace`, `baggage` | Order of concurrent requests in one render (sort by method, URL, body sha256) | T-104, T-607, T-610; T-122 at 6.3 |
| Network (browser) | Per-action contract (41 §2): count, method, URL incl. `?t=undefined`, body, headers; navigation type (document vs `/search/_next/data/`); GA commands; Sentry, LogRocket, `/account` counts per cookie state | OPTIONS preflights dropped; asset hashes; timing (review:00 X40.22) | T-702, T-412, T-719 |
| Console | Nothing outside the versioned allow-list (browser and Jest); positive pins present (GA `Send command doesn't exist: search`, Q-071) | Allow-list per React/Next version; each entry cites R/Q and enters via an AD row (§8 rule 6) | T-701, T-741 |
| Hydration | T-728 pinned diff unchanged (tuple set, §4 item 2); no new `pageerror`, `console.error`, window `error` (§4) | None | T-728, T-701 |
| SSR body DOM | No-JS DOM and settled hydrated DOM of every T-601 200-route fixture: tag, text, every attribute (`href`, `rel`, `target`, `alt`, `title`, `type`, `data-*`), vs the B0 captures | Class hash → `[name]_[local]`, buildId, chunk URLs | T-728 |
| Classes | (DOM path, ordered class tokens, `type`/`form`/`disabled`/`href`/`target`/`rel`) on SSR and post-interaction DOM; built CSS keyed by (source file, normalised selector list, at-rule chain, ordinal) | Hash suffix → `[name]_[local]` (md5 on 10/12, sha1 on 13+; review:test-strategy.verdicts TS-05) | T-605, T-003 |
| Styles, ARIA, a11y | Computed-style census (property list below), every element under `#__next` and portals, every state and forced hover/focus/focus-visible/active; motion and media-rule census (T-805); ARIA snapshots; axe violation set identical | None | T-805, T-806, T-803 |
| Lint | (path, rule, count) vs `findings/baselines/` until W1, then vs the W1 new-tool baseline on unchanged code | Repo-relative paths (review:00 X40.31) | T-001 |
| Process, size | Crash semantics; raw/gzip size per route; RSS after the P0 sweep; first-load JS | The only numeric tolerances: size ±5%, RSS +10% (T-611), first-load gzip ≤ B0 +10% cumulative (T-007, OD-49) | T-608, T-611, T-007 |

**T-805 property list** (changes only via §8): every longhand `getComputedStyle` enumerates, per engine, plus `content` of `::before`/`::after`, minus `test/baseline/t805-exclusions.json` (properties shown nondeterministic across the 3 captures on G, 42 §6; its sha256 is recorded with B0 in STATUS §1 and checked by T-012). Tests install Roboto, so a token that differs only in fallback fonts is still caught by the full `font-family` string.

**Behavioural attributes** (T-605, T-728, T-417 and C4; everywhere, incl. replaced unit roots and their portals; never covered by OD-28(c)(b) or a `kind: delta` AD row): per element keyed by (role, accessible name, ordinal), equal to B0: `href`, `target`, `rel`, `download`, `type`, `form`, `formaction`, `formmethod`, `name`, `value`; `disabled`, `readonly`, `required`, `checked`, `selected`, `multiple`, `min`, `max`, `step`, `pattern`, `minlength`, `maxlength`, `autocomplete`, `inputmode`, `placeholder`, `accept`; `src`, `srcset`, `sizes`, `alt`, `loading`, `decoding`, `crossorigin`, `referrerpolicy`; `title`, `lang`, `dir`, `tabindex`, `contenteditable`, `draggable`; the targets of `for` and IDREF `aria-*`; text content.

## 2. Harness

All harness files are new, added by harness PRs (§8). Created at **2.1**: `jest.config.js`, `test/{setup,transforms,mocks,utils}/`, `test/esm-allow-list.json`, `test/ssr/{stub.mjs,hosts.json}`, `test/fixtures/resolve.mjs` (stub), `e2e/{package.json,proxy/generate.mjs,fixtures/guard.mjs,fixtures/pixel-exact.mjs}`, `playwright.config.mjs`, `scripts/{build-parity.mjs,e2e-stack.mjs,lock-immutable.mjs,ci-local.sh}` (local mode; the Docker-only recipe files and the prototype CI workflow of the first plan were removed, D19, D20), `.gitignore` += `!test/baseline/build/`; **2.2** recorder and scrub check; **2.3** tests, `test/hydration/dev-ssr.patch`; **2.6** `scripts/{lint-parity,audit-gate,ad-ledger}.mjs`; **2.7** `test/faults/` (incl. `Q-clauses.json`, `controls.json`), `stryker.config.mjs`, `scripts/{run-faults,merge-coverage,gate-stats,outdated-at}.mjs` (gate-stats' C6-NI part at 2.5). Commands §10, workflows 42 §10. Scrubbed recorded fixtures, the data snapshot, screenshots (Playwright's default `<spec>-snapshots/` folders) and record-mode outputs are committed next to the tests (42 §7; OD-24/OD-25); `$ARTIFACT_DIR` (default `../search-upgrade-artifacts`, outside the repo) holds only unscrubbed recordings until the scrub check passes, and run reports. One resolver, `test/fixtures/resolve.mjs` (`(method, url, body) → {status, headers, body}`), serves Jest MSW, Playwright `page.route` and the SSR stub.

Placement (T-011): no `*.test.*` under `pages/` (each file there is a route; a test file fails `next build`; `pageExtensions` stays, D1; review:00 X40.2); no `build`/`dist` directory under `test/`, `e2e/` (`.gitignore:6-7`) except the committed `test/baseline/build/` (42 §7); no tests under `data/` (`.gitignore:16`); `git ls-files --others --ignored --exclude-standard -- test e2e` empty (review:00 X40.3).

### 2.1 Jest

- **babel-jest only**, with the unchanged root `babel.config.js`. Never `next/jest`: it forces SWC, ignores `babel.config.js`, maps `*.module.css` to an identity proxy first (hides R-001), mocks images as objects (review:test-strategy V5). From 6.7 Jest keeps babel-jest on a Jest-only config (CS-SWC-1); compiler parity is proven by T-018, G–I and `test:unit:swc`: the B–F suite again with `@swc/jest` set like Next's SWC (`.browserslistrc` targets, automatic JSX), whose pass set must equal the babel-jest run at every step and gate from 6.7.
- **`jest.config.js`:** projects `node` (`test/{unit,pages}/**/*.test.js`), `dom` (`jest-fixed-jsdom`, same dirs `*.test.jsx`, `setupFilesAfterEnv: test/setup/dom.js`), `static` (`test/static/**`). **Each project** carries its own `transform` (`.module.css` → `test/transforms/css-module.js`, JS → babel-jest; a top-level one is ignored, `SyntaxError`, review:00 X40.1), `transformIgnorePatterns` from the allow-list, `moduleNameMapper` (9 live aliases of `next.config.js:86-100`; `data/.{statistics,formap,members}.json` → synthetic `test/fixtures/data/`; global CSS → style mock; images → URL string) and `setupFiles: test/setup/env-clock.js`.
- **CSS-module transform:** postcss parse; keys as css-loader `exportLocalsConvention: 'camelCase'` (original + camelCase), value = original name, unknown key `undefined`. It cannot see the build no-op behind R-001 (detectors T-605, T-003, T-801).
- **ESM allow-list** `test/esm-allow-list.json`: msw 2.15 deps (`rettime`, `until-async`, `@open-draft/deferred-promise`, `@inquirer/*`; review:00 X02.6), d3-*, react-markdown/rehype-raw when bumped. ESM-only SDKs (react-ga4 3, W4c): `jest.mock(pkg, factory)`, never automock.
- **Router mock** `test/mocks/next-router.js`: one mutable singleton, default export and `useRouter()` result (`store/filters.js:2`, `store/search.js:2`), incl. `prefetch`; reset in `beforeEach`. Static: blind to router-driven R-018/R-019 triggers (T-702, T-722 see them).
- **`test/utils/render.js`**, the only RTL importer (`render`, `screen`, `within`, `waitFor`, `fireEvent`, `userEvent`, local `renderHook`, `withRouter`, `withStore`). Queries from `@testing-library/dom` 10 from day one, `configure({ eventWrapper, asyncWrapper })` wrapping React 17 `act`, since RTL 12 does not act-wrap dom-10 events (review:test-strategy.verdicts TS-08). RouterContext: 10.2.3 `next/dist/next-server/lib/router-context`; 11–12 `next/dist/shared/lib/router-context`; 13.5–16 `…/router-context.shared-runtime` (review:test-strategy V4). The RTL 16 swap (W6a, CS-R18-5) edits only this file.
- **T-012** (41) self-tests transform, allow-list, router-mock members (vs installed `next/router`) and RouterContext path in every project.
- **MSW only in Jest**, opt-in per file (`test/utils/msw.js`, `onUnhandledRequest: 'error'`). msw 2.15.0 (per 02) needs the allow-list; if it fails on Node 18 (VF-07), stop and record the exception in 02. T-104 never loads MSW. From 6.3 axios runs with `adapter: 'fetch'` everywhere ([70](70-phase6.md) §3.3), so MSW keeps intercepting fetch under jsdom; browser request semantics are asserted in T-702.
- **Setup:** `TZ=UTC` in the script; `env-clock.js` sets `API_KEY=test-key`, `API_URL=https://api.core.ac.uk/internal` (as builds inline from `env.config.js:15-34`) and the fake clock (§5); `dom.js` fails on `console.error`/`warn` outside `test/console-allow/react-<major.minor>.json`. Map stubbed (`jest.mock('modules/map/map')`); `@oacore/design` real (global CSS stubbed; needs postinstall `lib/config.js`); react-ga4, logrocket, `@sentry/*`, js-file-download are factory spies.
- **Node:** Jest on the step's runtime Node (CI-2; 18 until W4e) so T-104, T-108, T-117 match prod; lint, hooks, Stryker, Playwright on tooling Node 24 (`.nvmrc`, CS-W0-5; review:00 X02.5).

### 2.2 SSR HTTP stub

- Every Playwright run starts the parity image with the prod runtime env plus `Internal_API=http://stub`, `Internal_API_HOST=api.core.ac.uk` (as `kube/prod/deployment.yaml:50-53`; env 42 §3), so SSR API calls take the prod internalised path (`api/internalize.js:16-29`).
- `test/ssr/stub.mjs` (separate process, Node built-ins only) records each request (method, raw URL, wire `Host`, all headers in order, body bytes + sha256) to `test-results/ssr-wire.ndjson` and answers from the resolver; an unmatched request gets 502 and fails the run.
- **Other hosts** (doi.org E9, logo hosts E14, Sentry ingest): the app sits on an egress-denied network behind a logging catch-all resolver (dnsmasq `address=/#/<stub IP>`, `log-queries`); the stub serves HTTPS with certificates minted at start from a test CA for each name in `test/ssr/hosts.json`; the app gets `NODE_EXTRA_CA_CERTS` (env only). An unlisted name fails the run; the first golden run (2.3), with an empty list, is the discovery run that seeds it.
- **Not in-process MSW:** it sees app-set headers, not the wire (native fetch drops the `Host` override, Q-022, review:test-strategy V10; UA and `Accept-Encoding` are invisible; review:00 X40.6). Wire capture surfaces R-016 and R-076.
- `test/ssr/fetchlog.cjs` (`--require`) logs what app code hands to `fetch` (app-set vs runtime-added headers) for triage only.
- **Self-check** (`test:harness`): each listed name reaches the stub with the expected wire Host; a forced server error with the test DSN yields its Sentry requests (an unhandled rejection at 10.2.3: two, one from the `@sentry/node` integration and one from `pages/_app.jsx:21-23`, as T-608 c3 pins); an unknown host fails. If TLS interception fails in the 2.1 spike, redirect non-Internal_API hosts with the review `preload-fetch` prototype and note it in STATUS.

### 2.3 Gateway-equivalent proxy

- `e2e/proxy/generate.mjs` reads `kube/{prod,stage}/httproute.yaml` at setup, asserts they differ only in `metadata.namespace` and `spec.hostnames`, and emits nginx config (image by digest, 42 §3); never hand-edited, so YAML changes (CS-OPS-1) flow in.
- Semantics (`kube/prod/httproute.yaml:13-65`; review:00 X40.26): PathPrefix matches whole path elements (`/search/x`, not `/searchx`); longest prefix wins; `ReplacePrefixMatch` (`/static/search` → `/`, `/display` → `/outputs`, CS-OPS-1); backend timeout 30 s (35 s request timeout not emulated); `merge_slashes off`, raw `$request_uri`; anything else → 404 "other service".
- `:8080` is gateway-faithful (all G/H/I tests); `:8081` is allow-all, only for paths the gateway does not route (`/error-card/`, `/`, `/api/healthz/`; Q-005). Acceptance T-612; real controller VF-01; gap RG-2.

### 2.4 Third parties and test build values

| Browser host | Handling |
|---|---|
| `api.core.ac.uk/**` (incl. E22), `doi.org/**` | Resolver |
| `*.tile.openstreetmap.org`, `core.ac.uk/image/**` | Fixed 256 px PNG |
| `www.googletagmanager.com/gtag/js*` | Empty script + init-script spy on `dataLayer.push` (T-719, T-741) |
| other `google*`, `*.logrocket.com`, `*.lgrckt-in.com`, `*.logr-in.com`, `*.cloudflareinsights.com` | Abort, count (LogRocket would hit the real project; review:00 X10.15) |
| `o0.ingest.sentry.io`, `sentry.io` | Count, 200 |
| Anything else | Abort, count, fail |

Aborts happen after the browser's CSP check (proven once in the 2.1 spike with a CSP-blocked host), so violations (R-026; LogRocket ≥11 vs `csp.config.js:6`) still reach the guard (T-720). Build values (42 §2): `API_KEY=test-key`, `GA_TRACKING_CODE=G-TEST000000`, `SENTRY_DSN=https://public@o0.ingest.sentry.io/0` (prod host shape; `https://k@sentry.io/1` matched CSP `sentry.io` and hid R-026; Q-096; review:00 X40.16). The resolver rewrites absolute `https://core.ac.uk` in `links[].url` to the proxy origin at serve time, keeping full navigations inside (review:00 X40.15).

### 2.5 Journey guard and builds

- `e2e/fixtures/guard.mjs` wraps every browser test: fails on `pageerror`, `console.error` outside the allow-list, window `error`, `securitypolicyviolation`, image/stylesheet/script/font responses ≥400 (T-721), unexpected hosts; records request and console logs, `context.cookies()` and the `localStorage`/`sessionStorage` key sets (each equal to B0 per cookie state); sets the cookie state (absent, essential, essential + analytics; Q-070).
- E2E runs only on the parity image (frozen data; 42 §1–§2), never `next dev` (it never server-renders: `pages/_app.jsx:149-155`).
- T-802 uses a separate harness build (OD-30 default), never the parity build: Next 10 `commons minChunks = totalPages`, so an extra page changes chunking (review:00 X40.30); switch `IMPL=design|antd`.

## 3. Layers

| Layer | Tool | Where | Never a detector for |
|---|---|---|---|
| A Static/build | Jest `static` + scripts on source, lock, `.next` from the image (per-Next adapters, §8 rule 7) | `test/static/` | Runtime behaviour |
| B Unit | Jest `node`: `api/`, `utils/`, `lib/`, config modules | `test/unit/<source path>/` | Build, CSS, routing |
| C Store | Jest `dom` (T-209 `node`), router mock, MSW; MobX-API tests T-203/T-209 are rewritten via T-212 (6.0/6.5) | `test/unit/store/` | Router triggers (R-018, R-019) |
| D Hooks | Jest `dom` + RTL | `test/unit/{hooks,templates}/` | Router event timing |
| E Components | Jest `dom` + RTL, real design lib | `test/unit/{templates,modules,main}/`, `test/pages/**/*.test.jsx` | R-001, R-007, R-008, R-021, R-022 |
| F Integration | Jest `node` + MSW: gSSP, healthz; data-loader child process (`--require` preload sends its 3 URLs to a stub, T-117) | `test/pages/**/*.test.js`, `test/unit/data/` | Next renderer (redirect/notFound, serialisation, trailing slash) |
| G Server HTTP | Playwright `request`, parity image via proxy + stub | `e2e/http/` | - |
| H Browser | Playwright: Chromium (WebKit, Firefox for §4 and T-724) | `e2e/journeys/` | - |
| I Visual, a11y, styles | Playwright, axe, pinned container | `e2e/visual/`, `e2e/a11y/` | - |
| J Ops | Docker, C6-CI, prod, checklists | `test/ops/` | RG-1..RG-8 (55) |

Rules (review:test-strategy §2; review:00 X40.35): A–F are white-box, G–J black-box; only G–J and the version-agnostic part of B stay valid oracles across every step; Jest never counts as a detector for build, CSS, routing or SSR-framework risks. Every Critical/High risk has ≥1 black-box detector proven by its seeded fault (`test/faults/R-###*.patch`, C1; table 41 §3). The old "two independent layers" claim is withdrawn; coverage = measured C1–C3 (55).

## 4. Hydration detection

React 17 production prints no mismatch warning (review:test-strategy V12); dev does but never server-renders (`pages/_app.jsx:149-155`). React 17 silently repairs text and children, not attributes (inserts the consent popup, deletes the `/display` breadcrumb tail, Q-075; review:test-strategy.verdicts TS-06). React 18/19 report via `reportError` → window `error` (#418/#423/#425), not `console.error` (review:00 X40.7). So:

1. **React-17 dev inventory (2.3):** in a throwaway `git archive` copy of the tree apply `test/hydration/dev-ssr.patch` (committed, never merged; `NextApp = App`), run `next dev` on Node 18 with `--openssl-legacy-provider` (`Dockerfile:23`) in the compose topology; sweep routes × fixtures × TZ (UTC, America/Los_Angeles, Asia/Tokyo) × cookie state. Each warning maps to a Q row or a new one (30, 01 §9); output `hydration-dev-r17.json` in `$ARTIFACT_DIR`.
2. **T-728:** same matrix; no-JS DOM (`javaScriptEnabled: false`) vs settled hydrated DOM (text and attributes by DOM path), plus a MutationObserver set by an init script before app scripts; both DOMs also vs the B0 captures (SSR body DOM, §1). On React 18/19 the pinned diff is T-701's allow-list keyed on (route, fixture, TZ, cookie state, engine, error code, DOM path of the first mismatch), never on message text, recorded at W6a and again at W7b (55 C7 (1)): an entry is expected until an approved CS-ESC fix (OD-40) removes it; a new or changed entry fails.
3. **T-701** listens on `pageerror`, `console.error`, window `error`; `/display/:id/` goes through the proxy (T-701, T-723).
4. **html-validate** (per 02) on T-602 raw HTML; findings pinned (nested `<a>` Q-072, duplicate IDs Q-089).
5. Cookie matrix on T-701, T-702 and request logs: Sentry, `/account`, LogRocket counts equal baseline per state.
6. Items 2–3 run on Chromium, WebKit and Firefox; C7 (55) uses items 2–5.

## 5. Determinism

- **TZ, locale:** server and Jest `TZ=UTC`; Playwright `timezoneId: 'UTC'`, `locale: 'en-GB'`; only §4 and T-108 add other zones (T-108: a child process per zone, since `process.env.TZ` set inside a Jest test does not reach `Intl`).
- **Clock:** browser `page.clock.setFixedTime('2026-01-15T12:00:00Z')` for visual and SEO tests; timer journeys use `install()` with `pauseAt()`/`runFor()` (`install()` alone does not freeze time). Jest sets the fake clock in `setupFiles` before any import (`MAX_YEAR` is computed at module load, `modules/filters/year/hooks/use-year-filter-controller.js:6`). Server Date not frozen: it feeds only `MAX_YEAR` and `lib/loader.js:37` (review:test-strategy.verdicts TS-13); `env.json` records the capture date.
- **Randomness:** page tests and C4 replays (55 C4) serve a `/members` fixture with one eligible member, so `templates/search/utils/featured-member.js:25,32` picks it for any `Math.random()`; no PRNG seeding (calls before the pick vary: `pages/search/index.jsx:49`, libraries). Multi-member selection only in T-113. `templates/search/pagination.jsx:77` keys never reach the DOM.
- **Data:** frozen snapshot; the live data-loader never runs (42 §2).
- **Arch, fonts:** arm64 only (prod, `ubuntu-24.04-arm`); Playwright image derived from `mcr.microsoft.com/playwright:v1.64.1-noble-arm64` (per 02) by digest, plus pinned `fonts-roboto` and Noto (the design font stack has no `@font-face`; review:test-strategy F-12), built in each CI job, never pushed (42 §3); `fc-match roboto` / `sans-serif` go to `env.json`.
- **Screenshots:** Chromium launched with `--disable-partial-raster` (`visual` and `record` projects; without it partial raster re-anti-aliases rounded corners one level differently at random); `animations: 'disabled'`, `caret: 'hide'`, `reducedMotion: 'reduce'` (the design `lib/reboot.css:4` imports sanitize.css `reduce-motion.css`, which then sets every animation to 1 ms and every transition to 0 s, `!important`; motion is checked by the T-805 motion census under `no-preference`); no global `transition: none` (Leaflet needs `transitionend`). Capture after `document.fonts.ready`, loaders gone, stub tiles loaded, Leaflet maps settled on their container size (one `resize` event first: the resize events of a full-page capture would otherwise pan a map whose layout changed without one, in a frame that races the pixels) and the sprite check (`/static/search/icons.svg` 200 `image/svg+xml`, a `<use>` with non-zero `getBBox()`; review:00 X40.24).
- **Flakes:** `retries: 0` everywhere; flaky = failure; no quarantine; budget <1 per 100 runs (C5).
- **Settled states only:** web-first assertions, `expect.poll`, `waitFor`; never render counts or intermediate states (R-081); StrictMode and isolation per §7 rules 5–6.
- **Isolation:** one browser context per test; parallel workers are safe (SSR is per-request, T-609; `statistics`, Q-007, is constant with frozen data); the client store is a per-page singleton (Q-094), so no test relies on an earlier navigation.
- **Network:** deny by default (MSW, stub, guard). **Stability proof:** 42 §6; cross-host pixels VF-10.

## 6. Fixtures

1. **Record once at 2.2:** `npm run fixtures:record` against production `https://api.core.ac.uk` with a real `API_KEY` from env, never committed (anonymous: 10 requests per window, a 429 locks 10 min; bad token 401; review:00 X40.21). Manual, never CI. Stores status, all headers (incl. CORS, cache), body bytes.
2. **Read-only only** (GET, search/aggregation POST). Mutating POSTs (E10, E16, E17) are hand-written (201/409/500) and may be committed.
3. **Settle VF-03:** record the live 410 body (Q-001), `publishedDate` format (Q-050), how often empty date + numeric year, `doi: null`, missing `location` occur, and whether `links.display` uses `/display/`.
4. **Derive edge cases from real objects** (copy one, change one field); never invent shapes. Shape-variance family: null and absent for every dereferenced field (`outputs[].doi`, `sourceFulltextUrls`, `dataProviders`, `links`, `location`); recorded type quirks stay (numeric `work.yearPublished`, string `output.yearPublished`, providers without `id`).
5. Scenario IDs: 41 §2. Live drift: T-906, never an upgrade failure.
6. **Scrub, store:** scrub emails, account/member contact data and tokens; keep public scholarly metadata; licence check; corpus URLs from logs only in the sanitised form of 42 §7 (user query terms, IPs, user-agent strings, referrers, cookies never committed); commit per OD-24/OD-25 (42 §7). The repo is public, so only scrubbed files go in.

## 7. Test-writing rules

1. Titles start with T-ID, the Cases clause when the row has several (41 §0), and tier tag (`T-601 @P0 …`, `T-805 c3 @P1 …`), which tier commands select on; register the row in 41 in the same PR (01 §9).
2. Characterise, never correct (D1, D8): a test pinning a bug names its Q-ID and asserts today's behaviour; the PR that first pins a Q clause also adds its C1-Q patch and `.expect` (Reviewer-written; 55 C1-Q), unless the quirk is exempt or the clause `none`.
3. Selectors: role and label first; an `id` only if unique (never Q-089 duplicates; corrected IDs per README errata, review:00 X40.15).
4. Pointer-events traps (Q-083): keyboard or `{ force: true }` with a comment citing Q-083.
5. No StrictMode wrapping in gating tests (`reactStrictMode` null → false, OD-22); T-301's StrictMode case is removed (review:00 X40.29).
6. T-209: `node` project, own file, `jest.isolateModules` (`isServer` is computed at load; `enableStaticRendering` is process-global). From W3, `afterEach` calls mobx-react-lite `clearTimers()`.
7. Lint: `.eslintrc.yml` (flat config from W1) overrides for `test/**`, `e2e/**` (jest/node globals, devDependency imports); test files lint clean so T-001 holds (`lint:js` takes `.js`/`.jsx` only, so the `.mjs` specs and scripts are outside it today). `lint:json` (`package.json:78`) checks every non-ignored JSON, so generators write committed JSON through `prettier --write`; from W1 (Prettier 3) a new `.prettierignore` is a second `--ignore-path` (review:00 X40.31).

## 8. Harness-change protocol

Harness change = any change, other than new tests and baselines, to `test/**`, `e2e/**`, Jest/Playwright/Stryker config, `scripts/*.mjs`, test devDependencies, normalisers or allow-lists (review:00 X40.28).

1. One change per PR, label `harness`, no app file.
2. **Oracle equivalence:** the full suite with the new harness on golden commit G / golden image gives the same pass set and byte-identical record-mode outputs as the current baseline (run URL in the PR).
3. **Inertness:** T-013 on every harness PR; T-014 when root `package.json` or the lock changes (42 §5).
4. **Output-changing tool bumps** (Playwright, Chromium, container, axe, html-validate; incl. 6.10 and the final Playwright bump at GATE-S) follow 42 §9: re-capture from the golden image; the old app on the new tool must match before any candidate runs.
5. **RTL 16 cannot run on React 17:** it lands in W6a with React 18 (CS-R18-5), editing only `render.js` and `package.json`; Jest results there are corroborated by G–I.
6. **Console allow-list entries** (per React/Next version): only for a message proven to come from framework or tooling for an existing R/Q row (e.g. React 18.3 `defaultProps` on design Histoslider/MathMarkdown), each with an AD row.
7. **Build-artefact adapters** (T-003, T-004, T-005, T-007, T-010 read version-specific `.next` layouts) must reproduce the old outputs on the golden build before use on a candidate.
8. **Acceptance changes.** A change that can make any comparison accept more (a tolerance or the pixel comparator, a mask or normaliser, a T-805 exclusion, an allow-list entry, a `testIgnore` or skip, a narrower matrix, the 42 §8 key rule, `scripts/gate-stats.mjs`, a `none` mark in `test/faults/Q-clauses.json`, `test/faults/controls.json`) needs an owner `SIGNED:`, a full C1 + C1-Q re-run on its head with no new survivor (55 C1), and merges only while no step is between its runbook steps 1 and 10. Rule 2 alone never suffices: G against G cannot see a widened oracle. T-012 pins the constants and the comparator and runs the `gate-stats.mjs` known-answer tests.

## 9. Triage

1. **Test or tool?** Before any re-run counts (01 §4 step 3, 55 C5) run the failing test 20 times on the golden image and 20 times on the candidate, `retries: 0` (`APP_IMAGE=<digest> npm run e2e -- --grep T-### --repeat-each=20`; Jest: `--testNamePattern` in a loop); record both sets. (a) Candidate red, golden 0/20: regression, stop (01 §8). (b) Golden red: harness or determinism defect, fixed under §8 (rule 8 if it can accept more), baseline untouched. (c) 0 red on both: 100 more runs each; any candidate red with golden 0: (a); else `unreproduced`. (b) and (c) count as flakes in C5; two unreproduced failures of one test at one head stop the step (01 §8). At 2.6 (candidate = golden) every red run is (b) or (c).
2. **Changed PRESERVE quirk** ([30](30-quirks-register.md))? Restore it in the step's CS PRs.
3. **ESCALATES** (30 §E, OD-09/OD-40 approved list)? D1a: own PR, signature, pinned test stays green (W5.5 in [50](50-roadmap.md)).
4. **New risk?** R row in [10](10-risk-register.md), T row in 41, fault patch (01 §9).
5. **Never update a baseline to pass.** Baselines change only by 42 §9 re-capture (tool/harness) or D15 re-baseline (product change); a framework delta code cannot preserve becomes an owner-signed AD row (OD-39). Stop conditions: 01 §8.

## 10. Commands

All **(new)**, in root or `e2e/package.json`; *Created* = the step whose PR adds the script; CI mapping 42 §10 (D20: the CI column names the job of the local full-suite run; `faults.yml`, `mutation.yml`, `gate-s.yml`, `soak.yml`, `baseline-capture.yml` are WITHDRAWN and their scripts run locally). Node: "runtime" = step runtime, "24" = tooling. Tier: `-t @P0` (Jest), `-- --grep @P0` (Playwright); per-PR CI runs P0 + P1 due by the step (41); step exits and gates run all tiers (review:00 X40.14).

| `npm run` (new) | Runs (Node) | CI | Created |
|---|---|---|---|
| `test:unit` = `TZ=UTC jest --selectProjects node dom` | B–F (runtime) | CI-2 | 2.1 |
| `test:unit:swc` = `TZ=UTC jest --selectProjects node dom --config jest.swc.config.js` | B–F on `@swc/jest` (§2.1) | CI-2 | 6.7 |
| `test:static` = `TZ=UTC NEXT_DIR=<dir> jest --selectProjects static` | A on `.next` from the image (runtime) | CI-3 | 2.1 |
| `test:harness` = `jest -t T-012 && node e2e/proxy/generate.mjs --self-test && node test/ssr/stub.mjs --self-check` | T-012, T-612 YAML self-test, §2.2 self-check (24) | CI-3 | 2.1 |
| `build:test` = `node ./node_modules/.bin/design build icons && next build` | Parity build, no data-loader, 42 §2 (runtime) | CI-3 | 2.1 (CS-W0-9) |
| `e2e` = `node scripts/e2e-stack.mjs test --run <id> [Playwright args]` on a host stack from `npm run e2e:up -- --run <id>` (stop: `npm run e2e:down -- --run <id>`; local mode, D19: the Docker compose runner of the first plan is WITHDRAWN) | G, H, I | CI-4 | 2.1 |
| `e2e:record` (`RECORD=1`, `--update-snapshots`) | Record mode, golden image only, 42 §6 | `baseline-capture.yml` | 2.4 |
| `test:image` = `bash test/ops/t901.sh --host --build <key>` | T-901 in host mode (the container half: DEFERRED, D19) | CI-5 | 2.1 stub, 2.3 |
| `lint:parity` = `node scripts/lint-parity.mjs` | T-001 (24) | CI-1 | 2.3 |
| `docs:check` = `node tools/check-docs.mjs docs/upgrade --repo . --tests test,e2e` | IDs, links, anchors, counts, forbidden text, code citations, test titles (24) | CI-1 | tool: docs PR; script 2.1 |
| `fixtures:record -- --out "$ARTIFACT_DIR/fixtures"` | §6, needs `API_KEY` (24) | manual | 2.2 |
| `faults [-- --risk R-### \| --sealed <gate>]` = `node scripts/run-faults.mjs` | C1, C1-Q: per patch: clean worktree (design-path Q patches: derived image, 55 C1-Q), build, validity checks (`.expect`), all tiers, `test-results/faults/kill-matrix.json`; `--sealed`: the gate's sealed batch, once (55 C1 (b)) (24) | `faults.yml` | 2.7 |
| `mutation` = `stryker run stryker.config.mjs` | C2, VF-08 (24) | `mutation.yml` | 2.7 |
| `coverage` = `node scripts/merge-coverage.mjs` | C3: Jest V8 + `page.coverage` + `NODE_V8_COVERAGE` (24) | gate runs | 2.7 |
| `corpus -- --golden <digest> --candidate <digest>` | C4 (container); `--live`: GATE-x.6 A/B on release-recipe builds; equal digests refused except `--self`; positive controls (55 C4) | `gate-s.yml` | 2.5 |
| `soak -- --reference <digest> --candidate <digest> --golden <digest>` | C6-CI (55): prod limits, interleaved corpus replay through the stub | `soak.yml` | 2.5 |
| `outdated-at -- <Tr>` = `node scripts/outdated-at.mjs` | GATE-x.1 outdated list at the cut-off (02 §5 step 5) (24) | sweep head checks, gate runs | 2.7 |
| `gate-stats` = `node scripts/gate-stats.mjs` | C1, C4, C6-NI statistics and power; C6-prod and C6-CI tests, row 7 group key, calibrations (55 §2) (24) | gate runs | 2.5 (C6-NI), 2.7 |
