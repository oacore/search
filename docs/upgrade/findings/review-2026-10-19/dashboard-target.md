# Review: dashboard-target (phase 6-7 target conventions, M6)

Reviewer key: `dashboard-target`. Date: 2026-10-19. Plan under review: `docs/upgrade/` at `497ff4c` (app code = `f5cfc20`).
Read-only on search/dashboard/design/core-ui. All experiments are under `<scratch>/exp/dashboard-target/` (axios-exp, nextapp, tseslint-exp, husky-exp, ts7, next16). Nothing was installed in any repo.

Legend: **[RAN]** = I executed it and quote the output. **[SRC]** = read from source/dist code (path:line). **[REG]** = npm registry query today. **[WEB]** = official docs. **UNCONFIRMED** = not proven.

---------------------------------------------------------------------------------------------------

## 0. Verdict (one paragraph)

The plan treats "adopt the dashboard's libraries" as a library swap. It is not. The dashboard is a client-only Vite SPA; every one of its conventions (global per-component `.css`, module-singleton zustand stores, SWR with a mix of global+local config, axios with a Node/XHR default adapter, a root `tsconfig` that only holds `references`, a TS-only ESLint config, antd runtime styles inserted *before* app CSS) either **fails the build**, **silently changes SSR output**, or **silently changes request behaviour** in a Next pages-router SSR app. I reproduced eight of these on Next 16.4.2 / React 19.3.1 / antd 6.6.6 / axios 1.20.0 / swr 2.5.1 / zustand 5.0.15 / Node 18.20.8, 22.18.0, 24.18.1. Also: the dashboard is not on latest versions (M1), and the *latest* TypeScript (7.0.2) and ESLint (10.13.0) break typescript-eslint / the react-import-jsx-a11y plugin family today. The plan has no doc that defines the phase 6-7 conventions; `50-roadmap.md §5` is two table rows. Recommendation: add `NEW:70-target-conventions.md` (spec in §6 below) and the gap list in §7, and change the items flagged in the findings.

---------------------------------------------------------------------------------------------------

## 1. Verification of `findings/08-dashboard-reference.md`

| # | 08 says | Verdict | Evidence |
|---|---|---|---|
| 1 | HEAD `48e3466`, Vite 7 + TS 5.9 + React 19 + router 7 | OK | `git log -1` = `48e3466 2026-10-16`; `package.json` |
| 2 | "40 files import from zustand. 19 use middleware" | **WRONG: 22 files import zustand** (22 `create(` stores). 19 use `zustand/middleware` is right; `devtools` in 17 files; `persist` in 2 | `grep -rlE "from ['\"]zustand['\"]" src` = 22; `grep -rl "persist" src` = authStore.ts, fairCertificationStore.ts |
| 3 | "`useSWR` in 43 files, `swr/mutation` in 4" | OK (43 files import `swr`, 40 call `useSWR(`, 47 call sites) | grep |
| 4 | "Hooks opt into `swrDefaultConfig` (revalidation off, errorRetryCount 1)" | **INCOMPLETE and misleading.** 39 of 40 hooks spread `swrDefaultConfig` OVER the global `swrConfig` of `App.tsx`; the global keeps applying for every key not overridden: `keepPreviousData: true`, `compare: JSON.stringify`, `revalidateIfStale: true`, `errorRetryInterval: 5000`, `focusThrottleInterval: 5000`, `provider: () => new Map()`. `dedupingInterval` is 10000 globally but 0 locally. Global `revalidateOnFocus/Reconnect: true` is overridden to false locally. `useBadgesData.ts` does not spread it (focus revalidation ON, 10 s dedupe). The comment in `config/swr.ts:81` says "2 seconds" for 10000. Nothing in `src` uses `fallback`/`fallbackData` (no SSR pattern exists) | `config/swr.ts:71-126`; `grep -rn "fallback" src` (no SWR hits); `grep -L swrDefaultConfig` |
| 5 | "Global `fetcher` sets no-cache headers" | OK. Also `swr.ts` has `/* eslint-disable */` for the whole file (08 says so) | `config/swr.ts:1,20-27` |
| 6 | Direct `axios` imports outside `config/`: auth.service, 2 hooks, "2 features", ChangePassword | OK (6 files). **08 omits that `fetch(` is also used directly twice** (`features/Content/hooks/useWorksData.ts:81` with `VITE_APP_API_BASE_URL`, `useRorSuggestions.ts:64`), bypassing the axios instance and its 401 interceptor | grep |
| 7 | "axios `timeout: 900000`" | OK, **must not be copied** (see DT-07) | `config/axios.ts:12` |
| 8 | "Prettier is not configured; stray prettier@2.8.8 exists" | OK, and incomplete: `node_modules/@oacore/{prettier-config 1.0.6, eslint-config-base, eslint-config-react, stylelint-config-base, design}` exist as plain dirs (dated Mar 19 / May 5) but are in neither `package.json` nor `pnpm-lock.yaml` (`grep prettier pnpm-lock.yaml` = nothing). They are leftovers of an earlier npm install. The org's real Prettier preset is `@oacore/prettier-config`: `{trailingComma:'es5', semi:false, singleQuote:true, endOfLine:'lf', quoteProps:'consistent'}`, which **search uses today and the dashboard's code does not follow** (dashboard code uses semicolons) | `cat node_modules/@oacore/prettier-config/index.js`; `search/node_modules/@oacore/prettier-config/index.js` identical |
| 9 | "Husky 9: `.husky/pre-commit` runs `npx lint-staged`" | OK, **but the hook file still has the v8 shim** (`#!/usr/bin/env sh` + `. "$(dirname -- "$0")/_/husky.sh"`). Husky 9.1.7 prints "DEPRECATED ... They WILL FAIL in v10.0.0" from `.husky/_/husky.sh`. Do not copy the file; the v9 hook is just `npx lint-staged` | `.husky/pre-commit`; `.husky/_/husky.sh` |
| 10 | "eslint.config.js uses `tseslint.config([...])`" | OK, but `tseslint.config()` is **deprecated** in the installed typescript-eslint 8.57 ("ESLint core now provides this via `defineConfig()`") | `node_modules/typescript-eslint/dist/config-helper.d.ts:67-68` |
| 11 | "ESLint config applies to TS files only" | OK and has a consequence 08 does not draw: `lint-staged` passes `*.{js,jsx,ts,tsx}` but no rule block matches JS/JSX, so JS is linted with no rules. Search is JS/JSX until phase 6 ends, so the dashboard config lints nothing of search as-is | `eslint.config.js`, `package.json` lint-staged |
| 12 | "`@stores` alias points to a missing folder; Vite aliases `react`/`react-dom`" | OK | `tsconfig.app.json`, `vite.config.ts` |
| 13 | "usrn route declared twice" | OK (`routes/index.tsx:108-113` and `:138-141`) | read |
| 14 | "38 CSS files, 0 CSS modules, ~30 inline styles, kebab global classes" | OK. **08 does not say what "pure CSS" costs**: 12,545 CSS lines; 86 `import '...css'` lines for 38 files (the same file is imported from many components); 396 `.ant-*` selector occurrences in 25 files (113 distinct antd classes); 55 `!important`; 128 `@media` with literal px (the `--breakpoint-*` custom properties are unusable in `@media`; 0 `var()` in media queries) | greps |
| 15 | "core-ui peer `antd ^5.27.6`; dashboard resolves antd 6.3.2" | OK. Extra: pnpm links core-ui to antd 6.3.2 **and `@ant-design/icons@5.6.1`**, while antd 6.3.2 itself depends on `@ant-design/icons ^6.1.0` (nested 6.1.0 copy). So **two icon libraries load**; the antd 6 migration guide says icons >=6 is required. core-ui's `dist/core-ui.js` imports `antd` and `@ant-design/icons` (peers, not bundled) | `ls node_modules/.pnpm \| grep icons`; antd/package.json deps; core-ui dist head; [WEB] ant.design/docs/react/migration-v6 |
| 16 | "pnpm 9 in Docker/CI, core-ui engines pnpm>=10" | OK; Docker `node:24-alpine`, CI node 24, `pnpm/action-setup version: 9` | Dockerfile, `aks_deploy_prod.yml:116-125` |
| 17 | "`.cursor/rules` asks for SCSS" | OK. It is dead guidance: nothing in the repo is SCSS | `.cursor/rules/rule.mdc` |
| 18 | 08 says nothing about `@oacore/core-ui` HEAD vs 2.0.20 | New: the local `core-ui` repo HEAD (2026-09-24) exports `Header` (with advanced search presets doi/title/oai/issn), `Footer`, `Link`, `Carousel`, `defaultHeaderMenus`, `useCookie*`; the **installed 2.0.20 exports none of these**; tag v2.0.21 exists. See DT-05 | `core-ui/src/index.ts` vs `dashboard/node_modules/@oacore/core-ui/dist/index.d.ts`; `git tag` |

Also unverifiable by me: the dashboard `dist/` and `.next/` dirs are stale artefacts; I ignored them.

---------------------------------------------------------------------------------------------------

## 2. What the dashboard conventions actually are (as read)

- **Layout**: `src/{main.tsx,App.tsx,instrument.ts,config/,components/{Layout,common},features/<Name>/{<Name>.tsx,components,hooks,store,texts,types,utils,styles.css},guards,hooks,pages,routes,services,store,styles,utils}`. Alias `@/ @components @features @hooks @services @config @routes @styles @utils @types` (+ dead `@stores`). Imports mix `.ts` extensions and extensionless.
- **axios**: one instance `API` (`baseURL=env.IDP_URL`, `Content-Type: application/json`, custom header, `timeout: 900000`, `withCredentials`), a typed `http` wrapper, a 401 interceptor (substring `/internal/`, not `login_check`/`/logout`) that calls a registered handler (`config/auth401Handler.ts`) to avoid a circular import.
- **swr**: URL-string keys; global `fetcher` wraps `http.get` with no-cache headers; imperative mutation helpers in `config/swr.ts`; `useSWRMutation` in 4 files (CSV download via `responseType:'blob'`); SWR `onSuccess` mirrors data into zustand stores (e.g. `useWorksData.ts:99-110`); store reset during render (`useWorksData.ts:36-48`).
- **zustand**: module singletons `create<State&Actions>()(devtools(..., {name}))`; `persist` only in `authStore` (`auth-storage`, `partialize`) and Fair; selectors are not used (`const {a,b} = useStore()`).
- **antd 6**: `ConfigProvider theme={merge(coreTheme, localTheme)}` in `main.tsx`; **static** `message.*` calls (42 sites; no `App.useApp`, no `message.useMessage`), 2 `notification.*`; `Form.useForm` in 4 files; no locale prop; no `StyleProvider`; no `cssVar`/`hashed`/`layer` config.
- **CSS**: plain global `.css` per feature, kebab-case classes, `:root` custom properties in `styles/theme.css`, extensive `.ant-*` overrides, `!important` x55, inline `style={{}}` x30. Imported from any component (Vite allows this).
- **TS**: `tsconfig.json` = `{files:[], references:[app,node]}`; app config: `strict`, `noUnusedLocals/Parameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `moduleResolution:bundler`, `noEmit`; checked only by `tsc -b` inside `build`.
- **Tooling**: ESLint 10 flat (TS-only), no Prettier, husky 9 + lint-staged (`eslint --fix` only), **no tests, no PR workflow**.
- **Env**: `src/config/env.ts` reads `import.meta.env.VITE_*` and throws at import if `API_URL`/`IDP_URL` is empty.

Org architecture guide (`core-fe-architecture/index.html`): recommends React, TypeScript, antd, **"Pure CSS ... to extend or override Ant Design"**, zustand, SWR, axios, **React Router "replaces file-system-based routing"**, React Hook Form, LogRocket, ESLint+Prettier, Husky; principles "client-first logic", feature folders; `styles/` = "custom global CSS or module-specific CSS files"; `stores/` (plural, dashboard uses `store/`). Git history: commit `d010de4` (2025-08-04) "Migrate application from Next.js to React" - the guide was **changed from a Next.js guide to a client-first React guide**. A sibling scaffold `@dashboard/dashboard-next` (Next 15.4.5, app router, tailwind, axios/swr/zustand, one commit "Initial commit from Create Next App") was abandoned. So the org *chose to leave Next for the authenticated dashboard*; that rationale (no SEO need) does not apply to `search`. The guide's React Hook Form conflicts with D3; `module-specific CSS files` is compatible with keeping CSS Modules.

---------------------------------------------------------------------------------------------------

## 3. Registry state today (2026-10-19) vs dashboard vs plan [REG]

| Package | Latest | Dashboard installed | Notes |
|---|---|---|---|
| axios | 1.20.0 | 1.13.6 | |
| swr | 2.5.1 | 2.4.1 | 2.5.1 contains an `@experimental` `cacheData` SWRConfig option and `strictServerPrefetchWarning` (not in the dashboard's 2.4.1; do not use experimental APIs) |
| zustand | 5.0.15 | 5.0.11 | peer `react >=18` (no React 17) |
| antd | 6.6.6 | 6.3.2 | minors change visuals: mask blur on 6.0-6.2.x, off from 6.3.0; size enums renamed 6.3.0-6.3.2 [WEB migration-v6]. `hashed` still default true; `zeroRuntime` + `antd/dist/antd.css` exist since 6.0 |
| @ant-design/icons | 6.3.4 | 5.6.1 (direct) | antd 6.6.6 depends on `^6.3.4` |
| @ant-design/cssinjs | 2.1.2 | 2.1.2 (nested) | `StyleProvider layer`, `hashPriority`, `ssrInline` exist [SRC es/StyleContext.d.ts] |
| @ant-design/nextjs-registry | 1.3.0 | - | **App Router only**; pages router uses `_document` + `extractStyle` [WEB use-with-next] |
| react / react-dom | 19.3.1 | 19.2.4 | |
| next | 16.4.2 | - | Node >=20.9; **no `next lint` command** [SRC dist/cli lacks next-lint] |
| typescript | **7.0.2** | 5.9.3 (`~5.9.3`) | 7.x is the native compiler: `require('typescript')` returns only `{version, versionMajorMinor}` [RAN ts7/x/package/lib/version.cjs]; TS 6.0.3 is the last JS-API line; npm `@typescript/typescript6` 6.0.2 |
| typescript-eslint | 8.71.2 | 8.57.0 | peer `typescript >=4.8.4 <6.1.0`; **hard-fails on TS 7** [RAN] |
| eslint | 10.13.0 | 10.0.3 | engines `^20.19 \|\| ^22.13 \|\| >=24` |
| eslint-plugin-react / -import / -jsx-a11y | 7.37.5 / 2.32.0 / 6.10.2 | - | peers cap at ESLint **9** (`^9.7`, `^9`, `^9`): none supports ESLint 10; `eslint-config-next@16.4.2` bundles all three |
| eslint-plugin-react-hooks / -react-refresh | 7.1.1 / 0.5.7 | 7.0.1 / 0.5.2 | both ESLint 10 ok |
| @babel/eslint-parser | 8.0.7 (needs `@babel/core ^8`); 7.29.9 (eslint <=9) | - | the repo needs a Babel-aware parser while decorators exist |
| @babel/core / preset-env | **8.0.7** | - | Babel 8 **removed `useBuiltIns`** [RAN: "The 'useBuiltIns' option has been removed. Please use babel-plugin-polyfill-corejs3"] |
| prettier | 3.9.10 | none | |
| husky / lint-staged | 9.1.7 / **17.6.0** | 9.1.7 / 16.3.3 | lint-staged 17 needs Node >=22.22.1; 16 needs >=20.17; 15 >=18.12 |
| @sentry/react / @sentry/nextjs | 11.8.0 / 11.8.0 | 10.49.0 | engines Node >=20.19 \|\| >=22.12; `@sentry/nextjs` peer `next ^16.0.0-0` |
| react-router / react-router-dom | 8.5.0 / 7.18.4 | 7.13.1 | not applicable to Next |
| stylelint | 17.16.0 | - | engines >=20.19 |

---------------------------------------------------------------------------------------------------

## 4. Experiments (all [RAN]; reproducible with the files in exp/dashboard-target/)

E1 `nextapp` (Next 16.4.2, React 19.3.1, antd 6.6.6, cssinjs 2.1.2, Node 22.18.0):
- A component imports `./widget.css` -> **both webpack and Turbopack builds FAIL**: "Global CSS cannot be imported from files other than your Custom <App>... move all first-party global CSS imports to pages/_app.js. Or convert the import to Component-Level CSS (CSS Modules)". Source rule: `next/dist/build/webpack/config/blocks/css/index.js:329-375` (pages-only app: global CSS allowed only from node_modules, outside root, or issuer = `customAppFile`).
- Moving the imports into `_app` builds. `_document.tsx` with `createCache/extractStyle/StyleProvider` (the antd docs recipe) renders: no console errors, class `ant-btn css-jdb7z4 css-var-_R_6_ ...`.
- **SSR head order**: `<link rel="stylesheet" ...next css>` comes BEFORE `<style data-antd-ssr>`. Next source: `dist/pages/_document.js:508` (`getCssLinks`) then `:529` (`styles`).
- **Cascade probe**: project CSS `.ant-btn{border-radius:40px}` `.ant-btn-primary{background-color:green}` (equal specificity) -> computed `border-radius: 2px`, `background-color: rgb(183,84,0)`: **the override LOSES**. With `<StyleProvider layer>`: `@layer antd{...}` x4 in SSR HTML; computed `40px` and `rgb(0,128,0)`: **the override WINS**, independent of order.
- `typescript@7.0.2`: `next build` runs "Running TypeScript ... Finished" via the CLI mode (`experimental.useTypeScriptCli: true` is the default in `config-shared.js:263`); also works with `typescript@npm:@typescript/typescript6@^6.0.2` + `@typescript/native@npm:typescript@^7.0.2` (API mode). Next's own error text for a TS without API: "TypeScript 7.x does not provide the compiler API required by Next.js. Set experimental.useTypeScriptCli back to true ... or install TypeScript 6" (`runTypeScriptCli.js:85-87`).
- Custom `babel.config.js` shaped like search's (`@babel/preset-env`, `'@babel/react'`, plugins incl. transform-runtime), Babel 7.29.7: `.tsx` fails: "Syntax error: Unexpected token, expected \"from\"" on `import type`. Add `@babel/preset-typescript` -> compiles, then prerender fails with "ReferenceError: React is not defined" (classic JSX runtime; TSX written dashboard-style without `import React`) and, with `@babel/plugin-transform-runtime` present, "TypeError: (0, f.genStyleHooks) is not a function" because Next 16 passes `node_modules` (antd, next/dist) through the user's Babel config (trace shows `./node_modules/antd/lib/...`, `./node_modules/next/dist/...`). Passing config: `sourceType:'unambiguous'` + `['@babel/preset-react',{runtime:'automatic'}]` + `['@babel/preset-typescript',{onlyRemoveTypeImports:true}]` (kept `useBuiltIns:'usage',corejs:3`, Babel 7). Control: `presets:['next/babel']` also passes. Rule that explains it: `babel/loader/get-config.js:325-337` (if the user config defines `presets`, `next/babel` is NOT added).
- SWR 2.5.1 + SSR `fallback` + defaults: the browser issued **1 extra** `/api/data` request after hydration and replaced the SSR text ("from-ssr" -> "from-api"). With `{revalidateIfStale:false, revalidateOnFocus:false, revalidateOnReconnect:false}`: **0 extra requests**, SSR text kept. Source: `swr/dist/use-swr-emll9s78.mjs:270-290` (`shouldDoInitialRevalidation = isUndefined(data) || revalidateIfStale`).
- zustand 5.0.15 (`esm/react.mjs:6-10`): server snapshot is `api.getInitialState()`. `renderToString` of a component after `store.setState(...)` -> `dp=null`; with the data in the creation state -> `dp=["p1","p2"]`. A module-singleton store served two concurrent "requests": A saw `bob`. `persist` on the server logs "[zustand persist middleware] Unable to update item 'x', the given storage is currently unavailable." on every `set`.

E2 `axios-exp` (axios 1.20.0; Node v18.20.8, v22.18.0, v24.18.1 - identical results):
- Host override: native `fetch` -> sends `127.0.0.1:port` (override dropped); axios **default (http) adapter -> `Host: api.core.ac.uk`** (honoured); axios **`adapter:'fetch'` -> dropped** (same as native). -> closes the README checklist item "Is the Host header ignored on Node 18 too?": **yes, on the prod runtime**.
- String body POST content-type: fetch `text/plain;charset=UTF-8`; axios `application/x-www-form-urlencoded`; axios instance with default `Content-Type: application/json` -> `application/json`. (Claim POST `store/claim.js:38-44`, Q-019.)
- Default User-Agent `axios/1.20.0` (fetch: `node`).
- `responseType:'blob'`: http adapter returns **String**; fetch adapter returns **Blob**. -> `api/outputs.js:36-49 fetchCitations` (`.then(({data: blob}) => blob.text())`), executed in gSSP (`pages/works/[id].jsx:106`, `pages/outputs/[id].jsx:88`) inside try/catch that sets `citations = []`: with the http adapter the TypeError is swallowed and **citations vanish from the SSR HTML silently**.
- `params` serializer: axios `a[]=1&a[]=2`, drops `undefined`; search's `URLSearchParams` path gives `a=1%2C2&b=undefined` (Q-016). Never pass `params`.
- A transport-only instance (`adapter:'fetch', responseType:'blob', transformResponse:[x=>x], validateStatus:()=>true`) + the existing Content-Type regex reproduced: JSON object, `SyntaxError` on bad JSON, Blob for `text/csv` and `text/x-bibliography`, 410 JSON body, 204 -> empty Blob, redirect followed. Network error message still differs: axios `AxiosError: Network Error` vs `TypeError: fetch failed` (observable in `LogRocket.captureException` and `console.error`).
- Default axios on bad JSON silently returns the raw string (`silentJSONParsing`), whereas `api/index.js:92-96` throws SyntaxError (T-102).

E3 `tseslint-exp`: `eslint@10.13.0 + typescript-eslint@8.71.2 + typescript@7.0.2` -> npm installs it ("invalid" peer) and ESLint fails at runtime: "typescript-eslint does not support TS 7.0 ... tracking https://github.com/typescript-eslint/typescript-eslint/issues/10940 for TS >=7.1". With the MS-recommended aliases (`typescript: npm:@typescript/typescript6@^6.0.2`, `@typescript/native: npm:typescript@^7.0.2`) ESLint passes; binaries: `tsc` = 7.0.2, `tsc6` = 6.0.3. Source: [WEB] devblogs.microsoft.com/typescript/announcing-typescript-7-0/ ("We expect TypeScript 7.1 to ship with a new (and different) API").

E4 `husky-exp`: `husky@9.1.7` without `.git` -> prints ".git can't be found", exit 0 (Docker `npm ci` safe; plan already sets `HUSKY=0` in CS-W0-6). `lint-staged@17.6.0` engines `>=22.22.1`; runs on 22.18.0 with only an engines warning.

---------------------------------------------------------------------------------------------------

## 5. Library-by-library mapping onto Next pages-router SSR (what changes, why it is silent)

### 5.1 zustand (M6; R-004)
- Module singleton `create()` (dashboard) = cross-request leak [RAN]. Use `createStore` factory per request on the server and keep the client singleton exactly like `store/index.jsx:12-21` (`initStore`), not zustand's `useState` provider (a remount of `Main` would otherwise create a new store).
- **New, unlisted**: zustand v5's hook reads `getInitialState()` as the server snapshot [RAN]. The MobX flow `useStore(initialState)` -> `storeContext.extend(initialState)` after construction (`store/index.jsx:32-35`, `store/root.js:37-40`, used by `pages/data-providers/index.jsx:34`) would render **empty `dataProviders` in SSR HTML** (state set after creation is invisible to SSR and to the hydration render). Seed state at creation: `createRootStore({statistics, dataProviders})`.
- Dashboard anti-patterns not to copy: `persist` (SSR warning; search stores nothing in localStorage - grep clean), `devtools` in prod, store reset during render, mirroring SWR data into stores, whole-store subscription (`useStore()` without selector re-renders on every change; MobX re-rendered only readers) -> selectors + `useShallow`.
- MobX behaviours that need explicit equivalents (R-030 covers one): `computed` (`DataProviders.results`), in-place assignment on observable class instances (`dataProviders.params.size = s`, `claim.query = ...` in `pages/data-providers/index.jsx:57-84`), `makeObservable` class methods called as `filters.fetchFilters()` from components, `@invalidatePreviousRequests` per-method shared AbortController across instances (06 §1.5).
- zustand 5 requires React >=18 - fine (phase 6 is after S), not for W3-W5.

### 5.2 SWR (R-029)
- No SWR hydration pattern exists in the dashboard; the plan must define it. With `fallback` + defaults there is **1 extra request per key after hydration** [RAN]. Pin `revalidateIfStale:false`, `revalidateOnFocus:false`, `revalidateOnReconnect:false`, `shouldRetryOnError:false` (dashboard hooks use `errorRetryCount:1`, i.e. one extra request after 5 s on every failure), `keepPreviousData:false`, `dedupingInterval:0`.
- Fit: of search's client-side fetch flows, only `SimilarWorks.fetchSimilar` is read-on-mount (`templates/output/similar-works.jsx:29-31`). `filters.fetchFilters` (POST, abort previous, diffs against `initialData`), `report.fetchOutput/submit`, `claim.retrieve`, `search.downloadResults` are event-driven/imperative; gSSP fetches are server-side and SWR is irrelevant there. SWR caches by key: re-visiting an output page would show cached similar works before refetching (today: `reset()` then loader), and identical in-flight `fetchLogo` URLs would be deduped (fewer requests than today). Either is a visible behaviour change.
- Therefore: phase 6 default = axios + zustand actions; SWR only where a test proves identical network + render sequence (similar works), via `useSWRMutation`-style trigger or a cache-clearing wrapper.
- `SWRConfig provider: () => new Map()` (dashboard) is SSR-safe per render; the default global cache is a module singleton shared across requests (only matters if someone calls `mutate` on the server).

### 5.3 axios (R-016, R-028; OD-20)
See E2. Required decisions: server adapter = `fetch` to keep Q-022 and Blob (or consciously change Host behaviour under OD-20 with ops); keep URL/params/body/header builders and `processBody/processError` (they hold the contract: `error.status/data/type/headers`, 410 and 409 consumers `pages/works/[id].jsx:90-93`, `pages/outputs/[id].jsx:22-27`, `store/claim.js:47-49`); `credentials:'include'` -> `withCredentials:true`; no default `Content-Type` header (the builder sets it only for object bodies); no `timeout` default (explicit 50 s in `fetchWorks`, 3 s in `lib/loader.js`); abort -> `signal` (axios throws `CanceledError`, not `AbortError`; no code inspects the name today - grep clean - but `invalidatePreviousRequests` + `console.error(error)` text changes). Browser XHR vs fetch: network errors become `AxiosError: Network Error`.
- Base URL per env: `API_URL` is inlined at build by `next.config` `env` (`env.config.js`), must be read as the literal `process.env.API_URL` (comment `api/index.js:6-12`); `Internal_API`/`Internal_API_HOST` are deliberately runtime-only (`api/internalize.js:1-11`). A dashboard-style `config/env.ts` that validates at import would crash the client bundle and could freeze the runtime vars at build time.
- axios interceptors: the dashboard's 401 handler (clear cookies + redirect) has no equivalent and must not be added (no auth in search).

### 5.4 antd 6 SSR (phase 7)
- Needs a new `pages/_document` (none today; Q-054 "no `<html lang>`" must stay: render `<Html>` with no `lang`, and no other new attributes, or T-601 snapshots change).
- Recipe works [RAN] but the CSS order is reversed relative to the dashboard (E1). Use `<StyleProvider layer>` in `_document.enhanceApp` AND in the client tree (`_app`) so SSR and client agree; keep project overrides unlayered. Consequence to plan for: during the coexistence period (design CSS vendored in W5 is un-layered) vendored design global CSS beats layered antd; the replacement must go component-by-component with the cascade probe.
- `cssVar.key` defaults to `React.useId()` (`antd es/config-provider/hooks/useTheme.js:14-35`): stable only if the server and client trees have the same shape; `pages/_app.jsx:148-155` dev-only wrapper returns `null` on the server (Q-052), so in `next dev` nothing is server-rendered and `extractStyle` has nothing to extract (dev FOUC only); production is unaffected. UNCONFIRMED: whether the `useId` key matches when the dev wrapper is active.
- Static `message.*`/`notification.*`/`Modal.confirm` ignore `ConfigProvider` theme; the dashboard uses static `message` 42 times. For pixel-exact toasts use `App.useApp()`/`message.useMessage()`.
- `zeroRuntime: true` + `import 'antd/dist/antd.css'` (846 KB, default theme only, no hash) is an alternative that removes `_document` extraction, but a themed restyle needs `@ant-design/static-style-extract` [WEB css-variables... customize-theme]; not recommended before the restyle is stable.
- Browser floor: antd 6 "last 2 versions" of modern browsers; search keeps `last 3 versions` (OD-16). Baselines are Chromium, so low risk.
- `@ant-design/nextjs-registry` is for the App Router; do not add it.

### 5.5 "Pure CSS"
Dashboard meaning: plain `.css`, global, kebab-case, imported anywhere, `.ant-*` overrides. In Next pages router this is only legal from `pages/_app` [RAN]. Options for search:
 A. Keep `*.module.css` (still plain CSS; the guide allows "module-specific CSS files") and put only truly global rules + antd overrides in one or two files imported from `_app`. camelCase hack stays on webpack (or `styles['kebab']`).
 B. Convert all 26 module files to global CSS imported from `_app`: needs renaming (246 distinct classes, **32 names defined in more than one module file**: `container` x6, `header` x5, `map`/`label` x4, `title`/`disabled`/`buttons`/`layout`/`action-button` x3...), 428 `styles.x` reads, loses per-route CSS splitting, changes cascade order -> pixel risk with no benefit.
 Recommendation A. `main/global.css` is 25 lines today.

### 5.6 TypeScript for a Next pages app
- Flat `tsconfig.json` with `include`: Next skips auto-config when a tsconfig has `extends`/`references` (`writeConfigurationDefaults.js: "Bail automatic setup ..."`), and runs `tsc --project <tsconfig> --noEmit` (`runTypeCheckCli.js:26-41`), so the dashboard's `references`-only root would check nothing. Next also forces `module: esnext|preserve|...`, `moduleResolution: bundler|node16|nodenext`, `resolveJsonModule`, `esModuleInterop`, `isolatedModules` (skipped when `verbatimModuleSyntax:true`), `jsx: react-jsx` [SRC lines ~100-215].
- `allowJs:true, checkJs:false, strict:false` first; ratchet with a second `tsconfig.strict.json` whose `include` grows by folder (`tsc -p` in CI). `erasableSyntaxOnly` + `verbatimModuleSyntax` are fine and match Babel/SWC strip-only builds. `noUnusedLocals` conflicts with `import React from 'react'` kept for the classic runtime unless `runtime:'automatic'` is set (search files import React for JSX).
- Do not convert MobX stores to TS (legacy decorators under Babel `legacy:true`); order = zustand in JS first, then rename.
- Babel while kept: see E1 (three required babel.config.js changes). Aliases: replace the 10 webpack aliases by tsconfig `baseUrl`/`paths` (Next reads them natively); bare names `api/store/lib/config/data/main/hooks/utils/templates/modules` all resolve under `baseUrl:"."`.
- Latest TS = 7.0.2 -> alias strategy (DT-02).

### 5.7 react-router
Not applicable: Next owns routing; React Router `framework mode` would add another server. The org guide's "client-first" premise (no SSR) contradicts the SEO/status-code requirements (R-005). Record "react-router: N/A, Vite: N/A" in README; get an explicit owner sign-off for OD-02 because the org guide says the opposite.

---------------------------------------------------------------------------------------------------

## 6. Concrete convention spec for search (to become `70-target-conventions.md`)

Each row: **Adopt** (copy the dashboard), **Adapt** (copy the library, change the usage), **Reject** (do not copy).

| Area | Decision | Spec |
|---|---|---|
| Versions | Adapt | "Dashboard conventions" = libraries, NOT its versions. At phase-6 start re-run `npm view` and pin: axios, swr, zustand (`^`), antd + `@ant-design/*` **exact** (minors change pixels), TS via alias (below). |
| Language | Adapt | TS with `allowJs`. `typescript` -> `npm:@typescript/typescript6@^6.0.2` (JS API for typescript-eslint, Next API mode); `@typescript/native` -> `npm:typescript@^7.0.2` for `tsc` in CI; switch to plain `typescript@^7.1` when typescript-eslint supports it. |
| tsconfig | Adapt | Flat file. `target ES2022, lib [dom,dom.iterable,esnext], module esnext, moduleResolution bundler, jsx react-jsx, allowJs true, checkJs false, strict false (ratchet via tsconfig.strict.json), noEmit, isolatedModules/verbatimModuleSyntax true, erasableSyntaxOnly true, resolveJsonModule, skipLibCheck, incremental, baseUrl ".", paths = the 10 bare aliases`, `include [next-env.d.ts, **/*.ts, **/*.tsx, **/*.js, **/*.jsx]`. No `allowImportingTsExtensions` (dashboard mixes extensions; Jest/Next resolve extensionless). |
| Babel (while kept) | Adapt | `sourceType:'unambiguous'`; `['@babel/preset-react',{runtime:'automatic'}]`; `['@babel/preset-typescript',{onlyRemoveTypeImports:true}]`; stay on Babel 7 (8 removes `useBuiltIns`) until SWC (W9). |
| Package manager | Reject (for now) | npm (OD-06). |
| ESLint | Adapt | Flat `eslint.config.js` with `defineConfig` from `eslint/config` (not `tseslint.config`). Blocks: JS/JSX (parser `@babel/eslint-parser@7` while decorators exist; rules: react-hooks `rules-of-hooks:error, exhaustive-deps:warn`, `no-duplicate-imports`), TS/TSX (typescript-eslint `recommended`), Next (`@next/eslint-plugin-next` rules). `lint` script = `eslint .` (no `next lint`). ESLint 10 only when the react/import/jsx-a11y plugins are dropped or support it (they cap at 9) and Babel 8 parser is possible; until then ESLint 9.x is the justified M1 exception (record in 90). Parity gate per OD-15. |
| Prettier | Adapt | Repo-owned `prettier.config.js` inlining the `@oacore/prettier-config` values (`semi:false, singleQuote:true, trailingComma:'es5', endOfLine:'lf', quoteProps:'consistent'`) to drop the private package; Prettier 3.9; `eslint-config-prettier` (not `eslint-plugin-prettier`); `.editorconfig` kept. Reformat in its own commit + T-801. The dashboard has no Prettier; its semicolon style is not a target. |
| Husky | Adopt | husky 9; `"prepare":"husky"`; `.husky/pre-commit` = `npx lint-staged` (no v8 shim); `HUSKY=0` in Dockerfile and CI install (CS-W0-6). |
| lint-staged | Adapt | `*.{js,jsx,ts,tsx}: [eslint --fix, prettier --write]`, `*.{json,md}: prettier --write`, `*.css: stylelint` (no `--fix`, OD-15). Version follows the Node floor: 15.x on Node 18, 16.x on Node 20, 17.x on Node >=22.22.1. Type-check stays in CI, not in the hook. |
| HTTP (axios) | Adapt | One module `api/http` = axios instance used only as a transport: `adapter:'fetch'`, `responseType:'blob'`, `transformRequest:[x=>x]`, `transformResponse:[x=>x]`, `validateStatus:()=>true`, `withCredentials:true`, no `baseURL`/`timeout`/default headers/`params`; the existing builders and `processStatus/processBody/processError` remain verbatim on top. Server and browser use the same code; browser XHR would be used only if `adapter` is left default - decide explicitly (fetch adapter in the browser keeps preflight and cookies identical to today). |
| Data (swr) | Adapt | Phase 6 default: axios + store actions. SWR only for similar-works with `{revalidateIfStale:false, revalidateOnFocus:false, revalidateOnReconnect:false, shouldRetryOnError:false, dedupingInterval:0, keepPreviousData:false}`; SSR data via `SWRConfig fallback` from gSSP props; never the dashboard `swrConfig`/`swrDefaultConfig`. |
| State (zustand) | Adapt | `store/create-root-store.ts`: `createStore<RootState>()((set,get)=>({...initial, ...actions}))`; server: new store per call; client: singleton (port `initStore`); provider keeps `StoreContext`; hook `useRootStore(selector)` with `useShallow`; no `persist`, no `devtools` in production (`devtools({enabled: process.env.NODE_ENV!=='production'})` only if wanted). Seed all initial data at creation. |
| UI | Adapt | antd 6 exact, `@ant-design/icons@^6`, `ConfigProvider theme` built from design foundation tokens (NOT the dashboard/core-ui `antdTheme`, which holds dashboard-specific component tokens) with `cssVar` default; `StyleProvider layer` in `_document` and `_app`; hooks API (`App.useApp`) not static `message`; do not depend on `@oacore/core-ui`. |
| CSS | Adapt | Plain CSS only (no Sass/Less/CSS-in-JS other than antd). Component CSS stays `*.module.css`; globals + antd overrides in files imported from `pages/_app` only; custom properties from the design `:root` tokens; literal px in `@media` (postcss custom-media stays until W8). No `!important` unless a cascade probe proves it is required. |
| Routing | Reject | Next pages router; react-router N/A. |
| Env | Adapt | Keep `env.config.js` + literal `process.env.*` reads; add a validating `src/config/env` only for build-time values; keep `Internal_API*` runtime-only. |
| Sentry | Open | `@sentry/nextjs` 11.8 (server+client) vs `@sentry/react` (client only, loses server errors); OD-14. |
| Tests | Reject dashboard (none) | Jest+RTL, Playwright (D2). |
| Folder layout | Reject for now | `features/<name>/{components,hooks,store,types}` is optional for NEW code; no moves (D1/M6 "no improvements"). |

Config snippets worth putting in `70`:

```jsonc
// package.json (excerpt)
"devDependencies": {
  "typescript": "npm:@typescript/typescript6@^6.0.2",
  "@typescript/native": "npm:typescript@^7.0.2",
  "typescript-eslint": "^8.71.2"
},
"scripts": { "typecheck": "tsc --noEmit -p tsconfig.json", "typecheck:strict": "tsc --noEmit -p tsconfig.strict.json", "lint": "eslint ." }
```
```js
// pages/_document.tsx (phase 7)  [verified E1 on Next 16.4.2]
const cache = createCache()
ctx.renderPage = () => originalRenderPage({ enhanceApp: (App) => (props) => (
  <StyleProvider cache={cache} layer><App {...props} /></StyleProvider>) })
const initialProps = await Document.getInitialProps(ctx)
styles: <>{initialProps.styles}<style dangerouslySetInnerHTML={{ __html: extractStyle(cache, true) }} /></>
// render <Html> WITHOUT lang (Q-054 must stay)
```
```js
// api/http (transport only) [prototype E2 reproduced JSON/blob/410/204/bad JSON]
export const transport = axios.create({ adapter: 'fetch', responseType: 'blob',
  transformRequest: [(d) => d], transformResponse: [(d) => d], validateStatus: () => true, withCredentials: true })
```
```js
// store/index.jsx (zustand) - client singleton preserved
let client = null
export const initStore = (initial) => { if (isServer) return createRootStore(initial); return (client ??= createRootStore(initial)) }
```

---------------------------------------------------------------------------------------------------

## 7. Gap list (what the plan lacks for phases 6-7)

G1 No definition of the phase 6-7 conventions anywhere (`50 §5` has two rows; OD-07/11/12/14/20 are fragments) -> NEW doc 70.
G2 "Pure CSS" undefined and conflicts with Next's global-CSS rule (DT-01).
G3 TypeScript version/lint stack conflict with M1 (DT-02, DT-12).
G4 No SSR design for zustand seed state, SWR hydration, antd extraction.
G5 No axios adapter decision (Host, Blob) -> silent citations loss.
G6 No Babel changes listed for TS/automatic runtime/antd in node_modules.
G7 core-ui disposition undecided (design ownership, M4).
G8 No test items for: CSS cascade probes (antd vs project CSS), transport differential (old fetch wrapper vs axios transport), SSR-HTML seeding of `/data-providers`, SWR zero-extra-request, SSR citations on `/works/:id`, tsconfig ratchet, ESLint JS block.
G9 Node floors of the target tooling vs OD-05 and W1 timing (lint-staged 17 >=22.22.1, ESLint 10 >=20.19/22.13, Sentry 11, core-ui >=24.14).
G10 Version-target table lacks Babel 8 (useBuiltIns removed), `@ant-design/icons` 6, `@sentry/nextjs` 11, eslint plugin caps.
G11 08 contains factual errors (zustand count, SWR config description, omitted direct `fetch`, husky shim, deprecated `tseslint.config`).
G12 Prettier: dashboard has none; the org preset (semi:false) is not what the dashboard writes; decide and inline.
G13 Static `message.*` pattern (dashboard) would not take the restyle theme.
G14 Org guide contradicts D3 (RHF) and OD-02 (client-first, React Router).

---------------------------------------------------------------------------------------------------

## 8. Resolved `[VERIFY]` items (from README §8 and others)

- "Is the Host header ignored on Node 18 too? (Q-022)" -> **Yes**: native fetch drops the override on 18.20.8, 22.18.0 and 24.18.1 [RAN]. axios default adapter sends it; axios `fetch` adapter drops it.
- "Does `next/jest`..." not in scope.
- "react-router applicable?" -> No (§5.7).
- "Does core-ui render under antd 6?" -> It runs in the dashboard (89 import sites) because pnpm tolerates unmet peers; core-ui imports `antd`/`@ant-design/icons` as peers (resolved to antd 6.3.2 + icons 5.6.1). Visual correctness UNCONFIRMED. With npm 7+ the peers (`antd ^5.27.6`, `react ^19.1.1`, icons `^5.6.1`) would raise ERESOLVE against antd 6/icons 6.
- "Does Next 16.4.2 accept TypeScript 7?" -> Yes through the CLI mode; typescript-eslint does not (§4 E3).
- "Is `@ant-design/nextjs-registry` usable in pages router?" -> No (App Router).
