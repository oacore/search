# 01 - Dependency inventory, coupling graph and upgrade waves

Audit date: 2026-10-19. Scope: `search/package.json` + `package-lock.json` (lockfileVersion 2, 1760 resolved packages, `node_modules` matches the lock exactly: 0 missing, 0 version mismatches). Read-only audit, no repo file was modified.

## 0. Method and caveats (read first)

| Item | Detail |
|---|---|
| Installed versions | Read from `node_modules/<pkg>/package.json` and cross-checked with `package-lock.json` (identical for every direct dependency). |
| "Latest" versions | The npm registry is NOT reachable from the device or from the audit container (HTTP 403 policy denial for `npm view` and `npm audit`). Latest versions/peers/engines/deprecation were read by fetching `https://registry.npmjs.org/<pkg>/latest` through a web-fetch proxy on 2026-10-19. Treat as "very likely right, re-verify with `npm view <pkg> version peerDependencies engines deprecated` on a networked machine before pinning". Two values were inconsistent between fetches (`mobx-react-lite` latest = 5.0.3 via `/latest`, 5.1.0 via packument; `mobx` 7.0.5 vs 7.0.3). |
| `@oacore/*` | Published on GitHub Packages (`.npmrc.dist`: `@oacore:registry=https://npm.pkg.github.com`, token required). Latest versions could NOT be queried; only installed versions are known. |
| `npm audit` | Could not run (`403 Forbidden - POST /-/npm/v1/security/audits/quick` on device; no registry at all in the container). A partial substitute using the GitHub Advisory Database (about 45 package@version pairs, rate-limited, see section 6) is provided. **Re-run `npm audit --json` on a networked machine before wave 1.** |
| `npm ls` on the device | Reports ~638 "extraneous" and ~215 "invalid" lines. This is a mount/tree artefact (lock and disk agree 100%); ignore it, use the lock as source of truth. |
| Machine facts | Device Node v22.23.2, npm 10.9.8. `package.json` engines: node `>=16.18.1`, npm `>=8.19.2`. `Dockerfile`: `FROM node:18-alpine`, `NODE_OPTIONS=--openssl-legacy-provider`, `npm ci --include=dev --legacy-peer-deps \|\| npm install --include=dev --legacy-peer-deps`. Dashboard (target) uses pnpm, `engines.node >=24`, Vite 7, no Next.js. |

## 1. Top findings (summary)

1. **Next 10.2.3 is on webpack 4.44.1** (Next ships `next/dist/compiled/webpack/bundle4.js` and `bundle5.js`; the custom `webpack()` function in `next.config.js` with `config.node = { fs: 'empty' }` keeps it on webpack 4). Next 11 flips the default to webpack 5, Next 12 deletes webpack 4. This is the single biggest technical cliff, and `next-images`, `@zeit/next-source-maps`, `config.node.fs`, the CSS-modules patch in `next.config.js` all die on it.
2. **`@oacore/design@5.0.74` hard-pins `react`/`react-dom` peer to `^17.0.1`** and drags `react-slick@0.28.1` (peer React <=17). Any React 18/19 install fails with ERESOLVE unless `--legacy-peer-deps`/`overrides` is used (the Dockerfile already uses `--legacy-peer-deps`). Copying design components into search (or `overrides`) must happen before/with the React 18 bump.
3. **`--legacy-peer-deps` is currently mandatory**, caused by: `logrocket-react@6.0.3` (peer `react >=18` vs installed 17.0.2; and it is not imported anywhere in the source), `eslint-config-airbnb@18.2.1` (peer `eslint-plugin-react-hooks` not installed), `file-loader`/`url-loader` (peer `webpack`, absent from node_modules because Next bundles it).
4. **The lint stack cannot move past ESLint 7 until `@oacore/eslint-config-react` is dropped**: it pulls `eslint-config-airbnb@18` / `airbnb-base@14` (peer `eslint ^5 || ^6 || ^7.2`) and `prettier/react` (removed in eslint-config-prettier 8). Same for Stylelint: `@oacore/stylelint-config-base@1.0.6` depends on `stylelint-config-twbs-bootstrap@2` (peer `stylelint ^13.13.1`) and `stylelint-order@4` (<=13), so Stylelint is frozen at 13.
5. **MobX 7 and mobx-react-lite 5 require React 18+ and drop legacy decorators**. Only one file uses decorators (`store/filters.js`, `@observable`). Safe intermediate: `mobx@6.15.x` + `mobx-react-lite@4.1.1` (peer `react ^16.8 || ^17 || ^18 || ^19`) which works on React 17, 18 and 19.
6. Declared-but-unused dependencies: `filesize`, `throttle-debounce`, `logrocket-react` (zero imports in source), `@babel/plugin-syntax-dynamic-import` (no-op), `cssnano` (only configured in `postcss.config.js`). Phantom dependency: `data/data-loader.js` does `require('node-fetch')` which is NOT declared (it only exists because Next 10 depends on `node-fetch@2.6.1`, which has a high-severity advisory). Note: `@oacore/design` is imported deeply (`@oacore/design/lib/...`, 101 import sites) so copying is a path-rewrite job.
7. `package.json` lists `@zeit/next-source-maps` twice: `"0.0.4"` in dependencies (unsatisfied: lock/installed is 0.0.3 and `latest` dist-tag is 0.0.3, 0.0.4 looks non-existent) and `"0.0.3"` in devDependencies (deprecated: "Next.js now has built-in support for Source Maps"). `npm ci` strict validation is therefore suspect and the Dockerfile `|| npm install` fallback may silently ignore the lock.
8. **`bibtex-parse-js@0.0.24` has `ava@^0.15.2` + `xml2js@*` in its `dependencies`**: ~557 of the 1760 lock entries (~32%) hang off this one 11 KB library (babel-core 6, power-assert, core-js@2, chokidar 1, configstore/dot-prop 3, braces/micromatch 1-3, json5 0.5 ...) and flagged as production. Replacing it (e.g. `@orcid/bibtex-parse-js@0.0.25`, zero deps) shrinks the tree and removes many audit findings in one low-risk step.
9. Security (partial, section 6): Next 10.2.3 alone matches at least 16 GitHub advisories (1 critical RCE in image optimisation with AVIF, several high); `node-fetch@2.6.1` high; `postcss@8.4.14` / `8.2.13` / `7.0.39` medium; `lodash@4.17.21` is flagged by newer advisories (fixed 4.18.0); `svgo@1.3.2` high (pulled through `@oacore/design` -> svgstore, shipped in the prod tree); `nth-check@1.0.2` high; `json5`, `braces`, `shell-quote` (critical; lock-flagged prod but reached only via Next's dev overlay) etc.

## 2. Direct dependency inventory

Columns: **Declared** = range in `package.json`; **Installed** = `node_modules` = lock; **Latest** = npm `latest` dist-tag on 2026-10-19 (see caveat); **Maj.** = majors behind; **Use** = where it is used in search source (grep of 157 `.js/.jsx` files, `node_modules`/`.next` excluded); **Fate** = target architecture (KEEP+UPGRADE / REPLACE / REMOVE).

### 2.1 `dependencies` (24)

| Package | Declared | Installed | Latest | Maj. | Deprecated / health | Use in search | Fate |
|---|---|---|---|---|---|---|---|
| `@oacore/design` | `latest` | 5.0.74 | n/a (private GH Packages) | ? | design repo at `../design` is the same 5.0.74; to be deprecated | 69 files, 101 import sites; deep imports `@oacore/design/lib/{elements,modules,utils,utils/class-names,elements/logo,elements/icon,index.css}` | **REMOVE** (copy used components verbatim, then antd) |
| `@oacore/stylelint-config-base` | `^1.0.6` | 1.0.6 | n/a (design devDeps want `^2.0.0-stylelint.1`) | ? | config package, sits in `dependencies` (should be dev) | `stylelint.config.js` (resolved through absolute `node_modules` path) | **REPLACE** (stylelint-config-standard) or REMOVE |
| `@sentry/browser` | `^5.28.0` | 5.30.0 | 11.8.0 | 6 | advisory GHSA-593m-55hh-j8gv (prototype-pollution gadget) fixed in 7.119.1/8.33.0 | only via webpack alias in `next.config.js` (`@sentry/node` -> `@sentry/browser` client side); no direct import | **REPLACE** with `@sentry/nextjs` (stay on Next) or `@sentry/react` (dashboard uses `@sentry/react ^10.49`) |
| `@sentry/node` | `^5.28.0` | 5.30.0 | 11.7.0 | 6 | same as above | `utils/sentry.js` (`require('@sentry/node')`, `Sentry.init({dsn})` only) | **REPLACE** (as above) |
| `@zeit/next-source-maps` | `0.0.4` | 0.0.3 (hoisted, flagged `dev`) | 0.0.3 | 0 | **DEPRECATED** ("Next.js now has built-in support for Source Maps"); declared 0.0.4 unsatisfiable; duplicated in devDependencies | `next.config.js` `withSourceMaps(...)` | **REMOVE** (`productionBrowserSourceMaps: true` if wanted) |
| `babel-plugin-add-react-displayname` | `^0.0.5` | 0.0.5 | 0.0.5 | 0 | unmaintained (last release ~2018); build-time Babel plugin in a prod dependency | `babel.config.js` only | **REMOVE** (devDependency until Babel is dropped; no SWC equivalent, displayName only helps devtools) |
| `bibtex-parse-js` | `0.0.24` | 0.0.24 | 0.0.24 | 0 | **declares `ava ^0.15.2` and `xml2js *` as RUNTIME dependencies**: drags **557 packages** (ava 0.15, babel-core 6, power-assert, core-js@2, chokidar 1, update-notifier/configstore/dot-prop 3, ...) into the prod tree; the library itself is one 11 KB file | `templates/output/citation.jsx` (`bibtexParse.toJSON`) | **REPLACE** with the ORCID fork `@orcid/bibtex-parse-js@0.0.25` (no dependencies, same origin repo `ORCID/bibtexParseJs`; verify API parity) or vendor the file |
| `core-js` | `^3.8.1` | 3.42.0 | 3.50.0 | 0 | healthy; used implicitly (`useBuiltIns: 'usage', corejs: 3` in `babel.config.js`) | no direct import | KEEP+UPGRADE (minor), later REMOVE when browserslist is modern and SWC/Next handle polyfills |
| `cssnano` | `^4.1.10` | 4.1.11 | 9.0.4 | 5 | drags `postcss@7.0.39` and 30+ `postcss-*` v7 plugins; latest requires `postcss ^8.5.28` and Node `^22.22.3 \|\| ^24.15 \|\| >=26` | `postcss.config.js` only (custom preset: `discardComments:false, mergeLonghand:false, normalizeWhitespace:false, svgo:false, reduceInitial:false, reduceTransforms:false`) | **REMOVE** (Next already minifies CSS; verify with visual diff) |
| `filesize` | `^6.1.0` | 6.4.0 | 11.0.22 | 5 | healthy | **0 imports** (only `package.json`) | **REMOVE** |
| `i18n-iso-countries` | `^6.2.2` | 6.8.0 | 7.14.0 | 1 | healthy | `templates/data-providers/index.jsx` imports `i18n-iso-countries/langs/en.json` | KEEP+UPGRADE |
| `js-file-download` | `^0.4.12` | 0.4.12 | 0.4.12 | 0 | stale but tiny | `api/search.js` | KEEP |
| `leaflet` | `^1.8.0` | 1.9.4 | 1.9.4 | 0 | current | `modules/map/map.jsx` | KEEP |
| `leaflet.markercluster` | `^1.4.1` | 1.5.3 | 1.5.3 | 0 | current; peer `leaflet ^1.3.1` | `modules/map/map.jsx`, `pages/_app.jsx` (CSS imports) | KEEP |
| `logrocket` | `^10.0.0` | 10.0.0 | 12.4.0 | 2 | healthy | `pages/_app.jsx` (`LogRocket.init`), `api/index.js`, `modules/dropdown/index.jsx` (`captureException/Message`) | KEEP+UPGRADE (dashboard has no LogRocket: product decision) |
| `logrocket-react` | `^6.0.3` | 6.0.3 | 7.0.1 | 1 | **peer `react >=18`/`react-dom >=18` while app is on 17** (needs legacy-peer-deps); v7 peer `^17 \|\| ^18 \|\| ^19` | **0 imports** | **REMOVE** (unused) |
| `mobx` | `^6.0.0` | 6.13.7 | 7.0.5 (6.x latest: 6.15.0) | 1 | v7: proxies mandatory, legacy decorators dropped | 10 files, `makeObservable`; 1 file uses `@observable` decorators (`store/filters.js`) | **REPLACE** with `zustand` (long-term); interim KEEP+UPGRADE to 6.15.x |
| `mobx-react-lite` | `^3.0.0` | 3.4.3 | 5.0.3 (5.1.0 per packument) | 2 | v3 peers `react ^16.8 \|\| ^17 \|\| ^18`, `mobx ^6.1`; **v5 needs React >=18 and mobx ^7**; 4.1.1 = `mobx ^6.9`, `react ^16.8 \|\| 17 \|\| 18 \|\| 19` | `store/index.jsx` (`observer`, `enableStaticRendering`) + 1 more | **REPLACE** with zustand (interim 4.1.1) |
| `next` | `^10.0.3` | 10.2.3 | 16.4.2 | 6 | 16+ advisories on 10.2.3 (section 6); engines (latest) node `>=20.9` | 24 files (`next/router` x17, `next/head` x6, `next/link` x2, `next/dynamic` x1); `getInitialProps` in `_app`; no `next/image`, no API routes except `pages/api/healthz.js` | KEEP+UPGRADE (architecture decision: dashboard is Vite SPA + react-router; search is SSR, see section 8) |
| `next-images` | `^1.8.5` | 1.8.5 | 1.8.5 | 0 | effectively unmaintained; peer `webpack ^4 \|\| ^5`; obsolete from Next 11 (built-in static image imports, doc says remove or set `images.disableStaticImages`) | `next.config.js` only | **REMOVE** |
| `react` | `^17.0.1` | 17.0.2 | 19.3.1 | 2 | | 96 import sites; no `findDOMNode`, `ReactDOM.render`, `defaultProps`, `propTypes`, legacy lifecycles in search source | KEEP+UPGRADE to 19 |
| `react-dom` | `^17.0.1` | 17.0.2 | 19.3.1 | 2 | peer `react ^19.3.1` (latest) | Next-driven | KEEP+UPGRADE |
| `react-ga4` | `^2.1.0` | 2.1.0 | 3.0.1 | 1 | | `hooks/use-analytics.js` | KEEP+UPGRADE |
| `throttle-debounce` | `^3.0.1` | 3.0.1 | 5.0.2 | 2 | latest engines node `>=12.22` | **0 imports** (also a dep of design) | **REMOVE** |

### 2.2 `devDependencies` (28)

| Package | Declared | Installed | Latest | Maj. | Deprecated / peers / notes | Fate |
|---|---|---|---|---|---|---|
| `@babel/core` | `^7.12.9` | 7.27.3 | 8.0.6 | 1 | v8: Node `^22.18 \|\| >=24.11`, ESM-only; **do not move to Babel 8 while Next bundles its own Babel 7** (see 7.8) | KEEP on latest 7.x; REMOVE when Babel config is dropped |
| `@babel/plugin-proposal-class-properties` | `^7.12.1` | 7.18.6 | 7.18.6 | 0 | **DEPRECATED** -> `@babel/plugin-transform-class-properties` | REMOVE (needed only for decorators/class props; native in modern targets) |
| `@babel/plugin-proposal-decorators` | `^7.12.1` | 7.27.1 | 8.0.2 | 1 | legacy mode in use (`{legacy:true}`); v8 requires `version` option | REMOVE after `store/filters.js` is converted to `makeObservable(this, {...})` annotations |
| `@babel/plugin-proposal-export-default-from` | `^7.12.1` | 7.27.1 | 8.0.1 | 1 | used by 2 files (`templates/output/hooks/index.js`, `templates/data-providers/hooks/index.js`: `export useX from './x'`) | REMOVE after rewriting 2 lines to `export { default as useX } from` |
| `@babel/plugin-syntax-dynamic-import` | `^7.8.3` | 7.8.3 | 7.8.3 | 0 | no-op since ES2020 / Babel 7.5 | REMOVE (also redundant in preset-env) |
| `@babel/plugin-transform-runtime` | `^7.28.3` | 7.28.5 | 8.0.1 | 1 | range floor (7.28) is out of line with the other `^7.12` ranges | KEEP on 7.x until Babel is dropped |
| `@babel/preset-env` | `^7.12.7` | 7.27.2 | 8.0.7 | 1 | v8 removes `useBuiltIns/corejs` (uses `babel-plugin-polyfill-corejs3`) | KEEP on 7.x until Babel is dropped |
| `@babel/preset-react` | `^7.12.7` | 7.27.1 | 8.0.1 | 1 | v8 defaults `runtime: automatic` | KEEP on 7.x |
| `@oacore/eslint-config-react` | `^1.0.6` | 1.0.6 | n/a | ? | extends `airbnb` 18 + `@oacore/eslint-config-base` + `prettier/react`; **blocks ESLint >7** | **REPLACE** (flat config as dashboard) |
| `@oacore/prettier-config` | `^1.0.6` | 1.0.6 | n/a | ? | contents: `trailingComma:'es5', semi:false, singleQuote:true, endOfLine:'lf', quoteProps:'consistent'` | **REMOVE** (inline the 5 options in `.prettierrc`/`prettier.config.js`) |
| `@zeit/next-source-maps` | `0.0.3` | 0.0.3 | 0.0.3 | 0 | deprecated, duplicate of the prod entry | **REMOVE** |
| `babel-eslint` | `^10.1.0` | 10.1.0 | 10.1.0 | 0 | **DEPRECATED** ("now @babel/eslint-parser") | **REPLACE** (`@babel/eslint-parser`, or `typescript-eslint` after TS) |
| `eslint` | `^7.15.0` | 7.32.0 | 10.13.0 | 3 | v10: flat config only, Node `^20.19 \|\| ^22.13 \|\| >=24`; `eslint-plugin-import` peer max `^9`, `eslint-plugin-react` max `^9.7`, `eslint-plugin-jsx-a11y` max `^9` | KEEP+UPGRADE (9 with the old plugin set, 10 only if those 3 plugins are dropped as dashboard did) |
| `eslint-plugin-import` | `^2.22.1` | 2.31.0 | 2.32.0 | 0 | peer eslint up to ^9 | KEEP (<=ESLint 9) or REMOVE (TS resolves imports) |
| `eslint-plugin-jsx-a11y` | `^6.4.1` | 6.10.2 | 6.10.2 | 0 | peer eslint up to ^9 | KEEP (<=ESLint 9) |
| `eslint-plugin-prettier` | `^3.1.4` | 3.4.1 | 5.5.7 | 2 | v5: eslint >=8, **prettier >=3**, optional `eslint-config-prettier` | REMOVE (run `prettier --check` separately; dashboard has no Prettier plugin) |
| `eslint-plugin-react` | `^7.21.5` | 7.37.5 | 7.37.5 | 0 | peer eslint up to ^9.7 | KEEP (<=ESLint 9) |
| `husky` | `^4.3.0` | 4.3.8 | 9.1.7 | 5 | **No hook config exists** (no `husky` key in `package.json`, no `.huskyrc`): `.git/hooks/*` contain v4 shims that do nothing; v9 needs `prepare: "husky"` + `.husky/pre-commit`; Node >=18 | KEEP+UPGRADE (+ `lint-staged` as dashboard) |
| `npm-run-all` | `^4.1.5` | 4.1.5 | 4.1.5 | 0 | unmaintained since 2018 (fork: `npm-run-all2`); used for `run-p lint:*` | REPLACE (`npm-run-all2`) or drop |
| `postcss` | `8.4.14` (exact pin) | 8.4.14 (+ 7.0.39 x many, + next's nested 8.2.13) | 8.5.31 | 0 (minor) | pin mirrors design's pin; below fix versions of several advisories | KEEP+UPGRADE (unpin, `^8.5`) |
| `postcss-custom-media` | `^8.0.0` | 8.0.2 | 12.0.2 | 4 | peer `postcss ^8.3`; latest Node >=20.19; `importFrom: 'main/media-queries.css'` option is removed in newer majors (plugin API change) - verify | KEEP+UPGRADE (re-check config) |
| `postcss-extend-rule` | `^4.0.0` | 4.0.0 | 4.0.0 | 0 | peer `postcss ^8.4.6`; depends on `postcss-nesting` | KEEP |
| `postcss-preset-env` | `^7.7.2` | 7.8.3 | 11.5.5 | 4 | latest Node >=20.19; config uses `stage: 0` (renamed/changed semantics in later majors) | KEEP+UPGRADE (re-check `stage`, `browserslist`) |
| `prettier` | `^2.2.1` | 2.8.8 | 3.9.10 | 1 | v3 changes defaults (`trailingComma: 'all'` - mitigated because shared config sets `es5` explicitly) | KEEP+UPGRADE |
| `stylelint` | `^13.8.0` | 13.13.1 | 17.16.0 | 4 | own `postcss@7`; frozen at 13 by `stylelint-config-twbs-bootstrap@2.2.4 (peer ^13.13.1)`, `stylelint-order@4 (<=13)`, `stylelint-scss@3`, `stylelint-config-css-modules@2.3 (11-14)` | KEEP+UPGRADE with new config, or REMOVE (dashboard has none) |

## 3. `@oacore/design` (pinned to `latest`) - what it drags into search

* Installed: **5.0.74** (`package-lock.json` -> `node_modules/@oacore/design`); `../design/package.json` is also 5.0.74 (identical dependency lists). `"latest"` in `package.json` means any fresh `npm install` without the lock (e.g. the Dockerfile `|| npm install` fallback, or `npm update`) can silently pull a different design version. Pin to `5.0.74` immediately (wave 0).
* `main: lib/index.js`, `bin: design`, **`scripts.postinstall: "node bin build"`** runs on every install (builds the icon sprite/assets); search build additionally runs `node ./node_modules/.bin/design build icons` (see `package.json` `build`, `design.config.js` lists 17 `@mdi/svg` icons).
* **Peer dependencies: `react ^17.0.1`, `react-dom ^17.0.1`** (hard cap on React 17).

### 3.1 Direct dependencies of `@oacore/design` (all shipped in search's production tree)

| Dep (declared) | Resolved in search | React peer / note | Matters because |
|---|---|---|---|
| `@babel/runtime ^7.12.1` | 7.27.3 (top) | | next carries nested 7.12.5 (older, advisory GHSA-968p-4wvh-cqc8 <7.26.10) |
| `@mdi/svg ^5.8.55` | 5.9.55 | | icon source for the sprite; `design.config.js` imports `@mdi/svg/package.json` (phantom-ish: resolved only through design) |
| `@tippyjs/react ^4.2.0` | 4.2.6 (+ `tippy.js 6.3.7`, `@popperjs/core 2.11.8`) | `react >=16.8` | OK on 18/19 |
| `babel-plugin-add-react-displayname 0.0.5` | 0.0.5 | | duplicate of search's own dep |
| `body-scroll-lock ^3.1.5` | 3.1.5 | | unmaintained |
| `classnames ^2.2.6` | 2.5.1 | | search imports `classNames` from `@oacore/design/lib/utils` 26+ times |
| `cosmiconfig ^7.0.0` | 7.1.0 | | used by design CLI (`bin`) |
| `d3-array ^1.2.0`, `d3-format ^1.2.0`, `d3-scale ^1.0.6` | 1.2.4 / 1.4.5 / 1.0.7 | | d3 v1 (ancient) |
| `deepmerge ^4.2.2` | 4.3.1 | | |
| `katex ^0.16.0` | 0.16.22 | | `MathMarkdown` element; advisory GHSA-238p-pmpm-9mq7 (low) |
| `prop-types ^15.7.2` | 15.8.1 (+ next's pinned 15.7.2) | | 28 design files use `propTypes` |
| `react-cookie ^4.1.1` | 4.1.1 (+ `universal-cookie 4.0.4`) | `react >=16.3` | `useCookie`/`Cookies` popup used by `hooks/use-analytics.js` and `_app.jsx` |
| `react-focus-lock ^2.9.1` | 2.13.6 (+ `focus-lock`, `use-callback-ref`, `use-sidecar`) | `^16.8 \|\| 17 \|\| 18 \|\| 19` | used by Modal |
| `react-markdown ^5.0.0` | 5.0.3 (+ `unified 9`, `remark-parse 9`, `mdast-util-from-markdown 0.8.5`) | `react >=16` | dashboard uses `react-markdown ^10.1` |
| **`react-slick ^0.28.1`** | 0.28.1 | **peer `react ^0.14 \|\| ^15 \|\| ^16 \|\| ^17`** (cap 17) | Carousel; first thing to break on React 18/19 |
| `sanitize.css ^12.0.1` | 12.0.1 | | global CSS in `@oacore/design/lib/index.css` |
| `slick-carousel ^1.8.1` | 1.8.1 | peer `jquery >=1.8` (not installed) | |
| `svgo ^1.3.2` | **1.3.2** (high advisories via `css-select@2`/`nth-check@1`) | | prod dependency only to build icons |
| `svgstore ^3.0.0-2` | 3.0.1 (+ `cheerio 1.0.0-rc.10`, `xml2js`) | | icon sprite build |
| `throttle-debounce ^3.0.1` | 3.0.1 | | |
| `yargs ^16.1.0` | 16.2.0 | | design CLI |

Design devDependencies (not installed in search but they show the toolchain it was built with): webpack 4.44, babel-loader 8, css-loader 5, postcss 8.4.14, postcss-preset-env 7.7.2, stylelint 13, eslint 7, react 17, react-styleguidist 11, Storybook 3 add-ons.

**Design usage in search:** 101 import sites in 69 files. Import specifiers: `@oacore/design` (39), `/lib/utils` (26, mostly `classNames`), `/lib/elements` (13), `/lib/utils/class-names` (11), `/lib` (6), `/lib/modules` (4), `/lib/index.css`, `/lib/elements/logo`, `/lib/elements/icon`. Components named: Button, Card, Icon, Link, Modal, Popover, TextField, Select, Form, Fieldset, Header, LoadingBar, MetadataList, ExpandableList, SearchResult, MathMarkdown, DesignProvider, Cookies popup, `useCookie`, DataProviderLogo, `classNames`.

## 4. Important transitive packages (from the lock)

| Package | Version(s) in tree | Pulled by | Why it matters |
|---|---|---|---|
| webpack (Next-compiled) | **4.44.1** active (`bundle4.js`); 5.37.0 also shipped (`bundle5.js`, unused because a custom `webpack()` config exists) | `next@10.2.3` | no standalone `webpack` in `node_modules`; `file-loader`/`url-loader` peers dangling |
| `@babel/core` (Next-compiled) | Next's own bundled Babel 7 (`next/dist/compiled/babel`) | `next` | user Babel plugins are resolved from root `node_modules` but executed by Next's Babel 7 |
| `@babel/core` (root) | 7.27.3 | direct dev dep | ESLint/Babel tooling |
| `postcss` | **8.4.14** (root pin), **8.2.13** (nested in `next`), **7.0.39** (cssnano 4 and ~35 plugins, stylelint 13, `stylelint-order`, `postcss-sass/scss/less`) | multiple | three postcss majors/minors coexist; postcss-preset-env 7.8.3 `peer postcss ^8.2`, custom-media `^8.3`, extend-rule `^8.4.6` |
| `autoprefixer` | 10.4.21 (root), 9.8.8 (inside stylelint) | postcss-preset-env 7 / stylelint 13 | |
| `browserslist` | 4.27.0 (root), 4.16.6 (nested in next) | | advisories on both (see 6) |
| `caniuse-lite` | 1.0.30001754 | | |
| `node-fetch` | **2.6.1** (exact pin by Next 10) | `next`; **also `require`d directly by `data/data-loader.js` (undeclared)** | GHSA-r683-j2x4-v87g (high); after Next upgrade it disappears and the script must use global `fetch` (Node 18+) |
| `react-refresh` | 0.8.3 | next | dev only |
| `styled-jsx` | 3.3.2 | next | |
| `chokidar` | 1.7.0 (via `bibtex-parse-js > ava`) and 3.5.1 (next) | | old fsevents chain |
| `scheduler` | 0.20.2 | react-dom 17 | |
| `core-js` | 3.42.0 (root) and 2.6.12 in 12+ nested copies (power-assert, babel-runtime; all via `bibtex-parse-js > ava`) | | `core-js@2` is deprecated |
| `tslib` | 1.14.1 (sentry), 2.8.1 (design deps) | | |
| `lodash` | 4.17.21 | many | flagged by newer advisories (fixed 4.18.0) |
| `semver` | 5.7.2, 6.3.1, 7.7.2 | | |
| `@next/*` | 10.2.3 (`env`, `polyfill-module`, `react-dev-overlay`, `react-refresh-utils`) | | |
| `cssnano-simple` | 2.0.0 | next | Next's own CSS minifier (reason cssnano direct dep is redundant) |
| ESLint chain | `eslint-config-airbnb 18.2.1`, `eslint-config-airbnb-base 14.2.1`, `eslint-config-prettier 6.15.0`, `@oacore/eslint-config-base 1.0.6` | `@oacore/eslint-config-react` | peers cap ESLint at ^7.2 |
| Stylelint chain | `stylelint-config-twbs-bootstrap 2.2.4`, `stylelint-config-standard 22`, `stylelint-config-recommended(-scss)`, `stylelint-order 4.1.0`, `stylelint-scss 3.21`, `stylelint-prettier 1.2.0`, `stylelint-config-prettier 8.0.2`, `stylelint-config-css-modules 2.3.0` | `@oacore/stylelint-config-base` | SCSS-aware configs for a plain-CSS repo |
| Total | 1760 packages in lock (~1058 top-level dirs in `node_modules`) | | |

## 5. Duplicates and oddities

| # | Finding | Evidence | Risk / action |
|---|---|---|---|
| 1 | `@zeit/next-source-maps` in both sections with different versions (`0.0.4` prod, `0.0.3` dev) | `package.json` `dependencies` and `devDependencies`; lock entry `node_modules/@zeit/next-source-maps` = 0.0.3 `dev:true` | declared prod version unsatisfiable by installed; deprecated; remove both |
| 2 | `@babel/plugin-transform-runtime ^7.28.3` among `^7.12.x` floors | `package.json` | harmless, lock has 7.28.5; the only `^7.28` floor means a resolver cannot go back below 7.28 |
| 3 | `postcss` exact pin `8.4.14` | `package.json` (devDeps) | matches design's pin; below patched versions (8.4.31 / 8.5.x); unpin |
| 4 | `cssnano ^4.1.10` (PostCSS 7 era) used from a PostCSS 8 pipeline via `postcss.config.js` | `postcss.config.js` | works through compat but brings `postcss@7.0.39` x35; Next already minifies CSS |
| 5 | `@oacore/stylelint-config-base` in `dependencies` (config, not runtime) | `package.json` | move/replace |
| 6 | `babel-plugin-add-react-displayname`, `core-js`, `cssnano`, `next-images`, `@zeit/*` build tools in `dependencies` | `package.json` | Docker installs with `--include=dev` anyway; classification is irrelevant for the build but noisy |
| 6b | `bibtex-parse-js` ships `ava`/`xml2js` as dependencies (557 transitive packages) | `node_modules/bibtex-parse-js/package.json` | replace (section 2.1) |
| 7 | Dead deps: `filesize`, `throttle-debounce`, `logrocket-react`, `@babel/plugin-syntax-dynamic-import` | grep: 0 imports | remove in wave 1 |
| 8 | Phantom dep `node-fetch` required by `data/data-loader.js`; `@mdi/svg` required by `design.config.js`; `@oacore/prettier-config` required by `prettier.config.js` is declared, OK | grep of bare specifiers vs `package.json` | declare or replace (`fetch` is global on Node 18+) |
| 9 | `@oacore/design: "latest"` | `package.json` | pin |
| 10 | `husky ^4` installed but no configuration anywhere (no `husky` key, no `.huskyrc`, no `lint-staged`) | `package.json`, `ls -a` | hooks are no-ops; nothing to migrate except to create the hooks |
| 11 | `--legacy-peer-deps` mandatory, `--openssl-legacy-provider` mandatory | `Dockerfile` | caused by logrocket-react (react>=18), airbnb 18 (react-hooks plugin missing), file-loader/url-loader (webpack peer), webpack 4 md4 hashing on Node 17+ |
| 12 | `Dockerfile` Node 18 vs device Node 22 vs `engines >=16.18.1` vs dashboard `>=24` | `Dockerfile`, `package.json` | pick one baseline (Node 22 LTS recommended: satisfies Next 16 (>=20.9), ESLint 10, Stylelint 17, postcss-preset-env 11) |
| 13 | `.github/workflows/aks_deploy.yml` rebuilds nightly (`cron: '0 3 * * *'`) with `npm ci \|\| npm install` | workflow + Dockerfile | with a floating `latest` design and ranges, nightly images can differ from the lock |
| 14 | Two lint-time configs resolve through absolute paths in `node_modules` (`stylelint.config.js`: `${__dirname}/node_modules/@oacore/stylelint-config-base`) | `stylelint.config.js` | breaks under pnpm / hoisting changes |
| 15 | CSS and Next coupling: `next.config.js` patches css-loader `modules.exportLocalsConvention = 'camelCase'` (Next 10 workaround, issue 10584), `config.node = {fs:'empty'}`, aliases `react`/`react-dom` to root `node_modules` (to dedupe React for design) | `next.config.js` | all three are webpack4/Next10-specific and must be re-evaluated per wave |

## 6. Security audit (PARTIAL - `npm audit` could not run)

`npm audit` is blocked (403 on the audit endpoint from the device, no registry from the container). As a substitute, `package@version` pairs from the lock (all direct deps plus ~60 notable transitives) were checked against the GitHub Advisory Database (`api.github.com/advisories?affects=...`, reviewed advisories only). The API rate-limited roughly half of the chunks, so **coverage is incomplete (not checked: ~1700 other lock entries, and the failed chunks: cross-spawn, hosted-git-info, loader-utils, decode-uri-component, cookie, ajv, trim-newlines, js-yaml, brace-expansion, @hapi/accept, raw-body, node-html-parser, buffer, svgstore, xml2js, mixin-deep, set-value, kind-of, core-js, filesize, i18n-iso-countries, js-file-download, mobx*, react-ga4, cssnano, postcss-preset-env, stylelint (only withdrawn found), react/react-dom, debug, body-scroll-lock, react-focus-lock, @tippyjs/react, deepmerge, micromatch 4.0.8, braces 3.0.3 partially)**. Numbers below are therefore a lower bound. Prod = reachable through `dependencies` (lock flag not `dev`); note `@oacore/design` makes many build-tool packages "prod".

| Severity | Package@version in lock | Advisory (GHSA) | Fixed in | Scope |
|---|---|---|---|---|
| **critical** | `next@10.2.3` | GHSA-2xp9-vwfh-vxw4 unauthenticated RCE in Image Optimization API with AVIF (range >=10.0.0 <15.5.24 / <16.3.3) | 15.5.24 / 16.3.3 | prod (only if `/_next/image` is exposed; search does not use `next/image`, but the endpoint exists by default in Next 10) |
| **critical** | `shell-quote@1.7.2` | GHSA-g4rg-993r-mgx7 command injection (>=1.6.3 <=1.7.2); also GHSA-w7jw-789q-3m8p / GHSA-395f-4hp3-45gv for <=1.8.x | 1.9.0 | **prod** flag in lock (via `next > @next/react-dev-overlay`, plus dev `npm-run-all`; dev server only at runtime) |
| high | `next@10.2.3` | GHSA-7gfc-8cq8-jh5f authorization bypass (>=9.5.5 <14.2.15); GHSA-25mp-g6fv-mqxx server crash (<11.1.3); GHSA-9gr3-7897-pp7m XSS in image optimizer (<11.1.1) | 11.1.3 / 14.2.15 | prod |
| medium | `next@10.2.3` | 12 more: GHSA-h64f-5h5j-jqjh (image DoS), GHSA-ggv3-7p47-pfv8 (rewrites request smuggling, relevant: search uses `rewrites()`), GHSA-3x4c-7xq6-9pq8, GHSA-9g9p-9gw9-jx7f, GHSA-g5qg-72qw-gw5v, GHSA-xv57-4mr9-wg8v, GHSA-4342-x723-ch2f (middleware SSRF), GHSA-g77x-44xx-532m, GHSA-fmvm-x8mv-47mj (CSP in image optimiser), GHSA-vxf5-wxwp-m7g9 (open redirect <11.1.0), + 2 low (cache) | various, all fixed by 16.x | prod |
| high | `node-fetch@2.6.1` | GHSA-r683-j2x4-v87g (secure headers forwarded on redirect, <2.6.7) | 2.6.7 | prod (Next dep + `data/data-loader.js`) |
| high | `svgo@1.3.2` | GHSA-w27v-7q3p-w38r, GHSA-2p49-hgcm-8545 (removeScripts XSS), medium GHSA-4vpr-x523-8j87 | 2.8.4+/3.3.5+ | via `@oacore/design`/svgstore (icon build) |
| high | `nth-check@1.0.2` | GHSA-rp65-9cf3-cjxr ReDoS (<2.0.1) | 2.0.1 | via svgo 1 -> css-select 2 |
| high | `browserslist@4.16.6` and `4.27.0` | GHSA-c83g-rgw3-j3cx (unbounded cache OOM), GHSA-73wf-gq98-2v4g (<=4.28.6) | 4.28.7 | build time |
| high | `postcss@8.4.14`, `8.2.13`, `7.0.39` | GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849 (sourcemap file read, <=8.5.17); medium GHSA-7fh5-64p2-3v2j (<8.4.31), GHSA-qx2v-qp2m-jg93, GHSA-fxqj-rqcc-2cmp | 8.5.23+ | build time (CSS pipeline) |
| high | `lodash@4.17.21` | GHSA-r5fr-rjxr-66jc (`_.template` code injection); medium GHSA-f23m-r3pf-42rh, GHSA-xxjr-mmjv-4gpg (<=4.17.23) | 4.18.0 | prod transitive (many parents) |
| high | `braces@1.8.5 / 2.3.2`, `braces@3.0.3` | GHSA-vfj7-8cjw-p6xm (<=3.0.3, no fix), GHSA-grv7-fg5c-xmjg (<3.0.3) | >3.0.3 | via `bibtex-parse-js > ava > chokidar 1` (prod-flagged) and Next/ESLint tooling |
| high | `json5@0.5.1`, `json5@1.0.2` | GHSA-9c47-m6qq-7p4h prototype pollution (<1.0.2 / 2.0-2.2.1) | 1.0.2 / 2.2.2 | `json5@0.5.1` via `ava > babel-core 6` (prod-flagged) |
| high | `dot-prop@3.0.0`, `dot-prop@5.3.0` | GHSA-ff7x-qrg7-qggm prototype pollution (<4.2.1, 5.0-5.1.0) | 4.2.1 / 5.1.1 | `dot-prop@3.0.0` via `bibtex-parse-js > ava > update-notifier > configstore` (prod-flagged) |
| high | `nanoid@3.3.11` | GHSA-xwg4-73v4-xw9w, GHSA-28wg-ghj8-5hjv, GHSA-2v37-7h3g-55p8 | 3.3.18 | transitive of postcss 8.4 |
| medium | `micromatch@2.3.11 / 3.1.10` | GHSA-952p-6rrq-rcjv ReDoS (<4.0.8) | 4.0.8 | via `bibtex-parse-js > ava > chokidar 1` |
| medium | `@sentry/browser@5.30.0` (and the 5.x family) | GHSA-593m-55hh-j8gv prototype-pollution gadget (<7.119.1, 8.0.0-alpha.1..<8.33.0) | 7.119.1 / 8.33.0 | prod (client) |
| medium | `@babel/runtime@7.12.5` (nested in next) | GHSA-968p-4wvh-cqc8 inefficient regex (<7.26.10) | 7.26.10 | prod |
| medium | `got@5.6.0` | GHSA-pfrx-2q88-qq97 (redirect to UNIX socket, <11.8.5) | 11.8.5 | tooling |
| low | `katex@0.16.22` | GHSA-238p-pmpm-9mq7 (trust bypass gadget, <0.18.2) | 0.18.2 | prod (design `MathMarkdown`) |
| low | `elliptic@6.6.1` | GHSA-848j-6mx2-7j84 (no fix) | none | via Next 10 `crypto-browserify` (browser polyfill) |
| clean (checked) | `eslint@7.32.0`, `stylelint@13.13.1` (only withdrawn advisories), `semver 5.7.2/6.3.1/7.7.2`, `glob-parent`, `ansi-regex`, `css-select@2.1.0` (no advisory itself), `chokidar`, `styled-jsx`, `lodash`(see above), `minimist@1.2.8`, `@sentry/node/utils/core`, `leaflet@1.9.4`, `logrocket@10.0.0`, `react-markdown@5.0.3`, `unified`, `remark-parse`, `react-slick`, `slick-carousel`, `react-cookie`, `universal-cookie` | returned no (non-withdrawn) advisory in the queried chunks, except where listed above | | |

Remediation map: every `next`, `node-fetch`, `browserslist@4.16`, `postcss@8.2/7`, `@babel/runtime@7.12`, `shell-quote`, `elliptic` finding disappears with the Next upgrade; the `svgo`/`nth-check`/`cheerio` family disappears when `@oacore/design` is removed; the `dot-prop`/`json5@0.5`/`braces`/`micromatch@2-3`/`chokidar@1`/`got@5`/`core-js@2` family disappears when `bibtex-parse-js` is replaced; `lodash`, `nanoid`, `postcss`, `@sentry/*` need explicit upgrades/`overrides`.

## 7. Coupling graph and upgrade waves

### 7.1 Hard couplings (must move together, or are blocked by)

```
node runtime (Docker node:18 / engines >=16.18)
  ├─ gates: Babel 8 (22.18+), ESLint 10 (20.19+), Stylelint 17 / postcss-preset-env 11 / postcss-custom-media 12 (>=20.19), cssnano 9 (22.22+), Next 16 (>=20.9), Next 13 (16.14), Next 14 (18.17), husky 9 (>=18)
  └─ webpack 4 on Node >=17 needs --openssl-legacy-provider (already in Dockerfile) -> disappears with Next 11/12

next  ──peer──>  react / react-dom                      (10: ^16.6||^17 ; 11-12: >=17.0.2 ; 13+: >=18.2 ; 15-16 pages router: 18 or 19)
next  ──owns──>  webpack (4 → 5 at 11, 4 removed at 12), postcss (nested 8.2.13), browserslist, node-fetch, styled-jsx, babel (bundled 7)
next  ──forces─> next.config.js: next-images (die 11), @zeit/next-source-maps (die 11), config.node.fs (webpack4-only, die 11), css-loader patch (re-check), resolve.alias react/react-dom
next 13+ ──>   @sentry/nextjs (v8+ requires Next >=13.2) ;  next/link child <a> change ; next/image rename
next 16  ──>   Turbopack default: build FAILS with a custom `webpack()` unless `--webpack` or config migrated

react ──peer──> @oacore/design (^17.0.1)  ← HARD BLOCK on 18/19 ; react-slick 0.28.1 (<=17) ; logrocket-react 6 (>=18, wrong today) ; mobx-react-lite 3 (<=18) / 4.1 (<=19) / 5 (>=18, mobx 7) ; react-focus-lock, tippy, cookie OK to 19 ; react-markdown 5 (>=16) OK
mobx 6 ↔ mobx-react-lite 3.x/4.x ;  mobx 7 ↔ mobx-react-lite 5 (React >=18) ; mobx 7 drops legacy decorators ↔ @babel/plugin-proposal-decorators (store/filters.js)

@oacore/design ──deps──> svgo 1 / svgstore / cheerio (icon build), react-slick, katex, react-markdown 5, react-cookie 4, d3 v1 → disappear when design is copied in & replaced by antd
bibtex-parse-js ──deps──> ava 0.15 (557 pkgs) → disappears when replaced

postcss 8.4.14 (pin) ↔ postcss-preset-env 7 (peer ^8.2) ↔ postcss-custom-media 8 (^8.3) ↔ postcss-extend-rule 4 (^8.4.6) ↔ cssnano 4 (postcss 7) ↔ next's nested postcss 8.2.13 loader
   (move postcss + preset-env + custom-media together; drop cssnano)

eslint 7 ──caps──> @oacore/eslint-config-react → airbnb 18 / airbnb-base 14 (peer eslint ≤7.2, plugin-react-hooks, import, jsx-a11y, react pinned floors), eslint-config-prettier 6 ('prettier/react' removed in 8), babel-eslint (deprecated) 
eslint-plugin-prettier 3 ↔ prettier 2 ; eslint-plugin-prettier 5 ↔ prettier ≥3 + eslint ≥8
eslint-plugin-react / -import / -jsx-a11y ↔ eslint ≤9 (no ESLint 10 support in latest)
stylelint 13 ──caps──> @oacore/stylelint-config-base → twbs-bootstrap 2 (^13.13.1), stylelint-order 4 (≤13), stylelint-scss 3, config-css-modules 2.3 (11-14), stylelint-prettier 1 ; stylelint 15+ removed stylistic rules (prettier conflict config no longer needed)
husky 4 → 9 (config model changed; independent of everything else)

babel 7 plugins ↔ @babel/core 7 (all peers ^7.0.0-0); Babel 8 plugins peer ^8 and are ESM-only; Next's bundled Babel is 7 → stay on 7
@sentry/browser ↔ @sentry/node ↔ (core/utils/types) must be same version; next.config.js alias hack couples them to webpack
```

### 7.2 Recommended waves (lowest risk first)

Every wave must end green on the safety-test suite (planned before the version bumps) and a manual smoke of: search results page, output page (citation/bibtex, download), data-providers page (map), cookie banner/analytics.

| Wave | Content | Why this order / risk | Gate to start |
|---|---|---|---|
| **W0 Hygiene, no behaviour change** | Pin `@oacore/design` to `5.0.74`; add `.nvmrc`; decide Node baseline (22 LTS) and align `Dockerfile` (currently node:18) + `engines`; drop duplicate `@zeit/next-source-maps` (both entries) after confirming source maps are not consumed; commit `.npmrc` policy (keep `legacy-peer-deps` explicit until W5); capture a clean `npm audit --json` baseline on a networked machine | Zero code change; removes the "latest"/nightly-drift hazard; prerequisite for reproducible diffs | none |
| **W1 Remove dead and heavy deps** | Remove `filesize`, `throttle-debounce`, `logrocket-react`, `@babel/plugin-syntax-dynamic-import`; replace `bibtex-parse-js` -> `@orcid/bibtex-parse-js` (or vendor); declare/replace `node-fetch` usage in `data/data-loader.js` (use global `fetch` on Node >=18 or declare `node-fetch@2.6.7`); move `@oacore/stylelint-config-base` to dev | Imports verified absent (grep); the bibtex swap is one import in `templates/output/citation.jsx` and removes ~557 transitive packages and most low-value audit noise. Medium-low risk: needs a citation/bibtex snapshot test | W0 |
| **W2 Dev-tooling track (no production effect)** | `husky 4->9` + `lint-staged` (hooks do not exist today, so this *adds* a gate); `prettier 2->3` (config inlined, `trailingComma:'es5'` explicit) + one `prettier --write` commit; ESLint 7->9 flat config replacing `@oacore/eslint-config-react`/airbnb/`babel-eslint`/`eslint-plugin-prettier` (keep react/import/jsx-a11y plugins, add `eslint-plugin-react-hooks`, `@babel/eslint-parser`) ; `stylelint 13->17` with new config; `npm-run-all -> npm-run-all2` | Cannot break runtime or build output (only lint/format results change). Do the Prettier reformat as its own commit so later diffs stay reviewable. ESLint 10 only after dropping eslint-plugin-react/import/jsx-a11y (dashboard approach) | W0 (parallel with W1/W3) |
| **W3 Leaf runtime libs** | `core-js` minors; `i18n-iso-countries 6->7` (check `langs/en.json` import path & shape); `react-ga4 2->3`; `logrocket 10->12`; `@sentry/browser`+`@sentry/node` 5 -> **7.119.1** together (fixes GHSA-593m-55hh-j8gv; keep the alias hack); `leaflet`/`markercluster`/`js-file-download` already current | Independent leaf packages with small call surfaces (1-3 files each); each can be its own commit + revert | W1 |
| **W4 State layer prep (on React 17)** | `mobx 6.13.7 -> 6.15.x` and `mobx-react-lite 3.4.3 -> 4.1.1` (peer covers React 17/18/19); convert the single decorated store (`store/filters.js`) to `makeObservable(this, { ... })`; remove decorators + class-properties Babel plugins | Removes the only MobX-7/Babel-8-incompatible construct while still on known-good React 17; unlocks W6/W7 | W2 (lint rules), W3 |
| **W5 Framework step 1: Next 10 -> 12 (React stays 17.0.2)** | `next 10.2.3 -> 11 -> 12` (do 11 first, then 12, one commit each). Remove `next-images`, `@zeit/next-source-maps`; rewrite `webpack()` hook for webpack 5 (`config.node.fs:'empty'` -> `resolve.fallback`/`false`, re-check css-loader `exportLocalsConvention` patch and `react` aliases); verify custom `babel.config.js` fallback (Next 12 keeps Babel when a config exists); re-check `rewrites`/`headers`; PostCSS plugin chain: `postcss` unpin, `postcss-preset-env 7->8+`, `custom-media`, drop `cssnano`; Node >= 12.22 (use 22) | Highest-value and highest-risk step: removes webpack 4, `node-fetch@2.6.1`, nested postcss 8.2/browserslist 4.16/@babel/runtime 7.12 and the bulk of Next advisories (still ~medium ones until 14/15). React 17.0.2 is the minimum for 11/12, so React and `@oacore/design` are untouched | W3, W4, snapshot/visual tests |
| **W6 Framework step 2: Next 12 -> 14 + React 17 -> 18** | `react/react-dom 18.x` (Next 13 min 18.2), `next 13` (Link child `<a>` codemod: only 2 files use `next/link`, `next/image` not used), `next 14` (Node 18.17+); **requires resolving the `@oacore/design` peer (^17.0.1) and `react-slick` (<=17)**: either copy the used design components into the repo first (planned later step; do the minimal subset now) or `overrides` + regression tests of Modal/Popover/Carousel/Cookies; React 18 strict-effects/auto-batching smoke; `mobx-react-lite 4.1.1` already compatible | React 18 is where runtime behaviour changes (concurrent rendering, StrictMode double effects, hydration errors). Sentry: switch to `@sentry/nextjs` here (needs Next >=13.2) | W5, design decision |
| **W7 Framework step 3: Next 14 -> 16 + React 18 -> 19** | `next 15` then `next 16` (pages router supports React 18 or 19; Node >=20.9); `react 19.3`; **Turbopack default in 16 makes `next build` fail with a custom `webpack()` unless `--webpack`** -> either keep `--webpack` or move aliases to `turbopack.resolveAlias`; remove `@oacore/design` completely (React 19: `propTypes` ignored, `defaultProps` on function components removed, `react-slick` 0.28 and design's class components unverified); `@sentry/nextjs` 10/11; `logrocket-react` stays removed; ESLint flat config must use `eslint-config-next@16` or none | Last because it depends on design removal and has the largest API surface change | W6 + design copied |
| **W8 Babel/PostCSS retirement and target libs** | Drop `babel.config.js` and all Babel packages (SWC takes over; requires no decorators, no `export x from`, no add-react-displayname); drop `core-js` if the browserslist (`last 3 versions`, `not ie > 0`) no longer needs it; then adopt dashboard libs: TS, axios, swr, zustand (replacing mobx), react-hook-form, antd (replacing design copy), Sentry react | These are architecture rewrites, not version bumps | W7 |

### 7.3 Things that MUST NOT be done

* Do not bump `@babel/*` to 8 while Next owns the Babel run (plugins are `ESM-only` with peer `@babel/core ^8`; Next compiles with its own Babel 7).
* Do not bump `mobx` to 7 / `mobx-react-lite` to 5 before React 18 and before removing decorators.
* Do not bump ESLint past 7 without replacing `@oacore/eslint-config-react` in the same change; do not bump Stylelint past 13 without replacing `@oacore/stylelint-config-base`.
* Do not run `npm update`/`npm audit fix --force` (floating `latest` design + ranges) - it would jump `@oacore/design` and break peers.
* Do not take Next 16 without deciding webpack vs Turbopack: default `next build` rejects the custom `webpack()` config.

## 8. Breaking changes per package (across the majors that must be crossed)

Confidence legend: **[V]** = read from the official page on 2026-10-19; **[M]** = from maintainer knowledge/changelog memory, verify before executing.

### 8.1 Framework and rendering

| Package (jump) | Breaking changes that touch THIS repo | Official references |
|---|---|---|
| **next 10.2.3 -> 11** [V] | Webpack 5 default (custom `webpack()` configs need the webpack5 guide); built-in static image imports collide with `next-images` (remove it or set `images.disableStaticImages`); removed `Container` from `next/app`, `props.url`, `Head.rewind`, `next/dynamic` `modules/render`; `router.events` not available during prerender; min React 17.0.2; `cleanDistDir` default. | https://nextjs.org/docs/pages/guides/upgrading/version-11 , https://nextjs.org/docs/messages/webpack5 , https://webpack.js.org/migrate/5/ |
| **next 11 -> 12** [V] | Webpack 4 support removed (opt-out flag now errors); SWC replaces Babel **but a custom `babel.config.js` keeps Babel** (search has one); `next/image` wraps in `<span>`; HMR over WebSocket; `target` deprecated; Node >= 12.22; middleware API changed in 12.2 (search has none). | https://nextjs.org/docs/pages/guides/upgrading/version-12 |
| **next 12 -> 13** [V] | Min Node 16.14, **min React 18.2**; `next/link` renders `<a>` itself (child `<a>` removed - `legacyBehavior` or codemod; 2 files in search use `next/link`); `next/image` renamed to `legacy/image` (search does not use it); `swcMinify` default true; `target` removed; browsers: IE dropped. | https://nextjs.org/docs/pages/guides/upgrading/version-13 |
| **next 13 -> 14** [V] | Min Node 18.17; `next export` removed (`output: 'export'`); `@next/font` -> `next/font`; WASM swc target removed. | https://nextjs.org/docs/pages/guides/upgrading/version-14 |
| **next 14 -> 15** [V] | Pages Router supports React 18 **and** 19; renamed `experimental.bundlePagesExternals`/`serverComponentsExternalPackages`; `geo`/`ip` removed from `NextRequest`; async request APIs are App-Router only (not used: search is pages-only); peer-dependency warnings with React 19 (`--legacy-peer-deps`). | https://nextjs.org/docs/pages/guides/upgrading/version-15 |
| **next 15 -> 16** [V] | Node >= 20.9; **Turbopack default; `next build` FAILS when a custom `webpack()` config exists** unless `--webpack` or `--turbopack` (ignores config) or config is migrated (`turbopack.resolveAlias` replaces `resolve.fallback` for `fs`); `next lint` and `eslint` option removed; `middleware` -> `proxy`; AMP, `serverRuntimeConfig/publicRuntimeConfig` removed; `next/image` default changes (`minimumCacheTTL`, `qualities`, local IP, redirects); `eslint-config-next@16` needs ESLint >= 9. | https://nextjs.org/docs/app/guides/upgrading/version-16 |
| **react / react-dom 17 -> 18** [M] | `ReactDOM.render` -> `createRoot` (Next does this); automatic batching; StrictMode double-invokes effects in dev; stricter hydration errors; `useId`; Suspense SSR changes; TypeScript `children` no longer implicit. Search has no legacy APIs (0 hits for `findDOMNode`, `ReactDOM.render`, `defaultProps`, `propTypes`, legacy lifecycles, legacy context). `@oacore/design` has 28 `propTypes` files, 2 `defaultProps` files, 20 `forwardRef` files. | https://react.dev/blog/2022/03/08/react-18-upgrade-guide |
| **react / react-dom 18 -> 19** [M] | Removed: `propTypes`/`defaultProps` on function components (silently ignored/removed), `ReactDOM.render/hydrate/findDOMNode/unmountComponentAtNode`, string refs, legacy context, `React.createFactory`; `ref` is a prop, `forwardRef` optional; new JSX transform required; `react-is` must match; stricter ref-callback semantics. Design components using `propTypes` still run (checks vanish) - validate `react-slick` (class-based, 0.28 declares <=17) and `react-focus-lock`/`tippy` (OK). | https://react.dev/blog/2024/04/25/react-19-upgrade-guide |
| **mobx 6.13 -> 6.15 (interim) -> 7.0.x** [V for 7] | MobX 7: legacy decorators removed (Stage 3 only), proxies mandatory (`useProxies` gone), namespaced annotations (`observable.ref` -> `observableRef`) and `comparer.*` renamed, `trace` removed. `ObservableSet.replace` semantic change in 7.0.2. Search: 5 store files use `makeObservable` with annotation objects (compatible), **1 file (`store/filters.js`) uses `@observable` decorators** (must be converted to `makeObservable(this, {...})`). Long-term the stores go to zustand, so 6.15 is a sufficient holding point. | https://github.com/mobxjs/mobx/releases (MobX 7.0.0 notes), https://mobx.js.org/ |
| **mobx-react-lite 3 -> 4.1.1 (interim) -> 5** [V] | 4.x: peer `mobx ^6.9`, React 16.8-19; 5.x: React >= 18, mobx ^7, removes `useObserver`, `useLocalStore`, `useAsObservableSource`, `useStaticRendering`/`observerBatching*` exports, `observer(fn,{forwardRef})`. Search imports `observer` and **`enableStaticRendering`** (`store/index.jsx`) - exists in 3.x/4.x; in 5.x check its replacement before using. | https://github.com/mobxjs/mobx/blob/main/packages/mobx-react-lite/CHANGELOG.md |
| **@oacore/design 5.0.74** | Peer `react ^17.0.1` blocks 18/19 resolution; no newer version is needed because components will be copied verbatim. Copy set to be driven by the 101 import sites (section 3). Icons: `design.config.js` + `design build icons` must be replaced when removing the package. | `../design/src` |

### 8.2 Build chain (Babel, PostCSS, CSS tooling)

| Package (jump) | Breaking changes | References |
|---|---|---|
| **@babel/* 7.x -> latest 7.x** | Safe within 7 (all plugins peer `@babel/core ^7.0.0-0`). Within 7 replace `@babel/plugin-proposal-class-properties` (deprecated) by `@babel/plugin-transform-class-properties`; `plugin-syntax-dynamic-import` is a no-op. | https://babeljs.io/docs/ |
| **@babel/* 7 -> 8** (NOT recommended now) [V] | Node `^22.18 \|\| >=24.11`; ESM-only; presets/plugins peer `@babel/core ^8`; `preset-env` drops `useBuiltIns/corejs` (use `babel-plugin-polyfill-corejs3`) and `loose/spec`; `preset-react` default `runtime: automatic`; `plugin-proposal-decorators` needs explicit `version` (`legacy`/`2023-11`); `plugin-transform-runtime` drops `corejs`; default `targets` change from `>= 0%` to `defaults`. Search config uses `useBuiltIns:'usage'` + `corejs:3` + legacy decorators, i.e. every item applies. | https://babeljs.io/docs/v8-migration |
| **postcss 8.4.14 -> 8.5.x** | Minor-level: no API break for plugins on `^8.4`; fixes sourcemap path-traversal and line-return advisories. Next 10 uses its own nested `postcss@8.2.13` for its loader and loads user plugins via `postcss.config.js`. | https://github.com/postcss/postcss/blob/main/CHANGELOG.md |
| **postcss-preset-env 7 -> 11** [M] | 8: removed `importFrom`/`exportTo`, Node >= 14, changed feature/stage defaults, `autoprefixer` bundled; 9-11: further feature graduation (cssdb), Node >= 18 then >= 20.19 (latest), `stage: 0` semantics and `browsers` -> use `browserslist` (`.browserslistrc` exists: `last 3 versions`, `not ie > 0`). Current config `postcss-preset-env: { stage: 0 }` enables *all* experimental features: output can change visibly. | https://github.com/csstools/postcss-plugins/blob/main/plugin-packs/postcss-preset-env/CHANGELOG.md |
| **postcss-custom-media 8 -> 12** [M] | Newer majors dropped `importFrom`/`exportTo`; `postcss.config.js` uses `importFrom: 'main/media-queries.css'` -> must be replaced by declaring `@custom-media` in each file, or by `@import`/`postcss-import`, or relying on preset-env's `customMedia` with a source file. Needs a visual/CSS-diff check (28 CSS files). | https://github.com/csstools/postcss-plugins/blob/main/plugins/postcss-custom-media/CHANGELOG.md |
| **postcss-extend-rule 4.0.0** | Already latest; keep. | |
| **cssnano 4 -> 9** | 5: PostCSS 8; 6-9: Node floors, preset changes, latest needs Node `^22.22.3 \|\| ^24.15 \|\| >=26` and `postcss ^8.5.28`. Recommendation: remove the plugin (Next's CSS pipeline minifies: `cssnano-simple` in Next 10-12, Lightning CSS in 15+). Current custom preset (`discardComments:false`, etc.) suggests deliberate output preservation, so compare built CSS before/after. | https://cssnano.github.io/cssnano/ |
| **webpack 4 -> 5 (via Next 11/12)** [V] | `node.fs:'empty'` -> `resolve.fallback`; automatic Node polyfills removed (`buffer`, `crypto`...) ; asset modules replace `file-loader`/`url-loader`; `config.module.rules` shape tweaks; persistent cache. | https://webpack.js.org/migrate/5/ , https://nextjs.org/docs/messages/webpack5 |
| **next-images / @zeit/next-source-maps** | Obsolete since Next 11 (static images) / Next 9.x (source maps); `productionBrowserSourceMaps` replaces the latter. | https://nextjs.org/docs/pages/guides/upgrading/version-11 |
| **stylelint 13 -> 17** [M] | 14: ESM/Node 12; 15: stylistic (formatting) rules deprecated; 16: stylistic rules removed, CommonJS Node API dropped, Node >= 18, `stylelint-config-prettier`/`stylelint-prettier` unnecessary; 17: Node >= 20.19 (per the latest package `engines`). All `@oacore/stylelint-config-base` parents pin <=13/14, so the config must be rewritten (e.g. `stylelint-config-standard` + `stylelint-config-css-modules` current). | https://stylelint.io/migration-guide/to-14 , /to-15 , /to-16 , /to-17 |

### 8.3 Lint, format, hooks

| Package (jump) | Breaking changes | References |
|---|---|---|
| **eslint 7 -> 9** [M] | Flat config default (`eslint.config.js`); `.eslintrc.yml` (`parser: babel-eslint`, `extends: '@oacore/eslint-config-react'`, `import/resolver` with `paths:['.']`) must be rewritten; `eslint:recommended` changes; formatters moved; node >= 18.18. | https://eslint.org/docs/latest/use/migrate-to-9.0.0 , https://eslint.org/docs/latest/use/configure/migration-guide |
| **eslint 9 -> 10** [V] | `.eslintrc` removed entirely; Node `^20.19 \|\| ^22.13 \|\| >=24`; `context.getFilename()` & co removed; JSX references tracked; **latest `eslint-plugin-react` (7.37.5), `-import` (2.32.0), `-jsx-a11y` (6.10.2) declare peers only up to ESLint 9** - dashboard avoids them. | https://eslint.org/docs/latest/use/migrate-to-10.0.0 |
| **babel-eslint 10 -> @babel/eslint-parser** | package deprecated; after TS adoption use `typescript-eslint` parser. | https://github.com/babel/babel/tree/main/eslint/babel-eslint-parser |
| **eslint-plugin-prettier 3 -> 5** [M] | Needs ESLint >= 8, Prettier >= 3; recommended to run Prettier separately instead of as a lint rule. `@oacore/eslint-config-base` enables `prettier/prettier: 'error'` - disappears with the shared config. | https://github.com/prettier/eslint-plugin-prettier/blob/master/CHANGELOG.md |
| **eslint-config-prettier 6 -> latest** [M] | The `prettier/react`-style entries were removed in v8; just use `eslint-config-prettier` (flat export) last. | https://github.com/prettier/eslint-config-prettier/blob/main/CHANGELOG.md |
| **prettier 2 -> 3** [M] | Defaults: `trailingComma: "all"` (mitigated: shared config sets `es5`), markdown/ESM config handling, plugin API; formatting diffs expected in a few files; `endOfLine: lf` already default. | https://prettier.io/blog/2023/07/05/3.0.0 |
| **husky 4 -> 9** [M] | Complete redesign: no `husky` key; hooks are files in `.husky/`; `"prepare": "husky"`; `core.hooksPath` is set to `.husky/_`. Search has *no* husky config today, so this adds hooks for the first time. Dashboard's `.husky/pre-commit` = `npx lint-staged` with `eslint --fix`. | https://typicode.github.io/husky/migrate-from-v4.html |
| **npm-run-all 4 -> npm-run-all2** | drop-in fork; `run-p lint:*` keeps working. | https://github.com/bcomnes/npm-run-all2 |

### 8.4 Runtime libraries

| Package (jump) | Breaking changes | References |
|---|---|---|
| **@sentry/browser + node 5 -> 7.119.1** [M] | v6: ES6 baseline, minor API clean-up; v7: `@sentry/tracing` merge, integrations as classes (still), performance API. Search calls only `Sentry.init({ dsn })` through a webpack alias. | https://docs.sentry.io/platforms/javascript/migration/ |
| **-> @sentry/nextjs 10/11 (after Next >= 13.2)** [M] | v8: functional integrations, `Hub` removed, `startTransaction` removed, new `Sentry.init` in `instrumentation`/`sentry.*.config.js`; v9/10: Node >= 18/20, removed deprecated v8 APIs. Replaces both `@sentry/browser`, `@sentry/node` and the `next.config.js` alias hack; dashboard uses `@sentry/react ^10.49`. | https://docs.sentry.io/platforms/javascript/guides/nextjs/ , https://docs.sentry.io/platforms/javascript/migration/v7-to-v8/ |
| **logrocket 10 -> 12; logrocket-react remove** | No published migration guide found; `LogRocket.init/captureException/captureMessage` (the only calls) are core API. Peer of `logrocket-react@7`: `^17 \|\| ^18 \|\| ^19` (unused package, remove). Privacy/CSP: `csp.config.js` must keep allowing LogRocket hosts. | https://docs.logrocket.com/ |
| **react-ga4 2 -> 3** [M] | Verify release notes; single wrapper `hooks/use-analytics.js` (`ReactGA.initialize/send/event`). | https://github.com/PriceRunner/react-ga4/releases |
| **i18n-iso-countries 6 -> 7** [M] | Check CHANGELOG for locale-data/package-layout changes (search imports the JSON `i18n-iso-countries/langs/en.json` directly; `exports` map in newer versions may block deep imports - test under Next 12+/Turbopack). | https://github.com/michaelwittig/node-i18n-iso-countries/blob/master/CHANGELOG.md |
| **core-js 3.42 -> 3.50** | Minor; no breaking change. | https://github.com/zloirock/core-js/blob/master/CHANGELOG.md |
| **leaflet 1.9.4 / markercluster 1.5.3** | Already latest 1.x; Leaflet 2.0 is pre-release (do not adopt). SSR note: `leaflet` touches `window` at import - already behind `next/dynamic(..., { ssr: false })` in `modules/map/index.jsx`. | https://leafletjs.com/ |
| **husky/lint-staged (dashboard)** | `lint-staged ^16` is the dashboard pairing. | https://github.com/lint-staged/lint-staged |

## 9. Fate in the target architecture (dashboard parity)

Dashboard reference (`../dashboard/package.json`): React `^19.2.4`, `react-router-dom ^7.13`, `antd ^6.3`, `axios ^1.13`, `swr ^2.4`, `zustand ^5`, TypeScript `~5.9`, ESLint `^10` flat config (`@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks ^7`, `globals`), Husky `^9` + `lint-staged ^16`, **Vite 7**, **pnpm**, Node `>=24`, `@sentry/react ^10.49`, `classnames`, `dayjs`, `react-markdown ^10`, `js-cookie`. No Prettier, no Stylelint, no MobX, no Next.js in the dashboard.

| Search package | Fate | Replaced by / note |
|---|---|---|
| `next`, `react`, `react-dom` | KEEP+UPGRADE (next 16, react 19) | **Decision needed:** dashboard is a Vite SPA with `react-router`; search is a server-rendered Next pages-router app (SSR for public search/output pages, `rewrites`, CSP headers, `getInitialProps`). Replacing Next by Vite+react-router would drop SSR/SEO and the rewrites; recommended to keep Next and take `react-router` out of scope unless SEO is not needed. |
| `mobx`, `mobx-react-lite` | REPLACE -> `zustand` | Interim 6.15.x / 4.1.1. 10 files import mobx (`store/*`, 1 decorated). |
| `@oacore/design` | REMOVE | Copy used components verbatim first, then migrate to `antd`; drops react-slick, svgo/svgstore/cheerio, d3 v1, katex(if unused), react-markdown 5 (dashboard has v10). |
| `@oacore/eslint-config-react`, `babel-eslint`, `eslint-plugin-prettier`, `eslint-plugin-import` | REPLACE | `@eslint/js` + `typescript-eslint` + `eslint-plugin-react-hooks` + `globals` (+ `eslint-plugin-react`/`jsx-a11y` only while ESLint <= 9). |
| `eslint` | KEEP+UPGRADE | 9 (legacy plugins) -> 10 (dashboard parity). |
| `prettier`, `@oacore/prettier-config` | KEEP prettier 3; REMOVE shared config (inline) | Project description lists Prettier although dashboard has none. |
| `stylelint`, `@oacore/stylelint-config-base` | KEEP+UPGRADE with new config, or REMOVE | Dashboard has none; "pure CSS" is retained either way. |
| `husky` | KEEP+UPGRADE (9) + add `lint-staged` | Matches dashboard. |
| `npm-run-all` | REPLACE (`npm-run-all2`) / drop | |
| `postcss`, `postcss-preset-env`, `postcss-custom-media`, `postcss-extend-rule` | KEEP+UPGRADE | Dashboard uses Vite's built-in PostCSS; with Next they stay. `cssnano`: REMOVE. |
| `@babel/*`, `babel-plugin-add-react-displayname`, `core-js` | KEEP 7.x short-term, REMOVE at W8 | SWC (Next) / `@vitejs/plugin-react` (dashboard) take over. |
| `@sentry/browser`, `@sentry/node` | REPLACE | `@sentry/nextjs` (stay on Next) or `@sentry/react` (dashboard). |
| `logrocket` | KEEP+UPGRADE (product decision; dashboard has none) | `logrocket-react`: REMOVE. |
| `react-ga4` | KEEP+UPGRADE | |
| `leaflet`, `leaflet.markercluster` | KEEP | |
| `bibtex-parse-js` | REPLACE -> `@orcid/bibtex-parse-js` or vendor | |
| `i18n-iso-countries`, `js-file-download` | KEEP (+upgrade) | `js-file-download` could be a 10-line util; dashboard uses `html-to-image`/`jspdf`, not this. |
| `filesize`, `throttle-debounce`, `next-images`, `@zeit/next-source-maps`, `cssnano`, `@babel/plugin-syntax-dynamic-import` | REMOVE | unused / obsolete / built into Next. |
| (missing today, to ADD per target) | ADD | `typescript` + `@types/react*` + `@types/node`, `axios`, `swr`, `zustand`, `react-hook-form`, `antd` (+ `@ant-design/icons`), `lint-staged`, `typescript-eslint`, `@eslint/js`, `eslint-plugin-react-hooks`, `globals`; optionally `react-router-dom` (see decision above), `dayjs`, `js-cookie`, `react-markdown ^10`. Today's data layer uses native `fetch` (`api/index.js`, `lib/loader.js`), not axios. |

## 10. Open questions, risks, and commands to run on a networked machine

1. **Re-verify "latest" data** (section 0): `npm view <pkg> version peerDependencies engines deprecated` for the 47 non-private direct dependencies; and `npm view mobx-react-lite@4 version peerDependencies`.
2. **Run the real audit**: `cd search && npm audit --json > audit.json` (read-only) and `npm audit --omit=dev --json`; replace section 6 with exact counts.
3. **Private packages**: `npm view @oacore/design versions --registry=https://npm.pkg.github.com` (needs `GITHUB_TOKEN`) to see whether anything newer than 5.0.74 exists and whether `@oacore/stylelint-config-base@2.0.0-stylelint.1` and a newer `@oacore/eslint-config-*` (maybe ESLint 8+/flat) exist - this could shorten W2.
4. **Does `npm ci` work without `--legacy-peer-deps`?** Cannot be tested offline here; expected failure sources are listed in finding 3.
5. **Decide Node baseline** (22 LTS recommended) before touching anything; Dockerfile currently pins node:18-alpine and `--openssl-legacy-provider`.
6. **Decide Next-vs-Vite** (section 9) - it changes whether W7 is a Next 16 migration or a rewrite to Vite + react-router.
7. **Decide webpack vs Turbopack** at W7 (custom `webpack()` hook: aliases to project dirs `api,data,main,hooks,config,store,utils,templates,modules,lib` + react/react-dom + sentry alias + css-loader camelCase patch). In a TS/Vite-like layout these become `tsconfig` `paths`/`turbopack.resolveAlias`.
8. **Is `data/data-loader.js` run at build time against the live API** (`node ./data/data-loader.js && ... next build`)? It uses undeclared `node-fetch`; keep working during every wave (global `fetch` replacement on Node >= 18).
9. **Source maps / Sentry**: `@zeit/next-source-maps` is used but no Sentry source-map upload exists in the repo; confirm what consumes the maps before deleting.
10. **CSP** (`csp.config.js`) lists third-party hosts for LogRocket/GA/Sentry; any library swap (Sentry SDK, LogRocket) must re-check CSP.
