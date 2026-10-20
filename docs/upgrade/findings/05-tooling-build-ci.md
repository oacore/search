# 05 - Tooling, Build, CSS pipeline, CI/CD, Observability

Auditor: tooling/build/CI. READ-ONLY audit of this repo (`search`, repo root; HEAD `f5cfc20`, 2026-10-19). Reference: `../dashboard`.
Measured on device: Node v22.23.2, npm 10.9.8, installed Next 10.2.3, ESLint 7.32.0, Prettier 2.8.8, stylelint 13.13.1, husky 4.3.8, `@oacore/design` 5.0.74, `@sentry/*` 5.30.0, logrocket 10.0.0, react-ga4 2.1.0, mobx 6.13.7.
Caveat: the device sandbox has **no npm registry access** (E403/ENOTFOUND), so "latest version" numbers are NOT verified here; re-check at upgrade time. Prettier 3 was not available locally either, so the Prettier 3 reformat diff size is estimated, not measured.

Artifacts saved for later parity checks (new files only, nothing existing was modified):
- `docs/upgrade/findings/baselines/eslint-baseline.json` (full ESLint 7 JSON result)
- `docs/upgrade/findings/baselines/stylelint-baseline.json`
- `docs/upgrade/findings/baselines/eslint-resolved-config.jsx.json` / `.config-js.json` (effective rule set, 461 rules known, 246 enabled)
- `docs/upgrade/findings/baselines/stylelint-resolved-config.json` (143 rules)
(All JSON was `prettier --write`n so `npm run lint:json` is not broken by them.)

---

## 0. TL;DR - ranked top findings

1. **`npm run lint` FAILS today** (exit 1): ESLint 13 errors / 0 warnings, stylelint 16 errors, Prettier-json clean. "Lint-zero baseline" does not exist; it must be created (fix or snapshot) BEFORE any tooling upgrade.
2. **Husky is a no-op today**: husky 4.3.8 stubs are in `.git/hooks`, but there is no `husky` key in `package.json`, no `.huskyrc`, no lint-staged. Nothing runs on commit. CI has no PR trigger, no lint, no tests. There is zero automated gate.
3. **Hidden build-time network dependency**: `npm run build` first runs `node ./data/data-loader.js` which fetches 3 endpoints from `https://api.core.ac.uk/internal/*` (hard-coded prod URLs, un-awaited promises). A failure becomes an unhandled rejection (Node >= 15 exits 1) and kills the Docker build; the nightly cron redeploy (03:00 prod / 04:00 stage) depends on it. Also `import cachedStatistics from 'data/.statistics.json'` (`pages/_app.jsx:12`) requires the file at build time.
4. **CSS contract with `@oacore/design`**: design's shipped `lib/*.css` is *unprocessed* and relies on search's PostCSS (`@extend` x3 in `elements/forms/styles.css`, `@media (--screen-until-desktop)` in `elements/fieldset/fieldset.css:44` whose definition lives in search's `main/media-queries.css`, `color-mod()` x4 in `elements/button/button.css`). Removing/changing the PostCSS plugins before design components are re-implemented silently breaks design CSS.
5. **CSS-modules camelCase export patch**: `next.config.js:37-77` monkey-patches css-loader to `exportLocalsConvention: 'camelCase'`. 221 of 428 `styles.xxx` accesses (50 files) use camelCase for dashed class names (`styles.cardItem` -> `.card-item`). This hack will no-op/mis-hit on Next 13+ loader structure and is ignored by Turbopack/Lightning CSS -> undefined class names, no build error. High visual-regression risk.
6. **Babel config forces Next 10 off SWC-ish features**: legacy decorators (MobX `@observable/@action/@computed` in `store/filters.js`, custom `@invalidatePreviousRequests` in 5 stores), `export X from` (2 files), class-properties, `add-react-displayname`. Next >= 12.1 handles legacy decorators via `experimentalDecorators` in jsconfig; a present `babel.config.js` makes Next keep using Babel (staging option).
7. **next-images + Next 11+ built-in image import conflict**: 12+ `import x from './a.svg'` call sites return `{src,width,height}` objects instead of URL strings unless `images.disableStaticImages: true` (or code changed).
8. **Docker/K8s**: Node 18-alpine (EOL), `--openssl-legacy-provider` workaround, single-stage image with full `node_modules` + dev deps, no `.dockerignore`, `npm ci || npm install` fallback hides lockfile drift, NPM_TOKEN leaks into image history and into the runtime K8s secret. K8s depends on: port 8080, `/api/healthz/` (pages/api), `next start -p 8080`, gateway rewrite of `/static/search/*` and `/search/_next/data/*`.
9. **Observability**: Sentry 5 used in 3 call sites (`pages/_app.jsx`), LogRocket in 4 call sites, GA4 only `ReactGA.initialize` + `ReactGA.send` pageview; no custom events anywhere. `hooks/use-analytics.js` has latent bugs (see sec 6) that tests should pin before any change. `logrocket-react` is declared but never imported.
10. **Undeclared transitive dependencies the build relies on**: `node-fetch` (data-loader.js), `@mdi/svg` (design.config.js:24), `@babel/runtime` (transform-runtime output), `yargs` (design CLI). Any lockfile re-resolve can remove them.

---

## 1. Babel (`babel.config.js`, 32 lines; `api.cache(true)`)

| # | Entry | Options | Why it is here (evidence) | Under SWC (Next 12+) |
|---|---|---|---|---|
| 1 | `@babel/preset-env` | `useBuiltIns:'usage', corejs:3` | Down-level + auto core-js polyfills (browserslist `last 3 versions, not ie > 0, not op_mini > 0`). No file imports `core-js` explicitly (grep: 0). | Replaced by SWC preset-env equivalent; Next injects its own polyfill chunk for legacy browsers. `core-js` dependency (package.json:dependencies) becomes unused -> remove after verifying. Targets then come from browserslist / Next's defaults (Next 13+ ignore `last 3 versions` semantics partly; Next 15 browserslist-baseline). **Behavioural diff**: output JS will differ; verify with bundle diff. |
| 2 | `@babel/react` (preset-react) | classic runtime (no `runtime:automatic`) | JSX. Files still `import React` (e.g. `main/index.jsx:1`). | SWC handles; Next 17+/automatic runtime default. Safe. |
| 3 | `@babel/plugin-proposal-export-default-from` | - | `export useReportController from './use-report-controller'` (`templates/output/hooks/index.js:1`) and `export useClaimController from './use-claim-controller'` (`templates/data-providers/hooks/index.js:1`). Only 2 sites. | Not a standard syntax; do not rely on SWC parser support. **Rewrite both to `export { default as X } from '...'`** (trivial, safe, do it before the Next bump). |
| 4 | `@babel/plugin-proposal-decorators` | `{legacy:true}` | See decorator inventory below. | Next >= 12.1: auto-detects `"experimentalDecorators": true` in `jsconfig.json`/`tsconfig.json` (docs: nextjs.org/docs/architecture/nextjs-compiler "Legacy Decorators"). **No jsconfig.json/tsconfig.json exists in search today -> must be added.** |
| 5 | `@babel/plugin-proposal-class-properties` | default (loose=false) | `store/*.js` class fields (e.g. `store/report.js:11-25`, `store/search.js:21-27`, `store/root.js:11-21`), and legacy-decorated fields. | Built into SWC for ES2022 targets. Edge: field define-vs-set semantics. With legacy decorators MobX requires `[[Set]]`-style fields (`useDefineForClassFields:false`). Needs per-store unit tests (observable reactivity). |
| 6 | `@babel/plugin-syntax-dynamic-import` | - | `dynamic(() => import('./map'))` in `modules/map/index.jsx:7` | Obsolete (syntax is standard). Drop. |
| 7 | `add-react-displayname` (`babel-plugin-add-react-displayname@0.0.5`) | - | Auto `displayName` for anonymous components; only 2 manual `displayName` in code (`templates/output/thumbnail-card.jsx:104`, `modules/show-more/index.jsx:39`). Possibly relied on by `@oacore/design` utilities or enzyme-style tests (none exist). | No SWC equivalent. Impact: React DevTools names, and any code reading `Component.displayName` / `.name`. Grep shows none beyond the 2 manual ones. Low risk; delete. |
| 8 | `@babel/plugin-transform-runtime` | default | Dedupe helpers. Requires `@babel/runtime` which is NOT in package.json (transitive). | SWC uses `@swc/helpers` internally (bundled by Next). Drop plugin and ensure nothing imports `@babel/runtime` directly (design's lib/*.js do: `require("@babel/runtime/helpers/interopRequireDefault")` -> **keep `@babel/runtime` resolvable while design is a dependency**; declare it explicitly). |

Related Babel/webpack config dependencies in `package.json`: `@babel/core`, `@babel/preset-env`, `@babel/preset-react`, `babel-eslint` (lint), `@zeit/next-source-maps` listed TWICE (dependencies `0.0.4` and devDependencies `0.0.3`), `next-images`.

### Decorator inventory (exhaustive grep, js/jsx excl. node_modules/.next)

| File | Decorators | Lines |
|---|---|---|
| `store/filters.js` | `@observable` x9 (fields), `@action` x15, `@computed` x2; class uses `makeObservable(this, null)` at :42 (decorator mode) | 16-39 (observable), 45,50,55,60,65,110,148,158,197,250,283,294,321,326,345 (action), 302,312 (computed), 66 (`@invalidatePreviousRequests`) |
| `store/similar-works.js` | `@invalidatePreviousRequests` | 23 |
| `store/report.js` | `@invalidatePreviousRequests` x2 | 52, 67 |
| `store/claim.js` | `@invalidatePreviousRequests` | 33 |
| `store/search.js` | `@invalidatePreviousRequests` | 118 |

Total: **~31 decorator uses in 5 files**. `utils/invalidatePreviousRequests.js` is a hand-written legacy method decorator `(target, key, descriptor)` that mutates `descriptor.value` (AbortController chaining). It combines with `makeObservable(this,{retrieve: action})` annotations (store/claim.js:21, similar-works.js:15). Only `store/filters.js` uses the MobX decorator syntax; the other 6 stores (`params, data-providers, similar-works, root, report, claim, search`) already use explicit `makeObservable(this,{...})`.

Recommendation (lowest risk): **eliminate MobX decorators in `store/filters.js` by converting to the explicit `makeObservable(this, {...})` form** that the other 6 stores use (pure refactor, same MobX 6.13, testable in isolation, before the framework bump). Keep only the custom `@invalidatePreviousRequests` (legacy descriptor decorator) or convert it to a plain wrapper function `invalidate(fn)` applied in the constructor - then **no decorator syntax remains** and `experimentalDecorators` is not needed at all. That removes the hardest SWC/Vite migration item (dashboard uses Vite+TS without decorators).

Staging option: leaving `babel.config.js` in place makes Next 12-15 skip SWC for all files (Babel fallback, per Next docs "Unsupported Features"); this allows upgrading Next first, and doing the SWC switch as a separate PR. Next 15+/16 with Turbopack also supports babel-loader if a babel config is present but verify on the chosen target version.

---

## 2. Lint / format

### 2.1 Configs

| Tool | Config | Effective rule base |
|---|---|---|
| ESLint 7.32 | `.eslintrc.yml` (16 lines): `extends: '@oacore/eslint-config-react'`, `parser: babel-eslint`, `env.browser`, `settings.import/ignore: design/index.js$`, `import/resolver.node: {paths:['.'], extensions:['.js','.jsx']}` | `@oacore/eslint-config-react@1.0.6` = `['airbnb', '@oacore/eslint-config-base', 'prettier/react']` + 3 overrides; base = `['airbnb-base','prettier']` + overrides + `eslint-plugin-prettier`. Resolved: 461 known rules, **246 enabled** (core 144, react 48, jsx-a11y 32, import 21, prettier 1). |
| Prettier 2.8.8 | `prettier.config.js` -> `@oacore/prettier-config` | `trailingComma:'es5', semi:false, singleQuote:true, endOfLine:'lf', quoteProps:'consistent'` |
| stylelint 13.13.1 | `stylelint.config.js` (extends via absolute path into node_modules) -> `@oacore/stylelint-config-base@1.0.6` | `stylelint-config-twbs-bootstrap/css` + `stylelint-config-css-modules` + `stylelint-prettier/recommended` (+ `stylelint-order` plugin); 143 resolved rules |
| EditorConfig | `.editorconfig` | utf-8, lf, 2 spaces, final newline |
| Browserslist | `.browserslistrc` | `last 3 versions`, `not ie > 0`, `not op_mini > 0` (also drives preset-env/autoprefixer) |

### 2.2 `@oacore` custom rules that MUST be preserved (the rest is airbnb defaults)

From `@oacore/eslint-config-base/index.js` + `-react/index.js`:
- `curly: ['error','multi-or-nest']`  (this is why code has brace-less single statements)
- `eqeqeq: ['error','smart']`
- `function-call-argument-newline: ['error','consistent']`
- `max-len: 80` (tabWidth 2; ignoreUrls/Strings/TemplateLiterals/RegExpLiterals true; ignoreComments false)
- `no-console: ['error',{allow:['warn','error']}]`
- `no-param-reassign: ['error',{props:false}]`
- `no-plusplus: ['error',{allowForLoopAfterthoughts:true}]`
- `new-parens: off`
- `import/order`: groups `[builtin, external, [parent,sibling], index]`, `newlines-between: always`
- `prettier/prettier: error`
- `arrow-body-style: ['error','as-needed']`
- `reportUnusedDisableDirectives: true`
- override `*.config.js`: node env, `import/no-extraneous-dependencies {devDependencies:true}`
- react: `react/jsx-props-no-spreading: off`, `react/prop-types {skipUndeclared:true, ignore:[children,class,className,id,tag]}`, `react/state-in-constructor: ['error','never']`
- Import resolution: bare imports like `utils/...`, `store`, `modules/...`, `main` resolved via `import/resolver node paths ['.']`. In the new setup replace with `jsconfig.json` `baseUrl:"."` (Next resolves it natively) + `eslint-import-resolver-node`/`typescript` accordingly.

`stylelint` custom rules to preserve: `at-rule-no-unknown {ignoreAtRules:['extend']}` (only needed while design CSS / `@extend` remain), `max-nesting-depth 3 (ignore blockless-at-rules, pseudo-classes)`, `rule-empty-line-before always (except after-single-line-comment, first-nested)`, plus twbs-bootstrap (includes `order/properties-order`, `selector-class-pattern`, `selector-max-id`, etc.).

### 2.3 Does `npm run lint` pass today? NO.

Command run on device (read-only): `npm run lint` (= `run-p lint:*`), plus each linter separately with JSON output.

| Linter | Result | Detail |
|---|---|---|
| `lint:json` (prettier --check '**/*.json') | PASS (exit 0) | |
| `lint:js` (eslint, 156 files .js/.jsx) | **FAIL exit 1: 13 errors, 0 warnings**, 7 files, 3 auto-fixable | `no-console` 5, `prettier/prettier` 3, `max-len` 2, `import/no-named-as-default` 1, `class-methods-use-this` 1, `no-unused-vars` 1 |
| `lint:css` (stylelint, 28 files) | **FAIL exit 2: 16 errors**, 4 files | `order/properties-order` 7, `selector-class-pattern` 4, `prettier/prettier` 4, `shorthand-property-no-redundant-values` 1 |
| `npm run lint` overall | **exit 1** | `ERROR: "lint:css" exited with 2.` Run time ~15 s |

ESLint error list (file:line):
- `api/index.js:4` import/no-named-as-default
- `babel.config.js:25` prettier/prettier (double quotes)
- `hooks/use-analytics.js:22` no-console + prettier/prettier (the stray `console.log("GA")`)
- `lib/loader.js:14,29` max-len; `:25` class-methods-use-this
- `modules/dropdown/index.jsx:30` no-unused-vars (`metadata`)
- `pages/search/index.jsx:51,53,56,66` no-console (`console.time/timeEnd` perf timers)
- `templates/output/index.jsx:192` prettier/prettier

Stylelint: `modules/layout/styles.module.css:5,11,16,23` camelCase classes (`.stickyTop`, `.maintenanceBanner`, `.maintenanceBannerText`) violate `selector-class-pattern`; `:26` property order; `templates/output/styles.module.css:150,167,168,174,177`; `templates/output/update/styles.module.css:67-70` (uppercase hex and ordering).

Observations:
- The errors sit in recently touched code (maintenance banner CSS, `console.time` perf timers, stray `console.log("GA")`), which is consistent with lint not being enforced anywhere (no hook, no CI). Not verified via git blame.
- The effective ESLint `import/no-extraneous-dependencies` is silent about undeclared deps (`node-fetch`, `@mdi/svg`) only because `data/` and `*.config.js` have overrides / devDependencies:true.
- Prettier itself is clean on all tracked source except 3 JS + 3 CSS files above (plus yaml/md that lint does not cover). **Source is already ~Prettier-2-clean, so churn from a stricter lint is small.**

### 2.4 Migration path (recommended order)

1. **Baseline commit**: fix the 29 existing errors (13 ESLint, 16 stylelint; mostly `--fix`able: 3 ESLint, the prettier + order ones in CSS) OR record baselines (committed JSONs above) and gate on "no new errors". Prefer fixing: the list is tiny.
2. **Prettier 2 -> 3 (separate format-only commit)**. Risk assessment:
   - The headline Prettier 3 break (`trailingComma` default `es5` -> `all`) does **NOT apply** here because `@oacore/prettier-config` sets `trailingComma:'es5'` explicitly. Keep that setting, inlined in a local `prettier.config.js` since `@oacore/prettier-config` is a private GitHub-Packages dependency (also removes the `@oacore` registry dependency for dev tooling).
   - Other Prettier 3 formatting differences are minor edge cases (some nested ternaries/arrow chains, markdown/yaml tweaks, CSS comment handling, and Prettier 3 reading `.gitignore` as an ignore source by default - verify `docs/` and `.next/` handling). Not measurable here (no Prettier 3 offline). **Method to measure at upgrade time:** in a throwaway worktree run `npx prettier@3 --write "**/*.{js,jsx,css,json}"` and `git diff --shortstat`. Expect small diff (hundreds of lines at most) because of the explicit config; if the diff is >5% of lines, investigate options.
   - Do it as **one format-only commit, no logic, listed in `.git-blame-ignore-revs`**.
   - `eslint-plugin-prettier` 3.x -> 5.x; `eslint-config-prettier` 6 -> 9/10 (note: `prettier/react` and `prettier/*` extends names were removed in eslint-config-prettier 8; flat config uses `eslint-config-prettier` default export). Consider dropping eslint-plugin-prettier entirely (dashboard does not use it; run `prettier --check` separately, which also avoids duplicate/slow double-reporting).
3. **ESLint 7 -> 9/10 flat config** (`eslint.config.js`, like dashboard's). Blockers:
   - `@oacore/eslint-config-react@1.0.6` and `-base` are legacy eslintrc configs with deps on `eslint-config-airbnb@18`, `airbnb-base@14`, `eslint-config-prettier@6` (pins ESLint 6/7 peer ranges). Options: (a) wrap with `@eslint/eslintrc` `FlatCompat` (works but keeps old plugin versions, which may not support ESLint 9/10 APIs - `eslint-plugin-import` 2.22, `jsx-a11y` 6.4, `react` 7.21 need upgrades; some airbnb-config-referenced rules were removed from core ESLint 9/10 -> "Definition for rule not found" errors); (b) **recommended: write a self-contained flat config that re-states the ~20 oacore rules above on top of `@eslint/js` recommended + `eslint-plugin-react` + `react-hooks` + `jsx-a11y` + `import`/`import-x`** (Airbnb style is not maintained for ESLint 9+; an `eslint-config-airbnb-extended` community port exists - verify before adopting). Dashboard's config is TS-only (`**/*.{ts,tsx}`), uses `reactRefresh`, `react-hooks` and `no-duplicate-imports`; it does not include airbnb, so search needs its own config rather than copying.
   - Parser: `babel-eslint` 10 is dead -> `@babel/eslint-parser` (needs a Babel config, `requireConfigFile:false` + preset-react) or, once SWC/TS migration happens, `typescript-eslint` parser (handles JSX + decorators via `experimentalDecorators` in tsconfig).
   - Run old and new in parallel for a transition PR and compare rule-by-rule using the committed `eslint-resolved-config.*.json`; require "same 13 errors or fewer" on the same files.
   - `reportUnusedDisableDirectives: true` -> flat `linterOptions.reportUnusedDisableDirectives: 'error'`.
   - Add `@next/eslint-plugin-next` (or `eslint-config-next`) after Next bump; `next lint` is deprecated/removed in recent Next majors (verify on the chosen Next version) - call `eslint .` directly (already how lint:js works).
4. **stylelint 13 -> 16**: Node >= 18.12 required; stylelint 15+ removed all stylistic rules (formatting is delegated to Prettier, which this repo already does via `stylelint-prettier`), config names changed. `@oacore/stylelint-config-base@1.0.6` depends on `stylelint-config-twbs-bootstrap@2` (stylelint 13/14 era) -> the extends need replacing with `stylelint-config-standard` (or re-state twbs rules locally), keep `stylelint-config-css-modules`, `stylelint-order` (properties-order), `stylelint-prettier`. The `stylelint.config.js` absolute-path `extends` hack (`resolve(__dirname,'node_modules')/@oacore/...`) goes away. The `selector-class-pattern` rule currently flags camelCase module classes; decide on kebab vs camel during CSS-modules migration (see 3.4). Dashboard has no stylelint at all (pure CSS, no lint) - optional to keep.
5. **Lint scripts**: add `lint:fix`, `format:check`; fix `lint:json` (`prettier --check '**/*.json'` also scans `docs/`, `package-lock.json` - ok as of now).


---

## 3. CSS pipeline

### 3.1 Setup today
- `postcss.config.js` (object form): plugin ORDER = `postcss-preset-env {stage:0}` -> `cssnano` (default preset with mergeLonghand/normalizeWhitespace/svgo/reduceInitial/reduceTransforms off, discardComments off, rawCache off) -> `postcss-custom-media {importFrom:'main/media-queries.css'}` -> `postcss-extend-rule`. (cssnano before custom-media/extend-rule is unusual: it works only because cssnano 4 leaves unknown at-rules alone.)
- Installed: postcss 8.4.14, postcss-preset-env 7.8.3, postcss-custom-media 8.0 (`importFrom` option was removed in later majors), postcss-extend-rule 4, cssnano 4.1.11 (cssnano 4 is PostCSS-7-era; works only through compat), postcss-nesting 10.2, postcss-custom-properties 12.1.
- Next 10 treats a user `postcss.config.js` as full replacement of Next's default PostCSS config. Next also minifies CSS itself in production (cssnano-simple), so the explicit `cssnano` 4 step is probably redundant.
- Files: **28 search-owned CSS files, 2,414 lines** (27 `*.module.css` + `main/global.css` + `main/media-queries.css`), imported as `import styles from './x.module.css'` in 59 JSX files. Global CSS imported only in `pages/_app.jsx:11-15`: `leaflet/dist/leaflet.css`, `leaflet.markercluster/.../MarkerCluster.css`, `...MarkerCluster.Default.css`, `@oacore/design/lib/index.css`, `main/global.css`.

### 3.2 Catalogue of features actually used in search's own CSS (grep-based counts; run date 2026-10-19)

| Feature | Count | Where (file:line) | Needs a plugin today? | What breaks/changes on Next 13+ default PostCSS / Lightning CSS / Vite plain CSS |
|---|---|---|---|---|
| `@custom-media` definitions | 2 | `main/media-queries.css:1-2` (`--screen-until-desktop (max-width:767px)`, `--screen-until-large-desktop (max-width:1200px)`) | yes: postcss-custom-media + importFrom | `--screen-until-large-desktop` is defined but never used. `importFrom` removed in postcss-custom-media >= 9; replace via `@csstools/postcss-global-data` or just inline `@media (max-width: 767px)` (6 usages). Vite plain CSS does NOT resolve `@custom-media` (Lightning CSS can, with `drafts.customMedia`). |
| `@media (--screen-until-desktop)` usages | 6 | `templates/output/styles.module.css:187`, `templates/output/update/styles.module.css:89`, `templates/search/styles.module.css:199`, `modules/filters/styles.module.css:240`, `modules/filters/year/selects/styles.module.css:22`, `modules/search-layout/styles.module.css:53` | yes | unresolved custom media = rule silently never matches (mobile layout lost). **Plus design's `lib/elements/fieldset/fieldset.css:44` uses the same name** (implicit cross-package contract). |
| `@extend` | **0 in search** (but 3 in design `lib/elements/forms/styles.css:92,95,375`: `%placeholder-hidden`, `%label-overlay`) | - | postcss-extend-rule only for design | keep plugin until design forms are replaced; stylelint override `at-rule-no-unknown ignoreAtRules:['extend']` stays tied to it. |
| CSS nesting (`&`) | 10 in 4 files | `templates/output/thumbnail-card.module.css:6,10,19,23`; `templates/data-providers/styles.module.css:5` (`& > *:not(:first-child)`); `templates/data-provider/styles.module.css:92,106`; `modules/logo/styles.module.css:11,20,30` | yes (preset-env stage 0 -> postcss-nesting 10) | Native nesting supported by modern browsers; Vite/esbuild lowers per `build.target`; Next 13+ default PostCSS pipeline has no nesting unless `postcss-nested`/preset-env kept; Lightning CSS lowers it. All 10 are relaxed-syntax `& x`/`&:state`, so any engine handles them. Low risk. |
| Custom properties `var(--*)` | 159 uses, ~37 distinct names | top: `--primary` 32, `--gray-800` 17, `--white` 16, `--page-padding-x` 12, `--gray-700` 12, `--page-padding-y` 9, `--gray-100` 9, `--elevation-04` 4, `--form-helper-color` 5 | preset-env custom-properties (preserve fallbacks) | **Almost all tokens are defined by `@oacore/design` foundation CSS** (`--primary`, `--gray-*`, `--white`, `--page-padding-*`, `--component-*`, `--card-*`, `--elevation-*`, `--form-*`, `--main-content-*`, `--h1-font-size`, `--spacer`, `--body-color`, `--danger`). Search defines only 14 local custom props (`templates/output/thumbnail-card.module.css:53`, `templates/search/styles.module.css:38-39`, `templates/data-providers/styles.module.css:11,26-29`, `modules/filters/styles.module.css:210`, `modules/show-more/styles.module.css:2`, `modules/copyable-input/styles.module.css:2,7-9`). Removing design = must vendor a `tokens.css`. Several of search's overrides (`--button-focus-ring`, `--icon-color`, `--link-color`, `--form-control-color`, `--button-padding-*`) are *design component API* variables - they stop working silently if the design component disappears. |
| `calc()` | 9 | various | preset-env (reduce/fallback) | none |
| `:focus-within` | 2 | `templates/output/thumbnail-card.module.css:10,39` | preset-env focus-within -> emits `[focus-within]` attribute fallback (seen in processed output) | fallback selector disappears; harmless on modern browsers |
| `:not(...)` | 19 | various incl. `:not(:focus):not(:focus-within)` visually-hidden pattern (`thumbnail-card.module.css:39`) | - | none |
| color functional notation / hex alpha | `hsl(var(--card-color, var(--on-surface)) / 0.12)` at `templates/output/styles.module.css:209`; `#00000040` at `modules/dropdown/styles.module.css:119` | preset-env (hex-alpha -> rgba; hsl with `var()` can't be statically converted and is emitted twice) | browsers support natively; only an ancient-browser fallback is lost |
| `inset: 0` | 1 | `modules/logo/styles.module.css:17` | preset-env logical -> expands to top/right/bottom/left (seen in output) | native in modern browsers |
| `gap:` | 9 | various | preset-env gap-properties (flexbox gap fallback) | none on modern |
| `@keyframes` | 1 | `modules/loader/loader.module.css:22` (`spin`) | - | CSS Modules scopes the keyframes name; Vite/Next do too |
| `url()` | 2 | `templates/search/styles.module.css:111` (`../data-provider/images/repoBackground.svg`), `templates/data-provider/styles.module.css:4` (`./images/map-background.png`) | css-loader url handling (Next 10 -> asset hash) | Next 13+ and Vite rewrite relatively; verify asset output path/prefix (`assetPrefix=/static/search` in azure builds) |
| `!important` | 19 | visually-hidden snippets etc. | - | none |
| `composes:` | **0** | - | - | none (good: no cross-module composition) |
| `:global` / `:local` | **0** | - | - | none |
| `@import` / `@supports` / `env()` / `clamp()` / `aspect-ratio` | 0 | - | - | none |
| Autoprefixing (side effect of preset-env + `.browserslistrc`) | processed output is +35% bytes (36,779 -> 49,743 B across 28 files; I ran the exact plugin chain on each file offline, outputs in `<scratch>/cssaudit/out`, not in repo) | e.g. `display:-webkit-box; display:-ms-flexbox`, `-ms-flex-align`, `-webkit-box-pack` (59/35/30 instances) | `.browserslistrc` `last 3 versions` expands to **35 browsers incl. `bb 7/10`, `ie_mob 10/11`, `kaios`, `op_mini all`, `baidu`, `and_qq`** (the `not op_mini > 0` filter does not exclude `all`). | Moving to a modern targets list/Vite defaults removes dead prefixes: byte-level CSS diff will be large but behaviourally neutral for supported browsers. Decide the supported-browser policy explicitly (Baseline/`>0.5%, last 2 versions, not dead`). |
| class naming | 27 module files; **dashed** class names in 24 files, camelCase in 2 (`modules/layout/styles.module.css`: `.stickyTop`, `.maintenanceBanner`, `.maintenanceBannerText`; `modules/dropdown/styles.module.css`: `memberType`, `activeClass`) | - | **`next.config.js:60-77` forces css-loader `exportLocalsConvention:'camelCase'`** | **221 of 428 `styles.<name>` accesses (50 files) rely on dashed->camelCase conversion** (e.g. `styles.cardItem` for `.card-item`). Next 10 default is `asIs`; the hack finds `styleRules`/`cssModuleRules` by regexing webpack's `oneOf` structure which differs in Next >= 12/13 (`rule.use` array nesting, `modules` object shape). If the hook finds nothing, `if (!styleRules) return config` silently skips and all those lookups return `undefined` -> **unstyled UI with no build error**. Turbopack/Lightning CSS ignore this hook entirely. Replacement options: (1) Next 13+: loader customization still possible but fragile; (2) Vite: `css.modules.localsConvention: 'camelCaseOnly'`; (3) **lowest-risk: codemod `.card-item` -> keep dashed in CSS and access via `styles['card-item']`, or rename classes to camelCase** - big mechanical diff, do as its own PR with the build-output diff check below. |

### 3.3 CSS-module class-name hashing / visual regression
- Class names are generated by Next's `getCssModuleLocalIdent` (Next 10: `[file]_[local]__[hash]` style). Next 13+/Vite generate different hashes. Verified by grep that **no JS/CSS selects hashed classes** (`querySelector`, `getElementsByClassName`, `[class*=]`: 0 hits), and `composes`/`:global` are unused, so a hash change itself is safe. The real visual-regression risks are:
  1. **Locals-convention hack silently failing** (above).
  2. **Cascade order**: search's module CSS overrides design's global element/attribute rules (`[type=button]`, `button` in `lib/elements/button/button.css` etc.) by source order. Next 13+/webpack-5 mini-css-extract may order chunks differently than Next 10 (`pages/_app.jsx` global CSS first). Same-specificity ties can flip.
  3. Different autoprefixer/targets output (35% fewer bytes) and `postcss-preset-env` removal -> any `var()` fallback duplicates dropped (fine) but also *design's* `color-mod()` (see 3.4).
  4. `url()` asset path rewriting with `assetPrefix` (`/static/search` when `BUILD_TARGET=azure`).

### 3.4 How `@oacore/design` CSS reaches the page and what it needs from search's pipeline
- Imported once: `pages/_app.jsx:14` `import '@oacore/design/lib/index.css'` (a stub of `@import url(...)` for `reboot.css`, `foundation/index.css`, `elements/index.css`, `modules/index.css`, `helpers.css`; 106 css files under `lib/`, 0 `.module.css`). Component JS (`lib/**.js`, CJS, Babel-compiled, `require("@babel/runtime/helpers/...")`) carries pre-hashed class names like `button-button-3fr3r` (so design is immune to search's hashing change).
- Design's shipped CSS is **not fully processed**: contains `@extend %placeholder-hidden/%label-overlay` (`lib/elements/forms/styles.css:92,95,375`), `@media (--screen-until-desktop)` (`lib/elements/fieldset/fieldset.css:44`), `color-mod(var(--primary) alpha(25%))` x4 (`lib/elements/button/button.css:5,57,76,95`), `hsl(... / a)` x3 files, `:matches/:is` x2 files. No `postcss-color-mod-function` is installed (preset-env 7.8.3 stage 0 does not include it) -> `color-mod()` is passed through and the browser discards those declarations: **button focus ring (`--button-focus-ring`, box-shadow) is already broken today**. Confirmed offline: running the exact search PostCSS chain on `design/lib/elements/button/button.css` leaves 9 `color-mod` occurrences in the output, while `@extend` (forms) and `--screen-until-desktop` (fieldset) ARE resolved by search's plugins (0 left). Record as a pre-existing baseline defect; don't "fix" silently.
- Therefore the search app must keep: postcss-extend-rule + postcss-custom-media (+ `main/media-queries.css` definitions) until design's forms/fieldset are re-implemented locally.
- `design build icons` (`package.json:scripts.build`) generates `public/design/icons.svg` + `public/design/icons/*` from `design.config.js` (17 MDI icon names via `@mdi/svg`, **undeclared dependency**, resolves only via design's deps). Dockerfile then copies `public/design/icons.svg -> public/icons.svg`. No network involved (local `@mdi/svg`). Both outputs are git-ignored. When design components are removed, icon usage (`Icon` x19 in code) needs a replacement sprite/component and this build step can go.
- Design components used by search (import counts): `classNames` 26, `Button` 24, `Icon` 19, `Card` 13, `Modal` 9, `Link` 8, `TextField` 7, `Header` 5, `Popover` 3, `MetadataList` 3, `Form` 3, `SearchResult` 2, `LoadingBar` 2, `Fieldset` 2, plus single-use `Select`, `ProgressSpinner`, `MathMarkdown`, `Histoslider`, `Footer`, `ExpandableList`, `DataProviderLogo`, `useCookie`, `DesignProvider`, `Cookies`, `CookiesProvider` (102 import lines across the repo; see the design-system audit for detail).

### 3.5 Recommendation / safety checks for CSS
1. Before touching anything: capture **CSS output snapshots** of the production build (`.next/static/css/*.css` and per-chunk) - keep as artifact; after each step diff **class-name-agnostic** (normalize hashes) and diff the *set of declarations per selector*.
2. Add a Playwright/Percy-style **screenshot baseline** of the 6 routes (`/search?q=...`, `/works/:id`, `/outputs/:id`, `/outputs/update`, `/data-providers`, `/data-providers/:id`, 404) at 3 widths (1440, 1024, 390; 767 breakpoint is the only custom media) before the Next bump. Mobile width is mandatory because all 6 custom-media rules are mobile-only.
3. Test that `styles.<camel>` lookups are defined: a jest/vitest test that imports every `*.module.css` through the project's own CSS-modules transform and asserts every `styles.xxx` identifier referenced in the matching JSX exists (a small static script using regex over 59 files is enough and catches the silent-undefined failure class).
4. Keep `main/media-queries.css`, extend-rule, and `color-mod` handling until design is gone; then delete `postcss.config.js` entirely (Next/Vite defaults) and `cssnano`, `postcss-*` devDependencies (5 packages) plus `stylelint-config` extends for `@extend`.

---

## 4. Husky 4 -> 9, lint-staged

Current state (verified):
- `package.json` has `husky ^4.3.0` (installed 4.3.8) but **no `husky` key**, no `lint-staged` dependency or key, no `.huskyrc*`, no `.husky/` dir, `git config core.hooksPath` empty.
- `.git/hooks/` contains the 20 husky-4 stub scripts + `husky.sh` + `husky.local.sh` generated on the maintainer's Mac on 2025-05-27 (`From: node_modules/husky`). With husky 4 and no config they do nothing (exit 0). **Net effect: no commit-time checks.**
- Dockerfile does `npm ci` with scripts enabled, so husky 4's install script runs inside the image (not verified what it does without `.git`; it has been building fine).

Reference (dashboard): `package.json` `"prepare": "husky"`, `husky ^9.1.7`, `lint-staged ^16.3.1`; `.husky/pre-commit` contains `. "$(dirname -- "$0")/_/husky.sh"` + `npx lint-staged` (the sourcing line is deprecated in husky 9 and gives a warning in v9.1+/removed in v10; new-style hook is just `npx lint-staged`); `lint-staged`: `"*.{js,jsx,ts,tsx}": ["eslint --fix --format compact"]`; `Dockerfile` sets `HUSKY=0`.

Migration steps for search:
1. `npm uninstall husky@4` (its postuninstall removes the husky-4 stubs from `.git/hooks` of that clone; other developers' clones keep stale stubs until they remove `.git/hooks/*` husky files or run `git config --unset core.hooksPath`/reinstall - harmless but noisy; document in README).
2. `npm i -D husky@9 lint-staged@16`, script `"prepare": "husky"`, `.husky/pre-commit` = `npx lint-staged`.
3. lint-staged config (new, since none exists):
```
"lint-staged": {
  "*.{js,jsx}": ["eslint --fix", "prettier --write"],
  "*.css": ["stylelint --fix", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"]
}
```
   Do not enable until section 2.4 step 1 (lint-zero baseline) is done, otherwise the first commit touching a dirty file is blocked. (Note lint-staged only lints changed files, so existing 29 errors in 11 files hit only those files.)
4. Docker/CI: set `HUSKY=0` env (as dashboard does) so `npm ci` in image does not try to configure git hooks; husky 9 also skips when `.git` missing, but be explicit. Dockerfile has `COPY . .` before install so `.git` is absent only if `.dockerignore` excludes it (there is none; see sec 5).
5. Optional `commit-msg` hook: none exists; do not add during upgrade.
6. Hooks must not be the only gate (they can be bypassed with `--no-verify`): mirror them in CI (sec 5.4).
7. Husky 9 requires Node >= 18 (fine); `prepare` script runs on `npm ci` for contributors; with `--ignore-scripts` hooks aren't installed (fine for CI).


---

## 5. CI/CD, Docker, Kubernetes

### 5.1 Dockerfile (`Dockerfile`, 29 lines, single stage)

| Aspect | Today | Issue / upgrade impact |
|---|---|---|
| Base | `node:18-alpine` (line 1) | Node 18 is EOL (Apr 2025). Dashboard uses `node:24-alpine`. Node version is gated by Next version: Next 10 / webpack 4 needs `NODE_OPTIONS=--openssl-legacy-provider` on Node >= 17 (line 23, README says the same for Windows); Next 13.5+/14 required for Node 20+ comfort; Next 15 needs Node >= 18.18; Next 16 needs Node >= 20.9 (verify on target version). `package.json engines` says `>=16.18.1`. |
| Layering / cache | `COPY . .` (17) happens BEFORE `npm ci` (19) -> any source change invalidates the install layer; no BuildKit cache mounts; no `--cache-from/--cache-to` in workflows (both build with plain `docker buildx build --push`). Every run reinstalls ~1,760 packages (lockfile has 1,760 `node_modules/` entries) | Split `COPY package*.json` -> install -> `COPY .`; use `--mount=type=cache,target=/root/.npm` and `cache-to=type=gha`. |
| `.dockerignore` | **none** | Local builds copy `node_modules` (438 MB), `.next` (489 MB), `.git`, `.idea`. CI checkout is clean, but local `docker build` isn't. Dashboard has one. |
| Install | `npm ci --include=dev --legacy-peer-deps \|\| npm install --include=dev --legacy-peer-deps` (19) | The `\|\|` fallback re-resolves silently when `package-lock.json` is out of sync (lockfile v2). On this device `npm ls` reports many `invalid`/`extraneous` entries (`@babel/core` etc.), i.e. `package.json` and lock/node_modules have already drifted. `--legacy-peer-deps` hides peer conflicts (React 17 / mobx etc.). Upgrade should end with a clean `npm ci` without fallback and without `--legacy-peer-deps`, or the drift stays hidden. |
| Registry auth | `.npmrc` written from build-arg `NPM_TOKEN` (18), removed after install (20) | `NPM_TOKEN` is a build ARG used in a RUN -> **visible in `docker history`**; it is also pushed into the runtime K8s secret (both workflows `--from-literal=NPM_TOKEN=...`, which `envFrom` injects into every pod). Use `RUN --mount=type=secret` and drop NPM_TOKEN from the runtime secret. `@oacore/design` (and `@oacore/*-config`) come from GitHub Packages - if design is removed the token/registry dependency can go (then also build stops needing GitHub PAT). |
| Build | `npm run build` = `node ./data/data-loader.js && node ./node_modules/.bin/design build icons && next build`, then copies `public/design/icons.svg -> public/icons.svg`, `public/static/images/* -> public/images/` | Network step (7). `design build icons` needs `@oacore/design` bin (`yargs`, `svgo`, `svg-sprite`...). Static images are duplicated into `public/images` (some code uses `getAssetsPath('/static/images/..')`, some may use `/images/..`; unknown which; check before removing). |
| Runtime | `ENV NODE_ENV`, `APP_ENV`, build-time `env` inlined by `next.config.js:12 env: envConfig`; `CMD node_modules/next/dist/bin/next start -p 8080` | Full `node_modules` incl. dev deps and sources in final image (no multi-stage, no `output:'standalone'`); image size not measured (no docker on device) but ~0.4 GB node_modules + 0.2-0.5 GB `.next` + sources -> estimated > 1 GB. Next 12.1+ `output: 'standalone'` (Next 12.2+ stable-ish; verify) + multi-stage would shrink it, but it changes startup command (`node server.js`) and where `.next/static`, `public` must be copied -> **K8s probes/ports unaffected, but Dockerfile CMD and COPY must change together**. Do NOT combine with the framework bump. |
| Runtime user | root (no `USER`) | out of scope, note. |
| Env | `ARG`/`ENV`: `BUILD_TARGET` (default `azure`), `SENTRY_DSN`, `NODE_ENV`, `APP_ENV`, `GA_TRACKING_CODE`, `API_KEY`, `ICONS_PUBLIC_PATH` | `ICONS_PUBLIC_PATH` is passed everywhere but **no code reads it** (grep over repo + design bin: 0 hits) -> dead. `API_KEY` is inlined into the **client bundle** by `env.config.js` (`env: envConfig` in next.config.js) - treat as public. `API_URL` is chosen by `APP_ENV` at build time (`env.config.js:3-17`), so one image per environment (prod and stage images are built separately). |

### 5.2 Workflows (`.github/workflows/aks_deploy.yml` prod, `aks_stage_deploy.yml` stage)

| Aspect | Today |
|---|---|
| Triggers | `push` to `main` (prod) / `stage` (stage), **nightly `schedule` cron (03:00 prod, 04:00 stage UTC)**, `workflow_dispatch`. **No `pull_request` trigger.** |
| Runner | `ubuntu-24.04-arm`, buildx `--platform linux/arm64` (cluster is arm64) |
| Steps | checkout@v4 -> azure/login@v2 (OIDC) -> compute tag `<sha7>-prod|-stg` -> `az acr login` -> setup-buildx@v3 -> `docker buildx build --push` with build-args -> `az aks get-credentials --admin` -> create/apply K8s secret -> apply manifests -> `envsubst '${IMAGE}'` + `kubectl apply --server-side --force-conflicts` -> `kubectl rollout status --timeout=300s` |
| Secrets/vars used | `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `NPM_TOKEN`, `GA_TRACKING_CODE`, `API_KEY`, `SENTRY_DSN`, `ICONS_PUBLIC_PATH`; GitHub environment `azure`. (Note: prod and stage use the same `API_KEY` secret name - dashboard's stage uses `API_KEY_STG`; confirm intended.) |
| Node setup / cache | none on the runner (everything in Docker); no `actions/cache`, no buildx cache |
| Lint / tests / typecheck | **none** (no `npm test` script exists, no test files/deps) |
| Gates after deploy | only `kubectl rollout status` (probe-based) |
| Pin policy | actions pinned to major tags; no Dependabot config in repo |

Important behavioural coupling: **nightly cron rebuilds `main` and redeploys** - this is also how `data/.statistics.json`, `.formap.json`, `.members.json` get refreshed in the image (see sec 7). Any change to the build that makes it flaky/slow (network, install, Node/Next incompatibility) will first show up as a failing nightly with no human in the loop.

### 5.3 Kubernetes manifests - what depends on build-output layout

| Dependency | File:line | Notes for the upgrade |
|---|---|---|
| Container port 8080 named `http`; Service port 80 -> `targetPort: http` | `kube/*/deployment.yaml:57-60`, `service.yaml:13-16` | `next start -p 8080` is the contract. Keep port 8080 even if CMD changes (standalone: `PORT=8080 HOSTNAME=0.0.0.0 node server.js`). |
| Probes: startup/readiness/liveness all `GET /api/healthz/` | `deployment.yaml:65-87` | Served by `pages/api/healthz.js` (static JSON, bypasses `_app`). Trailing slash is required by `trailingSlash: true` in `next.config.js:11` (non-slash would 308). Pages Router API routes keep working through all targeted Next versions; if ever migrating to App Router keep `/api/healthz/` identical. **Good safety hook:** it intentionally doesn't touch upstream API, so a green rollout says nothing about SSR/data correctness -> add a real smoke test (below). |
| Rollout | `maxSurge 2, maxUnavailable 0`, startupProbe up to 60x5s = 300s; workflow waits 300s | Next 13+ cold start could be slower; keep headroom. |
| Memory | prod: request 512Mi / limit 768Mi but `NODE_OPTIONS=--max-old-space-size=1024` (deployment.yaml:41-42) | heap limit (1 GiB) exceeds container limit (768 Mi) -> OOMKill rather than GC pressure. HPA scales at 80% of the 512Mi request (`hpa.yaml:19-25`, min 4/max 15). A Next major bump changes memory profile - load-test and re-tune before prod. **Also: runtime `NODE_OPTIONS` overrides the Dockerfile `ENV NODE_OPTIONS="--openssl-legacy-provider"`**, so the legacy-openssl flag is NOT active at runtime today (only during build) - i.e. runtime is already fine without it; remove the flag when webpack 4 goes. |
| Env | `Internal_API`, `Internal_API_HOST` (server-side only, `api/internalize.js:17-18`; NOT inlined, read at runtime), `UV_THREADPOOL_SIZE=32`; `envFrom` secret `core-frontend-search-secrets` (NPM_TOKEN, GA_TRACKING_CODE, API_KEY, ICONS_PUBLIC_PATH) | `GA_TRACKING_CODE`/`API_KEY` at runtime are redundant with build-time inlining (`next.config.js env`). Next 13+ still inlines `env`; if migrating to `NEXT_PUBLIC_*` the names change - avoid in this upgrade. |
| Gateway paths (`httproute.yaml`) | `/search`, `/works`, `/outputs`, `/data-providers` -> pod; `/static/search*` -> URLRewrite prefix `/`; `/display*` -> `/outputs` | Static assets are served from `assetPrefix=/static/search` (when `BUILD_TARGET=azure`, `utils/helpers.js:1-2`, `next.config.js:13`); the gateway strips the prefix. Next rewrites in `next.config.js:15-27`: `/search/_next/data/:path*` -> `/_next/data/:path*` (production only, `utils/helpers.js:4-20`) and `/static/:path*` -> `/:path*`. These interact with the monkey patch `useInterceptNextDataHref` (`pages/_app.jsx:70-81`) that rewrites `router.pageLoader.getDataHref` - **`router.pageLoader` is a private Next API**; changed across 11/12/13. If it stops being called, client-side navigation to `getServerSideProps` pages 404s at the gateway (no `/search` prefix on `/_next/data`). This must be covered by an e2e test (client-side route transition in prod mode behind a path-prefix proxy). |
| Request timeouts | 35s/30s | unaffected |
| Stage differences | `replicas: 1`, cpu 1200m request / 1500m limit, mem 1Gi limit; no HPA/PDB | stage is the place for canary of each step |

### 5.4 Where to add gates (proposal)

1. **New `.github/workflows/ci.yml` on `pull_request` (and `push` to non-deploy branches):** `actions/setup-node` (Node matching Dockerfile; use `.nvmrc`/`engines`), `npm ci` (with `actions/cache` npm or lockfile-keyed), then in parallel jobs: `eslint`, `stylelint`, `prettier --check`, `next build` smoke (see sec 7 for data/network), unit tests (vitest/jest + RTL; none exist today), bundle-size report. Required status checks on `main`/`stage`.
2. **Make both deploy workflows `needs: ci`** (or reuse the same CI as a reusable workflow) so a push cannot deploy without gates; keep the nightly cron but run it only after a smoke test passes on the freshly built image (`docker run` + `curl /api/healthz/` + `curl /search/?q=test` + `/works/<id>`), otherwise the nightly can ship a bad data refresh silently.
3. **Post-deploy smoke in the deploy workflow:** after `rollout status`, `curl -f https://stg.core.ac.uk/search/?q=test` for stage; for prod, run on stage first (promote by same image digest instead of rebuilding per env - today each env rebuilds from source, so what ran on stage is not what is promoted; because `API_URL` is inlined at build time this requires moving env selection to runtime, out of scope for this upgrade but note it).
4. **Docker layer caching**, `HUSKY=0`, BuildKit secret for NPM_TOKEN (sec 5.1).
5. Add Dependabot/Renovate config (none) with grouped PRs to keep libs current after this upgrade.


---

## 6. Observability: Sentry, LogRocket, GA4 - every call site

### 6.1 Sentry (`@sentry/browser` + `@sentry/node`, both 5.30.0; `@sentry/tracing` 5.30 transitive)

| # | Site | What | Notes |
|---|---|---|---|
| S1 | `utils/sentry.js:3-15` | `const Sentry = require('@sentry/node')`; `Sentry.init({dsn})` only if `process.env.SENTRY_DSN`; exports `{ Sentry }` | Single init for both server and client; relies on webpack alias in `next.config.js:97` (`'@sentry/node': config.isServer ? '@sentry/node' : '@sentry/browser'`) so the same `require` becomes browser SDK in the client bundle. No release, environment, tracesSampleRate, integrations, beforeSend. DSN inlined at build via `env.config.js:29`. |
| S2 | `pages/_app.jsx:21-27` | `process.on('unhandledRejection'/'uncaughtException', err => Sentry.captureException(err))` at module scope | Executes in the **browser bundle too** (`process.on` must exist in the polyfill; webpack 4 `process` shim has `.on`; webpack 5 / Next 12+ does not guarantee it -> verify, could throw `process.on is not a function` at module load and white-screen every page). On the server it adds handlers that swallow crash semantics (process keeps running after uncaughtException). In the new SDK the node `onUncaughtException/onUnhandledRejection` integrations already do this -> double reporting. |
| S3 | `pages/_app.jsx:30-42` | `ErrorBoundary.componentDidCatch` -> `Sentry.withScope` + `scope.setExtra` + `Sentry.captureException` | `withScope`, `setExtra`, `captureException` all exist in v8-10 (setExtra is still supported; `setContext` preferred). No capture of `getServerSideProps` errors or API-route errors. |

No other Sentry usage (grep over js/jsx: only `utils/sentry.js` and `pages/_app.jsx`). `next.config.js:79-84` has a TODO about 3rd-party sourcemaps "once we use Sentry"; `@zeit/next-source-maps` provides prod browser sourcemaps but nothing uploads them.

Migration impact to `@sentry/nextjs` (docs: docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup; targets Next 14+/15+; Node >= 20.19 stated there; verify against the Next version chosen):
- Replace both `@sentry/*` packages with ONE `@sentry/nextjs`; **delete the `@sentry/node` webpack alias** (it would break the package) and the `utils/sentry.js` indirection; `Sentry` import becomes `import * as Sentry from '@sentry/nextjs'`.
- New files: `instrumentation-client.ts` (or `sentry.client.config.js` on older Next), `sentry.server.config.js`, `sentry.edge.config.js`, `instrumentation.js` (`register()` + `onRequestError`), `pages/_error.jsx` using `Sentry.captureUnderscoreErrorException`; wrap `next.config.js` with `withSentryConfig(...)` - composes with existing `withImages(withSourceMaps(...))` chain: order matters and `@zeit/next-source-maps` must go (use `productionBrowserSourceMaps`/sentry plugin).
- Source-map upload needs `SENTRY_AUTH_TOKEN` as a build secret (dashboard does this: `vite.config.ts` + Dockerfile `SENTRY_AUTH_TOKEN`, `SENTRY_RELEASE=<sha7>`); add to the BuildKit secret list, not `--build-arg`.
- Remove `process.on(...)` handlers in `_app` (S2) or replace with SDK integrations.
- **CSP**: `csp.config.js:52` has `connect-src ... sentry.io` only. A host-source without wildcard does not match `oNNN.ingest.sentry.io`. Existing DSN host unknown (secret). Also `worker-src`/`child-src` already allow `blob:` (needed for replay). Update CSP and test in browser; consider `tunnelRoute` (adds a Next route - check gateway paths!). Note gateway only forwards `/search,/works,/outputs,/data-providers,/static/search,/display` to this app, so a tunnel route must live under one of those prefixes.
- Behaviour changes to pin: DSN absent -> no-op (keep `if (dsn)`), `environment` (use `APP_ENV`), `release` (sha7).
- v5 -> v10 API breaks relevant here are small (only captureException/withScope/init used); the big risk is **setup and build integration**, not call sites.

### 6.2 LogRocket (`logrocket` 10.0.0; `logrocket-react` 6.0.3 declared but **never imported** -> remove)

| # | Site | Call |
|---|---|---|
| L1 | `pages/_app.jsx:91` | `LogRocket.init('cab1al/search-gfe6o')` **inside the `App` render function, production only** -> executed on every render and during SSR (logrocket guards no-window). Hard-coded app id, no `setupLogRocketReact`, no `LogRocket.identify`. |
| L2 | `api/index.js:117` | `LogRocket.captureException(error)` in `executeRequest` network-error branch (fetch rejection). Imported at `api/index.js:1` and also flagged by lint (`import/no-named-as-default` at :4, unrelated). |
| L3 | `modules/dropdown/index.jsx:62` | `LogRocket.captureMessage('Failed to fetch logo. Status: ...')` |
| L4 | `modules/dropdown/index.jsx:68` | `LogRocket.captureException(err)` |

CSP coupling: `csp.config.js:6` allows `*.logrocket.com *.lgrckt-in.com` in script/connect/img/media/worker/child. API used is stable across majors (init/captureException/captureMessage); the risk is only version-bump regressions in SSR import (`window` access) - covered by a render-on-server smoke test. LogRocket-Sentry integration (`LogRocket.getSessionURL` -> Sentry) is NOT set up; do not add during upgrade.

### 6.3 GA4 (`react-ga4` 2.1.0) - `hooks/use-analytics.js` (single file, used once from `main/index.jsx:13`)

| # | Line | Call | Behaviour (as-is, including latent bugs - pin with characterization tests, do not "fix" in the same PR) |
|---|---|---|---|
| G1 | 7 | `useCookie('analytics_cookies_allowed')` from `@oacore/design` (react-cookie under the hood; cookie value `'true'`/`'false'`, default false) | **Consent depends on design package** (`CookiesProvider` in `_app.jsx:104`, `Cookies` popup in `main/index.jsx:22`). Removing design means re-implementing consent storage with the SAME cookie name/format or users are re-prompted / analytics silently stops. |
| G2 | 13-19 | `reportPageview(url, title, type='search')` -> `ReactGA.send({hitType: type, page: url, title: \`Search \| ${window.location.search.substring(1)}\`})` | `hitType` defaults to `'search'` (non-standard; GA4 pageview normally `'pageview'`). The `title` param is ignored. Called on mount for first page view and from `router.events 'routeChangeComplete'` (line 46) with `(url)` only. |
| G3 | 21-25 | in effect: `if (analyticsAllowed && NODE_ENV==='production') { console.log("GA"); ReactGA.initialize(process.env.GA_TRACKING_CODE) }` | stray `console.log("GA")` (lint error). `GA_TRACKING_CODE` inlined at build. Effect has `[]` deps -> **consent granted after mount never initializes GA until reload**; stale `analyticsAllowed`. |
| G4 | 26-31 | `else if (analyticsAllowed) window.ga = (...args) => console.log(...)` (dev stub) | dead for react-ga4 (uses gtag); cleanup sets `window.ga = null`. |
| G5 | 33 | `reportPageview(router.asPath)` unconditionally on mount | `ReactGA.send` is called even when consent is false / GA not initialized (react-ga4 then warns or no-ops; behaviour version-dependent). |
| G6 | 40-50 | `routeChangeComplete` subscribe/unsubscribe | page views on client navigation. |

No custom GA events, `ReactGA.event`, `gtag`, `dataLayer`, or enhanced-measurement code exists anywhere else (grep: 0). CSP allows GA/GTM/doubleclick/cloudflareinsights hosts. Cloudflare Web Analytics is injected outside the repo (CSP only).

### 6.4 Tests needed so analytics cannot break silently
1. Unit (vitest/jest + RTL, mock `react-ga4`, mock `next/router`, wrap with design's/own CookiesProvider): (a) consent=true + `NODE_ENV=production` -> `initialize(GA_TRACKING_CODE)` once; (b) consent=false -> `initialize` not called; (c) first render -> `send` called once with `{hitType:'search', page:<asPath>, title:'Search | <qs>'}`; (d) emitting `routeChangeComplete('/search?q=x')` -> `send` with that page; (e) unmount unsubscribes. These encode current behaviour including the quirks.
2. E2E (Playwright against `next start` build, prod mode): set cookie `analytics_cookies_allowed=true` and assert a request to `https://www.google-analytics.com/g/collect` (or `analytics.google.com`) with `en=...` fires on load and on client navigation; and none without the cookie. Use a dummy `GA_TRACKING_CODE=G-TEST`. Repeat on staging after deploy via the post-deploy smoke job.
3. Sentry: unit-test that a thrown render error in `ErrorBoundary` calls `captureException` once (mock `@sentry/nextjs`); staging check that an intentional test error event arrives (manual, once).
4. LogRocket: unit-test `executeRequest` rejection calls `captureException` (mock `logrocket`).

---

## 7. Build-time network dependencies (CI flakiness)

| # | Dependency | Where | Failure mode | Mitigation |
|---|---|---|---|---|
| N1 | **`node ./data/data-loader.js`** fetches `https://api.core.ac.uk/internal/{statistics,repositories/formap,members}` (hard-coded **prod** URLs even for stage builds; `getApiFromFileName` keys on file names `.statistics.json/.formap.json/.members.json`) | `package.json:scripts.build`; `data/data-loader.js:55-99` | `dataLoader()` does not await: `fs.readdir` callback fires `retrieveStats` (returns a promise) with no `.catch` -> on API 4xx/5xx/timeout it rejects (`throw new Error('Statistics retrieval failed due to API Core instability.')`) -> **unhandled rejection -> process exit 1 on Node >= 15 -> `npm run build` stops -> Docker build fails -> nightly deploy red**. No timeout or retry (the SSR loader in `lib/loader.js` has a 3 s AbortController timeout; the build one has none). It iterates every `*.json` in `data/` including `languages.json` (maps to null url -> skipped). Written by reading code, **not executed here** (would overwrite tracked cache files / needs network the sandbox lacks). | Make loader failure non-fatal (catch + keep committed cache), add timeout/retry; or move refresh to a separate scheduled job that commits the cache; skip in PR CI builds (`SKIP_DATA_REFRESH=1`). |
| N2 | Committed cache required at build: `import cachedStatistics from 'data/.statistics.json'` (`pages/_app.jsx:12`) | `.gitignore` ends with `data/*` but the 3 dotfiles + `languages.json` + `.gitkeep` ARE tracked (`git ls-files data`) | If anyone untracks them or cleans the repo, `next build` fails with "Module not found". `.formap.json` is 5.4 MB, `.members.json` 140 KB in git history (repo-size growth with each "cache refresh" commit: `Cache data refresh (#435)`, `Formap update (#444)`, `clean cache (#454)`). | Keep tracked; add a CI check that the 3 files exist and parse. |
| N3 | `next build` prerender of `/404` runs `_app.getInitialProps` -> `getStatistics/getDataProviders/getMembers` (`pages/_app.jsx:125-137`) | `lib/loader.js` | Reads cache first (exists, so no network). If cache missing: live fetch with 3 s timeout, failure tolerated (returns null). Not flaky as long as cache files exist. | OK. |
| N4 | `npm ci` from `registry.npmjs.org` **and** `npm.pkg.github.com` (`@oacore/*` incl. `@oacore/design` `latest`, `@oacore/*-config`) using `NPM_TOKEN` | `Dockerfile:18-20`, `package.json:dependencies["@oacore/design"]: "latest"` | Token expiry/rate limits make builds fail; **`@oacore/design: "latest"`** means a lock-less `npm install` (the `\|\|` fallback!) can pull a new design major. Lockfile pins 5.0.74 today. | Pin design to an exact version until removed; remove fallback. |
| N5 | `design build icons` | local `@mdi/svg` (+ svgo/sprite in design deps) | no network. Depends on undeclared `@mdi/svg` hoisting. | Declare `@mdi/svg` as devDependency now (zero-risk). |
| N6 | Docker base image pull / `apk` | `FROM node:18-alpine` | Docker Hub rate limits on shared runners; mirror in ACR. | optional |
| N7 | `browserslist`/`caniuse-lite` | local data; prints "11 months old" warning | none. `npx update-browserslist-db` changes the prefix output slightly (diff noise) - run it as its own commit. | |
| N8 | Runtime (not build): `lib/loader.js` + `api/*` call `api.core.ac.uk` | `internalize()` | n/a | |

There are **no** Google Fonts or other remote assets fetched at build time (`main/head.jsx` only references `https://core.ac.uk/favicon/...` at runtime).

---

## 8. Ranked "painful parts" with concrete safety checks

| Rank | Pain point | Why it is risky | Safety checks / gates (all runnable before + after) |
|---|---|---|---|
| 1 | **CSS-modules `camelCase` locals hack** (`next.config.js:37-77`) + 221 camelCase lookups | Silent `undefined` classNames, no build error; Turbopack/Lightning CSS ignore the hook | (a) static script asserting every `styles.x` identifier exists in the matching CSS module (class list after convention); (b) screenshot baselines (3 widths x 7 routes); (c) diff of class-name sets in `.next/static/css`; do codemod in own PR |
| 2 | **Design-system CSS contract** (extend-rule, custom-media from `main/media-queries.css`, color-mod defect, tokens `--primary/--gray-*`, global CSS order) | Removing/upgrading PostCSS plugins breaks design CSS; removing design removes ~37 tokens + component API variables | Keep the 4 plugins until design removed; CSS declaration-level snapshot of the production CSS before/after; `tokens.css` vendored first; keep pre-existing color-mod defect recorded as baseline |
| 3 | **Next 10 -> 12+ build system**: Babel/SWC, webpack 4 -> 5 (`config.node = {fs:'empty'}` at `next.config.js:38-42` must become `resolve.fallback`), `next-images` vs built-in images (`import x from '*.svg'` in 13+ files: `templates/output/update/index.jsx:11-12`, `report-success-modal.jsx:7-8`, `templates/search/index.jsx:12,15-16`, `templates/error/query.jsx:4`, `templates/data-provider/logo.jsx:4`, `.../index.jsx:5`, `modules/dropdown/index.jsx:12`, `pages/error-card/index.jsx:4`) | wrong asset types render `[object Object]`; `fs` bundling error; `@zeit/next-source-maps`/`next-images` unmaintained | Set `images.disableStaticImages: true` to keep next-images semantics (or codemod `.src`); build-output diff of `.next/static/media` + page manifest; bundle analyzer baseline (before/after sizes per route); e2e smoke of every route |
| 4 | **Legacy decorators / MobX store semantics** (`store/filters.js` 26 decorators; `@invalidatePreviousRequests` x5) | Reactivity regressions are silent (no UI update) and depend on class-field semantics | Convert to explicit `makeObservable` BEFORE framework bump; characterization tests per store (observable updates, `AbortController` cancellation of previous request, filter actions); keep `jsconfig experimentalDecorators` only if anything remains |
| 5 | **`useInterceptNextDataHref` + `/search/_next/data` rewrite + `assetPrefix`** (`_app.jsx:70-81`, `next.config.js:13-27`, `httproute.yaml`) | Private API; breaks client-side navigation only behind the gateway prefix | Prod-mode e2e behind a local nginx reproducing the 3 gateway rules: click-through navigation `/search -> /works/:id -> back`; assert `/_next/data` URLs start with `/search` |
| 6 | **Build-time network & committed data cache** (N1/N2/N4) and nightly redeploy | Flaky/failing unattended nightly; token/registry dependency; `@oacore/design: latest` | Make data-loader non-fatal + timeout; CI check on data files; pin design; run the real Docker build in PR CI (cached) |
| 7 | **No lint/test gates; lint already failing; husky inert** | Nothing prevents regressions during a multi-step upgrade | Lint-zero baseline commit first; PR workflow (sec 5.4); characterization tests (analytics, stores, `api` wrappers, `getAssetsPath/rewriteDataPath`, `env.config`); `lint-staged` after baseline |
| 8 | **Analytics/Observability** (GA4 consent via design cookie hook; Sentry 5 -> nextjs alias removal; `process.on` in client bundle; CSP hosts) | Silent loss of tracking/error reporting | Tests in sec 6.4; staging verification of a GA hit and a Sentry test event per release; CSP `connect-src` update + browser console check |
| 9 | **Prettier/ESLint/stylelint major bumps** | Config format break, plugin ecosystem (airbnb) dead for ESLint 9+, 29 existing errors | Format-only commit (Prettier 3, `trailingComma:'es5'` kept explicitly -> expected small diff; verify with `git diff --shortstat` in a throwaway worktree; add to `.git-blame-ignore-revs`); run old+new ESLint side by side, compare against committed `eslint-baseline.json`/`eslint-resolved-config.*`; `eslint --print-config` diff of rule set |
| 10 | **Docker/Node/K8s runtime** (Node 18 -> 22/24, `--openssl-legacy-provider`, memory limits, probes, port) | Cold-start/memory regressions show only under prod traffic | Build image in CI and run `docker run` + curl `/api/healthz/` and 6 routes; compare `docker image ls` size and RSS under a k6/autocannon run on stage before/after; keep port 8080 + `/api/healthz/`; stage canary first (1 replica, bigger limits) |
| 11 | **Browserslist target / polyfills** (`last 3 versions` pulls BlackBerry, IE Mobile, KaiOS, Opera Mini; `core-js` usage:corejs3) | Output differences; dropping polyfills may remove behaviour for old browsers (policy decision) | Decide supported browsers explicitly; Lighthouse baseline (perf/a11y/best-practices) per route and bundle-analyzer baseline; run `npx browserslist` diff |
| 12 | **Undeclared transitive deps** (`node-fetch`, `@mdi/svg`, `@babel/runtime`, `yargs`) | `npm ci` re-resolution can drop them -> build breaks | Declare them explicitly in step 0 (no behaviour change) |

### Suggested "step 0" tooling PRs (all behaviour-neutral, independently revertible)
1. Fix the 29 lint errors (or `--fix`), commit `eslint-baseline.json`/`stylelint-baseline.json` in CI as artifacts; add `ci.yml` (lint + prettier + docker build without push) and gate deploys on it.
2. Declare `node-fetch`, `@mdi/svg`, `@babel/runtime` (and `yargs` if design bin needs it); pin `@oacore/design` to `5.0.74`; remove duplicate `@zeit/next-source-maps` and unused `logrocket-react`; remove dead `ICONS_PUBLIC_PATH`.
3. Rewrite 2 `export X from` sites; convert `store/filters.js` decorators to explicit `makeObservable`; add store/analytics characterization tests.
4. Make `data/data-loader.js` fail-safe (catch + timeout); `.dockerignore`; Docker layer cache; BuildKit secret for NPM_TOKEN.
5. Capture baselines: production CSS snapshot, `.next` build manifest + route sizes (`next build` output table), bundle analyzer report, Lighthouse JSON for 6 routes, Playwright screenshots, `npm ls --all` + `npm audit` JSON.
6. Only then: Prettier 3 format-only commit -> ESLint flat/stylelint 16 -> husky 9 + lint-staged -> Next/React bump (separate audits).

### Verification notes / limits of this audit
- Executed on device (read-only): `npm run lint`, `eslint`, `stylelint`, `prettier --check`, `eslint/stylelint --print-config`, `browserslist`, and an offline run of the exact PostCSS plugin chain over 28 CSS files + 3 design CSS files with output to a scratch directory (`<scratch>/cssaudit/out`, not the repo). New files written only under `docs/upgrade/findings/`.
- NOT executed: `npm run build` / data-loader (network + would modify tracked data files), Docker build, any `npm install`.
- Not verifiable offline (no registry access in sandbox): latest versions of Prettier 3, ESLint 9/10 plugins, stylelint 16 configs, `@sentry/nextjs`; Node-version requirements of Next 15/16. Treat statements flagged "verify" accordingly.
