# Review: @oacore/design vendoring and ownership (M4) — key `design-system`

Reviewer scope: `docs/upgrade/60-design-copy-plan.md`, OD-21/OD-06 in `90-open-decisions.md`, design rows in 10/20/30/40/50, raw evidence `findings/04-design-system-usage.md`.
Repos: search `f5cfc20` (branch docs/upgrade-plan), design `bbc35a0`, core-ui `0e9cfa5`, dashboard HEAD. Date 2026-10-19.
All scratch experiments live under `<scratch>/exp/design-system/` (paths below are relative to it). Nothing in any repo was modified.

---

## 0. Verdict

The inventory in finding 04 / doc 60 is mostly right (101 import statements in 68 files; 53 CSS files reachable from `lib/index.css`; icon merge of two `design.config.js`). The recommendation to vendor the **compiled** output rather than `src/` is also right, and I could prove it with experiments. But the plan **cannot be executed as written**, and it has no ownership step:

1. **Critical.** Moving the compiled CJS files into a top-level `design/` folder puts them under search's Babel config, because Next's babel-loader skips only `/node_modules/`. Search's `preset-env {useBuiltIns:'usage'}` adds ESM `import "core-js/…"` lines to every vendored file. Webpack then treats each file as an ES module and its `exports.*` writes are lost. I reproduced this with Next's own bundled webpack 4 and webpack 5: `default` comes back `undefined` (section 4.1). The claim "JS semantics identical by construction" (60 §2) is false for the layout that 60 recommends.
2. A safer mechanism exists, and the plan does not list it. Keep the package shape: an in-repo local package (`vendor/oacore-design/`, installed as a real copy into `node_modules`). It is byte-identical by construction (the lockfile integrity stays `sha512-kwYolSk…`), it needs **no 68-file codemod** and no alias, and it can move to W0 (section 5).
3. There is **no ownership plan** (M4). 60 §2 says the vendored code "is thrown away in phase 7". By LOC, about 75% of the closure has no antd equivalent (Header and search bar, Select, Footer, SearchResult, Histoslider, MathMarkdown, icons, foundation and global CSS). Search must own these as source permanently (section 6).
4. **M1 gap.** Doc 60 pins every design runtime dependency at today's version and gives no route to latest. I found these concrete breakers at latest: `@babel/runtime@8` (no `./regenerator` export), `throttle-debounce@5` (signature change; it breaks Header suggestions silently), `svgo@4` and `yargs@18` (ESM-only; they break the sprite CLI), `d3-array@3`/`d3-scale@4` (ESM-only), `katex@0.19` and `sanitize.css@13` (pixel changes) (section 7).
5. **Test facts are wrong.** The production sprite has **48** symbols, not 49: `file-check` is added only when `NODE_ENV!=='production'`, and the Docker `ARG NODE_ENV=production` applies during `npm ci`. Fonts and media coming from design CSS (60 KaTeX files, the slick font and `ajax-loader.gif`) are missing from the inventory and from the asset tests (sections 1.4 and 1.5).

---

## 1. Exact inventory (verified)

### 1.1 Import sites
- `rg "@oacore/design"` (excluding node_modules, .next, docs, lockfile) finds 103 lines in 69 files: 101 import statements in 68 code files, plus `package.json:18` and one comment at `templates/data-provider/search.jsx:13`. This confirms 60 §3. Specifier counts are as in 04 §1a.
- 37 files import `classNames` (either shape). Search uses 20 distinct icon ids (`rg` over `src|icon|statusIcon…="#…"`), including `#magnify` (8 sites), `#check` (3) and `#pencil` (1), which come **only** from design's config.
- CSS: only `pages/_app.jsx:18` (`@oacore/design/lib/index.css`), which loads after leaflet (`:15-17`) and before `main/global.css` (`:19`). No `require()` or dynamic import of design exists. `lib/global/**` is referenced by nothing (this resolves 60 D1 "[VERIFY nothing references it]").

### 1.2 What actually runs today (compiled closure)
Script `scripts/closure.js` follows `require()` from the entry points search uses (`lib/index.js`, `lib/elements`, `lib/modules`, `lib/utils`, `lib/utils/class-names`, `lib/elements/icon`, `lib/elements/logo`):
- **110 of 114** lib JS files are evaluated today, because `lib/index.js` re-exports everything. Only `lib/content/*` (4 files) is unused.
- External runtime requires: `@babel/runtime` (102 files; the helpers used are interopRequireDefault, defineProperty, objectWithoutProperties, slicedToArray, typeof, toConsumableArray, createClass, classCallCheck, asyncToGenerator and **`@babel/runtime/regenerator`** in `lib/modules/search-result/search-result.js:9`), `react` (66), `prop-types` (26), `react/jsx-runtime`, `classnames`, `react-cookie` (2), `react-dom` (portal), `react-focus-lock`, `@tippyjs/react`, `katex`, `d3-array`, `d3-scale`, `throttle-debounce`, `react-slick` (Carousel, unused), and `react-markdown` (documentation-membership, unused).
- Declared but never required: `d3-format`, `body-scroll-lock`, and `babel-plugin-add-react-displayname` (a build plugin listed under `dependencies`).
- Internal barrel requires: 13 of them in 11 files (`require("..")` / `require("../../elements")`: cookies/popup, expandable-list, fieldset, footer, header/{advanced-search,header,search-bar}, modal, popover, search-result, select/{option,select}).

### 1.3 CSS closure
Script `scripts/css-closure.js`: `lib/index.css` reaches **53** lib CSS files (all lib CSS outside `lib/global/`) plus **7** external files: `sanitize.css/{sanitize,forms,typography,reduce-motion}.css`, `slick-carousel/slick/{slick,slick-theme}.css` and `katex/dist/katex.min.css`. Note that `lib/elements/math-markdown/math-markdown.css:1` imports `katex/dist/katex.min.css` **without** `~`. It resolves only because css-loader tries the relative path first and then module resolution (Next's compiled css-loader `resolveRequests(…, [requestified, original])`). Finding 04 §3.1 says "ships all 106 compiled CSS files"; that number counts the unused `lib/global` duplicate as well. The correct figure is 53 + 7.

### 1.4 Icons
- CLI: `bin/index.js` → `bin/build/{config,icons}`. Requires: `yargs`, `cosmiconfig`, `deepmerge`, `svgstore`, `svgo` (1.x class API: `new SVGO()` at `bin/build/icons/runner.js:22,38`, and `SVGO.call` at `bin/build/icons/svgo.js:11`), plus `fs`/`path`. `design.config.js` does `require.resolve('@mdi/svg/package.json')`. This is the exact devDependency list for 60 D5 "[VERIFY the exact list against the requires of the copied bin/]".
- Merge: `bin/config.js:69,74` runs `cosmiconfig('design',{stopDir:'/'})`, starting from the CLI's own directory and walking up until `/`. It finds `node_modules/@oacore/design/design.config.js` and then `search/design.config.js`, and combines them with `merge.all` (`:54`, arrays concatenated). Nothing else reads env: `ICONS_PUBLIC_PATH` is read by nothing in design or search (`grep process.env bin design.config.js lib`).
- **Symbol count depends on NODE_ENV.** `design.config.js:28,65` runs `if (isDev) icons.push('file-check')` with `isDev = NODE_ENV!=='production'`. Docker declares `ARG NODE_ENV=production` (`Dockerfile:4`), and ARGs are exposed to `RUN npm ci` (`:19`, where the postinstall runs `node bin build`) and to `npm run build`. The local sprite `public/design/icons.svg` has 49 `<symbol>` (it includes `file-check`); the **production sprite has 48**. T-005 and R-022 say "49".
- Runtime: `lib/elements/icon/icon.js:21` builds `${config.iconsPublicPath}#id`. `lib/config.js` is rewritten by postinstall to `/static/search/icons.svg` (the tarball ships `/` and `/icons.svg`). In production the gateway strips `/static/search` (`kube/prod/httproute.yaml`) and Docker copies the sprite to `public/icons.svg`. Locally, without the proxy, Next rewrites `/static/:path*`→`/:path*`, which gives `/search/icons.svg` and a 404. 40 §2.5 emulates the gateway, which is correct.
- MDI 5.9.55 → 7.4.47: the path data (`d=`) is identical for all 24 MDI ids used; only the wrapper markup differs (`pack-mdi-7`). Whether the svgo output (and so the sprite bytes) is identical is UNCONFIRMED.

### 1.5 Fonts and media assets (missing from 04/60)
Design CSS emits these into `.next/static/media` (dev build listing): **60 KaTeX font files** (`katex.min.css` `@font-face`), **slick font** `slick.{eot,woff,ttf,svg}` and `ajax-loader.gif` (`slick-theme.css:5,15-16`). Finding 04 §3.1 says "No `@font-face`/web font anywhere", which is wrong for the shipped CSS. The body font `roboto` is never loaded (that part is correct). Screenshots therefore depend on the fonts installed in the container (pinned image, 40 §1).

### 1.6 Global CSS, tokens, custom media
Finding 04 §3.1 is accurate. Search's PostCSS chain re-processes the design CSS. Evidence: the dev build `.next/static/chunks/pages/_app.js` shows `node_modules/@oacore/design/lib/elements/fieldset/fieldset.css` going through `css-loader!postcss-loader`, with `@media (--screen-until-desktop)` resolved to `(max-width: 767px)` and autoprefixer output added. The leftover `@extend %placeholder-hidden` / `%label-overlay` in `lib/elements/forms/styles.css:92,95,375` are **removed** by search's `postcss-extend-rule`, which leaves empty rules (`.styles-control-12Pze::placeholder{}`); this is today's behaviour. `color-mod()` survives (Q-066). The output also depends on `search/.browserslistrc` ("last 3 versions, not ie > 0, not op_mini > 0") and the installed `caniuse-lite`.

### 1.7 Per-unit table (compiled file = `node_modules/@oacore/design/lib/<path>.js`; source = `design/src/<path>.jsx`)
This adds to 04 §2. Only new or corrected hazards are listed; the rest is as in 04 §4.

| Unit | lib entry | Internal deps | 3rd-party | CSS (lib) | React 18/19 hazards |
|---|---|---|---|---|---|
| utils/classNames | utils/index.js, utils/class-names.js | — | classnames | — | none |
| Icon | elements/icon/icon.js | utils, config | prop-types | elements/icon/icon.css | none |
| Button | elements/button/button.js | utils | prop-types | button/button.css (global `button,[type=…]`, color-mod) | none |
| Card | elements/card/card.js | utils | prop-types | card/card.css | none |
| Link/BaseLink | elements/link/link.js | Icon | prop-types | link/link.css | none |
| Modal | modules/modal/*.js | **elements barrel** | react-focus-lock, react-dom | modal/modal.css | stale onClose (Q-068) |
| Form/TextField | elements/forms/*.js | Icon, ProgressSpinner | prop-types | forms/{text-field,styles}.css | none |
| Select | modules/select/*.js | elements barrel, header/advanced-search | — | select/select.css, header/advanced-search.css (global `ul`) | `child.type.displayName` lookup |
| Header (+useSearchBar), AppBar, Logo | modules/header/*.js, elements/app-bar, elements/logo | elements and modules barrels, context, hooks | throttle-debounce **3** (positional API at `search-bar.js:173`) | header/styles.css, app-bar/styles.css, logo/*.css | conditional hook (Q-047) |
| DesignProvider | context.js, modules/header/context/* | — | — | — | — |
| Popover | modules/popover/popover.js | elements barrel (Card) | @tippyjs/react 4.2.6 (latest; unmaintained since 2022) | popover/popover.css | `element.ref` warning (R-056) |
| MetadataList, ExpandableList | elements/metadata-list, elements/expandable-list | utils; elements barrel | — | own CSS | ExpandableList hook after early return |
| Fieldset | elements/fieldset/index.js | elements barrel | — | fieldset.css (`--screen-until-desktop`) | `items[0]` in effect |
| Histoslider | elements/histoslider/*.js | utils | d3-array 1, d3-scale 1 | histoslider.css | `defaultProps` (`histoslider.js:141`) |
| MathMarkdown | elements/math-markdown/*.js | — | katex 0.16.22 (+CSS +60 fonts) | math-markdown.css | `defaultProps` (`math-markdown.js:44`) |
| **SearchResult** | modules/search-result/search-result.js | elements barrel (Card, Heading, MetadataList, ExpandableList, MathMarkdown, LogoGroup, DataProviderLogo), BaseLink | **@babel/runtime/regenerator** | search-result/styles.css | **NEW:** `getLogoLink()` calls `useState`+`useEffect` once **per data provider inside `.map`**, and only when `useLogo` (`src/modules/search-result/search-result.jsx:85-110,140-143`). This violates the rules of hooks; the hook count depends on `dataProviders.length` and `useLogo`. **NEW:** each such hook does a client `fetch('https://api.core.ac.uk/data-providers/{id}/logo')` (`lib/…/search-result.js:137`), and search passes `useLogo` and `dataProviders` (`templates/search/results.jsx:95-114`, `templates/output/similar-works.jsx:67-84`). Not in R-033 or Q-047. |
| Cookies, CookiesProvider, useCookie | elements/cookies/*.js, hooks/use-cookies.js | elements barrel (Button, Link), hooks | react-cookie 4.1.1 / universal-cookie 4.0.4 | cookies/cookies.css | Q-051 ESCALATES |
| Footer | elements/footer/footer.js | elements barrel (Icon, Link, MathMarkdown) | — | footer/footer.css | none |
| LoadingBar, ProgressSpinner, Heading | elements/… | utils | prop-types | own CSS | none |

No `findDOMNode`, legacy context or `UNSAFE_*` lifecycles exist in the closure or in react-focus-lock, @tippyjs/react, react-cookie or react-slick (`grep` returned nothing). Peer caps: only `react-slick@0.28.1` caps React at ≤17. `react-markdown@5.0.3` peers `react >=16`; `react-focus-lock` allows up to 19; `react-cookie` and `@tippyjs/react` use open `>=` ranges. `react-slick@0.31.0` peers React up to 19.

---

## 2. Package integrity (installed vs design repo at bbc35a0)

| Check | Command | Result |
|---|---|---|
| Registry latest | `npm view @oacore/design dist-tags` | `latest: 5.0.74`; remote `master` = `bbc35a0` (`git ls-remote`). Nothing newer exists. |
| Installed == published tarball | `npm pack @oacore/design@5.0.74` → shasum `e6a401d7…` (= lockfile `resolved`), `diff -rq` with `search/node_modules/@oacore/design` | Identical except `lib/config.js` (postinstall-generated) |
| Tarball non-lib files == git | `git archive bbc35a0` vs tarball | Identical (466 files). Git has 3 extra files (`.gitignore`, `.npmrc`, `package-lock.json`). |
| **lib reproducible from src** | In scratch: `babel src --out-dir lib` + `postcss 'src/**/*.css' --base src --dir lib` (+ `--env=global` into `lib/global`), using `design/node_modules` and Node 18 (`rebuild/`) | **220/220 lib files byte-identical** to the published tarball, including the class hashes |
| design repo working `lib/` | `diff -rq` | Stale: 4 files differ (`config.js`, `elements/footer/footer.{js,css}`, `global/elements/footer/footer.css`). 04 lists 3. |
| design working tree | `git status` | Staged rename `assets/github.svg → githubF.svg` (content identical) |

Consequence: `design/src@bbc35a0` is a **proven exact source** of the compiled code. Ownership work can treat `src/` as the readable reference, while the compiled `lib/` stays the runtime truth until each unit is replaced.

---

## 3. How design CSS is processed today, and what vendoring changes

- Next 10.2.3 `dist/build/webpack/config/blocks/css/index.js`: global CSS from `node_modules` imported by app code, and global CSS imported by `pages/_app`, both use the same `getGlobalCssLoader(ctx, postCssPlugins)`. Moving the CSS to an app folder that `_app` imports therefore keeps the same loader chain. The CSS is processed the same way for both of options A and C below.
- I rebuilt search's PostCSS chain outside Next (`scripts/search-postcss.js`: preset-env stage 0 → cssnano preset → custom-media importFrom `main/media-queries.css` → extend-rule, the same order and options as `search/postcss.config.js`). For **53/53** lib CSS files, its output equals the CSS string that Next's dev build put into `.next/static/chunks/pages/_app.js` after whitespace normalisation, with the `/*# sourceMappingURL */` comments and `@import` lines stripped. So the CSS each file contributes is deterministic and can be extracted outside Next.
- That processed output is already "pure CSS". A scan of the 53 processed files finds no `@media (--`, no `@extend`, no nesting `&`, no `@custom-media`, no `:global(`. Only `color-mod(` remains (`elements/button/button.css`, Q-066; browsers drop it).
- Option B's premise fails. Running **src** CSS through search's chain gives a declaration set equal to lib-through-search for only **15/34** closure files, even with browserslist forced to search's query (`scripts/cmp-src-lib.js`). Some differences are semantic, for example:
  - `helpers.css`: `:global(.sr-only)` stays literal in a global file, so the selector is invalid, the `.sr-only` rule is lost, and visually-hidden text becomes visible.
  - Static fallbacks that the lib build added are missing (`modal.css` `.overlay-root{z-index:1030}`, `search-result/styles.css` `.container{min-height:9rem;padding-left:7rem}`).
  - Keyframe and class names change.

  Some differences are equivalent text (`calc` folding, `5vw` vs `calc((100vw - 90vw)/2)`). Either way, B cannot be proven byte-identical and needs per-property computed-style proof.
- Class names: under A or C they stay the inlined `[name]-[local]-[hash:base64:5]` names from `.cssmodulesrc`. Under B, Next's css-loader `getLocalIdent` generates different names, and design component CSS becomes per-chunk module CSS. That moves it out of the single global block that loads before `main/global.css`, which changes the cascade against search's equal-specificity rules.

**Proving byte-identical CSS output (W5):** see 8, G3.

---

## 4. OD-21 evaluated

### 4.1 The plan's option A (compiled lib copied into top-level `design/`) breaks under search's Babel
- Next 10.2.3 `dist/build/webpack-config.js` includes the app dir for babel-loader and excludes only `/node_modules/`. `next-babel-loader.js` adds the CommonJS transform only if the source contains `module.exports`. There are **0** compiled lib files containing `module.exports` (they use `exports.x =`). Next 12.3.4 is the same (`dist/build/babel/loader/get-config.js:91` `hasModuleExports`; `webpack-config.js:474-478` excludes only node_modules). W5 runs on Next 12.3 with Babel kept (50 O5).
- `scripts/../babel-probe.js` runs search's `babel.config.js` over `lib/elements/button/button.js`. The output starts with `import "core-js/modules/es.symbol.js"; import "core-js/modules/es.array.filter.js"; …` and keeps `exports["default"] = …`.
- `wp4/`: I bundled `lib/utils/class-names.js` as-is and after search's Babel, using Next's own `next/dist/compiled/webpack` (`init(false)` = webpack 4, `init(true)` = webpack 5). The untouched file gives `default: function`; the transformed one gives `default: undefined` in both. Webpack 4 marks it `/*! no exports provided */` and wraps it as a harmony module. In the browser, `exports` is then undefined (ReferenceError at module evaluation). On the server, the exports are silently lost, so components come back undefined.
- Fix, if the app-tree layout is kept:
  - add `ignore: [<vendored dir regex>]` to `babel.config.js`. Next's loader passes ignored files through unchanged (`babel-loader/src/index.js`: "If the file was ignored, pass through the original content").
  - add the folder to Jest `transformIgnorePatterns` (babel-jest errors on files that Babel ignores).
  - re-verify under SWC/Turbopack in W9 (UNCONFIRMED).
  - add a guard test (G2 in 8).

### 4.2 Option B (copy `src/`)
This is ruled out for W5 by section 3, by R-024/R-025 (alias collisions, pure-mode CSS) and by the JSX runtime mismatch (`babel.config.js:12` uses the classic runtime). The work in B is the ownership conversion itself, and it belongs to section 6, per component.

### 4.3 Missing option C: vendor the exact package as an in-repo local package (recommended)
- `vendor/oacore-design/` holds the exact content of the 5.0.74 tarball (466 files; the shipped `lib/config.js` default is kept, because postinstall regenerates it exactly as today). `package.json` gets `"@oacore/design": "file:vendor/oacore-design"`.
- It **must be installed as a copy, not a symlink**. A symlink resolves to the app path, and section 4.1 applies again. Probe (`dir-dep/`): with `install-links=true` the lockfile records `resolved: file:vendor/oacore-design` and no `link`; without it, `link: true`. Trap: `Dockerfile:18` **overwrites** `.npmrc` (`printf … > .npmrc`), and `.npmrc` is gitignored. So use `npm ci --install-links` (or `npm_config_install_links=true`) in the Dockerfile and CI, plus guard G1 (fail if `node_modules/@oacore/design` is a symlink).
- An immutable variant (`tarball-dep/`): `"file:vendor/oacore-design-5.0.74.tgz"` records **the same integrity `sha512-kwYolSk…`** as today's lockfile. This is a mathematical proof of zero content change. It is the right shape for the very first commit. Later edits (peer metadata, Q-051, defaultProps) make the readable directory form preferable.
- What option C gives:
  - The 101 import sites stay untouched: no codemod, no `design` alias in next/jest/eslint, and no half-vendoring context-identity risk (60 §5 pitfall 5).
  - Same server externals and CSS rule.
  - The GitHub-Packages token and `"latest"` drop out for design.
  - The postinstall behaves byte-for-byte as today.

---

## 5. Exact vendoring procedure (proposed replacement for 60 §4)

Phase **W5a** is packaging only. It can run in **W0**, right after the phase-2 baselines, on the unchanged Next 10 stack.
1. `npm pack @oacore/design@5.0.74` (shasum `e6a401d74defeb09d828b10374ff35107a9324c4`). Commit the tarball, or its extracted `package/` as `vendor/oacore-design/` (the second needs `--install-links`). Keep `LICENSE` and add `vendor/oacore-design/VENDORED.md` (source = registry tarball, shasum, git `bbc35a0`, date, and the rule that edits are listed in the allow-list).
2. Set `package.json:18` to `file:…`, then `npm install --package-lock-only`. The lockfile diff must show only `resolved` (and `link`) for that one entry. Integrity is unchanged in the tarball variant. **No other lockfile line changes**: check `caniuse-lite`, `browserslist` and `postcss*` especially (section 1.6).
3. Gates G1–G6 (section 8) against the phase-2 golden build.

Phase **W5b** makes metadata-only edits before W6. Each goes in its own PR on the allow-list:
- In vendored `package.json`, widen `peerDependencies` to include React 18/19.
- Either bump `react-slick` to 0.31.0 (peers ^19; it is never rendered), **or** delete the one `require("./carousel")` block in `lib/elements/index.js`. That single line removes react-slick from the graph. 60 D2 proposes instead to rewrite 13 internal barrel requires in 11 files plus new barrels.
- Remove the never-required deps (`d3-format`, `body-scroll-lock`, `babel-plugin-add-react-displayname`).
- The goal is that `npm ci` works without `--legacy-peer-deps` (T-008).

Phases W6/W7 then apply the ESCALATES and breakage edits (CS-R18-3, CS-R19-2/3) to vendored `lib/**` files. Each edit is listed in the allow-list manifest.

---

## 6. Ownership (M4) and the link to phase 7

### 6.1 Steps
- **O1 Freeze generated artefacts** (after S; or in W8 instead of the PostCSS majors):
  - (a) Commit the **production** sprite (48 symbols, duplicates kept, Q-067) as an owned asset. Remove `design build icons` from `package.json:76` and the `cp` at `Dockerfile:25`, if the sprite is committed at `public/icons.svg`; adjust `.gitignore:9-12`. Drop the 6 build deps (`@mdi/svg`, `svgo`, `svgstore`, `cosmiconfig`, `deepmerge`, `yargs`). This meets M1 by removal and ends the NODE_ENV dependence.
  - (b) Turn the vendored `lib/config.js` into a constant.
  - (c) Replace each vendored CSS file with its **search-processed** output (section 3: 53/53 reproducible, pure CSS). Inline `sanitize.css@12.0.1` (CC0) into the owned reset. The design CSS then no longer depends on the PostCSS chain, which makes OD-12/W8 and the M6 "pure CSS" goal safe for design CSS.
  - (d) Remove the postinstall.
- **O2 Per-component replacement (phase 7).** For each unit in 6.2: if it has an antd equivalent, use antd restyled (D5). Otherwise rewrite it as owned TS + plain CSS in `components/common/` or `components/layout/` (the org guide `core-fe-architecture/index.html` uses `components/common`, `components/layout` and `styles/`; the dashboard uses plain `.css`: 38 files, 0 `.module.css`). Use `design/src@bbc35a0` (proven exact, section 2) as the reference. Keep the exact class strings or CSS where needed for 0 px. Acceptance: T-802 0 px vs the phase-2 baseline, T-417 behaviour equivalence, and T-801. Characterization tests must pin each preserved quirk first (Q-047, Q-051, Q-066–Q-068 and the new SearchResult hook/fetch hazard).
- **O3 Delete `vendor/oacore-design`** when `rg "@oacore/design"` returns 0 and `npm ls @oacore/design` is empty.

### 6.2 Mapping to antd 6 / @oacore/core-ui
core-ui notes:
- The published `@oacore/core-ui@2.0.21` (npm) and the dashboard's 2.0.20 do **not** export `Header`, `Footer`, `Link`, `Carousel` or `useCookie`; those exist only in core-ui git `0e9cfa5` (unreleased).
- core-ui peers `antd ^5.27.6` and `@ant-design/icons ^5.6.1`, while antd latest is `6.6.6` and icons `6.3.4`, so using core-ui under antd 6 is a peer conflict.
- core-ui `Markdown` = react-markdown + rehype-raw, **no KaTeX**.
- core-ui components are restyled versions, not pixel copies, so under D5 they are references only.

| Design unit (search files) | antd 6 | core-ui | Class |
|---|---|---|---|
| Button (25) | Button | — | antd restyle; global native `button` rules stay owned CSS |
| Card + statics (14) | Card | CrPaper | antd restyle |
| Icon (20) | — (no MDI glyphs) | — | **custom** (owned sprite) |
| Link / BaseLink (9) | Typography.Link | Link (HEAD only) | antd restyle |
| Modal + statics (9) | Modal | — | antd restyle; preserve stale `onClose` (Q-068) and mount=open |
| TextField / Form + statics (7/3) | Form, Form.Item, Input | CrInput | antd restyle (floating label and status icons custom) |
| Select (1 + Header) | AutoComplete | — | antd composite |
| Header + useSearchBar, AppBar, Logo, advanced-search (5) | Layout.Header, Menu, AutoComplete | CrHeader / Header (HEAD only) | **custom** on antd primitives |
| DesignProvider (1) | — (ConfigProvider is theming) | — | **custom** context (zustand in phase 6) |
| Popover (3) | Popover / Tooltip | InfoTooltip | antd restyle (drops @tippyjs/react) |
| MetadataList (3) | Descriptions (markup differs) | — | **custom** |
| DataProviderLogo (2) | Avatar / Image | DataProviderLogo | antd restyle |
| LoadingBar (2) | — | — | **custom** |
| Fieldset (2) | Radio.Group `optionType="button"` / Segmented | CrToggleTabs | antd composite |
| SearchResult (2) | Card + Typography | — | **custom** |
| Cookies / CookiesProvider / useCookie (1/1/1) | — | CookiesPopup, useCookieHandler (useCookie HEAD only) | **custom** (cookie names, T-416) |
| Footer (1) | Layout.Footer | Footer (HEAD only) | **custom** |
| Histoslider (1) | Slider range (+ d3 histogram) | — | **custom** |
| MathMarkdown (1) | — | Markdown (no KaTeX) | **custom** (katex) |
| ProgressSpinner (1) | Spin (custom indicator) | — | antd restyle |
| ExpandableList (1) | — | CrShowMore | **custom** |
| classNames (37) | — | — | **custom** util |
| Foundation tokens, reset, global element rules | ConfigProvider tokens (partial) | themeTokens | **owned global CSS, permanent** (search CSS reads `--primary` 32×, `--page-padding-x` 12×, …) |

By 04 §6.1 LOC, the "custom" rows are about 5.2k of the ~7.05k LOC (≈75%).

Phase-7 prerequisites the plan omits:
- antd CSS-in-JS under **SSR** needs `@ant-design/cssinjs` style extraction in `pages/_document` for a 0 px first paint (https://ant.design/docs/react/server-side-rendering). The dashboard is a Vite SPA (`dashboard/vite.config.ts`) and gives no reference for this.
- Design's global `button,[type=button]`, `label`, `input`, `ul` rules will also hit antd's DOM. They can be retired only when no raw element still relies on them: search has 1 raw `<button>` and 9 raw `ul/input/select/textarea/label` sites.

---

## 7. M1: vendored runtime and build deps vs latest (registry 2026-10-19)

| Package | Installed | Latest | Latest in major | Effect at latest |
|---|---|---|---|---|
| @babel/runtime | 7.27.3 | **8.0.7** | 7.29.10 | 8.x `exports` has **no `./regenerator`**, so `lib/modules/search-result/search-result.js:9` fails to resolve (build error). Stay on 7.x until O2 replaces SearchResult. |
| throttle-debounce | 3.0.1 | **5.0.2** | 3.0.1 | v5 is `throttle(delay, callback, options)` (`cjs/index.js:28`); the vendored `throttle(suggestionsDelay, false, fn)` (`search-bar.js:173`) then has `false` as the callback, giving a TypeError on typing (silent until interaction) |
| katex | 0.16.22 | **0.19.0** | 0.16.47 | HTML, CSS and 60 font files change → pixel risk on math titles/abstracts; needs a math fixture in T-801 |
| sanitize.css | 12.0.1 | **13.0.0** | — | the reset changes on every page → pixel risk. O1 inlines 12.0.1 (CC0) and removes the dependency |
| d3-array / d3-scale | 1.2.4 / 1.0.7 | **3.2.4 / 4.0.2** | — | ESM-only (`"type":"module"`); the vendored CJS `require` is fine in webpack 5, but SSR externals on Node <22.12 give ERR_REQUIRE_ESM (UNCONFIRMED for Next 13–16 esmExternals) |
| react-cookie / universal-cookie | 4.1.1 / 4.0.4 | **8.1.2** | — | API and parse defaults change; T-416 must pin cookie attributes |
| @tippyjs/react | 4.2.6 | 4.2.6 | — | latest but abandoned (last publish 2022-04); React 19 `element.ref` warning; replaced in O2 (antd Popover) |
| react-focus-lock | 2.13.6 | 2.13.7 | — | patch |
| react-slick / slick-carousel | 0.28.1 / 1.8.1 | 0.31.0 / **2.0.0** | — | react-slick 0.31 lifts the peer cap. slick-carousel 2.0 changes CSS, fonts and the gif in the global bundle |
| prop-types, classnames | 15.8.1, 2.5.1 | same | — | — |
| svgo | 1.3.2 | **4.1.0** | — | ESM, no `SVGO` class → `bin/build/icons/svgo.js:11` breaks. O1 removes the CLI |
| yargs / cosmiconfig | 16.2.0 / 7.1.0 | **18.2.0** (ESM-only, Node ^20.19 / ^22.12) / 10.0.1 | — | `require('yargs')` in `bin/index.js` breaks. O1 removes it |
| @mdi/svg | 5.9.55 | 7.4.47 | — | path data identical for the 24 ids used (1.4). O1 removes the dependency |

The plan needs a row per package: target, gate and justification. My recommendation: stay on the installed major until S; then either remove the dependency through O1/O2 (svgo, yargs, cosmiconfig, deepmerge, svgstore, @mdi/svg, sanitize.css, @tippyjs/react, react-slick, slick-carousel), or bump it in its own pixel-gated PR (katex, react-cookie, d3, throttle-debounce together with the call-site change in owned code).

---

## 8. Gate for the design step (M5/M7): measurable checks

| ID | Check | Pass condition |
|---|---|---|
| G1 | Install shape | `node_modules/@oacore/design` is a real directory (not a symlink); `npm ci` with no `\|\| npm install` fallback |
| G2 | Compiler untouched | For every vendored module in a test build: the emitted module source equals the file on disk (webpack stats `originalSource()` hash), **or** no vendored module wrapper contains `core-js/modules` or `__webpack_exports__`. Re-run in W9 (SWC/Turbopack). |
| G3 | CSS bytes | All `.next/static/css/*.css` in `<link>` order, with `/*# sourceMappingURL */` stripped: SHA-256 equal to the golden build. With option C even the file names (contenthash) must be equal. |
| G4 | Media/assets | The set of `.next/static/media/*` names (they contain contenthashes) is equal: KaTeX 60, slick 4, ajax-loader, leaflet. Production `public/icons.svg` is byte-equal (48 symbols). |
| G5 | Whole-build identity (W5a only) | Every file under `.next/static/chunks/**` and `.next/server/**` is equal after replacing the buildId. W5a is packaging-only, so anything else is a defect. |
| G6 | DOM | Full SSR HTML of every fixture route in T-601 is equal after the normalisations in 40 §1. This is stricter than the SEO-scoped T-602. |
| G7 | Pixels and behaviour | T-801/T-802 0 px, T-417, T-418 (+ assert the sprite request returns 200 and one `<use>` has a non-zero bbox, so that an icon-less baseline cannot pass), T-416, T-701 |

G1–G5 are deterministic and cheap, and for a packaging-only step they make the M7 confidence about 100%. The screenshots then become a secondary net rather than the only proof.

---

## 9. Unconfirmed
- Whether Next ≥13's SWC or Turbopack would alter vendored CJS in an app folder (option A). Under option C it is moot.
- ESM-only d3 under Next 13–16 pages-router SSR externals.
- Whether svgo output (sprite bytes) is identical with @mdi/svg 7.
- Whether Next 10 production emits CSS source maps (with `@zeit/next-source-maps`); G3 strips them either way.
- The KaTeX font licence (KaTeX itself is MIT); check `node_modules/katex/LICENSE` and the font notices when vendoring or inlining.
- Licence conflict: `LICENSE` is MIT ("Copyright (c) 2015 The Open University") while `package.json` says `"license": "UNLICENSED"`. Owner to confirm. The same org owns both repos, so the risk is low. Third-party notices to keep: sanitize.css CC0-1.0, @mdi/svg Apache-2.0 (path data inside the committed sprite), katex MIT, d3 BSD-3-Clause.
