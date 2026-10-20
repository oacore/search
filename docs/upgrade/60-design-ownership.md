# 60 — Design ownership (`@oacore/design` → search-owned)

**Purpose.** Copy `@oacore/design` 5.0.74 verbatim (W0.5, W5), freeze its generated artefacts (DV7, 6.9), port what antd does not replace (DV8, 7.1), delete it (DV9, 7.F); D4, D4a, D9 (M4), D17 ([00](00-decisions.md)).
**Read it** before W0.5, W5, 6.9, 7.1, 7.F or any `vendor/` change. **Owns:** provenance, licence, inventory, DU-01..DU-24, OD-21 layouts, CS-DSN-1..7, CS-BAB-8, DV0–DV9, preserved behaviours, edit policy, traps. Replaces `60-design-copy-plan.md` (its D0–D6 = DV0–DV6; review "O1" = DV7).

## 1. The rule

> **Verbatim.** The JS and CSS that reach browser and server stay byte-identical to what `@oacore/design@5.0.74` delivers today. The only exceptions are the §7 edits, each in its own PR. Design bugs stay (D1, D8).

**The source is the published tarball, never `../design`.** `npm pack @oacore/design@5.0.74` (GitHub Packages, `NPM_TOKEN`) must give sha1 `e6a401d74defeb09d828b10374ff35107a9324c4` (`package-lock.json:2365`) and integrity `sha512-kwYolSk+PrJtJzSkhyUz/YGJKDbPcf6UpALedXnhWhNeJL/xB8PDvgGjHYq+xOZi2V7SIB9h0tueAAgR6IagrQ==` (`:2366`). The design working tree differs: `lib/` is stale in 4 files (`config.js`, `elements/footer/footer.{js,css}`, `global/elements/footer/footer.css`) and `assets/github.svg → githubF.svg` is a staged rename (review:design-system DS-04).

## 2. Provenance and licence

Verified 2026-10-19 (review:design-system §2, DS-04, DS-18):
- Installed package = tarball, except the postinstall-written `lib/config.js`. Tarball: 466 files; non-`lib/` files = `git archive bbc35a0`; dist-tag `latest` = 5.0.74.
- `lib/` (220 files: 114 JS, 53 CSS, 53 unused `lib/global/`) rebuilds 220/220 byte-identical from `src@bbc35a0`. `src/` ships in the tarball, so `vendor/oacore-design/src/` is the exact readable source for DV8.
- Licence: `LICENSE` MIT ("2015 The Open University") vs `UNLICENSED` in `package.json` and `package-lock.json:2368` (search has the same split, `package.json:12`). **OD-21 DECIDED (2026-10-20): MIT**; `LICENSE` stays verbatim. Public repo: vendoring = redistribution.

New files, outside the package dir so the installed copy stays at 466 files (VG-1):

| File | Step | Content |
|---|---|---|
| `vendor/PROVENANCE.md` | W0.5 | Tarball, hashes, `bbc35a0`, fetch command/date, §1 caveats, generated `lib/config.js` values (`/static/search`, `/static/search/icons.svg`), OD-21 |
| `vendor/CHANGES.md` | DV1 (empty) | One row per §7 edit: `File \| Change \| CS/Q \| PR \| Test`. DV8 replays every row |
| `THIRD_PARTY_NOTICES.md` | W5 | design MIT (OD-21); katex MIT, fonts [VERIFY: VF-27]; d3-array, d3-scale BSD-3. DV7 adds sanitize.css 12.0.1 CC0, @mdi/svg 5.9.55 Apache-2.0 (sprite paths), slick-carousel 1.8.1 MIT |
| `scripts/verify-design-verbatim.sh` | W0.5 | `diff -rq` of the extracted tgz vs `node_modules/@oacore/design` (from W5 also `vendor/oacore-design`); pass = diff set equals the CHANGES files (+ `lib/config.js` for installed copies until DV7). T-016, CI-3 ([42](42-baselines-and-ci.md)) |

## 3. Inventory and design units

At tree `a825839` (review:design-system §1).

**Imports.** 101 statements in 68 files; no `require()` or dynamic import. Specifiers: `@oacore/design` 38, `/lib/utils` 26, `/lib/elements` 13, `/lib/utils/class-names` 11, `/lib` 6, `/lib/modules` 4, `/lib/elements/icon`, `/lib/elements/logo`, `/lib/index.css` 1 each.

**JS.** `lib/index.js` re-exports everything, so 110/114 lib modules are evaluated (not `lib/content/*`), incl. the unrendered Carousel (react-slick 0.28.1, the only React ≤17 cap) and react-markdown 5.

**CSS.** One import, `pages/_app.jsx:18`; closure 53 lib + 7 external files (`sanitize.css` ×4, `slick-carousel` ×2, `katex.min.css`); `lib/global/**` unused.

**Sprite.** Design's `design.config.js` (10 MDI + 21 `assets/*.svg`) and search's (17 MDI) merge by cosmiconfig walk-up (`bin/config.js:54,68`): 48 symbols in prod, 49 in dev (`file-check`); duplicates office-building, account, open-in-new (Q-067). Search uses 20 ids; `#magnify`, `#check`, `#pencil` exist only via design.

**Size.** 121 src files, ~7,050 LOC (findings/04 §6.1); ≈61% lacks an antd equivalent (74% with Select).

**End state** (review:design-system §6.2): **antd** = antd restyled to 0 px (D5), skips DV8; **composite** = search code on antd parts; **owned** = readable search TSX + plain CSS, permanent. Split: 14 owned, 8 antd, 2 composite. M6 says "rewrite all UI on antd"; D9 allows owned source: the split is DECIDED under OD-21 (2026-10-20, STATUS §2). Phase 7: `7.1` = DV8 port; `7.2.DU-nn` = the antd PR, or an owned unit's deferred dependency bump (02 §3.7). Paths under `lib/`.

| DU | Unit (search files) | Entry; deps | Hazards | End state | Phase 7 |
|---|---|---|---|---|---|
| DU-01 | classNames (37: 26 namespace, 11 default) | `utils/`; classnames | Two export shapes | owned | 7.1 |
| DU-02 | Icon + sprite (20) | `elements/icon/`, `config.js` | R-022, Q-067 | owned | 7.1 |
| DU-03 | Button (25) | `elements/button/` | Global `button,[type=…]`; Q-066 | antd Button; global rules → DU-23 | 7.2.DU-03 |
| DU-04 | Card + statics (14) | `elements/card/` | Q-072 | antd Card | 7.2.DU-04 |
| DU-05 | Link, BaseLink (9) | `elements/link/` | `#open-in-new` | antd Typography.Link | 7.2.DU-05 |
| DU-06 | Modal + statics (9) | `modules/modal/`; react-focus-lock | Mount = open; Q-085, Q-068 | antd Modal | 7.2.DU-06 |
| DU-07 | TextField (7), Form + statics (3) | `elements/forms/` | `@extend` (R-009); floating label | antd Form, Input | 7.2.DU-07 |
| DU-08 | Select + advanced-search (in Header) | `modules/select/`, `modules/header/advanced-search.js` | Cycle with DU-09; `displayName` lookup; Q-068 | composite AutoComplete | 7.1 with DU-09/10, then 7.2.DU-08 |
| DU-09 | Header + `useSearchBar`, AppBar, Logo (5) | `modules/header/`; throttle-debounce 3 | Q-047, Q-084, Q-089 | owned (antd parts at 0 px) | 7.1, 7.2.DU-09 |
| DU-10 | DesignProvider, context (1) | `context.js`, `modules/header/context/` | One instance with DU-08/09 | owned (React context) | 7.1 |
| DU-11 | Popover (3) | `modules/popover/`; @tippyjs/react 4.2.6 | R-056 | antd Popover | 7.2.DU-11 |
| DU-12 | MetadataList (3) | `elements/metadata-list/` | `<ol>` markup | owned | 7.1 |
| DU-13 | DataProviderLogo (2) | `elements/logo/` | — | antd Avatar/Image | 7.2.DU-13 |
| DU-14 | LoadingBar (2) | `elements/loading-bar/` | — | owned | 7.1 |
| DU-15 | Fieldset (2) | `elements/fieldset/` | R-009 (V38), Q-068 | composite Radio.Group | 7.2.DU-15 |
| DU-16 | SearchResult (2) | `modules/search-result/`; `@babel/runtime/regenerator` | Q-090 (E22) | owned | 7.1 |
| DU-17 | Cookies, CookiesProvider, useCookie | `elements/cookies/`, `hooks/use-cookies.js`; react-cookie 4.1.1 | Q-051, Q-070 | owned | 7.1, 7.2.DU-17 |
| DU-18 | Footer (1) | `elements/footer/` | Hard-coded links (D15) | owned | 7.1 |
| DU-19 | Histoslider (1) | `elements/histoslider/`; d3-array 1, d3-scale 1 | R-012 | owned | 7.1, 7.2.DU-19 |
| DU-20 | MathMarkdown (1) | `elements/math-markdown/`; katex 0.16 | R-059, Q-097 | owned | 7.1, 7.2.DU-20 |
| DU-21 | ProgressSpinner (1) | `elements/progress-spinner/` | — | antd Spin | 7.2.DU-21 |
| DU-22 | ExpandableList (1) | `elements/expandable-list/` | Q-047, Q-074 | owned | 7.1 |
| DU-23 | Tokens, reset, global element CSS | `reboot.css`, `foundation/`, `helpers.css`; all 53 lib CSS (incl. unrendered table, carousel, switch) | Search reads `--primary` 32×, `--page-padding-x` 12×; R-023, R-087 | owned global CSS | DV7; 7.1 `styles/global/`; retired per rule in 7.2 |
| DU-24 | Media | 60 KaTeX fonts, 4 slick fonts + `ajax-loader.gif` (`slick-theme.css:5,15-16`) via css-loader `url()`; 21 `assets/*.svg` | VG-4; §8 trap 4 | owned (slick at DV7; KaTeX with DU-20) | 6.9, 7.1, 7.F |

Internal deps (for DV8, 7.2): 05→02; 06→03,02; 07→02,21; 08↔09; 09→03,02,10; 11→04; 13→02; 15→04,02; 16→04,05,12,13,20,22; 17→03,05; 18→02,05,20; 22→03 (review:design-system §1.7).

## 4. Layout options (OD-21)

| Layout | Verdict |
|---|---|
| A — `lib/` copied into the app tree, codemod, `design` alias | **Breaks** (R-075, review:00 X60.1): Next's babel-loader covers all non-`node_modules` files; `useBuiltIns:'usage'` (`babel.config.js:8`) adds ESM `import "core-js/…"`; 0/114 lib files use `module.exports`, so webpack drops `exports.*` and `default` is `undefined` (reproduced on Next 10.2.3; same in 12.3.4, babel-jest). Fallback only if C fails, with CS-BAB-8, codemod, VG-2, an SSR context-identity test, VG-2 at 6.7 |
| B — `src/` compiled by search | **Rejected.** src CSS via search's chain matches lib in 15/34 files (real diffs: `:global(.sr-only)`, a footer `calc`, static fallbacks, `getLocalIdent` names); classic JSX runtime (`babel.config.js:12`) vs design's automatic; R-024, R-025 |
| **C — local package** | **DECIDED (OD-21, 2026-10-20).** (i) W0.5: tgz `file:` dep; unchanged integrity proves zero content change. (ii) W5: `vendor/oacore-design/` installed as a copy (`npm ci --install-links`); 101 imports, node_modules CSS rule, server externals, postinstall as today (verified: config, 48-symbol sprite); React peer cap editable. Costs: copy not live; §8 traps |

## 5. Steps and change sites

DoD ([01](01-playbook.md) §6) always applies.

| Step | When | Action | Exit (binary) |
|---|---|---|---|
| — | W0.5 | CS-DSN-1; entry: 2.5 baselines (OC-18), CS-W0-1/-7/-4 merged | VG-1..VG-7 (55 §6) vs the W0b build (VG-5 needs VF-09); T-008; T-016; T-801/T-802 0 px |
| DV0 | W5 entry | T-417, T-418, T-802 vs the phase-2 golden baselines | Identical/0 px; a diff = W4 regression: stop ([50](50-roadmap.md)) |
| DV1 | W5 PR 1 | CS-DSN-2 | VG-1..VG-7 vs the W4e build; T-016 |
| DV2 | W5 PRs 2–4 | CS-DSN-3, -4, -5, one PR + one CHANGES row each | Their proofs |
| DV3 | — | Imports untouched under C (A: codemod + CS-BAB-8) | No app import site changes |
| DV4 | Every W5 PR | Postinstall still builds the sprite | T-005 (48, hash = golden); T-006; T-418 |
| DV5 | Every W5 PR | Lock scope | Diff = the design entry + CS-DSN-4/5 removals; `caniuse-lite`, `browserslist`, `postcss*` unchanged (T-013) |
| DV6 | W5 last PR | (a) Strict-install probe `npm_config_userconfig=/dev/null npm ci --install-links --no-legacy-peer-deps`: its `npm ls --all` problem set goes into `records/W5.md` and must be ⊆ the 02 §4 allow-list (T-008); the flag itself goes at 7.F (02 §1 rule 6). (b) If `grep -c npm.pkg.github.com package-lock.json` = 0: remove `NPM_TOKEN` (Dockerfile secret, workflow `--secret`, `.npmrc.dist`, 01 §1, `README.md:19`; S-3) | T-901 builds without the token |
| DV7 | 6.9 ([70](70-phase6.md)), before CS-CSS-1..4 (OC-22) | CS-DSN-6 | VG-3 (prod minified), VG-4, VG-6, T-003, T-801/T-802 0 px, T-005, T-006, T-418; VG-3 again at CS-CSS-4 |
| DV8 | 7.1 ([80](80-phase7-antd.md)) | One PR per §3 unit marked 7.1 (DU-08+09+10 together). Per unit: (1) its §6 and Q rows green on the vendored code; (2) port `vendor/oacore-design/src/<path>` + its CHANGES rows to TSX in `components/<unit>/`: same DOM, the lib's literal class strings, hook order, deps; (3) its DV7 CSS moves alongside, `@import`ed at the same position (§8 trap 10); (4) re-point only its imports | T-417 identical; T-801/T-802 0 px; VG-3; T-701/T-728 no new events; T-702 log identical |
| DV9 | 7.F | CS-DSN-7 | GATE-F (55 §5) |

`path:line` at `a825839`; Anchor = `git grep -nF` text (01 §9).

**CS-DSN-1 (W0.5).** Where: `package.json:18` (`"@oacore/design"`); the CS-W0-7 manifest COPY; `vendor/` (new). (1) `npm pack` into `vendor/`; check `shasum -a 1` and `echo "sha512-$(openssl dgst -sha512 -binary <tgz> | base64)"` against §1. (2) Spec `"file:vendor/oacore-design-5.0.74.tgz"`; `npm install --package-lock-only --legacy-peer-deps`. (3) `COPY vendor/ ./vendor/` before `npm ci`. (4) PROVENANCE + verify script. Proof: lock diff = root spec + design `resolved`, integrity unchanged; T-008; T-016 (R-015, D17).

**CS-DSN-2 (DV1).** Where: `package.json:18`; `.gitignore:7` (`build`); `Dockerfile:19`; each `npm ci` in `.github/workflows/` (42); `README.md:21,32,38`; W1 lint ignores and husky hook; Jest config. (1) `tar -xzf <tgz> -C vendor/oacore-design --strip-components=1`. (2) Spec `"file:vendor/oacore-design"`; `npm install --install-links --package-lock-only --legacy-peer-deps`. (3) `.gitignore` += `!vendor/oacore-design/bin/build/`. (4) Every install = `npm ci --install-links …`, flag on the CLI (`Dockerfile:18` overwrites `.npmrc`, gitignored at `.gitignore:4`). (5) `vendor/` in ESLint ignores, `.prettierignore`, `.stylelintignore`; hook runs `lint-staged --config <root config>` (vendored tool configs need `@oacore/*`, gone at W1; its `.lintstagedrc` runs `--fix`). (6) Jest `modulePathIgnorePatterns` and coverage exclude `<rootDir>/vendor/oacore-design/`. (7) CI-3: `test ! -L node_modules/@oacore/design`. Proof: `git ls-files vendor/oacore-design | wc -l` = 466; `git ls-files --others --ignored --exclude-standard -- vendor` empty; no `"link": true` in the lock; VG-1..VG-7 (R-075, R-022).

**CS-DSN-3 (DV2).** Where: vendored `package.json` (`"peerDependencies"`). Change: `react` and `react-dom` go from `^17.0.1` to `^17.0.1 || ^18.0.0 || ^19.0.0`. Proof: `npm ls react react-dom` shows no invalid peer; VG-5 identical (R-014, OC-3).

**CS-DSN-4 (DV2).** Where: `vendor/oacore-design/lib/elements/index.js:49-54,166` (`Object.defineProperty(exports, "Carousel"`; `require("./carousel")`) and the vendored `"react-slick"` dependency. Change: delete the getter, the require and the dependency. Carousel CSS stays. Alternative: react-slick 0.31.0. Proof: T-004 no react-slick in either bundle; VG-5 diff = carousel + react-slick modules only; VG-3, VG-6, T-801/T-802 identical; lock loses react-slick, enquire.js, json2mq, resize-observer-polyfill (R-014).

**CS-DSN-5 (DV2).** Where: vendored `"dependencies"` (`"d3-format"`, `"body-scroll-lock"`, `"babel-plugin-add-react-displayname"`). Change: remove the three (lib never requires them). Proof: VG-5 identical. The lock loses only `body-scroll-lock`, because d3-scale needs d3-format and `package.json:23` keeps the plugin.

**CS-DSN-6 (6.9, DV7).** Where: `pages/_app.jsx:18` (`'@oacore/design/lib/index.css'`); vendored `lib/config.js`, `"postinstall"`; `package.json:76` (`design build icons`), `build:test`; `Dockerfile:25` (`cp public/design/icons.svg`); `.gitignore:9-12`; `design.config.js`. (1) New `scripts/freeze-design-css.mjs` runs search's current PostCSS chain (plugins, order, options of `postcss.config.js`; review:design-system DS-08) over the 53 lib files, sanitize.css and slick, in `@import` order, into `styles/global/design/**`; slick fonts + gif copied alongside; katex CSS stays a package import. (2) `_app:18` imports `styles/global/design/index.css`. (3) Commit the prod sprite from the current parity image as `public/icons.svg`. (4) `lib/config.js` = the generated constant (CHANGES row). (5) Remove the postinstall; svgo, yargs, cosmiconfig, deepmerge, svgstore, sanitize.css, slick-carousel; root `@mdi/svg` (backstop CS-AN-5); `design.config.js` (also from the CS-W0-7 COPY); `design build icons`; the `Dockerfile:25` cp; `.gitignore:9-12`. Proof: byte identity is the target; a remaining diff needs a signed AD row with T-801/T-802/T-805 0 px (D7); VG-3 uses prod output (DS-08 proved dev only); `npm ls` shows none of the removed packages (R-009, R-022, R-023, OD-33, OD-06).

**CS-DSN-7 (7.F, DV9).** Where: `vendor/`; `package.json:18`; the lock; `THIRD_PARTY_NOTICES.md`; the `NPM_TOKEN` secret. Delete the vendor dir, tgz, PROVENANCE, CHANGES and the spec; deps per 02 §3.7. CI-1 guard: `npm ls @oacore/design` empty and `grep -c '@oacore/' package-lock.json` = 0 (source guard: CS-AN-6, [80](80-phase7-antd.md)). Remove the secret if DV6 did not. Proof: GATE-F (D9, S-3).

**CS-BAB-8 (W5, layout A only).** Where: `babel.config.js:28` (`return {`), plus the Jest, TS and coverage config. Change: Babel `ignore: [/[\\/]design[\\/]/]`; Jest `transformIgnorePatterns` += `<rootDir>/design/`; TS and coverage exclude `design/`. Proof: VG-2; in SSR, `DesignProvider` and `Header.useSearchBar` share one context; VG-2 again at 6.7 (R-075).

## 6. Preserved behaviours

T-417 (DOM, behaviour) and T-802 (pixels) assert each row: on the package (by W0.5), the copy (W5), each port (7.1). In 7.2 the behaviour still holds; DOM changes only per OD-28(c). No cleanup in verbatim steps (review:00 X60.9). Sources: design `src/` at `bbc35a0`.

| # | DU | Kept | Source | Q/R |
|---|---|---|---|---|
| 1 | 08/09 | `{...restSearchBarProps}` after the computed `changeOnBlur` (blur submits <500 px only on `/data-providers/`) | `modules/header/search-bar.jsx:131-137` | Q-084 |
| 2 | 09 | Menus close via a `document.body` click listener | `modules/header/header.jsx:40-41` | — |
| 3 | 09 | `if (propsIsHidden) useOutsideClick(…)` | `search-bar.jsx:115` | Q-047 |
| 4 | 09 | Duplicate DOM ids | `header.jsx:245,251` | Q-089 |
| 5 | 08 | Global `ul{padding:0;margin:0}` | `modules/header/advanced-search.css:16` | Q-068 |
| 6 | 06 | Overlay z 1030 (`modal.css:9,20`) < header 10000 (`header/styles.css:6`); `FocusLock returnFocus` (`modal.jsx:78`); overflow `hidden`→`unset` (`:69-71`); Esc only with focus inside (`:47`); duplicate aria-label check; mount = open; first-render `onClose` | `modules/modal/` | Q-085, Q-068 |
| 7 | 17 | Popup while `essential_cookies_allowed` is absent, only if `typeof window !== 'undefined'` | `elements/cookies/cookies.jsx:11-13,31-36` | Q-070, Q-051 |
| 8 | 04 | `tag` reaches the root (nested anchors) | `elements/card/card.jsx:10` | Q-072 |
| 9 | 22 | Hooks before the early return at `:29` (React #310) | `elements/expandable-list/expandable-list.jsx:14-29` | Q-047, Q-074 |
| 10 | 16 | `useState` + `useEffect` per provider in `.map`; one browser GET `/data-providers/{id}/logo` each (E22) | `modules/search-result/search-result.jsx:84-110,140-143` | Q-090 |
| 11 | 15 | `setActiveBox(items[0].value)` (throws if empty); `fieldset.css:44` → `(max-width: 767px)` (V38) | `elements/fieldset/index.jsx:11-12` | Q-068, R-009 |
| 12 | 11 | Trigger `'mouseenter focus'` unless `visible` | `modules/popover/popover.jsx:37` | R-056 |
| 13 | 01 | Namespace `.use/.from` and default class with statics | `utils/` | — |
| 14 | all | Statics: `Card.Title/Description/Footer`, `Modal.Title/Content/Footer`, `MetadataList.Item`, `ExpandableList.Item`, `Form.Control/Label/Group/Addon`, `Header.useSearchBar`, `Select.Option` | — | — |
| 15 | 03 | `color-mod()` focus ring never renders | `lib/elements/button/button.css:5` | Q-066 |
| 16 | 02 | Duplicate symbols, the first one wins; 48 in prod | sprite | Q-067 |
| 17 | 19/20 | `defaultProps` values; CS-R19-2/3 keep them identical | `histoslider.jsx:112-127`, `math-markdown.jsx:51-65` | R-012, R-059 |
| 18 | 20 | KaTeX only; `**x**` stays literal | `elements/math-markdown/` | Q-097 |

## 7. Edit policy

Zero edits at W0.5 and DV1. Afterwards only these, each with a CS row, a test red or pinned beforehand and a `vendor/CHANGES.md` row; edit `lib/**` only (runtime truth; DV8 replays rows onto `src/`):

| Edit | Step | CS |
|---|---|---|
| Peer ranges; Carousel getter + require; three unused deps | W5 (DV2) | CS-DSN-3, -4, -5 |
| Cookie popup after mount, if chosen over the search-side gate (proven only, OD-40, signature) | W5.5 | CS-R18-3 ([20](20-change-sites.md)) |
| `defaultProps` values applied inside Histoslider and MathMarkdown | W7b, first PRs | CS-R19-2, CS-R19-3 (20) |
| `lib/config.js` constant; postinstall and build deps removed | 6.9 (DV7) | CS-DSN-6 |

**Never:** formatting, lint fixes, dead-code or CSS pruning, renames, a dep bump outside its 02 row. Phase 6 excludes `vendor/` ([70](70-phase6.md)). After each edit: `npm ci --install-links` (copy not live); T-016 = exactly the CHANGES set.

## 8. Traps

1. **CSS order.** leaflet (`pages/_app.jsx:15-17`) → design (`:18`) → `main/global.css` (`:19`); search's equal-specificity rules win by order (R-023).
2. **Whole closure.** All 53 + 7 files: unused-component CSS styles bare elements (Q-068).
3. **PostCSS is load-bearing until DV7.** `@extend` (`lib/elements/forms/styles.css:92,95,375`; leaves empty rules) and `fieldset.css:44` resolve only via `postcss.config.js` (R-009); no chain change before DV7 (OC-12, OC-22). Compare processed output, not raw lib CSS (corrects findings/04 §6.3).
4. **`~` imports** (`lib/reboot.css:1-4`, `lib/elements/carousel/carousel.css:1-2`) need css-loader (VF-20). `math-markdown.css:1` lacks `~` and resolves only by css-loader's relative-then-module fallback: a Turbopack risk (OD-10 keeps `--webpack`).
5. **Generated config.** The postinstall walks up to search's `design.config.js`; without it every icon 404s silently. So: in the Docker context before `npm ci` (CS-W0-7), no `--ignore-scripts`, no cached `node_modules` (R-022). `ICONS_PUBLIC_PATH` (`Dockerfile:9,13`) is unused: keep it so.
6. **Sprite depends on `NODE_ENV`:** prod 48, local 49 (design `design.config.js:28,65`); expected sets come from the image (T-005).
7. **Symlink.** Without `--install-links` a `file:` dir is a symlink (R-075 again): `npm ci` fails (EUSAGE), `npm install` re-links and rewrites the lock. No `|| npm install` fallback (CS-W0-4); VG-1 proves the shape on the image's npm.
8. **`.gitignore:7` `build`** untracks `vendor/oacore-design/bin/build/**` (6 files): fresh checkouts fail at `node bin build` (tgz immune).
9. **Context identity.** `DesignProvider` (`main/index.jsx:2,17`) and `Header.useSearchBar` need one module instance: automatic under C; under A or DV8 move DU-08/09/10 together. Aliases (A, B, DV8): search's `hooks`, `modules`, `utils` (`next.config.js:86-96`) vs design src's bare `hooks`, `context` (R-025).
10. **Pages router:** global CSS only from `_app`; owned units keep plain global CSS at the same `@import` position (CSS Modules change names and chunk order, R-024, R-023).

## 9. Versions and core-ui

- **M1 for the vendored closure:** [02](02-version-matrix.md) §3.7 and §4. In-range lock bumps change no vendored file (§7 allows them).
- **core-ui is not a dependency** (OD-34, DECIDED 2026-10-20); reference only (review:00 X60.10): 2.0.21 lacks Header, Footer, Link, Carousel, useCookie (HEAD `0e9cfa5` has them, unreleased); peers antd ^5.27.6, icons ^5.6.1; no KaTeX; restyles, not pixel copies. findings/04 §7 "Footer: none in core-ui" is outdated.
- **Theme tokens** come from design `lib/foundation/*.css` (e.g. `--primary: #b75400`), not the dashboard's `antdTheme`; table: 80 (CS-AN-2).
