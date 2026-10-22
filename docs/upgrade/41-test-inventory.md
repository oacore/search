# 41 — Test inventory

**Purpose:** every test T-### with priority, cases, risks and expected-failure steps; the catalogues tests are built from (E1–E22, per-action counts, V1–V39, J1–J32, widths, fixtures); the risk → detector index.
**Read it** when writing tests (2.3, 2.7, a step's first PR), at a step start (filter Wave), when triaging, at a gate (§3, §4).
**Owns** T rows (P, cases, Risks, Wave), catalogues, risk index. Elsewhere: harness, normalisations, commands [40](40-test-strategy.md); baselines, AD ledger, CI [42](42-baselines-and-ci.md); thresholds, C1 rule [55](55-gates-and-confidence.md); Q → T [30](30-quirks-register.md); versions [02](02-version-matrix.md); status [STATUS](STATUS.md) (default TODO).

## 0. How to read

- **P0:** written in 2.3, green on the unchanged app before the 2.5 capture. **P0@x:** written in the first harness PR of step x and green on the step reference (`<base'>` for 2.1, 42 §5), before any CS PR other than the one that creates the reference.
- **P1:** written in 2.7 if its first Wave step is W0–W4e or `all`, else in the first PR of its first Wave step; **P1@x** overrides. **P2:** optional. Tests block once they exist.
- A test that is the only pin of a Q clause (30 §1 rule 1), or the only test of an E item or of a J item whose catalogue row is P0 or P1, is **P1@2.7** (never P2 or a later first write), so every gate has its pins (55 C3, GATE-x.5).
- Every step runs all P0 and every existing P1; every gate (GATE-S/A/F) runs all tiers; tiers only control per-PR cost (review:00 X40.14).
- **Wave:** steps where a failure is expected; it never limits when a test runs. Step IDs per [50](50-roadmap.md); `a–b` = every step from a to b in 50's order; `6.x`/`7.x` = all phase-6/7 steps.
- **Risks:** the authoritative R → T link ([10](10-risk-register.md) has no Tests column). Q-### behaviour: defined in 30, pinned here.
- **Cases:** the minimum, as clauses: `docs:check --cases-out test/cases.json` splits each Cases cell on top-level `;` into clauses c1…cn (position only, not IDs); a row with n > 1 needs a test naming each clause (`T-805 c3`, 40 §7 rule 1), and `docs:check --tests` fails on a clause with no test once the row has any. "03 §x"–"08 §x" = findings/0N §x, the normative case list ("01", "02" = plan docs); "Corr:" overrides it. Fixtures: §2.6. Layers, black/white-box: 40 §3.
- T-111, T-112 unused (tested via T-402, T-411); T-708 WITHDRAWN.

## 1. Tests

### A. Static and build

| ID | P | Target | Cases | Risks | Wave |
|---|---|---|---|---|---|
| T-001 | P0 | Lint parity (`lint-parity.mjs`) | (path, rule, count), repo-relative = findings/baselines (13 ESLint + 16 stylelint findings, 38 inline disables); `test/**`, `e2e/**` overridden (`lint:js` takes `.js`/`.jsx` only: `.mjs` specs, scripts and configs are not linted today). W1: new-tool baseline on unchanged code | R-033, R-049, R-050 | W1, 6.2 |
| T-002 | P0 | CSS-module keys (source) | 66 importing files: every `styles.<id>` member read (363; 430 was a grep token count) exists in its module under camelCase, except the 24 pinned dangling reads (Q-099), with 202 reads in 47 files that exist only through the camelCase export. Blind to the build no-op (T-605) | R-001 | W4b–W4d, W6c, W7a, W7c, 6.7, 6.9 |
| T-003 | P0 | Built CSS | Keyed by (source file, normalised selector list, at-rule chain, ordinal), never hash-stripped selectors. 0 `@media (--`, 0 `@extend`, `color-mod(` count (Q-066), declarations per key = baseline; media-rule count per feature (`prefers-*`, `hover`, `pointer`, `forced-colors`) = baseline. Any diff (W4c minifier, DV7, CS-CSS-4, CS-W0-11) passes only as an AD row with T-801 0 px on all three engines (OD-37) | R-008, R-009, R-023, R-024, R-043, R-086 | W4b, W4c, W8, 6.9, 7.1 |
| T-004 | P0 | Bundles (`.next` of the image) | Client: one `react`/`react-dom`, `@sentry/browser`; server only `@sentry/node` (CS-W0b-3; `@sentry/nextjs` from 6.8, CS-SEN-2); no new `readFileSync` of `lib/loader.js`; `API_KEY` placeholder in client (S-1); `pages-manifest` = known routes; client polyfills: per route, the `core-js/modules/*` of its first-loaded scripts = reference (R-032 usage built-ins) | R-032, R-040, R-044, R-091 | W2a, W4b, W4c, W6a, W6c, W7b, 6.7, 6.8 |
| T-005 | P0 | Static assets | Set from the golden image: prod sprite 48 symbols + byte hash (Q-067); next-images 9 file URLs + 5 data URIs (14 source import sites; the build holds 9 file-URL and 4 data-URI modules: `templates/data-provider/logo.jsx:4` is imported by no page); `.next/static/media` base names (60 KaTeX fonts, slick, `ajax-loader.gif`); `public/images/*` | R-007, R-021, R-022 | W0.5, W4c, W5, 6.9, 7.F |
| T-006 | P0@2.1 | Design runtime config | Image's design `lib/config.js` (from DV7 the committed constant): `iconsPublicPath` `/static/search/icons.svg` | R-022, R-091 | 2.1, W0.5, W5, 6.9 |
| T-007 | P1 | Bundle budget | Per-route first-load JS gzip ≤ B0 +10 % cumulative (OD-49), from manifests, never per chunk (chunk graph changes) | R-048, R-064 | W4b–W7c, 6.x, 7.x |
| T-008 | P0 | Install, alpine arm64 | `npm ci`, no fallback; with `npm_config_userconfig=/dev/null --no-legacy-peer-deps`: `npm ls --all` problems ⊆ the 02 §4 allow-list (today's 9 and their closing steps: 02 §1 rule 6); musl + gnu `@next/swc-*` locked from Next 12 (W4c; 10.2.3 locks none), sharp musl from 15; `@oacore/design` 5.0.74 `sha512-kwYolSk…` until DV9; resolves `node-fetch` (to W4a), `@mdi/svg`, `@babel/runtime`, `yargs` | R-014, R-015, R-027, R-054, R-066 | all |
| T-009 | P1 | Data files | On the frozen snapshot and on the release-recipe build of every step head (01 §4 step 3a, blocking; deployed data: T-907): `.formap.json` `[{id:number,name}]`; `.members.json` `billing_type` ∈ starting/supporting/sustaining, `repo_id` int, int[] or null; `.statistics.json` numeric `totalArticlesCount`; floors: formap and members rows, `totalArticlesCount` ≥90 % of the snapshot's | R-067, Q-026 | W0, W4a, every step head |
| T-010 | P0 | Routes manifest | (source, destination, headers) tuples = baseline (data and `/static` rewrites; CSP = T-116 string); the rewrite Next injects from 15 whitelisted | R-002, R-020, R-021, R-068 | W4c, W4d, W6c, W7a, W7c |
| T-011 | P0@2.1 | Repo layout | 0 `*.test.*` under `pages/`; `git ls-files --others --ignored --exclude-standard -- test e2e` empty; harness page absent from the prod `pages-manifest` | R-091 | all |
| T-012 | P0@2.1 | Harness self-tests | Per Jest project: real `*.module.css` gives kebab + camel keys, `styles.unknownKey === undefined`; ESM allow-list; router-mock contract (`prefetch`); RouterContext path map; harness constants: comparator `pixel-exact.mjs` (40 §1), no `mask`, `retries` 0, `forbidOnly` true, the sha256 of the T-805 list, the 40 §1 normalisation column and the 42 §8 key rule = `docs:check --constants`, and of `t805-exclusions.json` = STATUS §1 (40 §8 rule 8); comparator negative control: a stored image pair differing only in anti-aliased pixels counts >0; `gate-stats.mjs` known answers: Clopper-Pearson 59/59 = 0.9505, the 55 C6-NI binomial example, a seeded synthetic bootstrap with its expected U, power (φ 1, x0 9,892, 28-day pre, 14-day post, m 1.05) = 0.80, the C6-prod row-1 z test | R-001 | every harness PR |
| T-013 | P0@2.1 | Prod tree immutable | `scripts/lock-immutable.mjs`: old lock entries unchanged; `npm ls --omit=dev --all` identical; drift pinned by `overrides`; Playwright, axe only in `e2e/package.json` | R-015, R-084 | 2.1, every harness PR |
| T-014 | P0@2.1 | Build determinism | (a) Two builds of one tree: `.next/static` + `.next/server` identical, buildId normalised (VF-09; VG-5). (b) From 2.6, every step head (01 §4 step 3a): release and parity image of one checkout, built in one job: `.next` identical after normalising the inlined build-arg literals (42 §2) and the modules built from `data/*.json` | R-075, R-084, R-091 | 2.1, W0.5, W5, every step head |
| T-015 | P1 | JS syntax floor | es-check on client chunks; floor per Next version in the step record | R-077 | W4d, W7a, W7c, 7.0 |
| T-016 | P0 | Vendored design (VG-1, VG-2) | Not a symlink, 466 tracked files; emitted module == file (client: equal after the same transform, Next's terser options with locals renamed canonically, since chunks are minified; server: the package stays external, the external list pinned), no core-js injection; `verify-design-verbatim` vs the 5.0.74 tarball == `CHANGES.md` (before W0.5 on `node_modules`: differs only in `lib/config.js`); client require edges: every require of a bundled design module resolves to a package module, none into the app tree (`hooks` alias hit, R-025) | R-015, R-025, R-075 | W0.5, W5, W5.5, W7b, 7.1 (retired 7.F, 80 §5) |
| T-017 | P1@6.1 | TS ratchet | `tsc -p tsconfig.json` and `-p tsconfig.strict.json` pass; strict `include` never shrinks | R-090 | 6.1–6.6 |
| T-018 | P0@6.1 | Output identity | Per TS/Babel-config PR: Babel output of type-stripped TS == original JS; `.next` identical modulo module paths. 6.7 (SWC): same report, every diff class reviewed per [70](70-phase6.md) | R-011, R-032, R-090 | 6.1, 6.6, 6.7 |

### B. Unit (Jest, node)

| ID | P | Target | Cases | Risks | Wave |
|---|---|---|---|---|---|
| T-101 | P0 | `api/index.js` requests | 06 §7.2 "request builder". Corr: string body → `text/plain;charset=UTF-8`; arrays `a%2Cb`, `undefined`/`null` literal; GET without Content-Type (a GET with an object body hands fetch the raw `body` option and `application/json`: `TypeError` before sending; no caller does it); Authorization to every host (S-2) | R-028 | 6.3 |
| T-102 | P0 | `api/index.js` responses | 06 §7.2 "response/error". Corr: malformed JSON and empty 204 under `application/json` → `SyntaxError`, not reported to LogRocket (`captureException` runs for status and network failures only); `JSON.stringify(error)` = `{name,response:{},data,type,status,headers:{}}` | R-028 | 6.3 |
| T-103 | P0 | `api/internalize.js` | 06 §1.4, 6 cases (`jest.isolateModules`) | R-016 | W4e, 6.3 |
| T-104 | P0 | Wire headers | Echo server gets a call via `api/index.js` with `Internal_API*` set, MSW off: Host = service host, `user-agent: node`, `accept-encoding: gzip, deflate` (Q-022); step's runtime Node (Jest's Node major = the Dockerfile's) | R-016, R-028 | W4a, W4e, 6.3, 6.10 |
| T-105 | P0 | `utils/filters-transform.js` | 06 §3.2; Q-033, Q-034; `en`/`EN`; quote stripping | R-030 | W3, 6.5 |
| T-106 | P0 | `utils/data-providers-transform.js` | 06 §3.7 (Q-023, Q-035). Corr: data `billing_type` vs code `billingType` (starting never excluded); null logo → `GET {API_URL}null` (Q-090) | R-067 | 6.3, 6.6 |
| T-107 | P1 | `utils/validation.js`, `store/params.js` | 06 §3.4 | R-018 | W3, 6.5 |
| T-108 | P0 | Locale/TZ/ICU | `formatDate` 06 §3.5 in UTC, New_York, Tokyo (a child process per zone: `process.env.TZ` set inside Jest does not reach `Intl`); Q-029; `formatNumber`; `regionDisplayName` 676-region snapshot, same on every runtime Node (R-042), FK/HK/MO/PS recorded (Q-093); `getCountryName` on vendored 6.8.0 data (TR→Turkey, null→undefined) | R-010, R-031, R-042 | W0, W4e, 6.10 |
| T-109 | P1 | `utils/related-words.js` | 06 §3.3 | — | 6.6 |
| T-110 | P1 | Helpers | `getAssetsPath`, `rewriteDataPath` (`utils/helpers.js:4-25`); `findUrlsByType` mutates, first wins; `utils/sort.js` 06 §3.1 | R-002, R-021 | W4c, W4d |
| T-113 | P1 | Template utils | `generateFormMessage` error > created > duplicated; JSON-LD positions + `</script>` name (S-4, preserved: OD-36); `normalizeDataProviders`; multi-member `pickFeaturedMember`, seeded; `getMemberRepoId` | R-003 | 6.6 |
| T-114 | P1 | BibTeX | 06 §6 sample; garbage → `[]`; string thrown (Q-037); same on vendored `bibtexParse.js` | R-053 | W0 |
| T-115 | P1@2.7 | CSV download | E3 `text/csv` → `FileDownload(Blob,'results.csv')`; body `{q,accept,limit}` | R-028 | 6.3 |
| T-116 | P0 | Config modules | `env.config.js` `APP_ENV` → `API_URL`, throws without `API_KEY`; `csp.config.js` snapshot prod + dev | R-026, R-063 | W2b, W6c, W7a, W7c, 6.8 |
| T-117 | P0 | `data/data-loader.js` | Child process, temp `data/`, URLs → stub: 200 → 3 files raw, exit 0; 200 `[]` → exit 0, files `[]`; members 500 → exit 1, partial write; HTML or reset → exit 1; hang → running at timeout (Q-026). Same after W4a (OD-08) | R-017 | W4a, W4c |
| T-118 | P1 | `lib/loader.js` | Hit → no fetch; miss → `{data, timestamp}` (Q-025); 3 s timeout, 500 → null | R-055 | W4c, W6c |
| T-119 | P0 | `App.getInitialProps` | Q-004, Q-007 | R-055 | W4c, W6c |
| T-120 | P1 | `utils/sentry.js` | No DSN → no `init`; DSN → one `init` | R-040, R-055 | W2a, 6.8 |
| T-121 | P0 | `invalidatePreviousRequests` | Call 2 aborts call 1; signal after args (Q-020); one controller per decorated method, shared by every instance of the class; call 1 rejects after call 2 starts (Q-091) | R-011 | W2e, 6.5, 6.7 |
| T-122 | P0@6.3 | Transport differential | Old wrapper vs axios transport: raw request bytes (method, URL, all headers, body) and error deep-equality for the T-101/102/104/205 cases, one CI job | R-016, R-028 | 6.3 |

### C. Store (Jest, jsdom)

Transitions: 03 §5.1, 06 §7.2.

| ID | P | Target | Cases | Risks | Wave |
|---|---|---|---|---|---|
| T-201 | P0 | Filters fetch | `initialData` then diff (Corr: `isVisibleClearButton` is `undefined` after the first fetch with nothing checked, the first checked filter object otherwise); year open → 5 aggregations; zero years kept; `unknown` first; E2 500 → `console.error`; clear-all → 2 identical E2; refined q keeps stale buckets (Q-092, two distinct responses) | R-011, R-029 | W3, 6.5 |
| T-202 | P0 | Filters URL algebra | Q-040, Q-041; `reset('machine learning AND x')` → `q='machine'` + `fetchFilters('machine', signal)` (Q-020, Q-042); `reset(undefined)` throws; `pathname: undefined` | R-019 | W4c–W7c, 6.5 |
| T-203 | P0 | Reactivity contract | Generated table: observable/computed/action per field and method = baseline, incl. non-observable `Claim.duplicated` and un-actioned Search/Report methods; `autorun` once per write. From 6.0 via T-212 | R-011, R-039, R-046, R-081 | W2e, W3, 6.5, 6.7 |
| T-204 | P0 | Search store | 03 §5.1 "Search" (Q-043; CSV flow) | R-019 | W4c–W7c, 6.5 |
| T-205 | P0 | Claim store | 06 §5.1; raw string body `text/plain` (Q-019). Corr: overlapping `retrieve()` ends on the AbortError message, `created` set, `isLoading` false (Q-091); 409 message only via the `isLoading` flip | R-028, R-030 | 6.3, 6.5 |
| T-206 | P1@6.0 | Report store | `fetchOutput` strips `fullText`; `submit` mutates its input; error constant; `report.error` survives nav (Q-094) | R-073 | 6.5 |
| T-207 | P1@6.0 | SimilarWorks | Body ± `resultType:'work'`; fallback; `error:true` | R-029, R-073 | 6.4, 6.5 |
| T-208 | P1 | DataProviders | 6 search fields, case-insensitive; Q-028 | R-018 | W3, 6.5 |
| T-209 | P0 | Store isolation | Own file, node, `jest.isolateModules`: new server store per call, concurrent states isolated; client singleton; Q-048.U3. Rewritten via T-212 | R-004, R-018, R-073 | W3, 6.5 |
| T-210 | P1@6.0 | Facet aliasing | Toggle after `setActiveFilterSuggestions(f.items)` updates `data[i].items[j].checked` | R-030 | 6.5 |
| T-211 | P1@2.7 | Filters race | Q-021 | R-073 | 6.5 |
| T-212 | P0@6.0 | Store-driver contract | T-2xx (incl. T-203 effects), T-209, T-210 on `test/drivers/store-driver`; MobX driver 6.0, zustand per store 6.5; same results | R-004, R-011, R-030, R-073 | 6.0, 6.5 |

### D. Hooks (Jest + RTL)

| ID | P | Target | Cases | Risks | Wave |
|---|---|---|---|---|---|
| T-301 | P0 | `useDebouncedEffect` | 03 §4 (sync first, 250 ms coalesce, unmount cancels). Corr: no StrictMode case | R-018 | W3, W6a |
| T-302 | P0 | `useSyncUrlParamsWithStore` | 03 §4 (first `replace` sorted shallow, later `push`, same URL none, `routeChangeComplete` sets `size`); Q-048.U1 | R-018 | W3, W6a, W6c, 6.5 |
| T-303 | P0 | `usePagination` | 06 §3.6; Q-039 | — | W3, 6.6 |
| T-304 | P1 | Small hooks | `useWindowSize`, `useOutsideClick`, `useInput`, `useCopyToClipboard` (2.5 s, no clipboard → TypeError) | R-018 | W6a |
| T-305 | P0 | `useAnalytics` | Consent gating (Q-059); `send({hitType:'search'})` no-op + warning per load and route change (Q-071); GA code unset + accepted → unmount (Q-059) | R-041 | W4c, W5, 6.6 |
| T-306 | P1 | Template hooks | Claim (500 ms), report, year controller with the clock set before import (`use-year-filter-controller.js:6`) | R-018 | W3 |
| T-307 | P2 | `useLoading` | Router events | R-002 | W4c |

### E. Components (Jest + RTL)

| ID | P | Target | Cases | Risks | Wave |
|---|---|---|---|---|---|
| T-401 | P1 | `pages/search/index.jsx` | ErrorCard vs QueryError (Q-003); `queryError` → data re-render keeps "Rendered more hooks" (Q-047) | R-033 | W1, W6a |
| T-402 | P0 | `templates/search/results.jsx` | Title href (Q-012); reader → `api.core.ac.uk/reader-ui/1`; full-text order (06 §2.2); logo rule (Q-023); E22 per card per provider (Q-090); UTC date | R-010, R-033, R-051 | W4c, W6a, W7b |
| T-403 | P0 | Filters bar | LoadingBlock; facet search; exact push; "..." counts (three ASCII dots); Clear all iff checked; no undefined class; Q-092 | R-001, R-030 | W3–W7c, 6.5 |
| T-404 | P0 | Year filter, Histoslider | `height="200"` from `defaultProps`, slider 20, bars = years, no `NaN`; presets; classic and automatic JSX runtime | R-012 | W7b, 6.1, 7.1 |
| T-405 | P1 | Search pagination | Labels at ≥5; siblings 2/0 at 500 px; last-page Next by keyboard (Q-083); "last" | R-019 | W6a |
| T-406 | P0 | Provider pagination | Hrefs at offsets 0/10/90 of 100 (Q-044); one `<a>` per control; `aria-disabled`; Q-083 | R-013 | W6c, 7.F |
| T-407 | P0 | Providers result card | Anchor structure; click → `/data-providers/<id>` | R-013 | W6c, 7.F |
| T-408 | P1 | Sort | `sort` + `page:1`; provider keeps `offset`, Q-043; Q-049 | R-039 | W3, W6a |
| T-409 | P1@2.7 | CSV modal | `activeLimit`; E3 body; Q-056, Q-077, Q-085; Cancel → none | R-028 | 6.3, 6.5 |
| T-410 | P1 | Cite modal | Text; copy; no DOI → no Cite; Q-037 | R-053 | W0, W7b |
| T-411 | P0 | Takedown + report | 06 §3.6 parser (Q-036); exact error JSX; chain; Q-060, Q-078 | R-037 | W7b, 6.5, 7.2 |
| T-412 | P1 | Claim card | 06 §5.2. Corr: claim rows 1–5 (§2.6) SSR vs final; POST 500 → nothing; `/account` per §2.2 (Q-087) | R-038 | W6a, 6.3, 6.5, 7.2 |
| T-413 | P1@2.7 | Add-provider form | 4 messages; Q-038 | — | 6.5, 7.2 |
| T-414 | P1@2.7 | Map | 0, 1, 30 locations (Q-058 c1); `zoom` ignored (c3); popup `href` unquoted (c4) | R-047 | W6c, W7a, W7c |
| T-415 | P1 | App shell | Q-010 (one `captureException`); LoadingBar; Q-008 | R-040, R-058 | W2a, W7b, 6.8 |
| T-416 | P0 | Consent | Popup and cookie writes per Q-070 | R-041 | W5, 7.1, 7.2 |
| T-417 | P0 | Design contract | 23 components + `useCookie` + `classNames` (04 §5 props): DOM, classes, statics, both `classNames` shapes, [60](60-design-ownership.md) preserved behaviours, E22 count; interaction census: click, dblclick, hover 300 ms, focus, Enter, Space, Esc, ArrowDown on every node of the unit, recording DOM mutations, focus, URL, network, `checkValidity()`; package, then copy, each port and each antd unit: identical; overlays: with each overlay open (modal, select, popover, dropdown), window `blur`, scroll by 100 px and resize by ±1 px: DOM mutations, focus and network = B0 | R-024, R-025, R-056, R-075 | W0.5, W5, W5.5, W7b, 7.1, 7.2 |
| T-418 | P0 | Icon ids | Each `Icon` id (20 + design ids, 04 §3.3) is a `<symbol>` of the served prod sprite | R-022 | W0.5, W5, 6.9 |
| T-419 | P1 | Output template | Similar states; related; Q-062, Q-076, Q-046, Q-064 | R-029 | W6a, 6.4 |
| T-420 | P1 | Header search wiring | Q-057, Q-012; outputs push `/search/?q=` | R-051 | W4c, W6a |

### F. In-process gSSP (Jest, node)

| ID | P | Target | Cases | Risks | Wave |
|---|---|---|---|---|---|
| T-501 | P0 | `/search` | Every 06 §2.1 row (exact E1 URL, body, abort, members, props); Q-002, Q-013, Q-015. Corr: `t` injection, repeated `t` (Q-016), the recorded live answers for `page=0` (offset -1) and `page=1000` (offset 9990) are 500 and 400 (ErrorCard; `currentPage` 0 and 1000 only with a 200 answer) | R-028, R-045 | W4c–W7c, 6.3 |
| T-502 | P0 | `/works/[id]` | 06 §7.2 (Q-031, Q-001, Q-024). Corr: W-410-json/-text, W-emptydate, W-nodp; Q-016; `GET {API_URL}undefined` (Q-090; only for a member provider whose logo is `null` or `''`; `{API_URL}null` is the provider page, T-504); citations in props | R-028, R-045 | W4c–W7c, 6.3 |
| T-503 | P0 | `/outputs/[id]` | Q-030; 410, disabled, 500 messages; O-yearstring, O-nofulltext | R-028, R-045 | W4c–W7c, 6.3 |
| T-504 | P0 | `/data-providers/[id]` | `notFound`; Q-035; base64 logos; `billingType`; E13 error serialised; E18 un-awaited; Q-016; Q-090 | R-028, R-045, R-067 | W4c–W7c, 6.3 |
| T-505 | P1 | `/data-providers` | Props, formap fixture; Q-080 | R-018 | W3 |
| T-506 | P0 | healthz | 200 `{"status":"ok"}` | R-020 | all |

### G. Server HTTP (Playwright `request`, via the proxy)

| ID | P | Target | Cases | Risks | Wave |
|---|---|---|---|---|---|
| T-601 | P0 | Route/status matrix | findings/02 §4.1 URLs ± slash, with queries: status, `Location`, marker; plus `/search/?q=x&page=0`, `&page=abc`, `&page=1001`, `/works/1001/?t=a%26b%3Dc%20d`, `/works/1001/?t=a&t=b`, `/data-providers/0x56/`, `/data-providers/?q=100%25` (500: Q-028, Q-073 (d)), each with its T-607 upstream URL = B0 (Q-013, Q-016, Q-035). Corr: expected values per Q-001, Q-002, Q-005, Q-073, Q-098 and review:ui-flows §1; 500 fixtures W-410-*, W-emptydate, W-nodp, O-nofulltext; local-only pages via the allow-all proxy; `.map` 200 (S-9) | R-005, R-020, R-045, R-085 | all |
| T-602 | P0 | SSR head | 07 §7.1 on works 1001–1005, outputs 2001–2004, O-yearstring, search, providers, errors. Corr: raw `<title>` bytes (DOM parser, JS off, comments kept); app-owned tags in order, set per page type (Q-053); 40 §1 normalisations; html-validate pinned; 1004 pins `window.__PWN` (S-4, preserved: OD-36) | R-003, R-005, R-042, R-069, R-078 | all |
| T-603 | P0 | Headers | Values per class (HTML, `_next/data`, `public/`, `_next/static`, `.map`, `icons.svg`, 308, 404, 500, healthz), origin and proxy (healthz: the allow-all listener, the gateway does not route it, Q-005), for GET, HEAD, conditional GET and `Accept-Encoding: br, gzip` (42 §8) = `e2e/http/contract.baseline.json`; deltas only as AD rows (OD-39); CSP on every class; inline-script count (S-6) | R-026, R-083 | W2b, W4c, W4d, W6a, W6c, W7a, W7c, 6.8 |
| T-604 | P0 | `_next/data` via prefix | `/search/_next/data/<id>/works/1001.json` with and without CS-OPS-1: `application/json` + `pageProps`; `__N_REDIRECT`; `{notFound:true}`; stale buildId → 404 + hard-nav fallback; root `/_next/data` → other service | R-002, R-068 | W4b–W4d, W6c, W7a, W7c |
| T-605 | P0 | Class census | T-601 200-routes, SSR and post-interaction DOM (incl. client-only modals): (DOM path, class tokens, and `type`, `form`, `disabled`, `href`, `target`, `rel` of every `button`, `a`, `input`, `form`) normalised to `[name]_[local]` = baseline; 0 `[object Object]` URLs (an undefined `styles.x` omits the attribute) | R-001, R-007 | W4b–W7c, 6.7, 6.9, 7.x |
| T-606 | P1 | SSR resilience | Failing stubs → render < 30 s; Q-004; LogRocket import safe | R-055, R-062 | W2b, W4a, W4c |
| T-607 | P0 | In-cluster wire headers | Every run `Internal_API=http://stub`, `Internal_API_HOST=api.core.ac.uk`; stub records each SSR call's Host, Authorization, Accept, Content-Type, UA, Accept-Encoding, `sentry-trace`/`baggage` = baseline (Q-022) | R-016, R-028, R-076 | W4a, W4e, 6.3, 6.8, 6.10 |
| T-608 | P0 | Crash semantics | Preload throws async: prod-shaped DSN → exit 1 within ~3 s; no DSN → survives; `unhandledRejection` → survives + one event per handler (2 today: the `@sentry/node` 5.30 integration and `pages/_app.jsx:21-23`) | R-040, R-055 | W2a, W4b, W6c, W7c, 6.8 |
| T-609 | P0 | Concurrency | 200 interleaved SSR requests (2 queries, works 1001/1002), random latency: each response holds only its data; every 6.x PR; `/data-providers/?q=<a>` and `?q=<b>` (two snapshot terms with disjoint results) in the same mix: each SSR result list holds only its own `q` (the server store's only per-request state, `pages/data-providers/index.jsx:34`; R-004) | R-004, R-018, R-073 | all |
| T-610 | P0 | Props, server output | `__NEXT_DATA__.props` and `_next/data` JSON deep-equal; no `svc.cluster.local`, `Bearer `, stack in HTML; stdout/stderr census (allow Next 13.5/16 listeners); 0 server Sentry events | R-003, R-028, R-040, R-073 | all |
| T-611 | P1 | Size budgets | Raw + gzip per route ±5 % (`/data-providers/` 7,104,305 / 1,003,968 B); RSS after the P0 sweep ≤ +10 % | R-048 | W4b–W7c, 6.x, 7.x |
| T-612 | P0 | Gateway proxy | Generated from `kube/{prod,stage}/httproute.yaml` (differ only in namespace, hostname); table: `/searchx`, `/static/search`, `/display`, `/display/1/`, `//works/1`, `%2F`, unicode, `a+b`, long URL, `/_next/…`, `/static/search/_next/image` (routed to the app as today, OD-41; S-10 status as today, a change caused by a Next bump alone only via an owner-signed `delta` AD row, 42 §8) | R-020, R-068, R-072 | all, YAML PRs |

### H. Browser E2E (Playwright; journeys §2.4)

| ID | P | Target | Cases | Risks | Wave |
|---|---|---|---|---|---|
| T-701 | P0 | Console/hydration gate | T-601 200-routes (incl. `/display/<id>/`) x 3 TZ x 3 cookie states: `pageerror`, `console.error`, window `error` outside the T-728 pinned-diff tuple set (55 C7 (1); never keyed on message text) and T-741 pins = 0. Corr: React 17 prod logs no "did not match" | R-006, R-010, R-013, R-032, R-044, R-047, R-056, R-057 | all |
| T-702 | P0 | Navigation network log | From `/search/?q=climate`: page, sort, toggle, Clear all, Back, Forward; log = §2.2; 1 `document`; client navs hit `/search/_next/data/` 200; `window.__marker` survives; result click = full nav; 0 pageerrors. History log (init script; also in T-704, T-707, T-722): `pushState`/`replaceState` (method, URL, state keys), `history.scrollRestoration`, `scrollY` after each Back and Forward = B0; window events: after settle, `visibilitychange` hidden→visible, window `blur`→`focus` and `context.setOffline(true)`→`false`: request log, DOM and URL = B0 (SWR revalidation, 70 §3.4); every other §2.2 action row, each from a hard load: works and output loads, client nav output A → B (Q-055), `/data-providers/{id}` load, typing a URL on `/data-providers/` (E16 per settled value: body bytes and `Content-Type`, Q-019), report submit (E10), client nav to `/outputs/update/` by `window.next.router.push` (E19 x3 from the browser, Q-011): per-action browser log = B0 | R-002, R-028, R-029, R-055, R-068 | W4c, W4d, W6a, W6c, W7a, W7c, 6.3–6.5 |
| T-703 | P0 | J1 | | R-001, R-019 | all |
| T-704 | P0 | J2, J21 | Q-042 | R-011, R-019, R-030 | all |
| T-705 | P0 | J3, J21 | `setFixedTime` | R-012 | W7b, 6.1, 7.1 |
| T-706 | P0 | J4 | | R-019, R-052 | all |
| T-707 | P0 | J5 | | R-051 | all |
| T-708 | — | WITHDRAWN | Split into T-602 + T-729; "none removed" is red on the baseline (review:00 X40.8) | — | — |
| T-709 | P1 | J7 | | R-053 | W0, W7b |
| T-710 | P1 | J8 | Q-063 | R-021 | W4c |
| T-711 | P1@2.7 | J9 | Toast via advancing `page.clock` (`install()` does not freeze) | R-028 | 6.3 |
| T-712 | P1@2.7 | J10 | Q-055; remount path with the E8 stub delayed 1 s (hard load A, client nav to search, Back to A): loader visible before E8 resolves, E8 = 1 per mount, T-801 loading-state capture 0 px; T-702's window events on the works page after settle: E8 count, DOM and URL = B0 | R-029 | 6.4 |
| T-713 | P1 | J11 | Q-060, Q-082, Q-094 | R-037 | W7b, 6.5, 7.2 |
| T-714 | P1 | J12, J27, J32 | Q-080, Q-084 | R-013, R-047, R-052 | W6a, W6c, 6.5, 7.2 |
| T-715 | P1 | J13 | Q-079, Q-044, Q-043, Q-049 | R-013, R-039, R-047 | W3, W6a, W6c, 7.2 |
| T-716 | P1 | J14 | J14 (§2.4); client nav from `/search/?q=climate` to `?q=__status500` (header search): today's hooks-order crash stays (React #300 via `console.error`, blank `#__next`; Q-047, Q-010); header search from a hydrated `/works/<id>/` or `/outputs/<id>/`: same crash (Q-100) | R-020, R-033 | all |
| T-717 | P2 | J15 | | — | W7b |
| T-718 | P1 | J16 | | R-008 | W4c, W8, 6.9 |
| T-719 | P0 | J17 analytics | Pinned `gtag.js` or `dataLayer` spy: 0 hits before consent, 1 config hit on a consented hard load, 0 on client nav (Q-071); every `dataLayer` entry deep-equal B0 per cookie state (dates normalised); Sentry via prod-shaped DSN → counting stub (today the CSP blocks the browser report: one `connect-src` violation, 0 requests at the stub; Q-096); LogRocket aborted, counted; per cookie state | R-026, R-041 | W2a, W2b, W4c, W5, 6.8 |
| T-720 | P0 | CSP violations | `securitypolicyviolation` on all journeys = 0 | R-026 | W2b, W6c, W7a, W7c, 6.8 |
| T-721 | P0 | Asset 4xx | No image/icon/CSS/JS ≥400 on any route or modal; negative control: start without `BUILD_TARGET` must fail | R-007, R-021, R-082 | W4c, W5, 7.F, Dockerfile/kube PRs |
| T-722 | P0 | `/data-providers` history | 03 §5 R5 list; Q-048.U1, Q-048.U3; `history.length` | R-018 | W3, W6a, W6c, 6.5 |
| T-723 | P1 | `/display/:id/` | Render, client nav, Q-075 | R-010, R-020 | W4c, W5.5, W6a |
| T-724 | P1 | Engine smoke | J1, J5, J12 on WebKit, Firefox, one engine at the T-015 floor | R-032, R-065, R-077 | W4d, W7a, W7c, 6.7 |
| T-725 | P0 | J18 | | R-075, R-087 | all |
| T-726 | P1 | J19 | | R-075, R-087 | W5, 7.x |
| T-727 | P1 | J20 | | R-051 | W5, W6c |
| T-728 | P0 | J30 hydration diff | No-JS vs hydrated DOM (text, attributes) + MutationObserver, both also vs the B0 captures (SSR body DOM, 40 §1); pinned diff = T-701 allow-list on React 18/19, keyed on the 55 C7 (1) tuple; routes x fixtures x 3 TZ x 3 cookie states x 3 engines; React-17 dev inventory (40 §4), each hit → Q row | R-010, R-013 | all |
| T-729 | P0 | Post-hydration head | `document.head` per fixture (author/subject counts varied) = pinned (Q-069); from 15 also after client nav, per-version diff as AD rows (OD-39) | R-003, R-071 | W6c, W7a, 7.x |
| T-730 | P0 | J24 | Fixtures Q-074a–e: `#__next` empty, error signature (React 17: `console.error` through the ErrorBoundary, Q-010, no `pageerror`), SSR HTML intact | R-058 | all |
| T-731 | P0 | J23 | T-601 500 fixtures in the browser: `_error` in layout, `<title>`; `_next/data` 200 where direct is 500 | R-045, R-085 | all |
| T-732 | P1 | J22 | Extends T-723 | R-010, R-020 | W5.5, W6a |
| T-733 | P1 | Modal layering | Q-085, header unmasked | R-075, R-087 | W5, 7.2 |
| T-734 | P0 | J25 | Rows 1–5 (§2.6); `/account` per §2.2; delayed E16 claim race (Q-091; the browser's E16 is held at a route gate: the stub delays server calls only) | R-028, R-038, R-073 | W6a, 6.3, 6.5, 7.2 |
| T-735 | P1 | J26 | Q-079, Q-044, Q-043; counts §2.2 | R-018, R-039 | W3, W6c, 6.5, 7.2 |
| T-736 | P1 | J29 | Extends T-804; Q-083 | R-075, R-087 | W5, 7.2 |
| T-737 | P2 | J31 | V29 | — | 7.2 |
| T-738 | P1 | Sticky layers | V26, V27 at `scrollY` 900 (Q-088) | R-023, R-087 | W5, 7.x |
| T-739 | P1 | Geometry sweep | `getBoundingClientRect`, `display`, `visibility` per element, sweep widths on 2 shells (§2.5); overflow at 501/320 (Q-088) | R-001, R-008, R-023, R-086 | W4b–W8, 6.9, 7.x |
| T-740 | P0 | J28 | Q-070 | R-041 | W5, 7.x |
| T-741 | P0 | Console pins | Per route: the Q-071 warning per load and route change + other baseline messages (review:ui-flows §8.6); versioned per React/Next; entries cite R/Q | R-041, R-056, R-057 | all |
| T-742 | P1@6.5 | zustand singleton | `/data-providers` hard load + client nav: seeded from `initialState`, no #418, stable selectors | R-073 | 6.5 |

### I. Visual and accessibility

| ID | P | Target | Cases | Risks | Wave |
|---|---|---|---|---|---|
| T-801 | P0 | Page visuals, 0 px | V1–V39 at §2.5 widths, plus the §2.5 engine and dark subsets (dark = the light B0 at 0 px, V20); exact comparator (40 §1, `diff-pixels` = 0), no masks; animations off, `document.fonts.ready`, header unmasked; V28 JS off; setup: sprite 200 + a `<use>` with non-zero `getBBox()`. D5 reference | R-001, R-007, R-008, R-009, R-012, R-022, R-023, R-043, R-049, R-059, R-074, R-086, R-087 | all |
| T-802 | P0 | Component visuals | Design-unit states on a harness page in a separate build (OD-30), `IMPL=design\|antd`; package vs copy (W0.5, W5), port (7.1), antd unit (7.2): 0 px; DU-08 edge states: 0, 1, 11 options, a long option, empty query | R-024, R-025, R-074, R-075, R-087 | W0.5, W5, 7.1, 7.2 |
| T-803 | P1 | axe baseline | 07 §6 states; JSON incl. Q-089; violation set identical: a new or a vanished violation fails (Q-054, Q-089) | — | all |
| T-804 | P1 | Keyboard smoke | Tab order, Esc per modal, focus return; failures as baseline | — | W5, W6a, 7.2 |
| T-805 | P1 | Computed styles | Property list 40 §1, three engines; CDP `forcePseudoState` hover/focus/focus-visible/active; motion census with `reducedMotion: 'no-preference'`, animations on: `document.getAnimations()` and computed `transition-*`/`animation-*` per state change (modal, select, popover, toast, loaders, cookie popup) = B0; media-rule census of runtime `document.styleSheets` (cssinjs included) = B0; phase 7: antd cascade probes + layer rules | R-023, R-043, R-074, R-086, R-087 | all |
| T-806 | P1 | ARIA snapshots | `toMatchAriaSnapshot` per page and state | R-075, R-087 | W5, 7.x |

### J. Ops and manual

| ID | P | Target | Cases | Risks | Wave |
|---|---|---|---|---|---|
| T-901 | P0 | Image + container smoke | arm64 alpine from `git archive` (single recipe, 42), `npm ci` only; image ENV asserted; prod deployment env, `--memory 768m`; healthz + 6 routes via proxy; size recorded; no "patching"/"wasm" log at 12.3.7; SIGTERM under 20 rps: the prod sequence (preStop drain, then SIGTERM) loses no request, while a raw SIGTERM cuts the in-flight requests at Next 10.2.3 (`bin/next` exits without a drain; in-flight completion from the first Next that drains, VF-21), exit time ≤ B0 and < `terminationGracePeriodSeconds`; time-to-ready ≤1.10 × B0; `keepAliveTimeout`, `headersTimeout` recorded | R-014, R-015, R-017, R-027, R-035, R-036, R-060, R-061, R-063, R-066, R-082, R-091 | all |
| T-902 | P1 | Pre-merge soak (C6-CI; was: stage soak 24 h) | 01 §4 step 3a: `soak.yml`, reference, candidate and golden parity images at prod limits, stub + interleaved replay (OD-47); 55 C6-CI rows 1–7 | R-048 | every deployable step |
| T-903 | P1 | Prod watch 48 h | 01 §4 step 9; 55 C6-prod with the existing monitoring; breach → rollback; 0 5xx in the rollout per Next major (row 10); W4e and 6.3: Host/Authorization log (VF-02) | R-016, R-048 | every step |
| T-904 | P1 | Manual checklist | GA realtime; Sentry test event where a DSN exists (VF-04); LogRocket session; Rich Results + Scholar meta on prod after the merge (stage first when used); edge headers incl. `cf-cache-status` (VF-14) | R-003, R-026, R-041, R-083 | W2a, W2b, W4c, W4d, W5, W6a, W6c, W7a–W7c, 6.8 |
| T-905 | P1 | Load test | k6 against the C6-CI compose app at prod limits: RSS, latency, CPU-seconds per request (55 C6-CI) | R-048 | W6a, W7a, W7b, 6.5, 7.0 |
| T-906 | P2 | Live API drift | Nightly schema check | — | continuous |
| T-907 | P0 | In-cluster smoke | After every prod deploy (and stage deploys when used; probe path VF-14, 01 §4 step 8); its checks also run against the compose app in C6-CI: T-601 statuses, citation/JSON-LD order on 5 works, `_next/data` nav, 0 pageerrors, 3 sentinel styles, GA collect, `/data-providers/` provider count ≥90 % of the snapshot's; prod telemetry liveness probe (55 C6-prod row 8) | R-003, R-068, R-088 | every deploy |
| T-908 | P1 | Logo TLS probe | Member-logo hosts + doi.org, Node 22 vs 24 | R-080 | W4e |

## 2. Catalogues

### 2.1 Endpoints E1–E22

findings/06 §1.3 corrected by review:business-logic §2.2 (wire facts: its §2.1). `API_URL` is inlined at build (`env.config.js:24-35`); `{o}` = its origin.

| E | Call | Request | Handling |
|---|---|---|---|
| E1 | `api/search.js:5-28` | POST `{o}/v3/search/works?t=<t>` (`?t=undefined`); `{q,offset,limit,t,exclude,sort}`; 50 s abort | → `queryError{query,status??null}` |
| E2 | `api/search.js:30-40` | POST `…/v3/search/works/aggregate` `{aggregations,q}`; no signal | `console.error` |
| E3 | `api/search.js:42-49` | POST `…/v3/search/works` `{q,accept:'text/csv',limit}` | Blob → file |
| E4 | `api/works.js:4-15` | GET `…/v3/works/{id}?t=<t>` | `serverError` (Q-001) |
| E5 | `api/works.js:17-23` | GET `…/v3/works/{id}/outputs` | array |
| E6 | `api/outputs.js:3-8` | GET `…/v3/outputs/{id}` | `setOutputError`; CSR constant |
| E7 | `api/outputs.js:9-13` | GET `<output.dataProvider.url>` (internalised) | "disabled" message |
| E8 | `api/outputs.js:15-26` | POST `…/v3/recommend` `{identifier,limit:5,(resultType)}` | `error:true` |
| E9 | `api/outputs.js:28-51` | GET `https://doi.org/{doi}` x2, bibliography Accept + Authorization | → `citations:[]` |
| E10 | `api/outputs.js:53-62` | POST `…/internal/outputs/update` | `report.error` |
| E11 | `api/data-provider.js:9-17` | GET `…/v3/data-providers/{id}?t=<t>` | `notFound` |
| E12 | `api/data-provider.js:19` | GET `…/data-providers/{id}/stats` | into metadata |
| E13 | `api/data-provider.js:24` | GET `…/data-providers/{id}/outputs?q=&offset=0&limit=10&sort=recency` | error with API body in props |
| E14 | `api/data-provider.js:31-34` | GET `<logoUrl>` + Authorization; null/undefined → `{API_URL}null\|undefined` (Q-090) | → `null` |
| E15 | `pages/search/index.jsx:87` | GET `{API_URL}/members` after E1 succeeded | swallowed |
| E16 | `store/claim.js:33-53` | POST `{API_URL}/data-providers`, string body, signal | 409 JSON message; Q-091 |
| E17 | `api/claim.js:27` | POST `{API_URL}/data-providers/{id}/claim` | logged only |
| E18 | `api/data-provider-accounts.js:5`, called in render `claim-card.jsx:104-106` | GET `{API_URL}/data-providers/{id}/account` | `.length>0` |
| E19 | `lib/loader.js` | GET `https://api.core.ac.uk/internal/{statistics,repositories/formap,members}`, 3 s | only if a cache file is missing (Q-011) |
| E20 | `data/data-loader.js` | same 3 URLs, no timeout | T-117 |
| E21 | `modules/dropdown/index.jsx:58-60` | GET `https://api.core.ac.uk/data-providers/{id}/logo`, no credentials | LogRocket message |
| E22 | design `search-result.jsx:85-110` | same as E21, per card per provider, no dedupe | `console.log` |

Also `/api/healthz`. Dead: `api/sign-in.js`, `api/oai-resolver.js`.

### 2.2 Per-action request contract

Baseline (review:business-logic §6.1, review:00 X40.22); asserted by T-702, T-412, T-734, T-735 and in phase 6 (OD-43). Normalise only OPTIONS preflights (axios keeps the fetch adapter, 70 §3.3).

| Action | Server (wire order) | Browser |
|---|---|---|
| Load `/search/?q=x` | E1 → E15 (E1 error: no E15; page >1000 or NaN: E15 only) | [OPTIONS] + E2 x1; E22 per member card per provider |
| New q / filter / year | `_next/data` → E1 → E15 | E2 x1 (q containing the old q: stale facets, Q-092) |
| Page or sort change | same | E2 x0 |
| Clear all filters | same | E2 x2, identical (Q-092) |
| CSV Download | — | E3 x1 |
| Load `/works/{id}` | E4 → E5 → E14 per output → E9 x2 (with DOI) | E8 x1; E21/E22 per member card |
| Load `/outputs/{id}` | E6 → E7 → E14 (members) → E9 x2 | E8 x1 |
| Client nav output A → B | `_next/data` | E8 x0 (Q-055) |
| Load `/data-providers/{id}` | E11 → E12 → E14 → E13 → E18 (un-awaited) | E18 x2 with accounts, x1 without; +1 per ClaimCard re-render (Q-087) |
| Load `/data-providers/`, `/error-card/` | none | — |
| Type a URL on `/data-providers/` | — | E16 per settled value (500 ms); overlap → Q-091 |
| Report URL / submit | — | E6 / E10 |
| Client nav to a page without gSSP | — | E19 x3 only if a cache file is missing |

### 2.3 Visual states V1–V39

findings/07 §5 (V1–V20) corrected by review:ui-flows §2.1; V21–V39: its §2.2. M = full matrix (§2.5). P0 = in the 2.5 capture; P1 = captured from the golden image at 2.7 (42 §9). V19 print, V20 dark: none exist.

| V | State | P | Widths | Corrections |
|---|---|---|---|---|
| V1 | `/search/?q=climate` default | P0 | M | Pre- and post-hydration; one-member fixture, no mask |
| V2 | Filters open (mobile); facets field, year, type | P0 | M | |
| V3 | 2 filters + Clear all | P0 | M | |
| V4 | Sort open; copy toast; CSV modal | P0 | M | + reopen after Top 100 (Q-077) |
| V5 | `page=5`; page-1000 notice | P0 | M | The notice needs a 200 answer for offset 9990 (a derived fixture): the live API answers 400, so the recorded page 1000 is V6's ErrorCard |
| V6 | 0 results; ErrorCard | P0 | M | |
| V7 | Filters loading | P0 | M | |
| V8 | `/works/<id>/` full (1001: 6 authors, 3 versions; many authors: 1003, 30) | P0 | M | All outputs carry a DOI (Q-074); + empty "View on" (Q-081: a derived work without the `arxivId`/`pubmedId` keys; the recorded works hold both as `null` and show none) |
| V9 | `/outputs/<id>/` full | P0 | M | + `/display/<id>/`, `?source=oai` |
| V10 | Output variants | P0 | M | |
| V11 | Cite, Report, OAI modals | P0 | M | Header in shot; the OAI box is V9's `?source=oai` state (one capture) |
| V12 | Similar loading, error | P0 | M | |
| V13 | `/outputs/update/` states | P0 | M | |
| V14 | `/data-providers/` default, no results + form, suggestions | P0 | M | + a `?q=` state whose results show a `TR` provider's country name (R-031 is 1L; the default view shows no country, its first rows have no location; term picked at 2.2) |
| V15 | `/data-providers/<id>/` | P0 | M | Claim states → V36, output error → V35 |
| V16 | 404, `/error-card/`, "Uh-oh" ± referer | P0 | M | `/error-card/` via allow-all (Q-005) |
| V17 | Header, footer | P0 | M | Split into V21–V25 |
| V18 | Cookie popup | P0 | M, 950 | Hidden only by `essential_cookies_allowed` |
| V19 | Print | — | — | None exists |
| V20 | Dark mode | — | — | None exists; the T-801 dark subset (§2.5) proves it stays so |
| V21 | Header menus | P1 | 1920, 1440, 768 | |
| V22 | Hamburger ± Filters | P1 | 767, 375 | |
| V23 | Header search: input / collapsed icon / none per route | P0 | 1440, 375 | |
| V24 | Advanced-search panel | P0 | 1920, 1440, 767, 375 | Below 768 px "How to search?" is hidden: the panel opens through the info button shown while the header input is focused |
| V25 | Suggestions list | P1 | 1440, 375 | |
| V26 | `/search` scrolled (sticky + fixed) | P0 | 1440, 375 | T-738 |
| V27 | Works/outputs scrolled | P1 | 1440, 375 | T-738 |
| V28 | JS off, 5 page types | P0 | 1440, 375 | |
| V29 | Tooltips | P1 | 1440 | |
| V30 | `/display/:id/` hydrated | P1 | 1440 | |
| V31 | 500 page | P1 | 1440, 375 | |
| V32 | Blank pages Q-074a–e | P0 assert, P2 shot | 1440 | T-730 |
| V33 | Facet box variants | P1 | 1440, 375 | |
| V34 | Horizontal overflow | P1 | 501, 320 | |
| V35 | Provider output-error texts | P1 | 1440 | |
| V36 | Claim rows 1–5, SSR vs final | P0 | 1440, 375 | |
| V37 | `/data-providers/` clusters, Load more, add form | P1 | 1440, 375 | |
| V38 | Fieldset in CSV and Report modals | P0 | 767, 375 | Host `@custom-media` |
| V39 | KaTeX, long title, 30 authors | P1 | 1440, 375 | Q-097 |

### 2.4 Journeys J1–J32

findings/07 §3 (J1–J17) is normative except these corrections; J18–J32: review:ui-flows §4.2. Role/label selectors (ids: README errata); `pointer-events` traps (Q-083): keyboard or forced click, reason noted.

| J | Journey | P | T | Corrections |
|---|---|---|---|---|
| J1 | Search → results | P0 | T-703 | `q` pushed unencoded on some paths |
| J2 | Checkbox filter, Back | P0 | T-704 | Facet box stays open |
| J3 | Year filter | P0 | T-705 | + single bucket; empty year → J24 |
| J4 | Pagination, sort | P0 | T-706 | Last-page Next keyboard only; scroll 0 on push |
| J5 | Search → work → Back | P0 | T-707 | Full navigation to the absolute display URL (fixtures use the gateway host); author link 308; Q-076 |
| J6 | SEO contract | P0 | T-602, T-729 | Split SSR head / post-hydration head (Q-069) |
| J7 | Cite | P1 | T-709 | No aria-label; Esc only with focus inside |
| J8 | Full text, provider links | P1 | T-710 | Reader link no `target`; PDF link no `href` |
| J9 | Copy link, CSV | P1 | T-711 | Q-077 |
| J10 | Similar, related | P1 | T-712 | Q-055 |
| J11 | Report chain | P1 | T-713 | `hideManually`; Q-078, Q-082 |
| J12 | Providers directory | P1 | T-714 | Q-080; URL → `?q=&size=10` |
| J13 | Provider page | P1 | T-715 | Q-079; claim flip (J25) |
| J14 | Error, empty | P1 | T-716 | `/search/` → 308; 500s → J23 |
| J15 | Takedown, OAI | P2 | T-717 | OAI closes on outside mousedown only |
| J16 | Responsive | P1 | T-718 | + 501/320, 767/768 |
| J17 | Consent, analytics | P0 | T-719, T-740 | Q-070, Q-071 |
| J18 | Advanced search → "search by doi" → `doi:" "` focused → close | P0 | T-725 | |
| J19 | Header menus + hamburger | P1 | T-726 | |
| J20 | Collapsed search → `/search?q=a&b c++` | P1 | T-727 | |
| J21 | Facet variants | P1 | T-704, T-705 | |
| J22 | `/display/:id` alias | P1 | T-732 | |
| J23 | SSR failure matrix | P0 | T-731 | |
| J24 | Blank pages | P0 | T-730 | |
| J25 | Claim rows + modals | P0 | T-734 | |
| J26 | Provider search, pager, sort | P1 | T-735 | |
| J27 | Add-provider form states | P1 | T-714 | |
| J28 | Consent flows | P0 | T-740 | |
| J29 | Keyboard only | P1 | T-736 | |
| J30 | JS-disabled rendering | P0 | T-728 | |
| J31 | Tooltips | P2 | T-737 | |
| J32 | Map zoom, cluster, popup | P1 | T-714 | |

### 2.5 Widths (review:ui-flows §3)

| Set | Widths | Used by |
|---|---|---|
| M | 1920x1080, 1440x900, 768x1024, 767x900, 375x812 | T-801 |
| Sweep | 1280, 1024, 600, 561, 560, 501, 500, 360, 320 | T-739 on `/outputs/update/`, `/search/?q=climate` |
| Special | 950 (V18); 812x375 on `/data-providers/` (map); `scrollY` 900 | T-801, T-738 |
| Engines | WebKit and Firefox: V1, V2, V8, V9, V11, V13, V14, V18, V24, V37, V38 at 1440 and 375 (the design CSS has Firefox/WebKit-only rules, `lib/elements/forms/styles.css:84,147,211`) | T-801, T-805 |
| Dark | V1, V8, V14, V16, V31 at 1440 and 375, `colorScheme: 'dark'` | T-801 |
| Touch | 375x812, `{hasTouch: true, isMobile: true}`, `locator.tap()`; DOM, URL, network log = B0 | T-714, T-726, T-733, T-736, T-737 |

Every width is a breakpoint; no `@media (hover)`; the only `prefers-*` rule is sanitize.css `prefers-reduced-motion` (via `lib/reboot.css:4`, 40 §5).

### 2.6 Fixtures

Recording and scrubbing: 40 §6; storage: 42 §7.

| Name | Shape |
|---|---|
| Works 1001 / 1002 / 1003 | full (6 authors, DOI, abstract, PDF; every output has a DOI) / minimal / 30 authors |
| Works 1004 / 1005 | unicode + `</script>` (S-4; sandboxed context only) / 300-char title + `$x^2$` + a literal `**x**` (Q-097) |
| Works 4100 / 4040 / 5000 | API 410 / 404 / 500 |
| W-410-json, W-410-text | 410 with a JSON-object / text body (Q-001) |
| W-emptydate | `publishedDate:""`, `yearPublished:2001` (live work 6948813) (Q-073); the forced-500 fixture |
| W-nodp | `dataProviders:[]` (Q-073) |
| Outputs 2001–2004 | provider 86 / provider GET fails / `fulltextStatus:'disabled'` / no reader link |
| O-yearstring | `publishedDate:null`, `yearPublished:"2001"` |
| O-nofulltext | no download link; `sourceFulltextUrls` null and absent (Q-073) |
| Search `q` | `climate` (>100 hits), `zzzzqqq` (0), `__status500`, `__neterror`, `__nodataproviders` (Q-015) |
| Providers | 86 supporting, base64 logo; 4835 starting; 8 multi-repo (503 is not in the snapshot's formap: its page is the 404); 999999999 not in formap; a `/data-providers/?q=` term whose results include a `TR` provider (R-031) |
| `/members` | one member for page tests; full list only in T-113 |
| Q-074a–e | output `doi:null`; work DOI + ≥4 output DOIs; provider without `location`; similar `dataProviders:[]`; empty/out-of-range year aggregation |
| Claim rows 1–5 | 86 + accounts `[{…}]`; 4835 + `[]`; 86 + `[]`; a non-member formap provider (picked at 2.2) + `[]`; 86 + accounts 401/500 |
| Data snapshot | `test/fixtures/data-snapshot/` (`.statistics.json`, `.formap.json`, `.members.json`, `languages.json`), frozen at 2.2 |

## 3. Risk → detector index

Replaces the traceability matrix (review:00 X40.35). **C1** (55): **BR** = reproducible on the baseline; fault `test/faults/R-###[-a].patch` as described must be killed. **UO** = only with the new dependency; proven on the candidate at the risk's Bites-in steps (10 §2–§5). **OUT** = LOUD M/L, outside C1. **N/A** = process/security. **(1L)** = only a pixel test detects it black-box (single-layer). Each C/H and SILENT risk needs ≥1 black-box detector or GATE-S is blocked. Jest mocks the router: R-018/R-019 white-box tests miss router triggers.

| R | Sev | Black-box | White-box | C1 |
|---|---|---|---|---|
| R-001 | C | T-605, T-739, T-805, T-801 | T-002, T-003 | BR: `next.config.js:45-77` no-op |
| R-002 | L | T-604, T-702 | T-010, T-110 | BR: delete `pages/_app.jsx:70-80` |
| R-003 | C | T-602, T-610, T-907 | T-113 | BR: reorder `citation_*` |
| R-004 | C | T-609 | T-209, T-212 | BR: singleton server store |
| R-005 | C | T-601, T-602 | — | BR: works page fetched client-side |
| R-006, R-044 | L | T-701 | T-004 (R-044) | OUT |
| R-007 | H | T-605, T-721, T-801 | T-005 | BR: image import yields `{src}` |
| R-008 | H | T-718, T-739, T-801 | T-003 | BR: drop `importFrom` |
| R-009 | H | T-801, T-802, T-805 | T-003 | BR: drop `postcss-extend-rule` |
| R-010 | H | T-728, T-701, T-732 | — | UO |
| R-011 | H | T-703, T-704 | T-121, T-201, T-203, T-212 | BR: delete an `@observable` |
| R-012 | H | T-705, T-801 | T-404 | BR: drop Histoslider `defaultProps` |
| R-013 | H | T-701 (React ≥18), T-714, T-715 | T-406, T-407 | BR: nested `<a>` in pagination |
| R-014, R-027 | H | T-008, T-901 | — | UO |
| R-015 | H | T-008, T-901 | T-013, T-016 | BR: lock resolves design to latest |
| R-016 | H | T-607, T-903 | T-103, T-104, T-122 | BR: Host override sent |
| R-017 | H | T-901 | T-117 | UO |
| R-018 | H | T-722, T-735, T-609 | T-107, T-208, T-209, T-302 | BR: first sync pushes |
| R-019 | H | T-703, T-704, T-706 | T-202, T-204 | BR: drop `page:1` from the push |
| R-020 | H | T-601, T-612, T-716, T-731 | T-010, T-506 | BR: `trailingSlash:false` |
| R-021 | H | T-721, T-605 | T-005, T-010, T-110 | BR: wrong `assetPrefix` |
| R-022 | H | T-721, T-801 | T-005, T-006, T-418 | BR: postinstall without `design.config.js` |
| R-023 | H | T-805, T-739, T-801 | T-003 | BR: reorder `pages/_app.jsx:15-19` |
| R-024 | H | T-802, T-801 | T-003, T-417 | BR: design CSS as a module |
| R-025 | H | T-802 | T-417, T-016 | BR: `hooks` alias hit in design code |
| R-026 | H | T-720, T-719, T-904 | T-116, T-603 | BR: drop `*.logrocket.com` (`csp.config.js:6`) |
| R-028 | H | T-607, T-610, T-702 | T-101, T-102, T-115, T-122, T-205, T-501–T-504 | BR: JSON Content-Type on string bodies |
| R-029 | H | T-702, T-712 | T-201, T-207 | BR: SimilarWorks refetch on nav |
| R-030 | H | T-703, T-704 | T-105, T-210, T-403 | BR: copy, not alias, suggestions |
| R-031 | H | T-801 (1L) | T-108 | BR: 7.14.0 country data |
| R-032 | H | T-701, T-724 | T-004, T-018 | BR: second React copy |
| R-033 | H | T-701, T-702, T-716 | T-001, T-401 | BR: hooks above the early return |
| R-034 | M | — (dev only) | — | OUT |
| R-035, R-036 | M | T-901 | — | OUT |
| R-037 | M | T-713 | T-411 | UO |
| R-038 | M | T-734, T-702 | T-412 | BR: extra E18 per render |
| R-039 | M | T-715, T-735 | T-203, T-408 | BR: drop `observer()` on sort |
| R-040 | M | T-608, T-610 | T-004, T-120 | BR: server alias `@sentry/browser` |
| R-041 | M | T-719, T-740, T-741 | T-305, T-416 | BR: consent read from the analytics cookie |
| R-042 | M | T-801 | T-108 | UO |
| R-043 | M | T-801, T-805 | T-003 | UO |
| R-045 | L | T-601, T-731 | T-501–T-504 | OUT |
| R-046 | M | T-704 | T-203 | UO |
| R-047 | M | T-701, T-714, T-715 | T-414 | OUT |
| R-048 | M | T-611, T-902, T-903 | T-007 | UO |
| R-049 | M | T-801, T-805 | T-001 | BR: lint `--fix` |
| R-050, R-064 | M, L | — | T-001 (R-050), T-007 (R-064) | N/A |
| R-051 | M | T-707, T-727 | T-420 | BR: encode `q` in the works push |
| R-052 | L | T-706, T-714 | — | BR: `scroll:false` on the page push |
| R-053 | M | T-709 | T-114, T-410 | BR: ORCID fork 0.0.25 |
| R-054, R-066 | M, L | T-008, T-901 | — | OUT |
| R-055 | M | T-608, T-606 | T-118, T-119, T-120 | BR: remove `pages/_app.jsx:21-27` |
| R-056, R-057 | M | T-701, T-741 | Jest console gate | OUT |
| R-058 | M | T-730 | T-415 | UO |
| R-059 | L | T-801 (1L) | T-417 | UO |
| R-060–R-063 | L | T-901, T-606 (R-062) | T-116 (R-063) | OUT |
| R-065 | M | T-724, T-801 | T-003, T-004 | BR: newer `caniuse-lite` in the lock |
| R-067 | L | T-601, T-714 | T-009, T-504 | BR: provider missing from `.formap.json` |
| R-068 | C | T-604, T-702, T-612, T-907 | T-010 | BR: delete the data rewrite `next.config.js:18-21`; UO at W4d, W7a, W7c |
| R-069 | H | T-602 | — | BR: `<title>` as `X<!-- --> - CORE` |
| R-070 | H | T-901 | — | UO |
| R-071 | H | T-729 | — | UO |
| R-072 | H | T-612 | — | N/A (CI-8, 42) |
| R-073 | H | T-742, T-609, T-610 | T-209, T-212 | UO |
| R-074 | H | T-805, T-801, T-802 | — | UO |
| R-075 | C | T-601, T-801, T-802 | T-014, T-016, T-417 | BR: design installed as a symlink |
| R-076 | M | T-607 | — | BR: `sentry-trace` on server fetches |
| R-077 | M | T-724 | T-015 | UO |
| R-078 | L | T-602 | — | UO |
| R-079 | L | T-605 | T-417 | UO |
| R-080 | L | T-908 | — | UO |
| R-081 | L | T-703, T-704 | T-203 | UO |
| R-082 | H | T-721, T-901 | — | BR: start without `BUILD_TARGET` |
| R-083 | M | T-603, T-904 | T-010 | BR: extra `Cache-Control` header |
| R-084 | H | T-901 | T-013 | BR: devDependency moving a runtime entry |
| R-085 | M | T-731, T-601, T-801 | — | UO; BR after CS-N11-9 (edit `pages/_error.jsx`) |
| R-086 | H | T-801, T-805, T-739 | T-003 | UO |
| R-087 | H | T-805, T-802, T-801 | — | UO |
| R-088, R-089 | C | T-907 (R-088) | — | N/A (01 §4 merge rule, 01 §5; D15) |
| R-090 | H | T-801, T-601 | T-017, T-018 | UO |
| R-091 | C | T-901, T-721, T-801 | T-005, T-006, T-011 | BR: `build:test` without the Dockerfile copies |

## 4. Counts

Active tests: **P0 84, P1 62, P2 4 = 150** (P0: 76 plain, 8 P0@x; P1: 50 plain, 12 P1@x); "every plain P0 row" = the 76. Per layer (P0/P1/P2): A 14/4/0, B 12/8/0, C 7/5/0, D 4/2/1, E 9/11/0, F 5/1/0, G 10/2/0, H 19/20/2, I 2/4/0, J 2/5/1. Excludes T-708, T-111, T-112. 2026-10-20: 37 new; T-004, T-006, T-607 P1 → P0; T-724 P2 → P1 (RG-5, 70 §4); T-905 P2 → P1 (55 C6); also T-115, T-409, T-413, T-711, T-712 P1 → P1@2.7 and T-211 P2 → P1@2.7 (sole pins of Q-021, Q-038, Q-055, Q-056, Q-077; only tests of J9, J10, E3); T-414 P2 → P1@2.7 (sole pin of Q-058 c1, c3, c4). 2026-10-20, phase-2 detector review: clauses added to T-601 (Q-028 needs a G-layer pin, 30 §1 rule 6), T-609 (R-004), T-702 (R-028 string body, Q-011), T-716 (R-033, now in §3); V14 and the fixture rows 1005 and Providers extended (R-031, Q-097). 2026-10-22, 2.7 fault survivors: T-004 c6 (client core-js polyfill census, kills R-032-b `useBuiltIns: false`) and T-016 c4 (design require edges in the client module graph, kills R-025-a; R-025 → T-016) added. Every gate runs all tiers (§0).
