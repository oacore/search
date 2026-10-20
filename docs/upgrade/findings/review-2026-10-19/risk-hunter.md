# Risk-hunter review: blind spots in the search upgrade plan

Reviewer key: `risk-hunter`. Date: 2026-10-19. Subject: `search` @ `f5cfc20` (branch `docs/upgrade-plan`), plan docs in `docs/upgrade/`.

## How I worked

1. **Code first.** Before opening 10/20/30 I read the code: `pages/*`, `main/*`, `api/*`, `lib/*`, `store/*`, `hooks/*`, `utils/*`, `data/data-loader.js`, `next.config.js`, `babel.config.js`, `postcss.config.js`, `csp.config.js`, `env.config.js`, `design.config.js`, `.browserslistrc`, `Dockerfile`, `kube/*`, `.github/workflows/*`. I also read the relevant design sources (`cookies`, `histoslider`, `math-markdown`, `header/search-bar`). From that I built a list of upgrade failure modes.
2. **Then the diff.** I compared that list with `10-risk-register.md`, `20-change-sites.md` and `30-quirks-register.md`, plus the test rows in `40` and the wave procedure in `50`. This report keeps **only** what is missing, wrong, or mis-classified.
3. **Experiments.** All ran in `<scratch>/exp/risk-hunter/`, using `npm pack` only (no installs, no scripts):
   - Packages unpacked: `next@16.4.2`, `next@13.5.11`, `react`/`react-dom` 18.3.1 and 19.3.1, `@sentry/node` 7.119.1 and 11.8.0, `logrocket@12.4.0`, `axios@1.20.0`.
   - Small Node scripts:
     - SSR `<title>` rendering under React 17, 18 and 19;
     - the `Host` header across Node 18, 20, 22 and 24;
     - a differential of the server query parser (`url.parse` vs `URLSearchParams`).

Registry versions read today (`npm view <pkg> version`):

| Package | Version |
|---|---|
| next | 16.4.2 |
| react | 19.3.1 |
| mobx | 7.0.6 |
| mobx-react-lite | 5.1.0 |
| @sentry/* | 11.8.0 |
| logrocket | 12.4.0 |
| typescript | 7.0.2 |
| typescript-eslint | 8.71.2 |
| antd | 6.6.6 |
| axios | 1.20.0 |
| swr | 2.5.1 |
| zustand | 5.0.15 |
| caniuse-lite | 1.0.30001816 |

Overall the risk register is strong. It already covers the big ones: the `getDataHref` hack, the camelCase css-loader patch, next-images, custom-media `importFrom`, the Histoslider `defaultProps`, hydration via dates and the cookie popup, CSP, and node-fetch. What follows is what it misses.

---

## Findings (ordered by severity)

### RH-01 (HIGH, SILENT, SEO): React 19 empties the SSR `<title>`; React 18 + Next ≥13.5 inserts a literal `<!-- -->`

**Where.** These sites pass `<title>` more than one child, so React receives an array:

| Site | Title expression | Note |
|---|---|---|
| `pages/works/[id].jsx:144` | `<title>{data.title} - CORE</title>` | |
| `pages/outputs/[id].jsx:128` | same | |
| `pages/data-providers/index.jsx:85` | `<title>{query ? \`${query} - \` : ''}Data providers search</title>` | Always 2 children, even when `query` is empty |
| `modules/title/index.jsx:12` | — | Currently unused |

**Today.** Next 10 renders the document with `renderToStaticMarkup`: `node_modules/next/dist/next-server/server/render.js` (`'<!DOCTYPE html>'+(0,_server.renderToStaticMarkup)(…)`). That produces `<title>Deep learning - CORE</title>`.

**Experiment** (`exp/risk-hunter/scripts/title-ssr.js`, `title-stream.js`):

| React | renderToStaticMarkup | renderToString | renderToReadableStream |
|---|---|---|---|
| 17.0.2 (repo) | `Deep learning - CORE` | `Deep learning<!-- --> - CORE` | n/a |
| 18.3.1 | `Deep learning - CORE` | `Deep learning<!-- --> - CORE` | `Deep learning<!-- --> - CORE` |
| 19.3.1 | **`<title></title>`** | **`<title></title>`** | **`<title></title>`** |

**Why React 19 is empty.** Its Fizz renderer drops array children of length ≥2: `react-dom/cjs/react-dom-server.node.production.js:1202-1211` (`props = Array.isArray(children) ? 2 > children.length ? children[0] : null : children`). The legacy server build does the same at `react-dom-server-legacy.node.production.js:847`.

**Next's render path.**
- Next 13.5 renders the document with `renderToReadableStream`: `next@13.5.11 dist/server/render.js:84-85,919`.
- Next 16 does the same: `dist/server/render.js:84-85,967`.
- So under the plan's W6 (React 18 on Next 13.5–15) the crawler-visible title becomes `Title<!-- --> - CORE`. Inside `<title>` that comment is RCDATA, so it is literal text. Under W7 (React 19) the title is empty.

**Why it is silent.**
- The client head-manager sets `document.title` from `children.join('')` (`next16 dist/client/head-manager.js:107-113`). The browser tab, screenshots and T-801 all look correct.
- Only crawlers that read the raw HTML see the change, and Google Scholar is one of them. This is exactly the "broken SEO" case in D1a.

**Missing from the plan:**
- R-003 talks about meta/JSON-LD only.
- No change site.
- T-602 says "normalised `<title>`". If normalisation strips comments or whitespace, it hides the React 18 variant.

**Recommendation:**
- Add a risk (H/H, SILENT).
- Add a keep-behaviour change site in W6, before React 18. In each listed file, change the title to a single string, for example:

  ```jsx
  <title>{`${data.title} - CORE`}</title>
  ```

- Make T-602 assert the **raw** title bytes from the HTTP body.
- Add a Jest test that server-renders each page's `<Head>` subtree with react-dom/server and asserts that `<title>` has one string child.

---

### RH-02 (HIGH, factual error + missing risk): the server crash semantics are described wrongly and change at Sentry ≥8

**What the docs claim.** Q-009 says: "The server never crashes on `uncaughtException`". R-055 and findings/05 S2 say the handlers "keep the server alive".

**What the code does today.** `utils/sentry.js:6-11` calls `Sentry.init` whenever `SENTRY_DSN` is set. Both deploy workflows pass `--build-arg SENTRY_DSN=${{ secrets.SENTRY_DSN }}`, and `env.config.js:30` inlines it. The legacy `origin/master:.github/workflows/prod-stg-deploy.yml` even hard-codes a DSN `…@o318858.ingest.sentry.io/5340405`. So the DSN is set in production. Then:

- `@sentry/node@5.30.0` default integrations include `OnUncaughtException` (`node_modules/@sentry/node/dist/sdk.js:9-18`).
- Its handler calls `logAndExitProcess` on the first error, whatever other listeners exist (`dist/integrations/onuncaughtexception.js:40-66`).
- `logAndExitProcess` then calls `process.exit(1)` after flushing (`dist/handlers.js:242-259`).

So today an uncaught exception **does** kill the pod process (exit 1), and k8s restarts it.

**After the upgrade:**

| Version | Default | Result |
|---|---|---|
| `@sentry/node@7.119.1` (CS-SEN-1) | `exitEvenIfOtherHandlersAreRegistered: true` (`cjs/integrations/onuncaughtexception.js:12`) | Still exits |
| `@sentry/node@11.8.0` (latest, required by M1) | default `false` | Exits only when no other listener exists (source in `build/cjs/integrations/onuncaughtexception.js.map`) |

Other listeners will exist:
- the app's own (`pages/_app.jsx:25-27`);
- Next 16's router-server log-only listener, `process.on('uncaughtException', logError)` (`next16 dist/server/lib/router-server.js:719-722`).

So at Sentry ≥8 the process **stops exiting**. Pods keep serving after a fatal error, and restart counts drop. T-902 watches "pod restarts", so a drop would read as an improvement and hide the change.

**Also in the test harness.** The Playwright build sets `SENTRY_DSN=https://k@sentry.io/1` (40 §2.5). The test server therefore exits on any stray uncaught exception today. Expect flakiness, plus Sentry egress attempts.

**Recommendation:**
- Correct Q-009, R-055 and findings/05 S2.
- Add a risk for the Sentry ≥8 crash-semantics change, with a "keep behaviour" option: `onUncaughtExceptionIntegration({ exitEvenIfOtherHandlersAreRegistered: true })`.
- Add a test. Start `next start` with a DSN pointing at a local stub ingest, and use a test-only `--require` preload that throws from a timer. Assert exit code 1 within about 3 s on the baseline, and the same after every Sentry or Next bump.

---

### RH-03 (MEDIUM, SILENT network): Sentry ≥8 adds `sentry-trace` and `baggage` to every SSR fetch, and the parity contract cannot see it

**Code.** In `@sentry/node@11.8.0`, `build/cjs/integrations/node-fetch/undici-instrumentation.js:76-79` reads `if (!config.spans) { if (config.tracePropagation !== false && …) addTracePropagationHeadersToFetchRequest(…) }`. Headers are injected even with tracing off. `tracePropagationTargets` matches everything by default on the server.

**Affected SSR calls:**
- `api.core.ac.uk`, including the in-cluster path via `Internal_API`;
- `https://doi.org` (`api/outputs.js:28-51`);
- arbitrary repository logo hosts (`api/data-provider.js:31-34`).

**Why it is missed.** 40 §1 "Network (server)" compares only `Authorization`, `Accept`, `Content-Type` and `Host`. T-607 and T-104 record `Host`/`Authorization` only.

**Recommendation:**
- Record the full outbound header set in the MSW preload and the T-607 stub.
- Normalise only volatile values.
- When Sentry reaches ≥8, set `tracePropagationTargets: []` (keep behaviour) or record an explicit owner OD.

---

### RH-04 (MEDIUM, SILENT observability): logrocket 12 loads from hosts the CSP blocks

**Hosts.** The npm package's default hosts (the `// NPM package` branch in `dist/build.umd.js`) changed between versions:

| Version | Script | Ingest | Allowed by CSP? |
|---|---|---|---|
| 10.0.0 (repo) | `https://cdn.lgrckt-in.com` | `https://r.lgrckt-in.com` | Yes |
| 12.4.0 | `https://cdn.logr-in.com` | `https://r.logr-in.com` | No |

`csp.config.js:6` allows only `*.logrocket.com *.lgrckt-in.com`.

**Gap.** CS-LR-1 says "API calls unchanged". It lists `csp.config.js:6` but does not add the new host. After the bump the recorder script is CSP-blocked and sessions silently stop. T-904 is a manual check. T-720 only fires if the test network lets the request reach CSP evaluation.

**Recommendation.** Add a change site. Either add `*.logr-in.com` to `script-src`, `script-src-elem` and `connect-src` (keep behaviour), or pass `sdkServer`/`ingestServer` as the old `lgrckt-in` hosts. Add an assertion that LogRocket's script URL host matches a CSP source.

---

### RH-05 (HIGH, process gap): the deploy pipeline contradicts the wave procedure (soak, canary, rollback)

**Facts:**
- The remote default branch is `main` (`git ls-remote --symref origin HEAD` → `ref: refs/heads/main`).
- Locally, `origin/HEAD → master` is stale, and this session's tooling also names `master` as the main branch. `origin/master` holds legacy Container-Apps workflows: `prod-stg-deploy.yml`, with a 01:00 schedule that deploys `containerapp_deploy`.
- `.github/workflows/aks_stage_deploy.yml` has `schedule: '0 4 * * *'` and `actions/checkout@v4` with no `ref`.
- GitHub: "Scheduled workflows run on the latest commit on the default branch", and `GITHUB_REF` = the default branch (<https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows>). So **every night at 04:00 UTC stage is rebuilt from `main`, not from `stage`.**
- `aks_deploy.yml` rebuilds `main` and deploys prod at 03:00 UTC, and also on every push to `main`.

**Consequences for the 50 §4 wave steps:**

- Step 6, "T-902 soak 24 h incl. a nightly rebuild": the nightly rebuild **replaces** the soaked upgrade build on stage with `main`. Most of the soak then measures the old code.
- Step 8, "Prod canary (T-903)": no canary mechanism exists. The Deployment does a rolling update of all pods. The HTTPRoute has a single backend (`kube/prod/httproute.yaml:29-31`). Any merge to `main` goes to 100% of prod immediately.
- Rollback, "`kubectl rollout undo`": it is undone at 03:00 by the cron rebuild of `main` HEAD, unless `main` is reverted.
- PRs opened against `master` (as this session's tooling suggests) land on a dead branch.

**Recommendation.** Add a "Release mechanics" section to 50 and the README:

- The PR base is `main`.
- Upgrade builds go to stage through the `stage` branch, with the stage cron disabled or given `with: ref: stage` during the track.
- Freeze or guard the prod cron during waves.
- Make rollback mean "revert on `main` + workflow_dispatch".
- Implement the canary as a second Deployment/Service with weighted `backendRefs` on the HTTPRoute (Gateway API supports `weight`).

---

### RH-06 (MEDIUM, process gap): staging is not prod-equivalent for the risks T-902 is meant to catch

**Resources** (`kube/stage/deployment.yaml` vs `kube/prod/deployment.yaml`):

| | Stage | Prod |
|---|---|---|
| Replicas / scaling | `replicas: 1`, no HPA | HPA 4–15 |
| CPU request / limit | 1200m / 1500m | 300m / 600m |
| Memory limit | 1Gi | 768Mi |

**API routing.** The stage build uses `APP_ENV=staging` (`aks_stage_deploy.yml` build-arg), so `API_URL` = `https://api-stg.core.ac.uk/internal` (`env.config.js:11-13`).
- `api/internalize.js:24-25` rewrites only requests whose host equals `Internal_API_HOST=api.core.ac.uk`. So on stage the v3 SSR calls go to the public `api-stg` host and never take the in-cluster `Host` path that R-016 is about.
- The `lib/*-loader.js` URLs are hard-coded to prod `api.core.ac.uk` and do take it.

**Consequence.** R-048 (OOM at 768Mi, CPU throttling at 600m) and R-016 (in-cluster `Host` routing) cannot be validated by the stage soak as designed. T-905 (load) is P2.

**Recommendation:**
- Run the soak with prod-equal limits (temporary stage overlay) and with `APP_ENV=production`, or rely on a real weighted canary (RH-05).
- Move T-905 to P1 for W6 and W7.
- State this limitation in 40 §"residual risks".

---

### RH-07 (MEDIUM, weak test): the parity contract misses three cheap, high-yield detectors

**(a) `__NEXT_DATA__` / pageProps are never compared.** The 40 §1 SSR row compares head, meta, JSON-LD and landmark text only. Props serialisation is the silent seam between server and client:
- `pages/data-providers/[id].jsx:115-118` puts a raw `Error` (with a fetch `Response`, Blob and Headers) into `data.outputs.error`.
- Next only validates serialisability in dev. Next 16 `dist/server/render.js:696` checks `process.env.__NEXT_DEV_SERVER || isBuildTimeSSG`, the same as Next 10.
- So production `JSON.stringify` decides the shape.

Add T-608: deep-equal the normalised `__NEXT_DATA__` (`buildId`, seeded members) per route against the baseline.

**(b) Header values.** T-603 checks only `Cache-Control` "presence" and ignores `Vary` and `Content-Encoding`. Cloudflare sits in front (CSP lists `*.cloudflareinsights.com`), and its HTML caching depends on these values. Compare values for an HTML page, `_next/data`, a public file, `_next/static`, 404 and healthz. A concrete Next 10→16 value difference is UNCONFIRMED.

**(c) Server logs are not gated.** Next 16 now logs `uncaughtException:` and `unhandledRejection:` itself (`router-server.js:719-722`, `process-error-handlers.js`). Node 24 emits DEP warnings. Capture the `next start` stderr per run and diff it against an allow-list. That is the only place SSR-side regressions surface when the HTML still renders.

---

### RH-08 (MEDIUM, phase 6 SILENT + security): axios errors serialise secrets and in-cluster URLs into the public HTML

**Today.** The fetch-based `NetworkError` serialises to roughly `{name,response:{},data,type,status,headers:{}}`. `message` is not enumerable, and `Response`/`Headers` stringify to `{}`.

**With axios 1.20.** `AxiosError.toJSON()` (`lib/core/AxiosError.js:171-199`) returns `message`, `stack`, `config` (via `utils.toJSONObject`, with **no** default redaction), `code` and `status`.
- `config.url` is the **internalised** in-cluster URL (`http://core-frontend-api.core-frontend.svc.cluster.local/...`).
- `config.headers` includes `Authorization` and `Host`.
- If the phase-6 port keeps `Object.assign(data.outputs, { error })`, these land in `__NEXT_DATA__` of `/data-providers/<id>/` whenever the outputs call fails.

**Two more axios-vs-fetch differences missing from R-028 and OD-20:**
- axios honours the `HTTP(S)_PROXY`/`NO_PROXY` env vars by default; native fetch does not.
- axios uses Node's `http.globalAgent`, which has keep-alive on by default since Node 19, so the connection-reuse pattern changes.

**Recommendation:**
- Extend R-028 and OD-20.
- Add a phase-6 assertion (via T-608) that no route's HTML contains `svc.cluster.local`, `Bearer ` or a stack trace.
- Port errors to the same plain shape.

---

### RH-09 (MEDIUM, SILENT visual): Next's built-in 500 page changes, and the visual matrix does not cover it

There is no custom `pages/_error` (findings/02 §… "Custom `_error`: none"). Next's default error component differs between versions:

| | Next 10.2.3 | Next 16.4.2 |
|---|---|---|
| File | `node_modules/next/dist/pages/_error.js` | `dist/pages/_error.js:42-75` |
| Styles | font `-apple-system, BlinkMacSystemFont, Roboto…`, `color:#000;background:#fff`, bordered h1 with `padding:10px 23px 10px 0` | font `system-ui,"Segoe UI",Roboto…`, different paddings/margins/line-heights |
| Dark mode | none | adds `@media (prefers-color-scheme:dark){body{color:#fff;background:#000}…}` |

**Reachable 500s today:**
- Q-028 (`/data-providers/?q=100%25`: a URIError in SSR render; error boundaries don't run on the server);
- Q-029 (a Date object rendered);
- Q-039.

**Gaps:**
- The 07 §5 V-matrix has no SSR-500 row.
- V20 states "dark not supported in code". That becomes false for this page under Next 16.

**Recommendation:**
- Add V-rows for the SSR 500 page in light and dark `colorScheme`, plus the client "Application error" text.
- Open an OD: vendor Next 10's `_error` as `pages/_error.jsx` (keep behaviour), or accept the change.

---

### RH-10 (MEDIUM, mis-classified): OD-16 "keep `.browserslistrc` unchanged" does not keep the targets unchanged

**How the target list is decided.** `last 3 versions, not ie > 0, not op_mini > 0` is resolved through `caniuse-lite`.
- The lock pins `1.0.30001754`. Today it resolves to: chrome 140–142, safari 18.4–26.1, ios_saf 18.4–26.0, **ie_mob 10/11, bb 7/10, kaios 2.5, op_mini all**, … (`node node_modules/browserslist/cli.js`).
- So Babel and PostCSS emit ES5 plus polyfills/prefixes for dead engines.

**What changes it silently.** Any lock regeneration (CS-W0-4, CS-N12-4, every bump) moves caniuse-lite (latest 1.0.30001816). That changes:
- autoprefixer and postcss-preset-env output (the T-003 diff will show noise that tempts re-baselining);
- Babel and core-js output.

**What `.browserslistrc` does not control.** `node_modules` are not transpiled, apart from Next's own `dist/client|shared|pages`, which Next 16 does re-transpile (`dist/build/webpack-config.js:162-166`). So React 19, mobx, Sentry ≥8 and similar raise the real browser floor with no signal. R-065 is rated L/M and blames only "SWC or modern targets".

**Recommendation:**
- Record the resolved browserslist output in the baseline.
- Pin caniuse-lite via `overrides` for the whole track, and add a CI check that the resolved list is unchanged.
- Add `es-check` (or an equivalent) on the client chunks against the chosen ES level.
- Re-rate R-065 to M, and make OD-16 an explicit support-matrix decision based on GA browser share.

---

### RH-11 (MEDIUM, weak test): the visual and CSS detectors miss post-navigation and state styles, and T-003 normalisation can mask collisions

**(a) Only direct loads are covered.** T-801 shoots each route state on a direct load with the consent cookie. Pages-router CSS for the next page is inserted on client navigation; that is a classic source of order differences between a hard load and a soft navigation. No visual check exists after `/search → /works`, `/works → /search`, `/data-providers → /data-providers/<id>`.

**(b) Hover/focus/active styles are not checked.** These include the design Button focus ring (Q-066) and pill or menu hover states. A computed-style dump would catch them; a pixel test at rest does not.

**(c) T-003 can mask collisions.** T-003(d) normalises "class hashes stripped". Next's module class names are `<file>_<local>__<hash>`, and 20+ files are named `styles.module.css`. Stripping hashes merges unrelated selectors. Current module classes defined in several files:

| Class | Files |
|---|---|
| `.header` | 6 |
| `.container` | 6 |
| `.card` | 6 |
| `.pagination` | 6 |
| `.action-button` | 6 |
| `.label` | 5 |
| `.title` | 4 |

**Recommendation:**
- Add after-navigation screenshots for the journey pairs.
- Add a per-route `getComputedStyle` dump diff, including CDP-forced `:hover`/`:focus-visible`.
- Key T-003 by source file + local class.

---

### RH-12 (MEDIUM, open decision / design ownership): "pure CSS like the dashboard" is undefined, and a literal port causes collisions

**Dashboard.** `../dashboard/src` has **38 plain global `.css` files and 0 `.module.css`**.

**Search.** It has 26 CSS-module files with the colliding local names listed in RH-11. In the pages router, global CSS may only be imported from `_app`, so a literal port turns every class global with import-order cascade.

**Native-CSS gaps.** Native CSS has no `@custom-media` (R-008). Its nesting has `:is()` semantics.

**The plan.** README says the end state is "antd + plain CSS". OD-11 covers only camelCase access.

**Recommendation.** Add an OD defining "pure CSS":
- recommended: keep CSS Modules, drop PostCSS plugins with 0-px proof;
- or BEM-prefixed global classes with a collision check.

---

### RH-13 (MEDIUM, phase-7 plan gap): antd 6 SSR style extraction on the pages router is not planned

**What antd requires** (<https://ant.design/docs/react/use-with-next>, Pages Router):
- a `pages/_document` whose `getInitialProps` wraps `renderPage` with `StyleProvider` + `createCache()`;
- injecting `extractStyle(cache, true)`;
- `@ant-design/cssinjs` at antd's exact version.

**What happens without it:**
- SSR HTML has no antd styles: a flash of unstyled content on every load, and pixel tests that pass only after JS runs;
- the crawler HTML is unstyled.

**Why it is not trivial here:**
- Search has **no** `_document` today (Q-054). Adding one changes the document shell, including `<html>` attributes.
- The dashboard is a Vite SPA, so its antd setup cannot be copied.
- antd's `:where()` zero-specificity output interacts with CSS-module order.
- Runtime `<style>` injection relies on `style-src 'unsafe-inline'`.

**Recommendation.** Add these to the phase-7 section of 50 and to an OD. T-801 should also shoot with JS disabled, or at first paint, for antd pages.

---

### RH-14 (MEDIUM, version target): "latest TypeScript" (7.0.2) cannot satisfy M1 together with Next and typed ESLint

- **TypeScript 7.0.2** exports only `./lib/version.cjs` plus `unstable/*` (`npm view typescript@7.0.2 exports`). There is no `createProgram` API.
- **Next 16.4.2** type-checking calls `typescript.createIncrementalProgram`/`createProgram` (`dist/lib/typescript/runTypeCheck.js:100-110`).
- **typescript-eslint** 8.71.2 has peer `typescript >=4.8.4 <6.1.0`.
- **The dashboard** pins `~5.9.3`.
- **OD-07** covers timing only.

**Recommendation.** Target TS 6.0.x with an M1 justification. Add a later step to reach 7.x when Next and typescript-eslint support it, or use `tsc` 7 for `--noEmit` with Next's built-in check disabled.

---

### RH-15 (MEDIUM, SILENT, data-dependent): Node 24 TLS policy can silently drop repository logos; mocked tests cannot see it

**Node 24 policy.** M1 requires Node 24, the latest LTS; the plan targets 22. Node 24 uses OpenSSL 3.5 security level 2. RSA/DSA/DH keys below 2048 bits and RC4 suites are prohibited (<https://nodejs.org/en/blog/migrations/v22-to-v24>).

**Affected path.**
1. SSR on `/data-providers/<id>/` calls `checkLogo` (`pages/data-providers/[id].jsx:79-82`).
2. That calls `fetchLogo` against arbitrary institutional logo URLs (`utils/data-providers-transform.js:24-33` → `api/data-provider.js:31-34`).
3. A TLS failure is swallowed, the logo becomes `null`, and the default logo renders.

**Why tests miss it.** MSW and the stub servers mock away TLS, so no planned test can detect this.

**Recommendation.** Add a one-off probe script for the Node-24 wave. It should TLS-connect to every distinct member logo host from the data snapshot, plus `doi.org`, under Node 22 and Node 24, then diff the failures.

---

### RH-16 (MEDIUM, missing quirk / mis-specified test): the post-hydration and after-navigation SEO head will change, and T-708 asserts the ideal rather than today's behaviour

**Next 10 (today).** The head-manager is positional (`node_modules/next/dist/client/head-manager.js`, `updateElements`):
1. It walks `next-head-count` previous siblings.
2. It removes `meta`/`script` nodes in that window that are not equal to new **typed** head components.
3. The custom `<Meta>` element (`modules/meta/index.jsx`) is not typed `meta`, and it expands to N+1 DOM nodes while counting as 1.
4. So at hydration Next 10 very likely removes some `citation_*`/`DC.*` tags and the JSON-LD script from `document.head`, and duplicates charset/viewport.

UNCONFIRMED at runtime; derived from the code.

**Next 16.** `_document` clones top-level head children with `data-next-head` (`dist/pages/_document.js:443-452`). `<Meta>` receives the prop and does not forward it, so its tags are never managed (`dist/client/head-manager.js:50-63`). They stay after hydration, and also stay stale after a client navigation from A to B.

**The test.** T-708 asserts "same tag set as T-602 (none removed)". That is the intended behaviour, not a characterization of today's.

**Why it matters.** Googlebot renders JavaScript, so this is SEO-relevant.

**Recommendation:**
- Capture the T-708 baseline from the running Next 10 app, both after hydration **and** after a client navigation.
- Record the result as a quirk.
- Let the owner decide whether the Next 16 behaviour counts as an accepted D1a change.

---

### RH-17 (LOW-MEDIUM, weak test): the T-901 container smoke does not use the k8s runtime environment

**Environment mismatch.** k8s overrides the image `NODE_OPTIONS` with `--max-old-space-size=1024` (`kube/prod/deployment.yaml:40-41`), and adds `UV_THREADPOOL_SIZE=32`, the `Internal_API*` variables and a 768Mi memory limit. A plain `docker run` of the image keeps `--openssl-legacy-provider` and has no memory limit.

**Build context.** There is no `.dockerignore`, and a local `.next/` (with `cache/`) exists. So local T-901 builds copy the webpack persistent cache and `node_modules` into the context.

**Recommendation.** Run T-901 with `--memory 768m`, the exact env list, and a context built from `git archive`.

---

## Resolved [VERIFY] items

| Item | Answer | Evidence |
|---|---|---|
| Q-022 / T-104: does Node 18 honour the `Host` override in native fetch? | **No.** Node 18.20.8, 20.19.0, 22.18.0 and 24.18.1 all send the connection host. The outbound header set is otherwise identical: `connection: keep-alive`, `accept-language: *`, `sec-fetch-mode: cors`, `user-agent: node`, `accept-encoding: gzip, deflate`. | `exp/risk-hunter/host-test.js` run with each nvm Node |
| Does Next 10 use native fetch on Node 18? | Yes. | `node-polyfill-fetch.js`: `if(!global.fetch){global.fetch=_nodeFetch…}` |
| R-006: `process.on` in the browser under webpack 5 | Likely a non-issue on Next 16 webpack. The client `process` resolves to `next/dist/build/polyfills/process` → `next/dist/compiled/process`, whose `.on` is a no-op. Keep T-701; consider rating it C/L. | `next16 dist/build/webpack-config.js:601-604,1652-1663`; `dist/compiled/process/browser.js` (`.on=noop`) |
| Server query parsing: Next 10 `url.parse(…,true)` vs Next 16 WHATWG `URLSearchParams` | 21 edge inputs give identical results. Covered: `+`, `%2B`, lone `%`, `100%`, invalid UTF-8, latin-1 `%E9`, overlong, repeated keys, empty, `=x`, `;`, `%u`, NUL, emoji, `%zz`. The only difference: a `__proto__=` key is dropped on Next 16. | `exp/risk-hunter/qs-diff.js`; `next16 dist/shared/lib/router/utils/parse-url.js`, `querystring.js:58-74` |
| CS-N13-1/2: does Next 16 still support `legacyBehavior`? | Yes, deprecated. It logs `errorOnce('legacyBehavior is deprecated…')` in dev, so add that to the T-701 dev allow-list. | `next16 dist/client/link.js:137,264-286,407` |
| Does Next 16 CSS chunking reorder pages-router CSS? | No. `CssChunkingPlugin` skips chunks named `pages/*`. | `dist/build/webpack/plugins/css-chunking-plugin.js:45` |
| R-045: does Next 16 validate props serialisation in prod? | No, dev and build-time SSG only, as in Next 10. | `next16 dist/server/render.js:696` |
| Do the rewrite/header patterns compile on Next 16? | Yes. `/:path(.*)` and `/static/:path*` both work with Next 16's path-to-regexp. | `node -e` against `dist/compiled/path-to-regexp` |
| Static 404 with a custom App `getInitialProps` | Logic unchanged: `useStaticPages404 = !customAppGetInitialProps && …`. | `next16 dist/build/index.js:1712` vs Next 10 `build/index.js` |
| R-002: is the `getDataHref` call site still an instance call? | Yes. `this.pageLoader.getDataHref({...})` with an object param (`router.js:1405,1521,1710,1770`; `page-loader.js:100-114`). The patch's single-arg forward works mechanically. Whether the `/search/_next/data` rewrite reaches the data handler is still open (R-002 / T-604). | — |
| Node 21+ global `navigator` on the server | No server-side branch in search or its runtime deps flips on it (only `navigator.product==='ReactNative'` in logrocket). | `rg 'typeof navigator'` over deps |
