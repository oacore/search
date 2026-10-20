# Review: Next.js 10.2.3 → (webpack5 flag) → 11.1 → 12.3 + Node steps (key: nextjs-early)

Reviewer scope: W4 of `docs/upgrade/50-roadmap.md`, change sites CS-W0/CS-N11-*/CS-N12-*/CS-NODE-* in `20-change-sites.md`, the Next/webpack risks in `10-risk-register.md`, and `findings/02-nextjs-framework.md`. Date 2026-10-19. App code at `f5cfc20`.

## 0. Verdict (short)

The W4 plan cannot be executed as written, and it misses at least two SILENT production regressions.

* **SILENT, critical.** From **Next 12.2** onward, the existing `rewrites()` rule `/search/_next/data/:path*` → `/_next/data/:path*` returns **404**. Behind the gateway, every client-side navigation then becomes a full page reload, with no server error. The plan blames the wrong mechanism (the client `getDataHref` patch) and has no fix for it. The fix is one line: move this rule to `beforeFiles`. I verified it.
* **SILENT, high.** From webpack 5 onward (W4 step b), the **server bundle uses `@sentry/browser`**, because of the `config.isServer` alias bug. Server errors are then silently not reported.
* **SILENT, high.** Next ≥11 ships a newer CSS minifier. It changes the built CSS: lossy `rgba`→`hsla` conversion, alpha rounding, and different rule merging. This breaks the T-003 declaration parity and very likely T-801 at 0 px. No change site covers it.
* **LOUD blockers that the plan does not foresee:**
  * `next build` of Next 11/12 runs ESLint and fails on the 7 existing errors.
  * **Next 11.1.4 cannot build the real app at all** (webpack 5.51.1 `Maximum call stack size exceeded`).
  * `--openssl-legacy-provider` cannot be removed before Next 12.
  * Next 11 rejects a leftover `future.webpack5` key.
* Several plan worries turn out to be non-issues for W4, with evidence below:
  * `process.on` keeps working.
  * The CSS-module camelCase hack keeps working.
  * The SEO head is unchanged.
  * gSSP `redirect`+`props` and `notFound`+`props` are unchanged.
  * CSP has no new violations.
  * Next 12.3.7 runs on Node 22 and 24.

## 1. Method and evidence base

All work was done under `<scratch>/exp/nextjs-early/`. No subject repo was modified.

1. I read `next@11.1.4` and `next@12.3.7` from `npm pack` (`n11/`, `n12/`), and the installed `next@10.2.3`.
2. **Replica app** (`tpl/` → `app10`, `app11`, `app12`, `app12.0.10`, `app12.1.6`, `app12.2.6`). It uses the repo's exact `next.config.js` (webpack hook, aliases, CSP, rewrites, next-images, next-source-maps), `babel.config.js`, `postcss.config.js`, `.browserslistrc`, `utils/helpers.js` and `utils/sentry.js`. It reproduces these patterns:
   * `_app` with module-scope `process.on`, the `getDataHref` patch, `App.getInitialProps`, and a `lib/loader.js` that pulls `fs`/`path` into the client.
   * gSSP pages: `redirect`+`props`, `notFound`+`props` with an `Error`, and a throwing page.
   * A custom `<Meta>` inside `next/head`.
   * A kebab-case CSS module read via camelCase.
   * SVG and PNG imports, including the real `CoreB.png`, `errorCard.svg`, `redirect.svg`, and CSS `url()` assets.
   * MobX legacy decorators, `export x from`, and an `i18n-iso-countries/langs/en.json` named import.
   * Installs used `--ignore-scripts`.
3. **Real-app copies.** `real10`, `real10w5`, `real11`, `real121` and `real12` are full copies of the repo including its `node_modules`, with next swapped by `npm install next@X --no-save --ignore-scripts`. They were built with `NODE_ENV=production APP_ENV=local BUILD_TARGET=azure API_KEY=dummy`, so no CORE API calls were made.
4. **HTTP checks** use curl. **Browser checks** use `playwright-core@1.56.1` with the cached headless Chromium, through `scripts/proxy.js`, a minimal gateway equivalent of `kube/prod/httproute.yaml` (`/static/search/*`→`/*`, `/display/*`→`/outputs/*`). Scripts are in `exp/nextjs-early/scripts/` (`build.sh`, `check.sh`, `e2e.sh`, `browse*.js`, `snap.py`, `cssdiff.py`, `sentry-node-probe2.js`).
5. Node versions: v18.20.8 (production parity), v22.18.0 and v24.18.1, all darwin-arm64.

**Not confirmed (UNCONFIRMED):**
* linux/arm64-musl (alpine) Docker build. The Docker daemon was not running.
* Node 26, which is not installed.
* The root cause inside webpack-sources of the Next 11.1.4 overflow.
* Client navigation on the real app with live data (no API).

### 1.1 Result matrix

| Check | 10.2.3 wp4 (baseline) | 10.2.3 + `future.webpack5` | 11.1.4 | 12.0.10 / 12.1.6 | 12.2.6 / 12.3.7 |
|---|---|---|---|---|---|
| Build on Node 18 **without** `--openssl-legacy-provider` | ✗ `ERR_OSSL_EVP_UNSUPPORTED` | ✗ same (webpack 5.37 md4) | ✗ same | ✓ | ✓ |
| `config.node = {fs:'empty'}` | ✓ | ✗ schema `ValidationError` | ✗ same | ✗ (wp5) | ✗ |
| Real app `next build` (original `next.config.js`, ESLint 7 + `.eslintrc.yml` installed) | ✓ | n/a | ✗ ESLint: 7 errors | ✗ ESLint (12.1.6 not run unfixed) | ✗ ESLint: same 7 errors (real12 `build-orig.log`) |
| Real app build with fixes (fs fallback, DSI, lint skip) | ✓ | ✓ (webpack 5.37.0) | **✗ `HookWebpackError: Maximum call stack size exceeded`** (webpack 5.51.1) | ✓ 12.1.6 (webpack 5.72.0) | ✓ 12.3.7 (webpack 5.74.0) |
| `/search/_next/data/<id>/x.json` via the app rewrite | 200 | 200 | 200 | 200 | **404 HTML** |
| Same, with the rule in `beforeFiles` | — | — | — | — | 200 (12.3.7) |
| Browser client navigation through the proxy (document requests) | 1 | 1 | 1 | — | **4 (every navigation is a hard reload)**; 1 with `beforeFiles` |
| `typeof process.on` in the browser | function | function | function | — | function |
| CSS-module keys exported (kebab + camel) | ✓ | ✓ | ✓ | ✓ | ✓ |
| next-images URLs, PNG import, data-URI inlining | baseline | identical | identical with DSI; **build error without DSI** (PNG) | identical | identical |
| Server bundle Sentry | `require("@sentry/node")` | **browser SDK bundled** | **browser SDK bundled** | — | **browser SDK bundled** (real app: `.next/server/chunks/92.js`) |
| Built-in `_error` text (500 page) | "An unexpected error has occurred." | — | "Application error: a client-side exception has occurred …" | — | same as 11 |
| Built CSS declarations vs baseline (real app, hashes normalised) | — | identical (0 rule diffs) | n/a | 13 rules differ | 13 rules differ |
| SEO head (`<title>`, citation/DC order, JSON-LD) | baseline | — | identical | — | identical (only charset/viewport order swaps) |
| CSP violations, console/pageerror (real app, 5 routes) | baseline | — | — | — | identical to baseline |
| Node 22.18 / 24.18 build+start+data route (12.3.7) | — | — | — | — | ✓ / ✓ |

---

## 2. Findings

Severity follows the task brief. "Docs" names the plan files to change.

### NE-01 — CRITICAL — From Next 12.2 the data rewrite 404s, so every client navigation silently becomes a full reload behind the gateway
**Docs:** 20, 10, 50, 90 (OD-03), 40 (T-010), README §7 errata, findings/02 (errata only).
* **What breaks.** `next.config.js:15-21` adds the rule as an *afterFiles* rewrite (array form) `/search/_next/data/:path*` → `/_next/data/:path*` (source from `utils/helpers.js:12-16` when `NODE_ENV=production`).
  * On **12.2.6 and 12.3.7**, `GET /search/_next/data/<BUILD_ID>/search.json?q=abc` returns **404 text/html**.
  * Direct `/_next/data/...` still returns 200.
  * On 10.2.3, 10.2.3+wp5, 11.1.4, 12.0.10 and 12.1.6 the same request returns 200 JSON. This is bisected in `app12.0.10`, `app12.1.6` and `app12.2.6`, and re-confirmed on the real app: `real12` with original rewrites → 404, `real121` → 200.
* **Root cause, in the Next server.**
  * In 12.2+, the fs-route `_next/data catchall` no longer renders. It returns `{pathname, query:{__nextDataReq:'1'}, finished:false}` (`n12/package/dist/server/next-server.js:612-680`).
  * `Router.checkFsRoutes`, which runs for `check:true` (afterFiles) rewrites, keeps only `finished` and drops the returned pathname/query (`n12/package/dist/server/router.js:138-160`).
  * The request then falls through to the catch-all render of `/_next/data/...` and gets a 404.
  * In 12.1.6 the catchall renders directly and returns `finished:true`.
* **What users see.** Client side, the patched `getDataHref` (`pages/_app.jsx:70-98`) still prefixes `/search` correctly. The 404 makes the router log `Error: Failed to load static props` and hard-navigate. In the browser probe through the gateway proxy, a run with 3 navigations produced 4 document requests, and each data fetch returned 404. The page content is still correct, so nothing is visibly broken, but MobX state, the loading bar and analytics change.
* **Fix (config-only, behaviour-preserving).** Return `{ beforeFiles: [dataRule], afterFiles: [staticRule], fallback: [] }` from `rewrites()`. Verified on 12.3.7 (replica + real app) on Node 18, 22 and 24:
  * the data route returns 200;
  * the browser shows 1 document request and 200 data fetches;
  * the HTML route matrix is identical to baseline.

  The alternative is OD-03 option B (gateway `URLRewrite`).
* **Plan errors to correct:**
  * CS-N12-3 claims the patch "passes it through unchanged" and to stop only "if `pageLoader.getDataHref` no longer exists". It exists, and the failure is server-side.
  * R-002's trigger list.
  * OD-03 says "needed by W6". It is needed by W4(d).
  * T-010 pins `routes-manifest.json` rewrites "equal to the baseline". That must allow the beforeFiles shape.
  * README §7 must add an erratum to 02 §1.2/§1.3 (it says "12.x through 16 … the patch forwards correctly").

### NE-02 — HIGH — Next 11.1.4 cannot build the real app, so W4 step (c) is impossible as written
**Docs:** 50 (W4), 20 (CS-N11-8), 90 (OD-26).
* **The failure.** `real11` is the real repo plus `next@11.1.4`, with the lint skipped, the fs fallback, DSI and the Sentry fix applied. `next build` → `Failed to compile. HookWebpackError: Maximum call stack size exceeded` (`real11/build-fixed.log`).
  * It still fails without `@zeit/next-source-maps` (`build-nosm.log`).
  * It still fails with `realContentHash:false`, and with `node --stack-size=3800`.
  * It succeeds only with **both** minification and source maps off, which is not shippable.
  * One trace points into `next/dist/compiled/webpack-sources3` `RawSource.streamChunks`/`CachedSource.streamChunks` (`build-nomin.log`).
* **Other versions build.** The same app builds on 10.2.3+`future.webpack5` (webpack 5.37.0), 12.1.6 (5.72.0) and 12.3.7 (5.74.0).
* **Likely trigger (UNCONFIRMED).** The 5.4 MB `data/.formap.json` module (imported by `utils/data-providers-transform.js:2`) going through webpack 5.51.1's webpack-sources.
* **Recommendation.** Drop the 11.x deploy step. Go 10.2.3+wp5 → **12.1.6** (pre-12.2 router, so the afterFiles data rewrite still works; webpack 5.72; no md4) → 12.3.7. Apply the Next 11 breaking changes (§3) at the 12.1.6 step. Next's 12 upgrade guide does not require an 11 deploy.

### NE-03 — HIGH (LOUD) — `next build` of Next 11/12 lints `pages/`, `components/`, `lib/` with the repo ESLint and fails on the existing errors
**Docs:** 20 (new CS-N11), 50 (W4 entry), 10 (new risk), 40 (T-901/T-001).
* Next 11/12 run ESLint inside `next build` when an `.eslintrc*` is found:
  * dirs `pages, components, lib, src/*` (`n11/package/dist/lib/constants.js:47-55`; `n12/.../constants.js:46-51`);
  * errors throw `CompileError` (`n11/package/dist/lib/verifyAndLint.js:42-45`).
* `.eslintrc.yml` plus ESLint 7 and `@oacore/eslint-config-react` are installed in the image (`Dockerfile:19` `--include=dev`). The baseline has errors in `lib/loader.js` (max-len :14,:29; class-methods-use-this :25) and `pages/search/index.jsx` (no-console :51,:53,:56,:66) (`findings/baselines/eslint-baseline.json`).
* **Verified on the real app.** Next 11.1.4 and 12.3.7 both fail with exactly these 7 errors (`real11/build-orig.log`, `real12/build-orig.log`).
* W4's entry criterion is "W2, W3 green". W1 (ESLint 9 flat config, which would make Next find no `.eslintrc*` and skip lint) is optional/parallel.
* **Fix.** Add `eslint: { ignoreDuringBuilds: true }` in the first Next ≥11 PR. That keeps today's behaviour, since `next build` 10.2.3 never lints. Alternatively make W1 a hard W4 prerequisite. Either way, T-001 stays the lint gate.

### NE-04 — HIGH (SILENT) — From webpack 5 (W4 step b) the server bundle uses `@sentry/browser`, so server error reports are lost
**Docs:** 20 (new CS-N11), 30 (Q-065 → ESCALATES at W4), 10 (R-040 bites in W4), 40 (T-004 → P0 for W4).
* **The bug.** `next.config.js:97` aliases `'@sentry/node': config.isServer ? … : '@sentry/browser'`. `config.isServer` is always undefined.
  * On webpack 4, Next externalises `require("@sentry/node")` before the alias applies (baseline `.next/server/pages/_app.js`).
  * With webpack 5 (10.2.3+flag, 11.1.4, 12.3.7), Next's externals resolve **through** the alias. The browser SDK is then bundled into the server: replica `chunks/505.js` / `369.js` / `321.js`, and real app 12.3.7 `.next/server/chunks/92.js` contains `sentry.javascript.browser` with 0 `require("@sentry/node")`.
* **Why it matters.** Probe (`scripts/sentry-node-probe2.js`, Node 18): `@sentry/browser@5.30.0` `init`+`captureException` in Node delivers **0** events to a local DSN, while `@sentry/node@5.30.0` delivers `POST /api/1/store/ sentry.javascript.node`. The affected paths are SSR `ErrorBoundary`, the `process.on('unhandledRejection'|'uncaughtException')` handlers at `pages/_app.jsx:21-27`, and `utils/sentry.js`. Nothing errors.
* **Fix (D1: keeps today's effective behaviour).** Apply the alias only to the client: `...(isServer ? {} : {'@sentry/node':'@sentry/browser'})`. Verified:
  * the server again `require("@sentry/node")` (replica 12.3.7, real 12.3.7, real 10.2.3+wp5);
  * the client `_app` chunk hash is unchanged (`_app-b174eb12653cb6fe.js` before and after, replica).
* Q-065 must be marked ESCALATES at W4(b), not "watch". T-004 is P1. It must be P0 and run at W4(b). CS-SEN-1 (W2) keeps the alias, so the fix must also be valid for Sentry 7.

### NE-05 — HIGH (LOUD) — Next ≥11's CSS minifier changes the built CSS (lossy colours, rounding, rule merging); no change site or decision exists
**Docs:** 10 (R-043 → bites in W4), 20 (new CS-N12), 90 (new OD), 40 (T-003 triage).
* **Cause.** Next 10.2.3 minifies CSS with `cssnano-simple@2.0.0`. Next 11.1.4 depends on `cssnano-simple@3.0.0`, and 12.3.7 bundles `next/dist/compiled/cssnano-simple`, which includes `postcss-colormin`, `convertValues` and `mergeRules` (`n12/.../build/webpack/plugins/css-minimizer-plugin.js:5,41`).
* **What changes.** Real app, `scripts/cssdiff.py`, class/asset hashes normalised, 10.2.3 vs 12.3.7 (also 12.1.6): **13 rules differ, 2 grouped rules disappear**.
  * `.marker-cluster-small{background-color:rgba(181,226,140,.6)}` → `hsla(91,60%,72%,.6)`. This is lossy: it decodes to `rgb(182,226,141)`.
  * `.marker-cluster-large` `rgba(253,156,115,.6)` → `hsla(18,97%,72%,.6)` = `rgb(253,156,114)`. Both come from leaflet.markercluster CSS imported at `pages/_app.jsx:16-17`.
  * Alpha rounding: `.06666666666666667`→`.067`, `.8784313725490196`→`.878`, `.25098039215686274`→`.251`.
  * `rgba(10,10,10,.29)`→`hsla(0,0%,4%,.29)`.
  * `h2,h3`/`h4,h5` group rules are re-merged into per-element rules with extra `line-height` declarations.
* **Impact.** 10.2.3+wp5 is identical, with 0 rule diffs. So the change comes from Next's minimizer, not webpack 5, and the app's own cssnano 4 is not involved.
  * T-003(d) will fail, and T-801 at 0 px is likely to fail on map-cluster and box-shadow pixels.
  * This is the SILENT drift class R-043, but it bites in **W4**, not only W6/W8.
* **Recommendation.** Add an OD:
  * (A) restore the 10.2.3 output by replacing the minifier's processor in the client `webpack()` hook with `cssnano-simple@2.0.0`, pinned as a devDep. Must be verified by T-003 = identical and T-801 = 0 px. Or:
  * (B) accept it only if T-801 shows 0 px.

  Record the categories in T-003's triage list.

### NE-06 — HIGH (LOUD) — `--openssl-legacy-provider` cannot be removed "once webpack 5 builds"
**Docs:** 20 (CS-N11-5, CS-NODE-2), 50, findings/02 §6.1 step 1, README §3.
* On Node 18 without the flag, both 10.2.3+`future.webpack5` and 11.1.4 fail with `Error: error:0308010C:digital envelope routines::unsupported` at `BulkUpdateDecorator.hashFactory` (`app10/build-wp5.log` first attempt, `app11/build-a.log`).
* 12.0.10, 12.1.6, 12.2.6 and 12.3.7 build without it.
* Move CS-N11-5 / CS-NODE-2 to the first Next 12 step. `next-images` is not a blocker: its `loader-utils@2.0.4` falls back to WASM md4 (`node_modules/loader-utils/lib/getHashDigest.js:54-66`), so image names stay identical.

### NE-07 — MEDIUM (LOUD) — Next 11 refuses `future.webpack5`; Next 12 warns
**Docs:** 20, 50.
* With step (b)'s `future: { webpack5: true }` left in, 11.1.4 fails: "`future.webpack5` in `next.config.js` has moved to the top level `webpack5` flag".
* 12.3.7 warns: "Invalid next.config.js options detected … .future has an unexpected property, webpack5".
* Add a CS that removes the key in the same PR as the Next bump.

### NE-08 — MEDIUM (SILENT) — The built-in `_error` (500) page text and markup change at Next 11
**Docs:** 30 (new quirk), 20 (CS or OD), 40 (T-601 forced-500 fixture).
* There is no `pages/_error` (02 §1.1). The custom `App.getInitialProps` (`pages/_app.jsx:125-137`) does not call the page's `getInitialProps`, so `_error` never gets `statusCode`.
* 10.2.3 renders `<title>: An unexpected error has occurred</title>` and "An unexpected error has occurred.".
* 11.1.4 and 12.3.7 render "Application error: a client-side exception has occurred (see the browser console for more information)." The 12.x markup also replaces the inline `color:#000;background:#fff` with a `<style>` block (dark mode).
* Reproduced with a throwing gSSP (`/boom/` → 500) and on 404s served by `_error`. The real app's 404s use `pages/404.jsx`, but any uncaught SSR error (e.g. the open Q-053 LinkedData question) shows this page.
* T-601 has no forced-500 route. `5000`→500 fixtures are caught and render soft-404s.
* **Recommendation.** Add a fixture that throws during SSR. Then decide: PRESERVE via a `pages/_error.jsx` that reproduces the 10.2.3 output (same title, text and inline styles; identical HTML is required by D1), or accept it via an OD.

### NE-09 — MEDIUM — R-006/CS-N11-6 (`process.on` white screen) does not occur on the W4 path
**Docs:** 10 (R-006 severity/likelihood), 20 (CS-N11-6), README checklist.
* A Playwright probe on the client shows `typeof process.on === 'function'` on 10.2.3 wp4, 10.2.3+wp5, 11.1.4 and 12.3.7.
* The real app has 0 `pageerror` on 5 routes on 10.2.3 and 12.3.7.
* Mechanism:
  * Next 11 `ProvidePlugin({process: require.resolve('process')})` → `process@0.11.10` `browser.js` (`n11/.../webpack-config.js:930-938`);
  * Next 12 `ProvidePlugin` (`n12/.../webpack-config.js:903-915`) + `compiled/process/browser.js` (`.on=noop`).
* Downgrade R-006 to Low for W4. CS-N11-6 is not needed. Keep T-701, and re-check only for Turbopack (W9).

### NE-10 — MEDIUM — R-007's mechanism is wrong for this repo at 11.x; T-005 is wrong for 5 imports
**Docs:** 10 (R-007), 20 (CS-N11-3 notes), 40 (T-005), findings/02 §1.2 errata.
* **SVGs are not affected.** Next 11.1 removes `.svg` from its own `next-image-loader` when any custom rule tests `.svg` (`n11/.../webpack-config.js:1280-1293`). next-images' rule does, so SVG imports keep returning strings even without DSI.
* **The PNG breaks the build.** `templates/search/index.jsx:12` `CoreB.png` gets both loaders chained, and the build **fails**: `./public/static/images/CoreB.png TypeError: unsupported file type: undefined` (`app11/build-n11-noDSI.log`). The failure is LOUD, not `[object Object]`.
* With `images.disableStaticImages: true`, URLs are identical through 12.3.7. CS-N11-3 is correct.
* **next-images inlines small images.** It uses `inlineImageLimit: 8192` (`node_modules/next-images/index.js:10-13`). 5 of the 14 imports (4 files: `Default.svg` 524 B ×2, `repoPlaceholder.svg` 466 B, `arrowRight.svg` 243 B, `redirect.svg` 479 B) become `data:image/svg+xml;base64,…`. T-005 "each … resolves to an existing built file" is false for them. They must be pinned as data URIs, which is also needed later when next-images is removed (src changes).

### NE-11 — MEDIUM — SWC native binaries are required at 12.3 build time even with Babel; Next patches/fetches the lockfile during the build
**Docs:** 20 (CS-N12-2, CS-N12-4), 10 (R-027), 40 (T-008/T-901).
* **SWC is loaded anyway.** For every page that contains `getServerSideProps`, 12.3 parses it with SWC (`n12/.../build/analysis/get-page-static-info.js:208-210` → `parse-module.js:9`). Loading the bindings starts `patchIncorrectLockfile(process.cwd())` (`n12/.../build/swc/index.js:93-101`). That function fetches the registry and rewrites `package-lock.json` when `@next/swc-*` entries are missing (`n12/.../lib/patch-incorrect-lockfile.js:85-140`). If no native binary loads, Next downloads `@next/swc-wasm-nodejs` at build time (`swc/index.js:139-162`).
* **Observed on the real app** (with the current Next 10 lock): `warn - Found lockfile missing swc dependencies, patching...` then `error - Failed to patch lockfile … TypeError: Cannot read properties of undefined (reading 'os')`. This was non-fatal.
* **The lock is fine from macOS.** A lock created on macOS with npm 10.8.2 includes `node_modules/@next/swc-linux-arm64-musl` 12.3.4 (os linux, cpu arm64; `app12/package-lock.json`). So "regenerate in a linux container" is unnecessary. The requirement is: the lock regenerated with Next 12 must contain the musl entry (assert in T-008), in the Next-12 PR.
* `next@12.3.7` optionalDependencies pin `@next/swc-*@12.3.4` (`npm view next@12.3.7 optionalDependencies`).
* The alpine/arm64 runtime load is UNCONFIRMED (no Docker daemon). T-901 must run at this step.
* CS-N12-2's log line is confirmed: `Disabled SWC as replacement for Babel because of custom Babel configuration "babel.config.js"`.

### NE-12 — MEDIUM — Node target: plan says 22, but M1 needs the latest LTS; 12.3.7 already works on 24
**Docs:** 20 (CS-N12-6, CS-NODE-1), 90 (OD-05), 50 (O11), README §3.
* Release schedule (`github.com/nodejs/Release/schedule.json`, read 2026-10-19):
  * Node 18 is EOL (2025-04-30), and so is Node 20 (2026-04-30).
  * Node 22 is maintenance LTS until **2027-04-30**.
  * Node 24 moves from active to maintenance LTS on 2026-10-20, with EOL 2028-04-30.
  * Node 26 becomes LTS on 2026-10-28. `nodejs.org/dist/index.json` lists v26.12.0 and v24.22.0.
* Verified: 12.3.7 builds, starts, serves the data route and the CSS hack, and keeps Babel/decorators on **Node 22.18.0 and 24.18.1** (darwin), with no warnings in the start logs.
* **Recommendation.** W4(e) → `node:24-alpine` (pinned by digest), not 22. Add an explicit later step to Node 26 LTS (Next 16 supports ≥20.9). Node 26 + 12.3.7 is UNCONFIRMED.
* Also correct CS-N12-6's "[VERIFY] … if not, move this to W6": it does run.

### NE-13 — MEDIUM — Parity-contract normalisations are missing for known 11/12 output changes
**Docs:** 40 §1 (parity contract), 40 T-003/T-005/T-010/T-601/T-603, 90 (OD-28).
Verified changes that are not behaviour, but that will make byte-exact tests red:
* CSS-module class suffixes change in 12 (`card_container-inner__3cjKg` → `__ZzLfh`).
* CSS `url()` asset names change from `static/media/<name>.<32hex>.<ext>` to `<name>.<8hex>.<ext>` in 12.
* Page scripts go from `async` + `<link rel=preload as=script>` to `defer` with no preload (11+, per the Next 11 blog). `__NEXT_DATA__` moves after the scripts.
* `<meta charSet>`/`viewport` order swaps in 12.
* `data-reactroot=""` appears on `#__next` in 12.
* The 308 response body changes from empty to the target path in 12 (e.g. `/search/` body `"/"`).
* The ETag format changes in 12.
* The `routes-manifest` rewrites shape changes with NE-01.

The contract lists only "chunk/asset hashes, data-reactroot, script tags". Add class-hash suffixes in DOM attributes, the media-hash format, redirect bodies, the `defer` timing note and the T-010 exception explicitly.

### NE-14 — MEDIUM — Proposed revised W4 sequence (the current one has unnecessary, mis-ordered and missing steps)
**Docs:** 50 (W4 row), 20, 90 (OD-26).

| Step | Change sites | Evidence |
|---|---|---|
| W4.0 (prereq) | T-604, T-702, T-004 (→P0), T-003, T-801 green on the baseline. Add a forced-500 fixture to T-601. Add the NE-13 normalisations. Decide OD-03 (beforeFiles vs gateway), the new CSS-minifier OD (NE-05), the `_error` OD (NE-08) and OD-05 (Node 24). | — |
| W4.a | CS-N12-1: data-loader without `node-fetch` (own PR). See NE-17 on log text. | `real12`: `Cannot find module 'node-fetch'`; Next 11 still hoists node-fetch 2.6.7 |
| W4.b | 10.2.3 + `future.webpack5:true`; CS-N11-1 (`resolve.fallback.fs=false`, drop `config.node`); **new**: Sentry alias client-only (NE-04); **keep** `--openssl-legacy-provider` | real10w5: build OK, **0 HTML diffs**, 0 CSS rule diffs vs baseline |
| W4.c | **Next 12.1.6** (instead of 11.1.x): **new** remove the `future` key; CS-N11-3 DSI; **new** `eslint.ignoreDuringBuilds:true`; CS-N11-5 (drop the openssl flag, moved here); CS-N12-4 lock with musl entry; CS-N12-2 verify; CSS-minifier decision (NE-05); `_error` decision (NE-08); CS-N11-4 optional | real121: builds, data rewrite 200, HTML parity |
| W4.d | `next@12.3.7` exact; **new**: data rule in `beforeFiles` (or the gateway rule); T-604/T-702 must be green | app12/real12 |
| W4.e | `node:24-alpine` (NE-12); T-108 ICU snapshot per OD-05; T-901 on arm64 | Node 24.18 OK |

Prod only after W4.d, as planned. W4.b/c stay stage-only because of the advisories (NE-16).

### NE-15 — LOW (resolved-verify) — The CSS-modules camelCase hack still works through 12.3.7; no supported option exists
**Docs:** 20 (CS-N11-2), 40 (T-002 extraction), 10 (R-001 W4 likelihood).
* Mechanics (`next.config.js:45-77`):
  * it finds the first `oneOf` group containing a rule matching `file.css`;
  * it takes the first rule matching `file.module.css` whose `use.loader !== 'error-loader'`. The first hit is the `_document` error-loader rule, which is skipped because its `use` is an object.
* Rule dumps (`app*/rules-dump.json`):
  * The patched rule is oneOf index 2 on 10.2.3/11.1.4 and index 4 on 12.3.7.
  * Its css-loader path changed in 12.3 from `next/dist/compiled/css-loader/cjs.js` to `next/dist/build/webpack/loaders/css-loader/src/index.js`; `includes('css-loader')` still matches.
  * One other css-loader `modules` config stays `asIs`. It is the Sass-modules rule, which is unused.
  * In 12.2+ the hook runs 3×: client, server and edge.
* Both key forms are exported in the client chunk and SSR on all versions.
* No `cssModules` or `exportLocalsConvention` option exists in `config-shared` (11/12).
* T-002 can extract the map by grepping the client chunk for the `"<kebab>":"…",<camel>:"…"` object literal, or by SSR probe. Do **not** use `next/jest` (NE-21).
* R-001 likelihood for W4: L.

### NE-16 — LOW — The image optimizer is publicly reachable on every W4 version; advisories; not in the security notes
**Docs:** 30 (security notes), 50 (prod exposure per step).
* `/_next/image/?url=…` returns 200 on 10.2.3/11.1.4/12.3.7. Through the gateway it is reachable as `/static/search/_next/image/…`, and in 11/12 also via the `/static/:path*` rewrite.
* 12.3.7 returns 400 for SVG (`dangerouslyAllowSVG:false`), where 10/11 returned 200. The endpoint is unused (no `next/image`).
* `npm audit` (replicas):
  * 12.3.7 still matches GHSA-g77x-44xx-532m, GHSA-xv57-4mr9-wg8v, GHSA-h64f-5h5j-jqjh, GHSA-3x4c-7xq6-9pq8 (image optimizer), GHSA-ggv3-7p47-pfv8 (rewrite smuggling) and GHSA-p9j2-gv94-2wf4 (rewrite SSRF via attacker-controlled destination hostname). The SSRF one is likely N/A because the destinations are static.
  * The critical GHSA-2xp9-vwfh-vxw4 (AVIF RCE via sharp/libheif) is likely N/A: `npm ls sharp` → empty, so squoosh is used. UNCONFIRMED.
* The plan has no S-note. Add one (owner decision: gateway block, or `images.unoptimized` from 12.3). Keep W4.b/c off prod.

### NE-17 — LOW — CS-N12-1 (global `fetch`) changes the data-loader's build-log text and timeout semantics; node-fetch version drift at 11
**Docs:** 20 (CS-N12-1), 40 (T-117), 90 (OD-08/OD-28).
* The `console.error(fetchError)` at `data/data-loader.js:85` prints a node-fetch `FetchError: request to … failed, reason: …` today. With undici it prints `TypeError: fetch failed` with a cause.
* undici has a default 300 s headers/body timeout. node-fetch 2 has none, so a hung API hangs today's build and fails the new one.
* OD-28 counts console output as behaviour. Either T-117 asserts exit code and files only and the text change is accepted explicitly, or `node-fetch` is declared exactly (`2.6.1`, today's hoisted version) for W4 and removed in phase 6.
* If step (a) were skipped, Next 11 would silently switch the hoisted node-fetch to 2.6.7 (`app11`: `node-fetch@2.6.7`; Next 12: none).

### NE-18 — LOW — CS-N11-4 (source maps): baseline emits public client maps; the plugin still works; "identical output" is overstated
**Docs:** 20 (CS-N11-4), README checklist.
* The real baseline emits 27 client `.js.map` files under `/static/search/_next/static/` (`real10`).
* `@zeit/next-source-maps@0.0.3` sets `devtool:'source-map'` for client **and server** (`node_modules/@zeit/next-source-maps/index.js:11-13`). It still works on 10+wp5/12.3 and is not the cause of NE-02.
* `productionBrowserSourceMaps:true` restores client maps only. Server `.map` files disappear (no runtime effect).
* Removal is optional at W4. If done, state the server-map difference.
* `0.0.4` is not published (`npm view @zeit/next-source-maps versions`), which confirms "unsatisfiable".

### NE-19 — LOW (resolved-verify) — `fs`/`path` fallbacks
**Docs:** 20 (CS-N11-1), README checklist.
* `config.node={fs:'empty'}` → webpack 5 `ValidationError … configuration.node has an unknown property 'fs'` (10+wp5, 11).
* `resolve.fallback.fs=false` builds.
* Next provides `path`: 11 uses `path-browserify@1.0.1`, 12 uses the compiled copy. In the browser, `path.resolve('data/.statistics.json')` returns `/data/.statistics.json` on 10/11 but `data/.statistics.json` on 12.3 (different `process.cwd`). This is harmless because `fs` is empty and `readCache` returns null either way.
* Today's assignment drops Next's `node:{setImmediate:false}`, but no client module uses a free `setImmediate` (the dev bundle only has guarded core-js internals), so there is no webpack-5 difference.

### NE-20 — LOW (resolved-verify) — `getDataHref` internals per version
**Docs:** 20 (CS-N12-3), findings/02 §1.3.
* 10.2.3 and 11.1.4: `getDataHref(href, asPath, ssg, locale)` (`node_modules/next/dist/client/page-loader.js:5`, `n11/.../page-loader.js:50`). The patch forwards only `href`. Dynamic routes interpolate from the query.
* 12.3.7: `getDataHref(params)` with `{href, asPath, locale, skipInterpolation}` (`n12/.../page-loader.js:58`). It is called twice per navigation (`router.js:1067` eagerly with `skipInterpolation:true` for middleware matching, and `:1133`).
* Observed patched hrefs are identical across versions (`/_next/data/<id>/search.json?q=abc&page=2` → prefixed `/search`).
* No client change is needed through 12.3. The only W4 change is server-side (NE-01).

### NE-21 — LOW (resolved-verify) — Test-harness facts for 40 §2.2
**Docs:** 40 §2.2, README checklist.
* `next/jest` (12.3) always uses the SWC transformer and maps `*.module.css` to an identity proxy (`n12/.../build/jest/jest.js:46-75`). It must not be used: it would hide R-001 and can't apply the Babel decorator config. Keep `babel-jest`.
* RouterContext path: 10.2.3 `next/dist/next-server/lib/router-context`; 11.1.4/12.3.7 `next/dist/shared/lib/router-context`.

### NE-22 — LOW (resolved-verify) — Items in the 10 register that do NOT bite in W4
**Docs:** 10 (R-003, R-016, R-026, R-045 "Bites in").
* R-045 (gSSP shapes): `redirect`+`props:{}` → 308 `/` and `notFound:true`+`props:{error:new Error()}` → 404 on 10/11/12.3. The data route returns `__N_REDIRECT`.
* R-003 (SEO head): the custom `<Meta>` (fragments + JSON-LD) inside `next/head` renders an identical SSR head through 12.3.7.
* R-016 (fetch/Host): Next 11/12 polyfill only `if (!global.fetch)`, so native fetch is kept on Node 18 (`scripts/fetchprobe.js`).
* R-026 (CSP): real app, 5 routes. CSP violations, console errors and pageerrors are identical on 10.2.3 and 12.3.7. No new inline scripts.

### NE-23 — LOW — Pin exact versions and record why the intermediates are below latest (M1)
**Docs:** 20 (CS-N11-8, CS-N12-5), README §3.
* Registry: `latest`=16.4.2, `next-12-3-2`=12.3.7 (released 2025-03-28, a security backport whose optionalDeps use `@next/swc-*@12.3.4`), `next-11`=11.1.4.
* CS-N12-5 says "12.3.x". It should say `next@12.3.7` exactly, and `12.1.6` for W4.c (NE-02/14).
* Note in 20 that these are path-only intermediates, below latest by design, with the end state at W7.

### NE-24 — LOW — CS-N11-7 (i18n named JSON import) verified harmless; CI must accept "Compiled with warnings"
**Docs:** 20 (CS-N11-7), 40 §8.
* Webpack 5 warns: "Should not import the named export 'countries' … from default-exporting module". The real app shows the same.
* The value is unchanged (`TR` → "Turkey").
* No change is needed. Make sure G3/G5 do not treat build warnings as failures.

### NE-25 — LOW — Chunk graph and first-load size change; T-007 per-chunk baselines will not carry over
**Docs:** 40 (T-007).
* Real app "First Load JS shared by all": 1.26 MB (10.2.3), 1.24 MB (10+wp5), 1.24 MB (12.1.6), 1.27 MB (12.3.7).
* The baseline's hashed shared chunks (`0e194eac…`, `6fbfe604…`) are replaced by `framework`/`main`/`_app` (`_app` is 1.14 MB because of the formap).
* Keep the budget per route (±10%), not per chunk.

---

## 3. Official breaking changes vs this repo

Sources: <https://nextjs.org/docs/pages/guides/upgrading/version-11>, <https://nextjs.org/docs/pages/guides/upgrading/version-12>, <https://nextjs.org/docs/messages/webpack5>, <https://nextjs.org/blog/next-11>.

| Change | Applies? | Where / why | In 20? |
|---|---|---|---|
| 11: webpack 5 default | Yes | `next.config.js:37-103` | Yes (CS-N11-1/2). Missing: Sentry alias (NE-04), openssl timing (NE-06), 11.1.4 overflow (NE-02) |
| 11: `cleanDistDir` default | No | Dockerfile copies to `public/` after build (`Dockerfile:24-27`) | n/a |
| 11: `PORT` env | No | `CMD … -p 8080` wins; kube sets no `PORT` (secret contents unknown) | n/a |
| 11: `images.disableStaticImages` for next-images | Yes | 14 imports | Yes (CS-N11-3), but R-007's mechanism is wrong (NE-10) |
| 11: `super.componentDidCatch` / `Container` removed | No | `pages/_app.jsx` uses neither | n/a |
| 11: `props.url`, `unsized`, `next/dynamic` `modules`/`render`, `Head.rewind` | No | grep: none; `modules/map/index.jsx:7-9` uses only `{ssr:false}` | n/a |
| 11: moment locales | No | moment not installed | n/a |
| 11: `router.events` during render | No | all in `useEffect` | n/a |
| 11: React ≥17.0.2 | Satisfied | installed 17.0.2; peers `^17.0.2` (11.1.4), `^17.0.2 \|\| ^18` (12.3.7) | Yes |
| 11: new JSX transform | No | custom Babel uses classic `'@babel/react'` (`babel.config.js:12`); unchanged | n/a |
| 11 (blog): ESLint in `next build` | **Yes, breaks the build** | NE-03 | **No** |
| 11 (blog): scripts `defer` instead of preload+`async` | Yes (timing/HTML) | NE-13 | **No** |
| 11: Babel loader rewrite | Yes, works | function-form `babel.config.js` still found by Babel root-config lookup (`n11/.../get-config.js:128-135,140-210`); decorators and `export x from` verified | n/a |
| 11/12: newer CSS minifier | **Yes, changes CSS** | NE-05 | **No** |
| 11: built-in `_error` text | **Yes, visible** | NE-08 | **No** |
| 12: Node ≥12.22 | Satisfied | Node 18 | Yes |
| 12: SWC replaces Babel unless a Babel config exists | Opt-out happens; SWC is still loaded for page analysis | NE-11 | Partially |
| 12: `swcMinify` opt-in | No change | default `false` (`n12/.../config-shared.js:72`) | Yes (N13) |
| 12: styled-jsx parser | No | not used | n/a |
| 12: `next/image` span wrapper | No | not used | n/a |
| 12: HMR over WebSocket | Dev only | no dev proxy in prod | n/a |
| 12: webpack 4 removed | Yes | `future.webpack5` key must go (NE-07) | **No** |
| 12: `target` deprecated | No | not set | n/a |
| 12: `esmExternals` default `true` | No effect | no ESM-only runtime deps (scan of `node_modules` `type:module`: only tooling `flatted`, `node-releases`) | n/a |
| 12: `outputFileTracing` default | Build-time only | `.nft.json` files; no `output` set | n/a |
| 12.2: middleware stable / router-server rework | **Yes: data rewrite breaks** | NE-01 | **No (mis-diagnosed)** |
| 12.2: edge compiler runs `webpack()` | Harmless | hook is idempotent | n/a |
| 12: stops hoisting `node-fetch` | Yes | `data/data-loader.js:5` | Yes (CS-N12-1) |

## 4. Answers to the README §8 verification checklist (this dimension)

* **Webpack 5 `process` polyfill `.on`:** present (noop function) on 10+wp5, 11.1.4 and 12.3.7. R-006 does not bite (NE-09).
* **Browser `path` fallback:** yes (11: `path-browserify@1.0.1`; 12: compiled copy) (NE-19).
* **Baseline client `.map` files:** yes, 27 files (NE-18).
* **Next 12.3 on Node 22:** yes, and also on 24 (darwin); alpine is UNCONFIRMED (NE-12).
* **`next/jest` and a custom Babel config:** no. It always uses SWC (NE-21).
* **RouterContext path:** 10 `next/dist/next-server/lib/router-context`; 11/12 `next/dist/shared/lib/router-context`.
* **css-loader rejects `~` imports?** Not rejected through 12.3: the real app builds and design `lib/reboot.css` `~sanitize.css` resolves (real12/real121 builds).

## 5. Reproduction

* Replicas: `exp/nextjs-early/app{10,11,12,12.0.10,12.1.6,12.2.6}`.
* Real copies: `exp/nextjs-early/real{10,10w5,11,121,12}`.
* Build with `scripts/build.sh <app> <label> [ENV=…]`. The `EXP_*` env toggles in each `next.config.js` are `EXP_WEBPACK5`, `EXP_FS_FALLBACK`, `EXP_DISABLE_STATIC_IMAGES`, `EXP_BEFOREFILES`, `EXP_SENTRY_FIX`, `EXP_NO_LINT`, `EXP_NO_SM`, `EXP_NOMIN`, `EXP_NORCH`, `EXP_DUMP`.
* HTTP: `scripts/check.sh`, `scripts/realrun.sh` + `snap.py`.
* Browser through the proxy: `scripts/e2e.sh`, `scripts/reale2e.sh`.
* CSS rule diff: `scripts/cssdiff.py A/.next/static/css B/.next/static/css`.
