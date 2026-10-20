# 02 — Next.js framework-level audit (search)

Auditor scope: Next.js framework, build toolchain, SSR data flow, routing contract, build/deploy pipeline.
Mode: read-only audit. Baseline commit `f5cfc20` (main). All `file:line` refs are against that tree.

**Installed baseline (node_modules, verified):** next **10.2.3** (the `^10.0.3` range resolved to it), react/react-dom **17.0.2**, mobx 6.13.7, mobx-react-lite 3.4.3, next-images 1.8.5, @zeit/next-source-maps 0.0.3 (package.json lists **both** `0.0.4` in deps and `0.0.3` in devDeps), @oacore/design 5.0.74 (declared as `"latest"`), core-js 3.42.0, node-fetch 2.6.1 (transitive, via next@10 only), @sentry/node and @sentry/browser 5.30.0.
**Bundler today: webpack 4.** Next 10.2 turns on webpack 5 only for apps with no custom `webpack()`; this app has one. You can see it in the build output: `.next/server/ssr-module-cache.js` exists (webpack 4 layout), and the Dockerfile needs `NODE_OPTIONS=--openssl-legacy-provider` (Dockerfile:23) because webpack 4 uses md4 hashing, which breaks on Node 17+.

---

## 0. Executive summary

* The jump is really **two upgrades in one**: Next 10→16, and **webpack 4→5→(Turbopack)** plus **React 17→18(→19)**. Most of the breakage is in build plumbing (`next.config.js` webpack hacks, next-images, Babel), the private-API monkey-patch of the router (`pages/_app.jsx:70-98`), and SSR/hydration strictness in React 18.
* The **routing/asset contract is shared with the Kubernetes Gateway** (`kube/*/httproute.yaml`). Three things only work because Next config and the gateway agree: `/static/search` → `/`, `/search/_next/data` → `/_next/data`, and `/display` → `/outputs`. Any Next change that touches assetPrefix, data-URL generation or rewrite resolution must be tested **through a gateway-equivalent proxy**, not just against `next start`.
* **Dev mode never server-renders** (`pages/_app.jsx:148-155`). Only a production build (`next build && next start`) exercises SSR and hydration, so every safety test must run against a production build.
* Several **existing bugs/quirks** must be pinned by characterization tests *before* the upgrade. Otherwise "fixed" or "changed" behaviour will look like a regression, or a real regression will be dismissed as a quirk. See §2.6.

---

## 1. Inventory of Next.js APIs and features in use, with per-major impact

### 1.1 Feature matrix (where used)

| Feature | Sites | Notes |
|---|---|---|
| `App.getInitialProps` (custom `_app`) | `pages/_app.jsx:125-137`, re-attached on dev wrapper `:154` | Runs on **every** server request, and on the **client** for client-side navigations to pages without gSSP (`/outputs/update/`, `/404`, `/error-card/`). It turns off Automatic Static Optimization for the whole app. |
| `getServerSideProps` | `pages/search/index.jsx:18-111`, `pages/works/[id].jsx:19-120`, `pages/outputs/[id].jsx:43-102`, `pages/data-providers/index.jsx:14-31`, `pages/data-providers/[id].jsx:60-122` | gSSP `redirect` (`search:19-27`, returned **together with `props: {}`**), `notFound` (`data-providers/[id].jsx:67-71`, and `:91-96` returned **together with `props`**). |
| `getStaticProps` / `getStaticPaths` | none | |
| Page `getInitialProps` | none | |
| `next/router` `useRouter` | `_app.jsx:7,48,88`, `hooks/use-sync-url-params-with-store/index.js:2,7`, `hooks/use-analytics.js:2,9`, `templates/output/index.jsx:4`, `templates/output/report/report-success-modal.jsx:2`, `templates/search/{pagination,results,index}.jsx`, `templates/data-providers/hooks/use-claim-controller.js:2`, `templates/data-provider/{pagination.jsx,hooks/use-state-to-url-effect.js}`, `pages/{search/index,works/[id],outputs/[id],data-providers/[id]}.jsx` | `useRouter()` is called **inside `.map()`** at `templates/search/results.jsx:30` (hook in a loop). |
| `Router` singleton (`import Router from 'next/router'`) | `store/search.js:2,93-117`, `store/filters.js:2,174-195,235-245,334-340` | Used in MobX actions (client only). `store/search.js:93` **mutates** `Router.query` (`delete Router.query.id`). |
| `router.events` | `_app.jsx:55-65` (start/complete/error), `hooks/use-analytics.js:41-47`, `hooks/use-sync-url-params-with-store/index.js:63-68` | All inside `useEffect`, so they are Next 11-compliant. |
| `router.push/replace` with `as` + `shallow` | `hooks/use-sync-url-params-with-store/index.js:32-43` (object href + string `as` + `{shallow:true}`), `templates/data-provider/hooks/use-state-to-url-effect.js:17` (**dead code**, nothing imports it) | `query: { ...router.query, ...urlParams }` at `:38` spreads a `URLSearchParams` instance, which contributes nothing. The real query comes from `as`. |
| `router.pageLoader.getDataHref` (**private API monkey-patch**) | `pages/_app.jsx:70-80`, enabled in production only at `:93-98` | See §1.3 and Risk R1. |
| `next/link` | `templates/data-provider/pagination.jsx:4,72-128` (4× `<Link passHref shallow><Button tag="a">`), `templates/data-providers/result-card.jsx:3,20-24` (`<NextLink>` wrapping design-system `<Link>` that renders `<a>`, no `passHref`) | Breaks in 13+ unless `legacyBehavior` is added or the code is migrated. |
| `next/head` | `main/head.jsx:2-25` (default title + favicons), `modules/title/index.jsx:2,11-13`, `pages/search/index.jsx:151-153`, `pages/works/[id].jsx:143-146`, `pages/outputs/[id].jsx:127-130`, `pages/data-providers/index.jsx:84-98` (title, description, inline JSON-LD) | `pages/works/[id].jsx:145` / `outputs/[id].jsx:129` put a **custom component `<Meta>`** (`modules/meta/index.jsx:142-148`) inside `<Head>`. That works in SSR only; Next's client head-manager ignores non-DOM element types, so meta tags are not updated on client navigation. SEO depends on SSR HTML. |
| `next/dynamic` (`ssr:false`) | `modules/map/index.jsx:2,7-9` (Leaflet) | Stable through 16 in the pages router. |
| `next/image` | none | |
| `next-images` (static asset imports return URL **strings**) | plugin `next.config.js:3,106`; import sites: `templates/output/update/index.jsx:11-12`, `templates/output/report/report-success-modal.jsx:7-8`, `templates/search/index.jsx:12,15,16`, `templates/error/query.jsx:4`, `templates/data-provider/logo.jsx:4`, `templates/data-provider/index.jsx:5`, `templates/data-provider/claim/claim-success-modal.jsx:5-6`, `modules/dropdown/index.jsx:12`, `pages/error-card/index.jsx:4` | 14 imports. Next 11+ built-in static imports return **objects**. |
| API routes | `pages/api/healthz.js:4-6` | Used by all k8s probes as `/api/healthz/` (with trailing slash). |
| Custom `_document` | **none** | So there is no `<html lang>`. Default document. |
| Custom `_error` | none (built-in) | Custom `pages/404.jsx:5-12`. |
| `rewrites()` | `next.config.js:15-27` | `{source: dataPath.source → /_next/data/:path*}` (`utils/helpers.js:4-25`; source = `/search/_next/data/:path*` when `NODE_ENV=production`, otherwise identity) and `/static/:path* → /:path*`. |
| `headers()` | `next.config.js:28-35` | CSP on `/:path(.*)` from `csp.config.js`. |
| `env` (build-time inlining) | `next.config.js:12` ← `env.config.js:25-32` | `API_URL`, `API_KEY`, `SENTRY_DSN`, `GA_TRACKING_CODE`, `BUILD_TARGET`. **`API_KEY` is inlined into the client bundle** (`api/index.js:13-14,39`). Validation throws at config load if `API_URL` or `API_KEY` is missing (`env.config.js:19-22,34`), and that also happens at `next start`. |
| `publicRuntimeConfig` / `serverRuntimeConfig` / `getConfig` | none | Good: these were removed in 16. |
| `trailingSlash: true` | `next.config.js:11` | Next issues a 308 redirect for non-slash URLs. |
| `assetPrefix` | `next.config.js:13` = `utils/helpers.js:1-2` → `/static/search` when `BUILD_TARGET=azure` (Dockerfile default `ARG BUILD_TARGET=azure`, Dockerfile:2) | |
| custom `webpack()` | `next.config.js:37-103` | `config.node = {fs:'empty'}` (`:39-43`), CSS-module camelCase hack (`:45-77`), aliases (`:86-100`). |
| Plugins | `next-images`, `@zeit/next-source-maps` (`next.config.js:106`) | Both are webpack-only. |
| Custom Babel | `babel.config.js:1-32` | Turns off SWC in Next 12+. It does **not** include the `next/babel` preset. |
| Custom PostCSS | `postcss.config.js:1-25` | Replaces Next's default PostCSS pipeline (autoprefixer, flexbugs). |
| Middleware / i18n / basePath / images config / `output` | none | |

### 1.2 What changes per Next major, mapped to exact code sites

| Major | Breaking change (official guide) | Affected code here | Action |
|---|---|---|---|
| **11** | webpack 5 default; the webpack 4 opt-out still exists in 11 but is removed in 12 | `next.config.js:39-43` `config.node = { fs: 'empty' }` is **invalid in webpack 5** (schema error: `configuration.node has an unknown property 'fs'`). The CSS hack (`:50-77`) depends on the internal rule shape. `@zeit/next-source-maps` sets `devtool` (webpack-4 era plugin). | Replace with `config.resolve.fallback = { ...config.resolve.fallback, fs: false }`, or better, remove the client import of `lib/loader.js` (§2.3). Replace the source-maps plugin with `productionBrowserSourceMaps: true`, if public source maps are wanted (today they are emitted by the plugin; check). |
| 11 | Static image imports. `next-images` users must set `images.disableStaticImages: true` | All 14 import sites in §1.1 (`<img src={broken}>`, `pages/error-card/index.jsx:9`, and so on). Without it they render `[object Object]`. | Add `images: { disableStaticImages: true }` while keeping next-images, **or** drop next-images and use `.src` at all 14 sites. |
| 11 | React ≥ 17.0.2 | Installed version is 17.0.2. | OK. |
| 11 | `router.events` must not be accessed during render | Already in `useEffect` everywhere. | OK. |
| 11 | `distDir` cleaned by default | Dockerfile copies `public/design/icons.svg` **after** `next build` (Dockerfile:24-27). That is in public/, not .next, so unaffected. | OK. |
| **12** | webpack 4 removed; SWC replaces Babel **unless a Babel config exists** (then Babel is used as in 11) | `babel.config.js` keeps Babel. Next 12 bundles `node-fetch` internally, so it is **no longer hoisted to `node_modules/node-fetch`**. | `data/data-loader.js:5` `require('node-fetch')` → **build breaks** (`Cannot find module 'node-fetch'`). Switch to global `fetch` (Node 18+). |
| 12 | Node ≥ 12.22 | Node 18 in the Docker image. | OK. |
| 12.2 | Middleware stable; router internals reworked | `_app.jsx:72-77` patches `pageLoader.getDataHref`. In **10.2.3** the signature is positional `(href, asPath, ssg, locale)` (verified at `node_modules/next/dist/client/page-loader.js:5`), but the patch forwards a **single arg**, so `asPath`/`ssg`/`locale` are dropped today. Later 12.x+ uses a single **object** `{href, asPath, ssg, locale, skipInterpolation}`. | The behaviour of the hack changes silently across majors. See R1. |
| **13** | React ≥ 18.2, Node ≥ 16.14 | All React rendering. | React 18 upgrade happens here (other auditors cover mobx-react-lite and the design system). |
| 13 | `next/link` renders `<a>` itself; an `<a>` child is invalid unless `legacyBehavior` | `templates/data-provider/pagination.jsx:72-128` (4×), `templates/data-providers/result-card.jsx:20-24` (1×). | Add `legacyBehavior` (minimal-risk step), or migrate: `<Link href className ...>` with no `<Button tag="a">`. With `legacyBehavior`, Next 13+ also attaches a **ref** and `onTouchStart`/`onMouseEnter` to the child. The design-system `Button`/`Link` must forward refs or you get warnings and no prefetch. |
| 13 | `next/image` → `next/legacy/image` | Not used. | — |
| 13 | `swcMinify` default true (minifier only; works even with a Babel config) | Whole client and server bundle. | Minifier change is low risk; covered by E2E/visual tests. |
| 13 | IE dropped, modern browserslist | `.browserslistrc` = `last 3 versions, not ie > 0, not op_mini > 0` | OK. |
| **14** | Node ≥ 18.17; `next export` removed | Docker `node:18-alpine` (any 18.x tag ≥ 18.17 is fine). | OK. |
| **15** | Pages router supports React 18 **or** 19; Node ≥ 18.18; `@next/font` removed; `bundlePagesExternals` renamed | Nothing directly. | React 19 is optional at this step. |
| 15 | (pages router) server-side `fetch` is Node's native undici (already true today on Node 18; Next 10 only polyfills if `global.fetch` is missing, see `node_modules/next/dist/next-server/server/node-polyfill-fetch.js`) | `api/index.js:111-120`, `lib/loader.js:31-34`, and the `Host` header override in `api/internalize.js:29` | No change versus today, but the **Node major** bump changes the undici version. The `Host`-header override must be re-verified (R9). |
| **16** | **Node ≥ 20.9** | `Dockerfile:1` `FROM node:18-alpine` | Base image to `node:20/22/24-alpine` (dashboard uses Node ≥ 24). |
| 16 | **Turbopack is the default for `next dev` and `next build`; with a custom `webpack()` config, `next build` FAILS** unless run with `--webpack` | `next.config.js:37-103`, plus the plugins `next-images` and `@zeit/next-source-maps` (both inject `webpack()`). | Step 1: `next build --webpack` / `next dev --webpack`. Step 2 (Turbopack): move aliases to `jsconfig.json` `paths`, replace next-images with built-in imports, replace the CSS camelCase hack (no equivalent; Lightning CSS), and turn `fs` fallback into `turbopack.resolveAlias` (or remove the client import). |
| 16 | Turbopack uses Babel automatically if a Babel config exists (`turbopackUseBuiltinBabel`), with SWC still doing Next internals and downlevelling | `babel.config.js` | Decorators keep working under Turbopack+Babel. The `core-js` usage injection still runs. |
| 16 | `serverRuntimeConfig`/`publicRuntimeConfig` removed; AMP removed; `next lint` removed | Not used. | — |
| 16 | `images.*` default changes | Not used. | — |
| 16 | No more `scroll-behavior` override on navigation; HMR path `/_next/webpack-hmr` → `/_next/hmr` | Check `main/global.css` and design CSS for `scroll-behavior: smooth`. Dev proxies only. | Low. |
| 16 | `next build` no longer prints size / First Load JS | The bundle-size budget test must use its own measurement. | Low. |

### 1.3 Private/internal API usage (high fragility)

1. **`router.pageLoader.getDataHref` override** (`pages/_app.jsx:70-80`, production-only `:93-98`, called conditionally, which breaks the rules of hooks but is stable because `NODE_ENV` is constant).
   *Purpose:* in production the browser sits on `core.ac.uk`, where `/_next/*` is **not** routed to this service (the gateway routes only `/search`, `/works`, `/outputs`, `/data-providers`, `/static/search`, `/display`: `kube/prod/httproute.yaml:13-65`). Client-side navigations to gSSP pages fetch `/_next/data/<buildId>/<page>.json`. The hack prefixes this with `/search`, so the gateway routes it here, and the Next rewrite `/search/_next/data/:path* → /_next/data/:path*` (`next.config.js:18-21`, `utils/helpers.js:12-16`) strips the prefix again.
   *Today (10.2.3):* only `href` is forwarded; `asPath` becomes `undefined`. For dynamic routes Next falls back to `query` interpolation, so it happens to work. Fragile.
   *Later 12.x through 16:* the object signature means the patch forwards correctly. **But** (a) whether a `rewrites()` destination may point at `/_next/data/...` is internal routing behaviour; the router-server was rewritten in 13.4 and again later, so it **must be verified**; (b) `pageLoader` may change shape or be renamed. If the patch silently stops matching (`router.pageLoader?.getDataHref` is undefined), the fallback is that the client fetches `core.ac.uk/_next/data/...` → 404 from another service → Next does a **hard navigation**. The site still "works" but every client navigation becomes a full page load, and there is no error. Only a network-level E2E test catches it.
   *Safer long-term alternative (independent of Next internals):* add a gateway rule `PathPrefix /search/_next/data` → `URLRewrite ReplacePrefixMatch /_next/data` and keep the client patch, **or** make the client always hard-navigate. Either way, decide explicitly.
2. **Webpack rule surgery for CSS modules** (`next.config.js:45-77`): finds `oneOf` rules by testing regexes against `'file.css'` / `'file.module.css'` and mutates `options.modules.exportLocalsConvention`. If Next changes the rule shape, the hack **silently no-ops** (`if (!styleRules) return config` at `:55`; the `filter` at `:65`; `if (cssLoaderConfig && cssLoaderConfig.options)` at `:73`). It has no effect at all under Turbopack. **178 kebab-case class selectors across 20 `.module.css` files** are read in JS via camelCase (for example `pages/error-card/styles.module.css:1 .container-inner` ↔ `pages/error-card/index.jsx:8 styles.containerInner`). If the hack stops applying, `styles.containerInner` becomes `undefined` → `class=""` → **the page renders unstyled with no build error**. Risk R2.
3. **`@sentry/node` alias** (`next.config.js:97`) uses `config.isServer`, which is **always `undefined`** (`isServer` is the destructured option on `:37`). So the **server bundle also gets `@sentry/browser`**. This is an existing bug. Fixing it during the upgrade changes server error-reporting behaviour; keep the two as separate commits.
4. **`react`/`react-dom` hard aliases to `node_modules`** (`next.config.js:98-99`). These were added for linked packages. With Next 13+ (which vendors React for the app router and sets its own `react-dom$`-style aliases), a directory alias can clash with `react-dom/client` / `react-dom/server.edge` resolution. Keep it only if the build passes, and verify there is exactly one React copy in the client bundle (R10).
5. **Design system writes into `node_modules`**: `design build` (the build script) regenerates `node_modules/@oacore/design/lib/config.js` with `publicPath: "/static/search"` and `iconsPublicPath: "/static/search/icons.svg"` (from `design.config.js:34-41`), and `Icon` reads it (`node_modules/@oacore/design/lib/elements/icon/icon.js:21`). The build relies on mutating an installed package. That breaks with pnpm/strict stores, Turbopack persistent caching of node_modules, or read-only layers.

---

## 2. SSR data flow

### 2.1 Request lifecycle (production)

```
Gateway (core.ac.uk) ──PathPrefix /search|/works|/outputs|/data-providers──▶ next start :8080
                     ──/display/* ─URLRewrite→ /outputs/*────────────────────▶
                     ──/static/search/* ─URLRewrite→ /*──────────────────────▶ (assets, _next/static, icons.svg, images/)

next start
 1. headers(): CSP on every response                              next.config.js:28-35
 2. trailingSlash 308 (/works/1 → /works/1/)                      next.config.js:11
 3. App.getInitialProps (server)                                  pages/_app.jsx:125-137
      getStatistics → getDataProviders → getMembers  (sequential awaits)
        lib/loader.js:62-77 readCache(fs.readFileSync data/.*.json) → hit → return
        miss → fetch internal API, 3 s timeout each (lib/loader.js:9,25-41), writeCache
      **return value is ignored**; statistics come from the build-time import
        `import cachedStatistics from 'data/.statistics.json'` (_app.jsx:12,130-132)
 4. page getServerSideProps (server only, tree-shaken from client)
      api/index.js performRequest → internalize() rewrites https://api.core.ac.uk → http://core-frontend-api... + Host header
 5. render: <CookiesProvider><ErrorBoundary><Main initialState={{statistics}}> (pages/_app.jsx:103-115)
      Main → useInitStore(initialState) → new RootStore per request on server (store/index.jsx:12-21)
      enableStaticRendering(isServer) (store/index.jsx:10)
      pages call useStore(initialState) → RootStore.extend({dataProviders}) once (store/index.jsx:28-38, store/root.js:37-40)
 6. __NEXT_DATA__ = { props: { statistics, pageProps } }
Client
 7. hydrate (React 17 ReactDOM.hydrate today); initStore creates the singleton store once (store/index.jsx:17-20)
 8. Search page copies pageProps.data into the MobX search store in useEffect (templates/search/index.jsx:46-50);
    SSR HTML is rendered from props, not the store, so results are in SSR HTML (templates/search/index.jsx:70-120)
```

### 2.2 Server vs client responsibilities and observations

| Concern | Detail | Ref |
|---|---|---|
| **Dev has no SSR** | In non-production, `NextApp` returns `null` on the server. `next dev` never server-renders, so hydration bugs, server-only crashes and SSR meta tags are **invisible in dev**. | `pages/_app.jsx:139-155` |
| `App.getInitialProps` also runs on the **client** | For client navigations to pages without gSSP (`/outputs/update/`, `/404`, `/error-card/`), it runs in the browser: `fs.readFileSync` is undefined (`fs:'empty'`), `readCache` catches it, then **3 sequential browser fetches** to `https://api.core.ac.uk/internal/{statistics,repositories/formap,members}` with a 3 s timeout each and no auth. They can delay navigation by up to 9 s, then results are discarded. | `lib/loader.js:43-51,25-41,62-77` |
| Statistics are **always the fallback string** | `data-loader` writes raw API JSON (`{"totalArticlesCount":…}`, see `data/.statistics.json`) but `_app` reads `cachedStatistics.data`, which is undefined, so `statistics = { totalArticlesCount: 'more than 356 million' }`. The search-bar label is always "Search more than 356 million from papers around the world". | `_app.jsx:130-132`, `data/data-loader.js:78` |
| Module-scope `process.on(...)` | Registers `unhandledRejection`/`uncaughtException` handlers on the **server** (which means the Node process **never crashes** on an uncaught exception) and on the **client** relies on the `process` polyfill's no-op `on`. A webpack 5 or Turbopack `process` polyfill without `.on` gives `TypeError: process.on is not a function` at `_app` load, which is a white screen. | `pages/_app.jsx:21-27` |
| LogRocket init in render | `LogRocket.init` runs on **every render**, including server render, in production. | `pages/_app.jsx:90-91` |
| `fs`/`path` in client graph | `lib/loader.js:1-2` is imported by `_app` (`_app.jsx:11`) and so ends up in the client bundle. This is why `config.node.fs='empty'` exists. | `next.config.js:39-43` |
| Large JSON in **client** bundle | `utils/data-providers-transform.js:1-2` imports `data/.formap.json` (**5.4 MB**) and `data/.members.json` (140 KB). It is imported by client components (`templates/search/results.jsx:6`, `templates/output/similar-works.jsx:5`, `templates/output/card-dropdown.jsx:6`, `templates/data-provider/index.jsx:19`, `store/similar-works.js:3`), so the formap ships to browsers (dev `_app.js` chunk is 23 MB). `pages/data-providers/index.jsx:4` imports it too (server-only via gSSP). | — |
| Server-side `fetch` + `Host` header | `api/internalize.js:16-33` sets `Host` on native undici fetch (Node 18). That behaviour belongs to Node/undici, not Next, but a Node major bump is part of the Next 16 path. | `api/internalize.js:29`, `kube/prod/deployment.yaml:50-53` |
| HTTP status of error pages | `/works/:id` and `/outputs/:id` API failures render `Error404` with **HTTP 200** (soft 404; no `res.statusCode`, no `notFound`). `/data-providers/:id` returns a real 404 (`notFound`). `/search` upstream error renders `ErrorCard` with 200. | `pages/works/[id].jsx:85-100`, `pages/outputs/[id].jsx:76-82`, `pages/data-providers/[id].jsx:67-71,90-96`, `pages/search/index.jsx:73-81,118` |
| `window`/`document` during render | No unguarded module-scope access found. Access is inside effects/handlers or guarded (`hooks/use-window-size.js:14-23`, `templates/data-providers/index.jsx:34`, `hooks/use-outside-click.js:9`). `Router` singleton use in stores is client-only (actions). | grep summary |
| Hydration-sensitive renders (React 18/19 throw recoverable errors and client-re-render) | `useWindowSize` gives width `undefined` on the server, so `siblingCount` 0 vs 2 (`templates/search/index.jsx:32,133`). Server `formatDate` uses `Intl` and `new Date()` in the container's TZ (UTC) vs the user's TZ (`templates/search/results.jsx:33-37`, `utils/helpers.js:27-40`). `router.asPath`-derived markup (`templates/output/index.jsx:81-86`, `templates/search/index.jsx:44`). `key={Math.random()}` (`templates/search/pagination.jsx:77`). `/display/*` is served as `/outputs/*`, so server `asPath`=`/outputs/..` while client `asPath`=`/display/..`. | — |

### 2.3 Node polyfills (webpack 5 removed automatic ones)

| Usage | Where | webpack 4 (today) | webpack 5 / Next 11+ | Turbopack / Next 16 |
|---|---|---|---|---|
| `fs` in client graph | `lib/loader.js:1` via `_app.jsx:11` | `node.fs='empty'` | `node.fs` invalid, so the build fails until it becomes `resolve.fallback.fs=false` | `turbopack.resolveAlias: { fs: { browser: './empty.js' } }`, or **remove the import from `_app`** (recommended) |
| `path` in client graph | `lib/loader.js:2,15` | node-libs-browser | Next provides a `path` browser fallback (verify) | verify |
| `process.on` | `pages/_app.jsx:21-27` | `process/browser` (has no-op `on`) | Next's `process` polyfill (verify `.on` exists) | verify |
| `Buffer` | none found | — | — | — |
| `node-fetch` | `data/data-loader.js:5` (build-time Node script) | hoisted from next@10 | **gone** from 12 (compiled into next) | gone |
| `AbortController`, global `fetch` | `lib/loader.js:26,31` | Node 18 globals | same | same |

### 2.4 Store hydration model
* Server: a new `RootStore` per request (`store/index.jsx:15`). Client: a singleton for the page lifetime (`:18-20`). `useStore(initialState)` extends **only once per component instance** and **only if `dataProviders` is not already set** (`store/root.js:37-40`). After a client navigation away from and back to `/data-providers`, the store keeps the old `dataProviders` and ignores the new `initialState`. That is current behaviour; keep it pinned.
* The search store is filled from props in `useEffect` (`templates/search/index.jsx:46-50`), so SSR does not depend on it.
* `observe()` wraps `observer` in an extra component (`store/index.jsx:43-46`).

### 2.5 gSSP return-shape edge cases (worth guarding when upgrading)
* `redirect` + `props` returned together (`pages/search/index.jsx:19-27`). Next 10 accepts this (props overwritten). Make sure newer versions don't reject it; easiest is to drop `props: {}`.
* `notFound: true` + `props` together (`pages/data-providers/[id].jsx:91-96`), where `props.error` is a non-serializable Error. It works because `notFound` short-circuits before serialization. Drop `props`.
* `limit` comes from the query and is passed to the API, but `offset` always uses 10 (`pages/search/index.jsx:30,39-44`). Keep this as a contract; don't "fix" it in passing.

### 2.6 Existing defects to pin with characterization tests (do NOT fix inside upgrade commits)
1. Statistics always show the fallback (`_app.jsx:130-132` vs the data-loader format).
2. `@sentry/node` is aliased to `@sentry/browser` on the server too (`next.config.js:97`).
3. `getDataHref` patch drops positional args on 10.2.3 (`_app.jsx:74-76`).
4. `templates/data-provider/pagination.jsx:87` calls `urlTo('PREVIOUS')` but the switch handles `'PREV'` (`:37`), so the "previous" arrow links to the **current** offset.
5. Soft-404 (HTTP 200) for missing works/outputs.
6. `pages/error-card/index.jsx` lives under `pages/`, so it is an accidental public route `/error-card/`.
7. `data/data-loader.js` fires `retrieveStats` without awaiting it (`:94-95`). A fetch failure becomes an **unhandled rejection that crashes the process (Node ≥15)** and fails `npm run build` (the `&&` chain), so a CORE API outage blocks deploys. The nightly cron rebuild (`.github/workflows/aks_deploy.yml:6-7`) makes this a daily exposure. `loadCachedStats` (`:38-53`, the 6 h freshness check) is dead code.
8. `useInterceptNextDataHref` and LogRocket init are called conditionally or per render (`_app.jsx:90-98`).

---

## 3. Webpack 4→5 / SWC / Turbopack impact

| Item | Location | webpack 5 (Next 11-15, or 16 `--webpack`) | SWC (drop Babel) | Turbopack (Next 16 default) |
|---|---|---|---|---|
| `config.node.fs` | `next.config.js:39-43` | **Build error** → `resolve.fallback` | n/a | `resolveAlias` or remove import |
| CSS-module camelCase hack | `next.config.js:45-77` | Probably still finds the rules (oneOf + css-loader names persist in 11-15), but the rule structure changed between 12/13/14. **Must assert in CI** (see T-BUILD-2). | n/a | **Not supported**. Turbopack ignores `webpack()`. Lightning CSS has no `exportLocalsConvention`. Options: (a) mechanically rename 178 selectors to camelCase in 20 files, or (b) access with `styles['container-inner']`. Either is a large diff; visual regression is mandatory. |
| Aliases | `next.config.js:86-100` | OK | OK | Move to `jsconfig.json` `compilerOptions.paths` (Turbopack reads tsconfig/jsconfig `paths`). The ESLint resolver (`.eslintrc.yml:13-16`) already uses `paths: ['.']`. Note `'config'` → `config.js`, which **does not exist** (dead alias). |
| next-images | `next.config.js:3,106` + 14 imports | Works on webpack 5 (v1.8.x supports it) **with** `images.disableStaticImages: true` | n/a | **Not supported** (webpack plugin). Migrate to built-in static imports (`import x from './a.svg'` → `x.src`). Asset URLs change from `/_next/static/images/<name>-<hash>.<ext>` to `/_next/static/media/<name>.<hash>.<ext>`, both under `assetPrefix`. |
| @zeit/next-source-maps | `next.config.js:4,106`, package.json (deps 0.0.4 **and** devDeps 0.0.3) | Deprecated; use `productionBrowserSourceMaps: true` | n/a | `productionBrowserSourceMaps` (`turbopackSourceMaps` defaults to it) |
| Babel: `@babel/preset-env` `useBuiltIns:'usage', corejs:3` | `babel.config.js:4-12` | Unchanged. Injects core-js imports into app files (server and client). | Lost. Next's own polyfills cover modern targets. **Pin with a smoke test on the oldest supported browser.** | Kept (Babel auto-used) |
| `@babel/plugin-proposal-decorators {legacy:true}` + `class-properties` | `babel.config.js:17-22` | Unchanged | SWC needs `jsconfig.json` `"experimentalDecorators": true`. MobX legacy decorators in `store/filters.js` (9× `@observable`, 15× `@action`, 2× `@computed`, `makeObservable(this, null)` at `:42`) and the custom `@invalidatePreviousRequests` in `store/{report,similar-works,search,filters,claim}.js`. Field-initializer semantics may differ (define vs set). **High risk for SWC**; keep Babel until the stores are refactored (other auditors cover MobX→Zustand). | Kept (Babel) |
| `@babel/plugin-proposal-export-default-from` | `babel.config.js:15`; used at `templates/output/hooks/index.js:1`, `templates/data-providers/hooks/index.js:1` (`export useX from './…'`) | Unchanged | **SWC parse error.** Rewrite the 2 lines to `export { default as useX } from` | Kept (Babel) |
| `add-react-displayname` | `babel.config.js:24` | Unchanged | Lost: affects React DevTools / error messages only (no runtime `displayName` checks on app components; design lib is precompiled with its own names) | Kept |
| `@babel/plugin-transform-runtime` | `babel.config.js:25` (recently added) | Unchanged | n/a | Kept |
| No `next/babel` preset in custom config | `babel.config.js:4-13` | Next 10-15 inject the gSSP-stripping/page-config plugins via their loader. **Verify gSSP code is still tree-shaken** (T-BUILD-3). JSX uses the classic runtime (`'@babel/react'`), so every file must `import React`. | n/a | SWC does Next internals |
| PostCSS | `postcss.config.js` | Next uses the user's config verbatim (no autoprefixer). `postcss-custom-media` `importFrom` (`:20-22`) was **removed in postcss-custom-media v9+**. `cssnano` 4 (old) + Next's own minifier. `postcss-extend-rule`. | n/a | Turbopack runs PostCSS (object form OK), then Lightning CSS. Decimal precision drops to 5 digits. CSS-module ordering follows import order. |
| browserslist | `.browserslistrc` | Used by preset-env and Next | Used by SWC | Next 16 floor: Chrome/Edge/Firefox 111+, Safari 16.4+ |
| `--openssl-legacy-provider` | `Dockerfile:23`, README:15 | Not needed on webpack 5 (remove after verifying) | — | — |
| `config.isServer` alias bug | `next.config.js:97` | Same bug | — | Needs `resolveAlias` with `browser` condition |

---

## 4. Routing contract (external; SEO + inbound links from other CORE sites)

### 4.1 Public URL surface (prod `core.ac.uk`, stage `stg.core.ac.uk`)

| Public URL | Gateway → app | Next route | Query params read | Response contract today |
|---|---|---|---|---|
| `/search` | → `/search` | 308 → `/search/` (trailingSlash) | — | 308 |
| `/search/` (no query) | same | `pages/search/index.jsx` | — | **308 permanent → `/`** (`:19-27`), which is the CORE homepage served by another service |
| `/search/?q=…&page=&limit=&sort=&t=` | same | same | `q`, `page` (1..1000; >1000 gives an empty result), `limit` (default 10), `sort` (`relevance` default; `recent`→`recency`), `t` (search-session id) | 200, SSR results, `<title>Search CORE</title>` (`:151-153`); upstream error → 200 ErrorCard; empty → 200 QueryError |
| `/works/:id/?t=` | → same | `pages/works/[id].jsx` | `t` | 200 with citation_* / DC.* meta + JSON-LD (`modules/meta/index.jsx`); error → **200** Error404 (410 shows API message) |
| `/outputs/:id/` | → same | `pages/outputs/[id].jsx` | client reads `source=oai`, `search=` from `asPath` (`templates/output/index.jsx:50,83-86`) | as above; 410 → "article … has been disabled" |
| `/display/:id/` | **URLRewrite → `/outputs/:id/`** (`kube/prod/httproute.yaml:50-65`) | `pages/outputs/[id].jsx` | as above | browser URL stays `/display/…`; client `asPath` differs from the server's |
| `/outputs/update/` | → same | `pages/outputs/update.jsx` (no gSSP) | — | 200 |
| `/data-providers/?q=&size=&action=ADD&dataProviderUrl=` | → same | `pages/data-providers/index.jsx` | `q`, `size` (number), `action` (`ADD`\|null), via schema `store/data-providers.js:5-20`; `dataProviderUrl` (`templates/data-providers/hooks/use-claim-controller.js:42-44`). All query keys flow into the store (`index.jsx:22-26`). | 200 + JSON-LD + description; client syncs params back to the URL (sorted, shallow, `replace` if no search else `push`) |
| `/data-providers/:id/?q=&offset=&limit=&sort=&t=` | → same | `pages/data-providers/[id].jsx` | `q`, `offset`, `limit`, `sort` (default `recency`), `t` | unknown id (not in formap) → **404**; metadata error → 404 |
| `/static/search/*` | **URLRewrite → `/*`** | public files + `/_next/static/*` | — | JS/CSS chunks (`assetPrefix=/static/search`), `/static/search/icons.svg` → `public/icons.svg` (copied in Dockerfile:25), `/static/search/images/*` → `public/images/*` (Dockerfile:26-27), next-images assets `/static/search/_next/static/images/*` |
| `/search/_next/data/<buildId>/<page>.json` | → same (PathPrefix `/search`) | rewrite → `/_next/data/…` (`next.config.js:18-21`, prod only) | — | JSON for client navigations (needs the `_app.jsx:70-98` patch) |
| `/api/healthz/` | **not** publicly routed; k8s probes only (`kube/*/deployment.yaml:65-86`) | `pages/api/healthz.js` | — | 200 `{"status":"ok"}`. Probe path has a trailing slash, so it must stay 200 and not 308. |
| `/`, `/404`, `/error-card/` | not routed publicly | `pages/index.js` (empty page), `pages/404.jsx`, `pages/error-card/index.jsx` | — | internal only |

**App-level rewrites:** `/static/:path*` → `/:path*` (`next.config.js:22-25`), which matters for local and non-gateway setups. `/search/_next/data/:path*` → `/_next/data/:path*` (prod).
**Headers:** CSP on all paths (`csp.config.js`). Production has no `'unsafe-eval'` in `script-src`, while `script-src-elem` allows `'unsafe-inline' 'unsafe-eval'`. Dev adds unsafe-* and localhost (`csp.config.js:64-73`). `headers()`/`rewrites()` are frozen into `.next/routes-manifest.json` **at build time** using the build-time `NODE_ENV`.
**Outbound/absolute URLs embedded in HTML:** `https://core.ac.uk/search/?…` (`templates/output/index.jsx:84`), `//core.ac.uk/data-providers/:id` (`modules/dropdown/index.jsx:51`), JSON-LD `https://core.ac.uk/reader/:id`, `https://core.ac.uk/image/:id/large`, `https://core.ac.uk/search?q=repositories.id:(…)` (`modules/meta/index.jsx:70-120`), favicons from `https://core.ac.uk/favicon/*` (`main/head.jsx:8-23`), reader link rewrite `core.ac.uk/reader/` → `api.core.ac.uk/reader-ui/` (`templates/search/results.jsx:52-54`).
**Client-side URL producers** (they must keep producing the same URLs): `pages/search/index.jsx:126-133`, `pages/works/[id].jsx:130` (`/search?q=` with no slash, normalised by the router), `pages/outputs/[id].jsx:113` (`/search/?q=`), `templates/search/pagination.jsx:20-26`, `store/search.js:96-117`, `store/filters.js:177-195,237-245,334-340`, `pages/data-providers/[id].jsx:44-55`, `templates/data-provider/pagination.jsx:26-51`, `hooks/use-sync-url-params-with-store/index.js:8-45`, `templates/search/results.jsx:43-50` (`?t=<searchId>-<id>&search=<raw query>`).

---

## 5. Build / deploy pipeline

| Stage | Detail | Failure modes / upgrade impact |
|---|---|---|
| CI trigger | `aks_deploy.yml`: push to `main` + **nightly cron 03:00** + manual. `aks_stage_deploy.yml`: push to `stage` + cron 04:00. Both on `ubuntu-24.04-arm`, `docker buildx --platform linux/arm64`. | Nightly rebuilds pull fresh API data and (via the `npm install` fallback) possibly a new `@oacore/design@latest`. **No test, lint or build check runs before deploy.** |
| Docker base | `node:18-alpine` (`Dockerfile:1`) | EOL. Next 16 needs ≥ 20.9. Alpine is musl + arm64, so Next 12+ needs `@next/swc-linux-arm64-musl` (optional dep) in the **lockfile**. A lockfile generated on macOS can omit other-platform optional deps (npm optional-deps bug). Then `npm ci` fails, the Dockerfile **silently falls back to `npm install`** (`Dockerfile:19`), and you get non-deterministic installs, or Next falls back to WASM SWC (**no Turbopack on WASM**). |
| Install | `npm ci --include=dev --legacy-peer-deps \|\| npm install …` (`:19`); `.npmrc` with GitHub Packages token written then removed (`:18-20`) | `\|\|` fallback hides lockfile drift. `@oacore/design: "latest"`. `--legacy-peer-deps` hides React-peer conflicts (it will mask React 18/19 peer mismatches). |
| Build args/env | `BUILD_TARGET=azure` (default), `SENTRY_DSN`, `NODE_ENV=production`, `APP_ENV` (`development` default; CI passes `production`/`staging`), `NPM_TOKEN`, `GA_TRACKING_CODE`, `API_KEY`, `ICONS_PUBLIC_PATH` (passed but **unused in code**; the design lib takes its icon path from `design.config.js`) | `API_KEY` is a **build arg** (visible in image history) and is also inlined into the client JS via `env`. `NODE_OPTIONS=--openssl-legacy-provider` (webpack 4). |
| `npm run build` = `node ./data/data-loader.js && design build icons && next build` (package.json scripts) | **data-loader**: scans `data/*.json` (committed: `.statistics.json`, `.formap.json` 5.4 MB, `.members.json`; `languages.json` has no URL), refetches each from the public `https://api.core.ac.uk/internal/...` **without auth**, overwrites the file. Not awaited; uses `node-fetch`. **design build**: writes `node_modules/@oacore/design/lib/config.js` and `public/design/icons{,.svg}` from `@mdi/svg`. **next build**. | data-loader: API outage → unhandled rejection → build fails. Partial refresh is possible (some files updated, others stale). Removing `node-fetch` (Next 12+) → build fails. Bundled JSON (imported at build) means data freshness = image age. |
| Post-build | `cp public/design/icons.svg public/icons.svg; cp -r public/static/images/* public/images/` (`Dockerfile:24-27`) | Asset contract for `/static/search/icons.svg` and `/static/search/images/*` via the gateway. |
| Runtime | `CMD next start -p 8080` (`:29`). k8s: probes `/api/healthz/`, `Internal_API`/`Internal_API_HOST` runtime env (`kube/*/deployment.yaml:45-53`), secrets via `envFrom`, `NODE_OPTIONS=--max-old-space-size=1024` (overrides the Dockerfile `NODE_OPTIONS`, so `--openssl-legacy-provider` is **not** set at runtime), limits 600m CPU / 768Mi (prod). | `next start` re-loads `next.config.js` and so re-runs `env.config.js` validation (needs `API_KEY` at runtime; the secret provides it). Memory: the large bundled JSON on the server times the per-request store is worth a soak test after the upgrade (Next 13+ server memory profile differs). |
| Envs | `env.config.js:3-17`: local `127.0.0.1:8000`, development `api-dev`, staging `api-stg`, production `api`. `APP_ENV` picks one. `rewriteDataPath` keys off **`NODE_ENV`**, not `APP_ENV`. | Stage and prod both build with `NODE_ENV=production` → `/search/_next/data` rewrite + LogRocket + GA on stage too. |

---

## 6. Recommendation (options, not a decision)

### 6.1 Incremental Next upgrade path (pages router throughout)

Every step: separate PR, full safety suite (§7) green against a **production build behind a gateway-equivalent proxy**, deploy to stage, soak, then prod. Keep Babel until step 7.

| Step | Target | Key changes | Gate |
|---|---|---|---|
| 0 | Safety net on **10.2.3** | Add tests T-* (§7) and record the golden SSR HTML, route/status matrix, visual baselines, and bundle manifest. Pin `@oacore/design` to the exact version. Remove the `npm ci \|\| npm install` fallback. | All baselines captured |
| 1 | 10.2.3 + **webpack 5** (`future.webpack5: true`) | `resolve.fallback.fs=false`; confirm the CSS hack still applies; next-images on webpack 5; drop `--openssl-legacy-provider`; replace `@zeit/next-source-maps` with `productionBrowserSourceMaps` | Byte-level CSS class-map diff = 0; visual diff = 0 |
| 2 | **11.1.x** | `images.disableStaticImages: true` | Same suite |
| 3 | **12.3.x** | data-loader to global fetch (fix the await while there, as a separate commit). Babel stays (auto opt-out of SWC). Verify the `getDataHref` patch under the new signature. | Data-navigation E2E (network assertion) |
| 4 | **React 18** on 12.3 | Others cover mobx-react-lite, design system, `ReactDOM.hydrate`→Next handles it | Zero hydration errors in console on all routes |
| 5 | **13.5.x** | `legacyBehavior` on 5 Link sites (or codemod `new-link`). Check the `react`/`react-dom` aliases. | Link click-through E2E; no nested-`<a>` warnings |
| 6 | **14.2.x** → **15.x** | Node ≥ 18.18 (base image to 20/22 here is safest). React 18 stays allowed. | Same |
| 7 | **16.x with `--webpack`** | Node ≥ 20.9; scripts `next dev --webpack`, `next build --webpack` | Same |
| 8 | 16.x **Turbopack** (optional; can be deferred indefinitely) | Remove `webpack()`: aliases → `jsconfig.json` paths; next-images → built-in imports (`.src`, 14 sites); CSS-module camelCase → rename selectors or bracket access (178 selectors / 20 files); `fs` → remove client import; sentry alias → `resolveAlias` with `browser`. Babel stays (auto). | Visual regression on every route × breakpoints; CSS-ordering check |
| 9 | (optional) SWC | Delete `babel.config.js`; `jsconfig` `experimentalDecorators` or the MobX refactor first; rewrite 2 `export x from` lines | Store unit tests |

### 6.2 Stay on Next.js vs move to a Vite SPA (dashboard stack)

| Dimension | Stay on Next (pages router, latest) | Move to Vite + React Router 7 SPA (like dashboard) |
|---|---|---|
| **SEO / SSR** | Keeps server-rendered `<title>`, `citation_*`, `DC.*` and JSON-LD on `/works`, `/outputs`, and search results in HTML. Google Scholar indexing depends on `citation_*` meta being in the **initial HTML**. Scholar does not reliably execute JS. | A pure SPA serves an empty shell, so meta and JSON-LD appear only after JS runs. To match SEO you need prerendering or SSR anyway (React Router 7 "framework mode" SSR, Vite SSR, or a prerender service). That reintroduces a Node server, so it is no longer "like dashboard". |
| Status codes | Can return real 404/410/308 from gSSP (today partly 200 soft-404) | Static hosting (nginx, as in dashboard: `dashboard/nginx/default.conf`) returns 200 for everything unless the edge has route-aware logic |
| Data fetching | gSSP calls the in-cluster API via `Internal_API` (no CF/gateway hop); `API_KEY` can be kept server-only (today it is not) | All calls from the browser to the public API. `API_KEY` exposure is unavoidable (already exposed today via `env`), with more CORS/CSP `connect-src` traffic and rate-limit exposure. |
| Rewrites / headers / CSP | Live in `next.config.js` (and the `_next/data` hack) | Move to nginx/gateway config. CSP becomes simpler (no Next inline `__NEXT_DATA__`), and the `/search/_next/data` hack disappears entirely. |
| Asset/prefix contract | `assetPrefix` + gateway rewrite must be preserved | Vite `base: '/static/search/'` (or similar) + gateway. Simpler, no data-path issue. |
| API routes | Only `/api/healthz` (trivial) | nginx health endpoint |
| Stack alignment | Diverges from dashboard (Next vs Vite, router APIs, data fetching); SWR/Zustand/antd still usable | Same stack and tooling as dashboard; one mental model |
| Upgrade effort / risk | Incremental, testable per step (§6.1); the framework churn (Turbopack, React) continues | Effectively a rewrite of routing, data loading, head management and SSR; big-bang risk unless done route-by-route behind the gateway (possible: the gateway already routes per path prefix) |
| Middle path | Pages router now; later **app router** per route with React 19 + RSC, `generateMetadata` for SEO; can coexist with pages | Vite SPA for interactive-only routes (`/outputs/update`, claim flows) while SEO routes stay SSR (Next or RR7 SSR). The gateway allows per-prefix split. |

**Facts that bear on the decision:** (1) `/works/:id` and `/outputs/:id` are SEO-critical landing pages with scholarly meta. (2) Search-result HTML is SSR'd today. (3) The gateway already allows routing per path prefix, so a mixed approach is operationally feasible. (4) Dashboard is an authenticated app with no SEO need, so its architecture is not evidence for search.

---

## 7. Painful parts, ranked by risk, with required safety tests

Test-type legend: **U** unit, **I** integration (supertest against `next start`), **E2E** Playwright (prod build behind a gateway-equivalent proxy such as nginx or Caddy replicating `kube/prod/httproute.yaml`), **VR** visual regression (Playwright screenshots), **SSR** SSR HTML snapshot (curl/supertest, normalised), **BUILD** build-output check.

| # | Risk | What can break | How it manifests | Required tests |
|---|---|---|---|---|
| **R1** | `_next/data` path hack (`_app.jsx:70-98` + `next.config.js:18-21` + gateway) | Router internals (getDataHref signature or name), router-server rewrite handling of `/_next/data` destinations (13.4+ rewrite), `buildId` path format | **Silent**: client navigations fall back to full page loads (or 404 JSON → hard nav). Loading bar flickers, MobX client state lost, analytics double counts. No console error. | **E2E (proxy)**: from `/search/?q=x` click pagination, sort, filter, a work, then back. Assert via `page.on('request')` that a `GET /search/_next/data/<id>/search.json?...` **200 JSON** happened and **no** document request occurred (`request.resourceType()==='document'` count == 1). **I**: `GET /search/_next/data/$BUILD_ID/works/1.json` → 200 JSON with `pageProps`. **U**: patched `getDataHref` returns the `/search`-prefixed href for static and dynamic routes. |
| **R2** | CSS-module camelCase hack (`next.config.js:45-77`); Turbopack/Lightning CSS | Rule shape change → hack no-ops; Turbopack ignores it | **Silent** unstyled components (`class=""` or `class="undefined"`) across 20 modules | **BUILD**: script that imports each `*.module.css` through the built CSS manifest, or greps the built JS for the camelCase keys (e.g. `containerInner`) present in the class map; fails if any of the 178 kebab selectors lacks a camelCase export. **SSR**: assert no `class=""`/`class="undefined"` in rendered HTML for all routes. **VR**: all routes × 3 viewports. |
| **R3** | Static image imports (next-images → built-in, 14 sites) | Next 11+ returns objects; Turbopack doesn't run next-images | `<img src="[object Object]">`, broken images on error, update and claim modals, search hero, logos | **SSR**: assert every `<img src>` in rendered HTML starts with `/static/search/_next/static/` or a known absolute host (no `[object`). **E2E**: no 404 image requests across routes incl. modals (open claim modal, report modal, error page). **BUILD**: built files exist for each imported asset. |
| **R4** | SSR SEO meta / JSON-LD / titles | next/head changes, custom `<Meta>` component inside `<Head>`, React 18 streaming differences, removal of App gIP | Google Scholar/Google lose `citation_*`, titles revert to default, JSON-LD missing | **SSR snapshot** (normalised: strip buildId, chunk hashes, nonce) for fixtures `/works/:id/`, `/outputs/:id/`, `/search/?q=…`, `/data-providers/`, `/data-providers/:id/`: exact set and order of `<title>`, `meta[name^=citation_]`, `meta[name^=DC]`, `script[type="application/ld+json"]` (parse JSON, deep-equal), favicons. Run against a **mock API** (msw/nock or a stub server on `Internal_API`) for determinism. |
| **R5** | Route/status/redirect contract (trailingSlash, gSSP redirect/notFound, soft-404, `/display` rewrite, healthz) | Next redirect status changes, gSSP shape validation, trailingSlash for API routes, middleware-era routing | SEO loss, broken inbound links, k8s probes failing (pods never Ready) | **I** table-driven: `GET` each URL in §4.1 (with and without slash, with query) and assert status, `Location`, and key body marker. Include `/search/` → 308 `/`; `/data-providers/999999999/` → 404; `/works/<bad>/` → **200** (current); `/api/healthz/` → 200 JSON; `/api/healthz` → 308. **E2E (proxy)**: `/display/:id/` renders the output page and client navigation from it works. |
| **R6** | React 18/19 hydration strictness (+ dev never SSRs) | Mismatches (window size, TZ dates, asPath, `/display`) become recoverable errors with full client re-render; under React 19 more errors surface | Flash of re-rendered content, lost scroll, console errors, possibly broken event handlers | **E2E**: on every route collect `console` errors/warnings and `pageerror`; fail on any `Hydration`/`did not match`/`Minified React error #418/#423/#425`. Run with `TZ=Pacific/Kiritimati` browser timezone vs `TZ=UTC` server to force date mismatches. Run the E2E suite **only on prod builds**. |
| **R7** | Build pipeline: data-loader / node-fetch / design build / install | Next 12 removes hoisted `node-fetch`; API outage; `npm ci` fallback; arm64-musl SWC binary missing from lockfile; design `latest` | Red nightly deploy; or a green build with **stale/partial data** or an unexpected design version | **BUILD** in CI (PR + nightly): `npm ci` (no fallback) on `linux/arm64` alpine; `node data/data-loader.js` against a mock server (success, 500, timeout) must exit non-zero on failure **or** keep the committed files (decide explicitly). Assert `@next/swc-linux-arm64-musl` resolves (Next ≥ 12). Assert `node_modules/@oacore/design/lib/config.js` contains `/static/search/icons.svg` after `design build`. Assert `public/icons.svg` exists after Docker build. |
| **R8** | `next.config.js` webpack-isms under 16 (Turbopack default fails the build with a webpack config); `config.node`; aliases; sentry alias | Build failure (loud) or wrong module resolution (quiet: e.g. `@sentry/browser` on server, duplicate React) | Build error; or runtime `Invalid hook call` (duplicate React); or Sentry not reporting | **BUILD**: `next build` must succeed with the intended bundler flag pinned in scripts. Bundle analysis asserts exactly **one** copy of `react` and `react-dom` in client chunks. Server bundle resolves `@sentry/node` (after the deliberate fix). **I**: SSR error path reaches the Sentry transport (mock DSN). |
| **R9** | Server fetch: `Internal_API` + `Host` header (`api/internalize.js`) under a new Node/undici | undici may ignore or forbid a custom `Host`; AbortController semantics | All SSR pages fail (500 or error pages) **only in cluster**, invisible locally | **I**: run `next start` with `Internal_API=http://127.0.0.1:<stub>` + `Internal_API_HOST=api.core.ac.uk`; the stub asserts it received `Host: api.core.ac.uk` and the bearer token. **Stage soak** before prod. |
| **R10** | `next/link` (5 sites) with design-system `Button tag="a"`/`Link` | Next 13 `<a>` nesting; `legacyBehavior` ref/prefetch; design components not forwarding refs/onClick | Nested `<a>` (invalid HTML → hydration error), links that do full reloads or nothing | **E2E**: data-provider pagination (first/prev/next/last) and data-providers result card navigate client-side (no document request) to the expected URLs. **SSR**: no `<a>` inside `<a>`. Characterize the existing PREV bug (§2.6-4). |
| **R11** | `App.getInitialProps` runtime behaviour (server fs cache; client-side triple fetch; process.on handlers; LogRocket in render) | Polyfill changes (`fs`, `path`, `process.on`), removal of App gIP changes static optimization and router hydration (`__NEXT_HAS_REWRITES` replace) | White screen (`process.on is not a function`), 9 s navigation stalls, server crash semantics change | **E2E**: client-navigate to `/outputs/update/` and assert no requests to `api.core.ac.uk/internal/*` (or pin the current count), no `pageerror`. **I**: kill the API stub and assert SSR still renders within the gateway timeout (30 s, `kube/prod/httproute.yaml:27-28`) and the statistics label equals today's fallback text. |
| **R12** | Babel → SWC (only if chosen) | Legacy decorators, `export x from`, define-vs-set field semantics, core-js polyfills | MobX stores non-reactive (filters/sort UI stops updating), parse errors | **U**: MobX store tests (filters toggle, sort, year range, `invalidatePreviousRequests` cancellation) asserting observers re-run. **E2E**: filter, sort and year interactions on `/search/`. Oldest-browser smoke (Playwright WebKit plus a Chromium version pinned at the browserslist floor). |
| **R13** | CSP | Next/React versions adding inline scripts/styles or `eval`; Turbopack runtime; dev overlay | Blank page in prod with CSP violations; GA/LogRocket blocked | **E2E**: listen for `securitypolicyviolation` (inject a listener via `page.addInitScript`) and fail on any. **I**: CSP header value snapshot per environment (`NODE_ENV=production` vs dev). |
| **R14** | PostCSS chain (`postcss-custom-media` `importFrom` removal, cssnano 4, Lightning CSS precision/order) | Media queries silently stop applying; minor numeric drift | Responsive layout broken at breakpoints | **VR** at 360/768/1280 widths for all routes. **BUILD**: grep built CSS for unresolved `@media (--` custom media (must be 0). |
| **R15** | Client bundle size (5.4 MB formap in client) and server memory | New bundler splits it differently, or a budget is exceeded | Slower TTI; pod OOM under the 768Mi limit | **BUILD**: bundle budget (gzip size per route from the build manifest; compare to baseline ±10 %). **Load/soak** on stage: RSS under limit at peak RPS. |

### Minimum CI gates before step 1
1. `lint` (existing) + `next build` in a **linux/arm64 alpine** container with `npm ci` only.
2. Integration route matrix (R5) + SSR meta snapshots (R4) against a mock API.
3. Playwright E2E behind a proxy replicating `kube/prod/httproute.yaml` (R1, R3, R6, R10, R11, R13).
4. Visual regression baseline (R2, R14).
5. Build-output checks (R2 class map, R3 assets, R7 icons/config, R8 single React, R15 budget).
