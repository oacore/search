# Empirical baseline probe: full report

Reviewer key: `empirical`. Date: 2026-10-19. Subject: `search` @ `f5cfc20` (app code unchanged), docs under `docs/upgrade/`.
Everything below was observed by running the app (or small scratch builds of newer Next versions). Anything not run is marked UNCONFIRMED.

## 0. Method and environment (so a future session can reproduce)

| Item | Value |
|---|---|
| Scratch root | `<scratch>/exp/empirical/` |
| Baseline copy | `app/` (rsync of the repo, node_modules cloned with `cp -Rc`, never symlinked). Build 1: `APP_ENV=local`. Build 2 (kept): `APP_ENV=production BUILD_TARGET=azure NODE_ENV=production API_KEY=<dummy> NODE_OPTIONS=--openssl-legacy-provider` on Node 18.20.8 / npm 10.8.2 (macOS arm64, 8 CPUs). |
| Browser variant | `app-b/` = same build but `env.config.js` `local.API_URL` pointed at the local API proxy so the browser's own API calls reach the proxy. All numbers below that depend on API_URL were taken on `app/` unless said otherwise. |
| API access | No API key exists on this machine (`API_KEY` unset, README has a placeholder). Anonymous calls to `https://api.core.ac.uk/v3/...` work but are rate limited to 10 requests per window (a 429 locks for 10 minutes; seen once). I wrote a throttled, caching, key-stripping forwarding proxy (`tools/svc-a.js`, was `api-proxy.js`) plus fixtures derived from real cached responses (`tools/fixtures.js`) and a gateway-equivalent front proxy (`tools/svc-b.js`: `/static/search/*` and `/display/*` rewrites as in `kube/prod/httproute.yaml`, CSP relaxed only for `connect-src`/`img-src` toward the local proxy). The app reaches the proxy through its own `Internal_API`/`Internal_API_HOST` feature, which is exactly the production path. |
| Request budget | About 55 requests to `api.core.ac.uk` in total (6 by the `data-loader` runs, 5 direct curls, 32 through the proxy including 429/500 answers, about 12 issued by the browser itself: provider logos and the 3 client `getInitialProps` GETs), 5 to doi.org/crossref, 1 to `core.ac.uk` (Cloudflare challenge: **production site could not be probed**, and I did not try to bypass it). |
| Live API quirks seen | `/v3/search/works` answers 301 to a trailing-slash URL when anonymous, `/v3/works/<id>/outputs/` answers 301 the other way. `GET /v3/works/<id>/outputs` returned 500 for 2 of 3 works, `GET /v3/works/4761154` 500, `POST /v3/search/works/aggregate` 500. Fixtures therefore had to be built from real objects with edits (documented in `tools/fixtures.js`). |
| Servers | All started by me were stopped at the end (ports 41871-41880). Other reviewers share the machine: processes named `*proxy*`/`*gateway*` of mine were killed twice (presumably by someone's `pkill`), and the shared browser's first tab was navigated away by someone else. I renamed my scripts, opened my own tab, and closed it. |
| Repo safety | One slip: a `mkdir npmci2` landed in the repo working directory (a missing `cd`), and `npm ci --no-legacy-peer-deps` then ran there (npm walked up to the repo `package.json`). It stopped at `ERESOLVE` before changing anything. I removed the empty directory and verified: `git status` clean, `node_modules`, `package-lock.json`, `package.json` mtimes unchanged (Sep 17 / Sep 14 / Sep 11). |

Artifacts worth keeping for phase 2: `tools/fixtures.js` (how to derive failure fixtures from real API objects), `tools/fetchlog.js` (a `--require` preload that wrapped global `fetch` under `next start` on Node 18: proves a preload sees every SSR fetch), `tools/svc-b.js` (gateway equivalent), `http/` (all raw responses), `nx/*.log` (Next 11/12/13 build logs).

## 1. Build and runtime of the unchanged app

Dockerfile steps reproduced on Node 18.20.8: `data-loader` (0.9 s), `design build icons` (0.5 s), `next build` (20 s wall, 40 s CPU), then `cp public/design/icons.svg public/icons.svg; cp -r public/static/images/* public/images/`.

| Fact | Evidence |
|---|---|
| `NODE_OPTIONS=--openssl-legacy-provider` **is needed on 18.20.8** | Without it `next build` dies in 1.2 s: `Error: error:0308010C:digital envelope routines::unsupported ... ERR_OSSL_EVP_UNSUPPORTED` at `next/dist/compiled/webpack/bundle4.js` `createHash`. With it: `Compiled successfully`. |
| `next start` does **not** need the flag | Ran with the k8s value `NODE_OPTIONS=--max-old-space-size=1024`: healthz, search, outputs, data-providers all 200. |
| Build output | `.next` 97 MB (`static` 20.7 MB, `server` 46 MB, `cache` 31 MB). First Load JS shared 1.26 MB (`chunks/ed4d358e...js` 895 kB). Route sizes: `/search` 12.9 kB, `/data-providers/[id]` 12.7 kB, `/data-providers` 10.8 kB, others under 5 kB. 29 JS chunks, `BUILD_ID` random. |
| Client source maps | **Yes**: 35 `.map` files in `.next/static` (27 JS + 8 CSS), each JS map has `sourcesContent`; chunks end with `//# sourceMappingURL=`; served with `Cache-Control: public, max-age=31536000, immutable` at `/_next/static/chunks/*.js.map`. |
| API key in client JS | Yes, inlined into `chunks/ed4d358e...js` (the dummy value was found by grep). |
| `@sentry/node` on the server | `.next/server/pages/_app.js` contains `require("@sentry/node")` once (Q-065 confirmed). |
| `data-loader` | Writes the **raw** API JSON (no `data` key) into `data/.statistics.json`. `App.getInitialProps` reads `cachedStatistics.data`, so it is always the fallback. Confirmed in `__NEXT_DATA__`: `props.statistics = {"totalArticlesCount":"more than 356 million"}`, and in the browser the input placeholder is `Search more than 356 million from papers around the world` while the live API says 452,015,991 (Q-004). |
| `data-loader` failure | With `https.request` forced to HTTP 500 or ECONNREFUSED: exit code **1** on Node 18.20.8 and 22.18.0 (unhandled rejection `Fail. ==> Statistics retrieval failed due to API Core instability.`). The Dockerfile `npm run build` therefore fails when the API errors or rate-limits (Q-026 confirmed). |
| `design build icons` | `NODE_ENV` matters: `design.config.js` adds `file-check` when `NODE_ENV != production`. The repo's existing `public/design/icons.svg` (built outside production) has 49 symbols; the production build has 48. Duplicate ids `open-in-new`, `account`, `office-building` exist in both (Q-067 confirmed). `@oacore/design` also has `postinstall: node bin build`, which runs during Docker `npm ci` (no `--ignore-scripts`). |
| Memory | RSS idle 95 MB, after one SSR page 296 MB, after `/data-providers/` about 530 MB (plateau over 6 repeats). k8s prod limit is 768Mi while `--max-old-space-size=1024`. |
| Response sizes | `/search/?q=climate` 241 kB, `/works/` 72 kB, `/outputs/` 69 kB, `/data-providers/713/` 164 kB, **`/data-providers/` 7.15 MB** (HTML) and `/_next/data/<id>/data-providers.json` 7.08 MB, 404 page 54.5 kB. |

## 2. HTTP contract of the running baseline (resolves 02 §4.1 claims)

All with `trailingSlash:true`, production build, through plain `next start` (no gateway).

| Request | Result |
|---|---|
| `/search` | 308 `Location: /search/` (+ `Refresh: 0;url=/search/`) |
| `/search/` (no params) | **308** `Location: /` (+ `Refresh`). Not 301. |
| `/search?q=climate` | 308 to `/search/?q=climate` |
| `/search/?q=climate` | 200, 241 kB, `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`, `X-Powered-By: Next.js`, ETag, CSP on every response |
| `/works/<id>/`, `/outputs/<id>/`, `/data-providers/`, `/data-providers/713/` | 200 with the same `Cache-Control` as search |
| `/`, `/404`-type pages, `/error-card/`, `/outputs/update/` | 200/404 with **no `Cache-Control` header** (pages with only `_app.getInitialProps`) but an ETag. Unknown path `/nope/` 404, `/api/foo/` 404 (HTML), `/robots.txt`, `/sitemap.xml`, `/favicon.ico` 404. |
| `/data-providers/99999999/` | 404 with `Cache-Control: no-cache, no-store, max-age=0, must-revalidate` |
| `/display/<id>/` | **404 on the app** (the `/display` to `/outputs` rewrite exists only in the gateway) |
| `/static/search/_next/static/...`, `/static/search/images/...`, `/static/search/design/icons.svg` | 404 on the app (gateway strips `/static/search`). `/_next/static/...`, `/icons.svg`, `/images/errorCard.svg`, `/static/images/errorCard.svg` all 200 |
| `/api/healthz` | **308** to `/api/healthz/`; `/api/healthz/` 200 `{"status":"ok"}` (kube probes use the slash form) |
| `/_next/data/<buildId>/search.json?q=climate` and `/search/_next/data/<buildId>/search.json?...` | both 200 JSON (the second through the production-only rewrite); `/_next/data/WRONG/...` 404 HTML |
| Render error (500) | Next default `_error` page rendered inside the CORE header/footer: "An unexpected error has occurred.", status 500, no `Cache-Control` |
| Soft 404 | Works/outputs with an upstream error render the "Uh-oh ... could not be found" page with HTTP **200** (Q-001 confirmed: works whose `/outputs` call failed) |
| Request shape to the API | `POST /v3/search/works?t=undefined`, `GET /v3/works/<id>?t=undefined`, `GET /v3/data-providers/713?t=undefined` (Q-016 confirmed); `/v3/works/<id>/outputs`, `/v3/outputs/<id>`, `/v3/data-providers/713/stats` carry no `t`. The server always sends `Authorization: Bearer <API_KEY>`, `Accept: application/json`. Every `/outputs/<id>` SSR also calls `GET /internal/data-providers/<id>/account` (Q-027: ClaimCard fetch during render) and fetches `output.dataProvider.url` (absolute `https://api.core.ac.uk/v3/data-providers/<id>`, which `internalize()` rewrites when `Internal_API*` is set). |
| Host override (Q-022 on **Node 18.20.8**) | `fetch` init carried `Host: api.core.ac.uk` (preload log shows header names `Accept, Authorization, Host`), the receiving proxy saw `Host: 127.0.0.1:<port>` and `User-Agent: node` (undici). **Ignored on Node 18 too.** |
| Gateway-equivalent proxy | Needed for `/display`, `/static/search/*`. Built one (`svc-b.js`); it worked for the browser runs. |

## 3. SSR head / meta / JSON-LD (resolves 07 [VERIFY] items, Q-053, S-4)

Output page `/outputs/30671329/` (real API object) head contains: `title` "... - CORE", `citation_title`, `citation_author`, `citation_publication_date`, `DC.creator`, `DC.title`, `DCTERMS.abstract`, `DC.identifier` (`oai:apo.org.au:56783`), `DC.subject` (`Report`), one JSON-LD script. **Absent**: `citation_pdf_url`, `DC.format`, `DC.issued`, canonical, description, og:*.

Works page `/works/171513974/` head: `citation_title`, `citation_author` x2, `citation_publication_date` = `2024/1/01` (month de-padded, day not), `DC.creator` x2, `DC.title`, `DCTERMS.abstract`, JSON-LD. **`DC.identifier` and `DC.subject` are absent on works** (the work object has no `oai`/`subjects`); they are present on outputs. So Q-053's "probably absent" is half wrong.

The "falls back to year" claim (07, T-602) is wrong in both directions:
- Outputs: `yearPublished` is a **string** (`'2015'`); `formatCitationDate('2015')` returns `citation_publication_date="2015/NaN/undefined"`.
- Works: `yearPublished` is a **number** (`2015`); `publishedDate` is `''` for 4 of 10 results in `q=climate`; `modules/meta/index.jsx:21-27` calls `date.split` on a number, so `/works/19211324/` (and `/works/340052118/` when its outputs load, and fixture 9000003) returns **HTTP 500** with `TypeError: date.split is not a function` (`pages/works/[id].jsx:72` fallback `work.yearPublished`, `modules/meta/index.jsx:30-31`). Reproduced with real API data. Whether production shows the same is UNCONFIRMED (Cloudflare blocked a probe).
- A work with `dataProviders: []` returns **500**: `TypeError: Cannot read properties of undefined (reading 'logo')` in `ScientificOutputTemplate` (`templates/output/index.jsx:213`), so `LinkedData` never gets to throw first (both would).

JSON-LD: `author[].name` is an object, `{"@type":"Person","name":{"name":"Climate Council"}}`; `datePublished` is the raw string (`"2015"`). Confirmed.

**S-4 is an exploitable stored XSS, not just "breaks the tag".** Fixture work with title `T</script><script>window.__xss_ran=1</script>`: SSR HTML has the raw `</script><script>...` inside the JSON-LD `<script>` (JSON.stringify does not escape `<`), the injected script **executed** in the browser (`window.__xss_ran === 1`) although CSP is on, because production `script-src-elem` contains `'unsafe-inline'` (S-6). `<meta>`, `<title>`, body text and `__NEXT_DATA__` are escaped (`<`). It also corrupts `document.head`: Next's head manager later throws `Cannot read properties of null (reading 'content')` (the `next-head-count` meta moved). The attacker only needs a harvested repository record with such a title/abstract/publisher/author.

## 4. Browser-observed behaviours (resolves 07 UI items)

All on the baseline build in the built-in browser (Chromium) through the gateway proxy.

| Question | Answer |
|---|---|
| `router.push` scroll | Scrolls to top: `scrollY` 2508 to 0 on pagination click, document kept (marker survived), Next 10.2.3. |
| Result title click: full or client navigation? | **Full navigation**: the title is a plain `<a href="https://core.ac.uk/works/19211324/?t=...&search=q=climate">` (absolute, from API `links[type=display]`). Author/provider links are relative `/search?q=author:(...)`, `/data-providers/713?t=...`. |
| T-702 contract | Pagination fetches `/search/_next/data/<buildId>/search.json?q=climate&page=2` (fetch), no document request. Holds. |
| Q-011 | Client `router.push('/outputs/update/')` made 3 browser GETs: `https://api.core.ac.uk/internal/statistics`, `.../internal/repositories/formap` (**5.4 MB**), `.../internal/members`. Confirmed. Also every results page fetches the same provider logo several times (`.../data-providers/197/logo` four times). |
| CSV modal default | "Current page" (first card highlighted). They are `Card`s in a `Fieldset`, not radios; active state is set in an effect after mount (`design src/elements/fieldset/index.jsx:11-13`). |
| Data-provider sort resets `offset`? | **No**: `/data-providers/713/?offset=10&limit=10` then Sort "Relevance" gives `?offset=10&limit=10&sort=relevance&page=1`; the URL changes only after the data fetch completes (lag was ~9 s on a cold API). |
| Disabled filter items | Code: `modules/filters/filter-item.jsx` `<li onClick={onToggleChecked}>` is unconditional; `styles.disabled` is only `pointer-events:none; opacity:.5` (`styles.module.css:87-90`). Mouse clicks are blocked, keyboard/programmatic activation is not. Not exercised in the browser (aggregate endpoint returned 500). UNCONFIRMED at runtime. |
| ClaimModal | Unreachable: `setIsClaimModalActive(true)` and `setIsSignInModalActive(true)` are never called anywhere (grep of `templates/data-provider/`), only `false`. Confirmed by code. |
| DOI list effect | Not in `templates/output/metadata.jsx` (pure view). It is `templates/output/index.jsx:65-72`; line 68 `outputs.map((item) => item.doi.toLowerCase())` throws if any output has `doi: null` (the fixture output had `doi:''`, so not triggered). |
| Similar works with `dataProviders: []` | **Whole page goes blank** (`TypeError: Cannot read properties of undefined (reading 'id')`, `templates/output/similar-works.jsx:53`). Without both fields it shows the "unable to process" panel (`transformDataProviders([undefined])` throws inside the store try). |
| Map on a provider without `location` | **Whole page goes blank**: `Error: Invalid LatLng object: (undefined, undefined)` from `modules/map/map.jsx:27` (data-provider 22159 exists in formap without `dataProviderLocation`; fixture API response without `location`). Whether the real API ever omits `location` is UNCONFIRMED (null latitude would not throw). |
| Cookies | After "I agree": `essential_cookies_allowed=true`, `analytics_cookies_allowed=true`, `path=/`, expires +365 days, host-only (no Domain), no Secure, no HttpOnly, `SameSite` unset (browser default Lax). |
| Analytics without a GA id | With `analytics_cookies_allowed=true` and `GA_TRACKING_CODE` unset, `ReactGA.initialize(undefined)` throws `Require GA_MEASUREMENT_ID` in an effect and the **entire page unmounts blank** (no ErrorBoundary fallback, Q-010). The plan's `build:test` sets `GA_TRACKING_CODE=G-TEST000000`, so only the "why" is missing in the docs. |
| LogRocket | `LogRocket.init('cab1al/search-gfe6o')` runs in the production build (hard-coded project) and sets `_lr_*` cookies; the console showed "LogRocket: Session quota exceeded". A test image run against real network sends sessions to the real project. |
| Featured member | Different member banner on 3 loads of the same URL (Bristol, Manchester Met, University of the Arts London): `Math.random` at `templates/search/utils/featured-member.js:25,32` in gSSP. The plan seeds it with a preload; I confirmed a `--require` preload does see all SSR `fetch` calls under `next start` on Node 18. |
| Console on baseline | `Send command doesn't exist: search` (react-ga4, Q-059) and `console.log("GA")` on every load. |

## 5. Upgrade experiments in scratch clones (do not touch the repo)

Clones: `nx/n10w5`, `nx/n11`, `nx/n12`, `nx/n13` (CoW copies of `app/` + `npm install next@x --legacy-peer-deps --ignore-scripts`).

| Step | Result |
|---|---|
| Next 10.2.3 + `future.webpack5: true` + `resolve.fallback.fs=false` | Builds cold with `--openssl-legacy-provider`; without it `ERR_OSSL_EVP_UNSUPPORTED`. Top-level `webpack5: true` is ignored on 10.2.3 (log says "Using webpack 4"). |
| Next 11.1.4 (webpack 5 default) | (1) `next build` runs **ESLint** and fails on the existing lint errors (`pages/search/index.jsx` no-console x4, `lib/loader.js` max-len/class-methods-use-this). Needs `eslint:{ignoreDuringBuilds:true}`. (2) then `configuration.node has an unknown property 'fs'` (CS-N11-1, as the plan says). (3) With `NODE_OPTIONS=--openssl-legacy-provider` a **cold-cache build fails**: `HookWebpackError: Maximum call stack size exceeded`, inner `RangeError` in `webpack-sources3` `ConcatSource.streamChunks` called from the terser plugin `sourceAndMap` (`next/dist/build/webpack/plugins/terser-webpack-plugin/src/index.js:202`). Reproduced 5 times cold, also with `--stack-size=3000` and on Node 16.20. A warm `.next/cache` build succeeds, which is why it looks flaky. **Root cause: the 5.4 MB `data/.formap.json` module**: replacing it with a 1-entry file makes the cold build pass. `webpack5:false` on 11.1.4 builds cold. (4) `ERR_OSSL_EVP_UNSUPPORTED` still occurs on Node 18 without the flag. (5) `resolve.fallback` has `path: path-browserify` and `process: process/browser` (its `.on` is a no-op), so `lib/loader.js` `path` and `_app.jsx` `process.on` work with no guard. (6) `next-images` + `images.disableStaticImages:true` needed (without it `TypeError: unsupported file type: undefined`). Asset URLs stay `/static/search/_next/static/images/<name>-<md5>.svg` (same file names on 12 and 13). (7) named JSON import of `countries` only warns. (8) `~sanitize.css` imports in `lib/reboot.css` were accepted. |
| Next 12.3.7 | Cold build **succeeds on Node 18 without the legacy flag** and on Node 22.18.0 (20 s). Log: "Disabled SWC ... custom Babel configuration" (CS-N12-2 as expected). `next start` on Node 22 serves all routes; `__NEXT_DATA__` pageProps identical to baseline for search, works, outputs; body markup differs only by `data-reactroot=""` on `#__next` and CSS-module hash suffixes; head differs in `meta charSet` order and hashed asset URLs. **`node-fetch` disappears from node_modules** after the install (so `data/data-loader.js` fails with `MODULE_NOT_FOUND` before the build starts: CS-N12-1 confirmed). `package-lock.json` written by npm 10.8.2 on macOS already contains all 13 `@next/swc-*` entries including `linux-arm64-musl` (CS-N12-4 "regenerate on Linux" not needed). `productionBrowserSourceMaps:true` gives 31 maps (23 JS + 8 CSS) vs 35 on baseline. |
| **Next 12.3.7 client navigation** | **Broken silently.** `getDataHref` patch still works (returns `/search/_next/data/<id>/search.json?...` for the new object argument), but the app's `rewrites()` entry for `/search/_next/data/:path*` no longer applies: direct `curl` gives **404 HTML** for the prefixed URL and 200 for `/_next/data/...`. In the browser every pagination click becomes a hard page load (marker lost, `navigate` type). Fix verified: return `{ beforeFiles: [dataRewrite], afterFiles: [staticRewrite] }` from `rewrites()`; then the prefixed URL is 200 and client navigation works again. |
| Next 13.5.11 + React 18.3.1 | Original `next.config.js` fails loudly: `TypeError: reg.test is not a function` (CSS-modules hack lookup at `next.config.js:49,57`, some `oneOf` rules have a non-RegExp `test`). Guarding with `reg && typeof reg.test === 'function'` builds; the hack still finds and patches css-loader (`exportLocalsConvention='camelCase'` in all 3 compilers). `react`/`react-dom` directory aliases built fine; SSR works for all routes; outputs pageProps equal. Next 13 also prints `Invalid next.config.js options: "env.SENTRY_DSN" is missing, expected string` (values `undefined`). Single-React-copy check (T-004) not run: UNCONFIRMED. |

## 6. Install and registry checks

| Check | Result |
|---|---|
| `npm ci --include=dev --legacy-peer-deps --ignore-scripts` (macOS arm64, Node 18.20.8, npm 10.8.2, token from the user-level `.npmrc` valid: `npm view @oacore/design` works, latest = 5.0.74) | **Succeeds**: 1760 packages in 10 s, tree identical to the repo's `node_modules` (0 differences). linux/arm64-musl: Docker daemon not running, so UNCONFIRMED; statically the lock has only 2 platform-specific entries (`fsevents`, darwin), so no missing-optional-binary risk for the Next 10 tree. |
| `npm ci` without `--legacy-peer-deps` | **Fails `ERESOLVE`** on exactly one conflict: `logrocket-react@6.0.3` peer `react >=18`. After removing the unused `logrocket-react`, `filesize`, `throttle-debounce` (CS-W0-2) `npm install --package-lock-only --no-legacy-peer-deps` and `npm ci --no-legacy-peer-deps` pass, and also after removing `@oacore/design`. But the tree changes: +50/-2 packages, including **webpack 5.112.0, jquery 4.0.0, eslint-plugin-react-hooks 4.6.2** auto-installed as peers. |
| `i18n-iso-countries` | latest 7.14.0 has no `exports` map (deep import `langs/en.json` works). 20 entries are arrays and 9 visible names change when the code takes the first element (`getCountryName`, `templates/data-providers/index.jsx:27-30`): CD, CG, CI, CN "People's Republic of China", GM "Republic of The Gambia", IR "Islamic Republic of Iran", MK "The Republic of North Macedonia", TR "Türkiye", TZ. |
| `react-ga4` | latest 3.0.1 is ESM-only (`type: module`, `exports` to `dist/index.mjs`, no CJS); `initialize` still throws `Require GA_MEASUREMENT_ID`, `send` switch still warns `Send command doesn't exist`; no change to the hit code paths found in `src/ga4.ts`. |
| Test tooling vs Node 18 | `msw` latest 3.0.3 needs Node >=22.12 (2.15.0 is `>=18`), `@testing-library/jest-dom` 6.10.0 and 7.0.1 need Node >=22, `@axe-core/playwright` 4.14.0 needs >=22.12, `@playwright/test` 1.64.1 needs >=20, `jest` 30.5.2 `^18.14 || ^20 || ^22 || >=24`, RTL 16.3.3 `>=18`, `jest-fixed-jsdom` 0.0.11 `>=18`. The plan pins jest 29.7 / msw 2.x. |
| design `lib/global/*` | No file outside `lib/global/` references it and the app imports only `@oacore/design/lib/index.css` (`pages/_app.jsx:18`): unreferenced. design `bin/` runtime requires: `yargs`, `deepmerge`, `cosmiconfig`, `svgstore`, `svgo`, `path`, `fs`, plus `@mdi/svg` via `design.config.js`. |

## 7. Needs a real browser (not answerable by HTTP) or still open

- Disabled filter items firing via keyboard (code says yes). Needs the aggregate endpoint fixture.
- Hydration/TZ behaviour (Q-050/Q-051): prod React 17 does not log them; they need React 18 builds in a browser with TZ emulation.
- Visual parity, fonts, focus rings, Leaflet tiles.
- `Host` the in-cluster API expects (OD-20): not observable here.
- Production behaviour of the works-page 500 and of the XSS: blocked by Cloudflare from this machine; no API key.
- Next 14/15/16 hops, `eslint` option removal, `next/jest` honouring Babel, RouterContext paths, msw preload under msw (only a plain `fetch` wrapper was proven).
