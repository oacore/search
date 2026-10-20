# 04 - Design-system (`@oacore/design`) usage audit

Scope: READ-ONLY audit of how `search` consumes `@oacore/design` (v5.0.74), what must be copied into `search` when the library is retired, and which parts will break on React 18/19 + Next 13+.
Repos: search = this repo (repo root), design = `../design`, reference = `../dashboard` (React 19.2, antd 6.3, `@oacore/core-ui` 2.0.20).

## 0. Executive summary

| Fact | Value |
|---|---|
| Installed lib consumed by search | `node_modules/@oacore/design` **5.0.74** (lock: `npm.pkg.github.com/.../5.0.74`; `package.json` says `"latest"`, i.e. unpinned) |
| Design repo HEAD | `bbc35a0` "Bump version 5.0.74" (`git describe` = `5.0.74-1-gbbc35a0`; commit is a version bump only) |
| Installed `src/` vs design HEAD `src/` | **Identical** (`diff -rq`: only an empty dir `src/modules/NavHeader/context` exists in HEAD) - so HEAD `src/` is a faithful source for the installed lib |
| Design repo `lib/` (local build) | **STALE, do not use as reference** (gitignored; differs from installed in `config.js`, `footer.js`, `footer.css`). Use `search/node_modules/@oacore/design/lib` as the compiled truth |
| Design repo working tree | one staged, uncommitted rename `assets/github.svg -> assets/githubF.svg`; `design.config.js` still references `assets/github.svg` (installed package still has `github.svg`). Ignore for the copy; copy from the installed package |
| Import statements | 101 in 68 files (38 `@oacore/design`, 26 `/lib/utils`, 13 `/lib/elements`, 11 `/lib/utils/class-names`, 6 `/lib`, 4 `/lib/modules`, 1 each `/lib/elements/logo`, `/lib/elements/icon`, `/lib/index.css`) |
| Distinct design exports used | **23 components** (Button, Card, Cookies, CookiesProvider, DataProviderLogo, DesignProvider, ExpandableList, Fieldset, Footer, Form, Header, Histoslider, Icon, Link, LoadingBar, MathMarkdown, MetadataList, Modal, Popover, ProgressSpinner, SearchResult, Select, TextField) + 1 hook (`useCookie`) + 1 util (`classNames`) |
| Also rendered indirectly (not imported by search) | AppBar (+Brand/Item), Logo (`#core-symbol`), Heading, LogoGroup, Form.* statics, Select.Option (not used by search itself), Header search-bar + advanced-search |
| Transitive closure to copy | **121 source files / ~7,050 LOC** (44 `.jsx`, 38 `.js`, 39 `.css` = 3,271 CSS LOC) incl. 11 global/foundation CSS files; +6 SVG asset files for the sprite, +~9 npm deps |
| Tests in design | **None** (no `*.test.*`, `__tests__`, stories). Only 31 styleguidist `.md` example files (1,542 lines) |

### Top risks (ordered)
1. **Component CSS is not valid as Next CSS Modules as-is**: 26 of the 39 CSS files contain `:root{}` blocks, element selectors, `@extend %placeholder`, `@custom-media` definitions, `color-mod()`, `:global()` - Next's CSS-Modules "pure selector" rule rejects `:root`/element selectors. Files are named `*.css` (not `*.module.css`) and rely on `exportLocalsConvention: camelCase` (kebab class -> camelCase key). Needs a split into "global tokens" and "module" parts (see section 3/6).
2. **Global side effects inherited via `lib/index.css`** (reboot/sanitize.css, `:first-child{margin-top:0}`, `:last-child{margin-bottom:0}`, `p/h1..h6/ul/ol/pre` margins, `:link/:visited` colors, `body` font, `.sr-only`, `.display`) change the look of *every* search page, including search's own CSS modules. Must be copied as global CSS in the same order (design CSS first, `main/global.css` after - see `pages/_app.jsx:18-19`).
3. **Icon sprite is produced by merging TWO `design.config.js` files** (design's own, shipped in the package, + search's) via `deepmerge` (array concat). Footer/Header/Select/Modal/TextField/Link rely on icons that are NOT in search's list. Dropping the lib without replicating the merge silently breaks ~15 icons. `@mdi/svg` is not a search dependency (only transitive via design).
4. **React 19 breakers inside used components**: `defaultProps` on function components (MathMarkdown, Histoslider), Rules-of-Hooks violations (ExpandableList, Header search-bar), `@tippyjs/react` 4.2.6 reads `children.ref`, `react-cookie@4`, `react-dom@17` peer pins.
5. **Barrel imports pull the whole library into the bundle** (CJS, no `sideEffects`/`module` field), incl. react-slick, katex, react-markdown, tippy, d3. After the copy only the 121 files are needed; also bare alias imports (`'hooks'`, `'context'`, `'modules/header/context'`) would collide with search's own webpack aliases (`hooks`, `modules`, ...) if copied verbatim.
6. Existing (pre-copy) defects that a "verbatim" copy preserves: unresolved `color-mod()` focus ring in `button.css:8`, `--screen-until-desktop` undefined in design (resolved only because search's `main/media-queries.css` defines it), SSR/hydration mismatches in Cookies/Select/MathMarkdown. Decide up front: keep (verbatim) and record in the visual baseline.

## 1. Import sites in search (101 statements in 68 files)

Extracted with a multi-line-aware parser (static `import ... from`), excluding node_modules/.next/docs. CSS imports: only `pages/_app.jsx:18` (`@oacore/design/lib/index.css`). No `require()` / dynamic imports / CSS `@import` of `@oacore/design` exist.

### 1a. Count by import path

| Import path | Statements |
|---|---|
| `@oacore/design` | 38 |
| `@oacore/design/lib/utils` | 26 |
| `@oacore/design/lib/elements` | 13 |
| `@oacore/design/lib/utils/class-names` | 11 |
| `@oacore/design/lib` | 6 |
| `@oacore/design/lib/modules` | 4 |
| `@oacore/design/lib/elements/icon` | 1 |
| `@oacore/design/lib/index.css` | 1 |
| `@oacore/design/lib/elements/logo` | 1 |

### 1b. Count by imported name (files importing it)

| Name | Files | Source in design (HEAD src) |
|---|---|---|
| `classNames` | 26 | utils/index.js -> `export * as classNames from ./class-names` (namespace: default class + use/from) |
| `Button` | 25 | elements/button |
| `Icon` | 19 | elements/icon |
| `Card` | 14 | elements/card |
| `default classNames` | 11 | utils/class-names.js default export (class ClassNames, statics use/from) |
| `Link` | 9 | elements/link (StyledLink default; BaseLink named) |
| `Modal` | 9 | modules/modal (statics Title/Content/Footer) |
| `TextField` | 7 | elements/forms/text-field.jsx |
| `Header` | 5 | modules/header (+ static useSearchBar) |
| `Form` | 3 | elements/forms (form.jsx + statics Control/Label/Group/Addon) |
| `Popover` | 3 | modules/popover |
| `MetadataList` | 3 | elements/metadata-list |
| `DataProviderLogo` | 2 | elements/logo/data-provider.jsx |
| `LoadingBar` | 2 | elements/loading-bar |
| `Fieldset` | 2 | elements/fieldset/index.jsx |
| `SearchResult` | 2 | modules/search-result |
| `useCookie` | 1 | hooks/use-cookies.js |
| `DesignProvider` | 1 | context.jsx |
| `Cookies` | 1 | elements/cookies (index.js -> cookies.jsx) |
| `ProgressSpinner` | 1 | elements/progress-spinner |
| `Histoslider` | 1 | elements/histoslider |
| `Footer` | 1 | elements/footer |
| `default Icon` | 1 | elements/icon (via lib/elements/icon) |
| `CookiesProvider` | 1 | elements/cookies/cookies-provider.js (re-export of react-cookie CookiesProvider) |
| `Select` | 1 | modules/select |
| `MathMarkdown` | 1 | elements/math-markdown |
| `ExpandableList` | 1 | elements/expandable-list |

### 1c. Every import site (file:line, names, path)

| # | file:line | imported | path |
|---|---|---|---|
| 1 | hooks/use-analytics.js:4 | { useCookie } | `@oacore/design` |
| 2 | main/index.jsx:2 | { DesignProvider, Cookies as CookiesPopup } | `@oacore/design` |
| 3 | modules/authors-box/index.jsx:2 | { Button, Link } | `@oacore/design` |
| 4 | modules/authors-box/index.jsx:3 | { classNames } | `@oacore/design/lib/utils` |
| 5 | modules/copyable-input/index.jsx:2 | { Form, Icon, Button, Popover } | `@oacore/design` |
| 6 | modules/dropdown/index.jsx:2 | { Button, Card, DataProviderLogo, Link, } | `@oacore/design/lib/elements` |
| 7 | modules/dropdown/index.jsx:8 | classNames | `@oacore/design/lib/utils/class-names` |
| 8 | modules/dropdown/index.jsx:9 | { Popover } | `@oacore/design/lib/modules` |
| 9 | modules/filters/bar-item.jsx:2 | { Icon } | `@oacore/design` |
| 10 | modules/filters/bar-item.jsx:3 | { classNames } | `@oacore/design/lib/utils` |
| 11 | modules/filters/filter-item.jsx:2 | { Icon } | `@oacore/design/lib` |
| 12 | modules/filters/filter-item.jsx:3 | classNames | `@oacore/design/lib/utils/class-names` |
| 13 | modules/filters/index.jsx:2 | { Button } | `@oacore/design/lib/elements` |
| 14 | modules/filters/index.jsx:3 | { classNames } | `@oacore/design/lib/utils` |
| 15 | modules/filters/loading-block.jsx:2 | { Icon, ProgressSpinner } | `@oacore/design/lib/elements` |
| 16 | modules/filters/loading-block.jsx:3 | classNames | `@oacore/design/lib/utils/class-names` |
| 17 | modules/filters/search.jsx:2 | { TextField } | `@oacore/design/lib` |
| 18 | modules/filters/year/custom-range.jsx:2 | { Icon } | `@oacore/design/lib/elements` |
| 19 | modules/filters/year/custom-range.jsx:3 | classNames | `@oacore/design/lib/utils/class-names` |
| 20 | modules/filters/year/index.jsx:2 | { Histoslider } | `@oacore/design/lib/elements` |
| 21 | modules/layout/app-bar.jsx:2 | { Header } | `@oacore/design` |
| 22 | modules/layout/index.jsx:2 | { Footer, LoadingBar } | `@oacore/design` |
| 23 | modules/loader/loader.jsx:2 | classNames | `@oacore/design/lib/utils/class-names` |
| 24 | modules/logo/index.jsx:1 | Icon | `@oacore/design/lib/elements/icon` |
| 25 | modules/logo/index.jsx:2 | { classNames } | `@oacore/design/lib/utils` |
| 26 | modules/map/index.jsx:3 | { classNames } | `@oacore/design/lib/utils` |
| 27 | modules/search-layout/main.jsx:2 | { classNames } | `@oacore/design/lib/utils` |
| 28 | modules/search-layout/result-stats.jsx:2 | { classNames } | `@oacore/design/lib/utils` |
| 29 | modules/search-layout/result.jsx:2 | { classNames } | `@oacore/design/lib/utils` |
| 30 | modules/search-layout/result.jsx:3 | { Card } | `@oacore/design` |
| 31 | modules/search-layout/search.jsx:2 | { classNames } | `@oacore/design/lib/utils` |
| 32 | modules/search-layout/sidebar.jsx:2 | { classNames } | `@oacore/design/lib/utils` |
| 33 | modules/show-more/index.jsx:2 | { classNames } | `@oacore/design/lib/utils` |
| 34 | modules/title/index.jsx:3 | { classNames } | `@oacore/design/lib/utils` |
| 35 | pages/_app.jsx:8 | { CookiesProvider } | `@oacore/design` |
| 36 | pages/_app.jsx:18 |  | `@oacore/design/lib/index.css` |
| 37 | pages/error-card/index.jsx:2 | { Button } | `@oacore/design/lib` |
| 38 | pages/outputs/[id].jsx:3 | { Header } | `@oacore/design` |
| 39 | pages/search/index.jsx:4 | { Header } | `@oacore/design/lib/modules` |
| 40 | pages/works/[id].jsx:3 | { Header } | `@oacore/design` |
| 41 | templates/data-provider/claim/claim-card.jsx:3 | { Card, Button } | `@oacore/design` |
| 42 | templates/data-provider/claim/claim-card.jsx:4 | { classNames } | `@oacore/design/lib/utils` |
| 43 | templates/data-provider/claim/claim-modal-edit.jsx:2 | { Modal, Button, TextField } | `@oacore/design` |
| 44 | templates/data-provider/claim/claim-modal-edit.jsx:3 | { classNames } | `@oacore/design/lib/utils` |
| 45 | templates/data-provider/claim/claim-modal.jsx:2 | { Modal, Button, TextField } | `@oacore/design` |
| 46 | templates/data-provider/claim/claim-modal.jsx:3 | { classNames } | `@oacore/design/lib/utils` |
| 47 | templates/data-provider/claim/claim-success-modal.jsx:2 | { Modal, Button } | `@oacore/design` |
| 48 | templates/data-provider/claim/claim-success-modal.jsx:3 | { classNames } | `@oacore/design/lib/utils` |
| 49 | templates/data-provider/claim/sign-in-modal.jsx:4 | { Modal, Button, TextField } | `@oacore/design` |
| 50 | templates/data-provider/claim/sign-in-modal.jsx:5 | { classNames } | `@oacore/design/lib/utils` |
| 51 | templates/data-provider/index.jsx:2 | { classNames } | `@oacore/design/lib/utils` |
| 52 | templates/data-provider/index.jsx:3 | { DataProviderLogo } | `@oacore/design/lib/elements/logo` |
| 53 | templates/data-provider/logo.jsx:2 | { classNames } | `@oacore/design/lib/utils` |
| 54 | templates/data-provider/map-card.jsx:2 | { Card } | `@oacore/design` |
| 55 | templates/data-provider/map-card.jsx:3 | { classNames } | `@oacore/design/lib/utils` |
| 56 | templates/data-provider/meta-box.jsx:2 | { Card } | `@oacore/design/lib/elements` |
| 57 | templates/data-provider/meta-box.jsx:3 | { classNames } | `@oacore/design/lib/utils` |
| 58 | templates/data-provider/pagination.jsx:3 | { Button, Icon } | `@oacore/design` |
| 59 | templates/data-provider/pagination.jsx:5 | { classNames } | `@oacore/design/lib/utils` |
| 60 | templates/data-provider/search.jsx:2 | { Select } | `@oacore/design` |
| 61 | templates/data-providers/form.jsx:2 | { TextField, Button, Card } | `@oacore/design` |
| 62 | templates/data-providers/index.jsx:2 | { Button, Header } | `@oacore/design` |
| 63 | templates/data-providers/result-card.jsx:2 | { Icon, Link, MetadataList } | `@oacore/design` |
| 64 | templates/data-providers/utils/generate-form-message.jsx:1 | { Link } | `@oacore/design` |
| 65 | templates/error/404.jsx:2 | { Button } | `@oacore/design` |
| 66 | templates/output/api-card.jsx:1 | { Card } | `@oacore/design` |
| 67 | templates/output/card-dropdown.jsx:2 | { Card, Icon, Link } | `@oacore/design/lib/elements` |
| 68 | templates/output/card-dropdown.jsx:3 | classNames | `@oacore/design/lib/utils/class-names` |
| 69 | templates/output/chips.jsx:1 | { classNames } | `@oacore/design/lib/utils` |
| 70 | templates/output/chips.jsx:2 | { MetadataList } | `@oacore/design` |
| 71 | templates/output/citation.jsx:2 | { Button, Modal, Icon } | `@oacore/design` |
| 72 | templates/output/citation.jsx:4 | { classNames } | `@oacore/design/lib/utils` |
| 73 | templates/output/index.jsx:3 | { Button, Icon, MathMarkdown } | `@oacore/design/lib/elements` |
| 74 | templates/output/keywords.jsx:2 | { Icon } | `@oacore/design` |
| 75 | templates/output/map-card.jsx:2 | { Card } | `@oacore/design` |
| 76 | templates/output/map-card.jsx:3 | { classNames } | `@oacore/design/lib/utils` |
| 77 | templates/output/metadata.jsx:2 | { ExpandableList, MetadataList } | `@oacore/design` |
| 78 | templates/output/other-versions.jsx:2 | { Card } | `@oacore/design/lib/elements` |
| 79 | templates/output/related-search.jsx:2 | { Icon } | `@oacore/design` |
| 80 | templates/output/report/report-card.jsx:2 | { Card, Button } | `@oacore/design` |
| 81 | templates/output/report/report-form-modal.jsx:2 | { Modal, Button, Form, TextField, Fieldset } | `@oacore/design` |
| 82 | templates/output/report/report-success-modal.jsx:3 | { Modal, Button, Link, Card, Icon } | `@oacore/design` |
| 83 | templates/output/report/report-type-modal.jsx:2 | { Modal, Button, Icon, Card } | `@oacore/design` |
| 84 | templates/output/report/report-type-modal.jsx:3 | classNames | `@oacore/design/lib/utils/class-names` |
| 85 | templates/output/similar-works.jsx:2 | { Icon, SearchResult } | `@oacore/design` |
| 86 | templates/output/thumbnail-card.jsx:2 | { Card } | `@oacore/design` |
| 87 | templates/output/thumbnail-card.jsx:3 | { classNames } | `@oacore/design/lib/utils` |
| 88 | templates/output/thumbnail-card.jsx:4 | { Button, Icon } | `@oacore/design/lib/elements` |
| 89 | templates/output/update/index.jsx:2 | { Button, Form, Link, TextField } | `@oacore/design/lib` |
| 90 | templates/output/update/index.jsx:3 | classNames | `@oacore/design/lib/utils/class-names` |
| 91 | templates/output/update/links.jsx:2 | { Link } | `@oacore/design/lib` |
| 92 | templates/search/index.jsx:2 | { Button, Icon, Link, LoadingBar } | `@oacore/design/lib/elements` |
| 93 | templates/search/index.jsx:3 | { Popover } | `@oacore/design/lib/modules` |
| 94 | templates/search/index.jsx:4 | classNames | `@oacore/design/lib/utils/class-names` |
| 95 | templates/search/modals/download-results.jsx:1 | { Modal } | `@oacore/design/lib/modules` |
| 96 | templates/search/modals/download-results.jsx:3 | { Button, Fieldset } | `@oacore/design/lib/elements` |
| 97 | templates/search/pagination.jsx:2 | { Button, Icon } | `@oacore/design/lib` |
| 98 | templates/search/pagination.jsx:3 | classNames | `@oacore/design/lib/utils/class-names` |
| 99 | templates/search/results.jsx:2 | { SearchResult } | `@oacore/design` |
| 100 | templates/search/sort.jsx:2 | { Icon } | `@oacore/design/lib/elements` |
| 101 | templates/search/sort.jsx:3 | classNames | `@oacore/design/lib/utils/class-names` |

## 2. Resolution and transitive closure (design HEAD `src/` == installed `src/`)

Compiled counterpart of every `src/X.jsx|js|css` is `lib/X.js|css` in the installed package (Babel -> CJS/ES5, CSS-Modules class maps inlined in JS, `.css` kept as hashed global CSS, `[name]-[local]-[hash:base64:5]`).
All paths below are relative to `../design/src/`. "Own" = files that belong to the component; "closure" adds its design-internal dependencies.

| Unit | Own files (LOC) | Design-internal deps | npm deps | Own file list |
|---|---|---|---|---|
| **utils** | 3 (66) | - | classnames | `utils/index.js` `utils/class-names.js` `utils/can-use-dom.js` |
| **config** | 1 (10) | - | - | `config.js` |
| **Icon** | 3 (62) | utils, config | - | `elements/icon/icon.jsx` `elements/icon/icon.css` `elements/icon/index.js` |
| **Button** | 3 (147) | utils | prop-types | `elements/button/button.jsx` `elements/button/button.css` `elements/button/index.js` |
| **Card** | 3 (104) | utils | prop-types | `elements/card/card.jsx` `elements/card/card.css` `elements/card/index.js` |
| **Link** | 3 (109) | Icon | - | `elements/link/link.jsx` `elements/link/link.css` `elements/link/index.js` |
| **LoadingBar** | 3 (46) | utils | - | `elements/loading-bar/loading-bar.jsx` `elements/loading-bar/loading-bar.css` `elements/loading-bar/index.js` |
| **ProgressSpinner** | 3 (91) | utils | - | `elements/progress-spinner/progress-spinner.jsx` `elements/progress-spinner/styles.css` `elements/progress-spinner/index.js` |
| **MetadataList** | 4 (122) | utils | - | `elements/metadata-list/metadata-list.jsx` `elements/metadata-list/metadata-list-item.jsx` `elements/metadata-list/metadata-list.css` `elements/metadata-list/index.js` |
| **MathMarkdown** | 6 (179) | - | katex (+ katex/dist/katex.min.css via math-markdown.css) | `elements/math-markdown/math-markdown.jsx` `elements/math-markdown/math-markdown.css` `elements/math-markdown/index.js` `elements/math-markdown/utils/index.js` `elements/math-markdown/utils/hasMathMLSupport.js` `elements/math-markdown/utils/latexify.jsx` |
| **Heading** | 1 (33) | utils | - | `elements/heading.jsx` |
| **Logo (Logo, DataProviderLogo, LogoGroup)** | 7 (178) | Icon | - | `elements/logo/logo.jsx` `elements/logo/logo.css` `elements/logo/data-provider.jsx` `elements/logo/data-provider.css` `elements/logo/group.jsx` `elements/logo/group.css` `elements/logo/index.js` |
| **Form/TextField (forms)** | 10 (732) | Icon, ProgressSpinner | - | `elements/forms/form.jsx` `elements/forms/control.jsx` `elements/forms/label.jsx` `elements/forms/group.jsx` `elements/forms/addon.jsx` `elements/forms/text-field.jsx` `elements/forms/text-field.css` `elements/forms/styles.css` `elements/forms/index.css` `elements/forms/index.js` |
| **Fieldset** | 2 (96) | Card, Icon | - | `elements/fieldset/index.jsx` `elements/fieldset/fieldset.css` |
| **ExpandableList** | 3 (138) | Button | - | `elements/expandable-list/expandable-list.jsx` `elements/expandable-list/expandable-list.css` `elements/expandable-list/index.js` |
| **Histoslider** | 5 (519) | utils | d3-array, d3-scale | `elements/histoslider/histoslider.jsx` `elements/histoslider/histogram.jsx` `elements/histoslider/slider.jsx` `elements/histoslider/histoslider.css` `elements/histoslider/index.js` |
| **AppBar** | 6 (133) | utils | - | `elements/app-bar/bar.jsx` `elements/app-bar/brand.jsx` `elements/app-bar/item.jsx` `elements/app-bar/styles.css` `elements/app-bar/index.css` `elements/app-bar/index.js` |
| **hooks** | 5 (145) | - | react-cookie | `hooks/index.js` `hooks/use-cookies.js` `hooks/use-outside-click.js` `hooks/use-window-size.js` `hooks/use-switch.js` |
| **DesignContext (DesignProvider)** | 4 (77) | - | - | `context.jsx` `modules/header/context/index.js` `modules/header/context/reducer.js` `modules/header/context/actions.js` |
| **Cookies / CookiesProvider** | 5 (146) | Button, Link, hooks | react-cookie (hooks/use-cookies.js, cookies-provider.js re-exports react-cookie CookiesProvider) | `elements/cookies/cookies.jsx` `elements/cookies/popup.jsx` `elements/cookies/cookies.css` `elements/cookies/index.js` `elements/cookies/cookies-provider.js` |
| **Footer** | 3 (350) | Icon, Link, MathMarkdown | - | `elements/footer/footer.jsx` `elements/footer/footer.css` `elements/footer/index.js` |
| **Modal** | 7 (315) | Button, Icon | react-focus-lock, react-dom (createPortal) | `modules/modal/modal.jsx` `modules/modal/title.jsx` `modules/modal/content.jsx` `modules/modal/footer.jsx` `modules/modal/portal.jsx` `modules/modal/modal.css` `modules/modal/index.js` |
| **Popover** | 3 (142) | Card | @tippyjs/react (headless) | `modules/popover/popover.jsx` `modules/popover/popover.css` `modules/popover/index.js` |
| **SearchResult** | 4 (461) | Card, Heading, MetadataList, ExpandableList, MathMarkdown, Logo (Logo, DataProviderLogo, LogoGroup), Link | - | `modules/search-result/search-result.jsx` `modules/search-result/styles.css` `modules/search-result/index.css` `modules/search-result/index.js` |
| **Select** | 9 (895) | Form/TextField (forms), Icon, Button | - | `modules/select/select.jsx` `modules/select/option.jsx` `modules/select/select.css` `modules/select/index.js` `modules/select/hooks/index.js` `modules/select/hooks/use-input.js` `modules/select/hooks/use-options.js` `modules/header/advanced-search.jsx` `modules/header/advanced-search.css` |
| **Header** | 4 (1057) | AppBar, Button, Icon, Logo (Logo, DataProviderLogo, LogoGroup), Select, hooks, DesignContext (DesignProvider) | throttle-debounce | `modules/header/header.jsx` `modules/header/search-bar.jsx` `modules/header/styles.css` `modules/header/index.js` |
| **Foundation + global CSS** | 11 (697) | - | sanitize.css (4 imports in reboot.css, `~` prefix) | `index.css` `reboot.css` `helpers.css` `foundation/index.css` `foundation/colors.css` `foundation/component.css` `foundation/elevation.css` `foundation/layout.css` `foundation/loading.css` `foundation/spacing.css` `foundation/type.css` |

Notes on non-obvious edges:
- `elements/index.js` and `modules/index.js` are **barrels**; component files import siblings through them (`from '..'`, `from '../../elements'`, `from '..'` modules). They create import cycles (`// eslint-disable-next-line import/no-cycle` at: cookies/popup.jsx:5, expandable-list.jsx:5, fieldset/index.jsx:5, footer/footer.jsx:5, header/index.js, header/header.jsx:4, header/search-bar.jsx:8). Copy must rewrite these to direct relative paths (path-only change).
- `modules/select/select.jsx:7` imports `../header/advanced-search` and `modules/header/search-bar.jsx:8` imports `Select` from the modules barrel: **Select <-> Header cycle** (advanced-search is shared).
- `elements/footer/footer.jsx:5-7` pulls `Icon, Link, MathMarkdown` and `BaseLink` from `../link`; Footer therefore drags in MathMarkdown + katex.
- `modules/search-result/search-result.jsx:5-15` pulls Card, Heading, MetadataList, ExpandableList, MathMarkdown, LogoGroup, DataProviderLogo, `BaseLink`.
- Bare alias imports (babel `module-resolver`, design `babel.config.js`: `utils elements modules context hooks`): `context.jsx:3` (`modules/header/context`), `elements/cookies/cookies.jsx:6` (`hooks`), `modules/header/search-bar.jsx:11` (`context`), `:12` (`hooks`). **search's `next.config.js` already aliases `hooks`, `modules`, `utils`, `lib`, `config`, ... to its own dirs** - verbatim copy would resolve to the wrong modules; rewrite to relative paths.
- `elements/icon/icon.jsx:4` imports `../../config` (`src/config.js`). In the published package `lib/config.js` is **overwritten at postinstall** (`bin/build/config/runner.js`) with search's values: `publicPath: "/static/search"`, `iconsPublicPath: "/static/search/icons.svg"`. HEAD `src/config.js` default (`/`, `/icons.svg`) is NOT what runs in search. Copy must hard-code the generated values.
- `elements/logo/index.js` exports `{ Logo, DataProviderLogo, LogoGroup }`; `export * from './logo'` is in `elements/index.js`. search's `@oacore/design/lib/elements/logo` import (templates/data-provider/index.jsx:3) = this index.
- Statics that search uses and that must survive the copy: `Card.Title/Description/Footer` (card.jsx:48-50), `Modal.Title/Content/Footer` (modal.jsx:115-117), `MetadataList.Item` (metadata-list.jsx:14), `ExpandableList.Item` (expandable-list.jsx:82), `Form.Control/Label/Group/Addon` (forms/index.js `Object.assign`), `Header.useSearchBar` (header.jsx:277), `Select.Option` (select/index.js).
- `utils/index.js`: `export * as classNames from './class-names'` -> `classNames` is a **module namespace** (`classNames.use(...)`, `.from(...)`, `.default`), whereas `import classNames from '.../utils/class-names'` is the `ClassNames` class (has static `use`/`from`). Search uses both forms (26 + 11 sites); a copy must expose both shapes.

## 3. Global things search inherits from design

### 3.1 Global stylesheet: `pages/_app.jsx:18` `import '@oacore/design/lib/index.css'` (then `main/global.css` at :19 - order matters)

`lib/index.css` is only a list of `@import url(...)` (reboot -> foundation -> elements -> modules -> helpers); Next/css-loader inlines them. It therefore ships **all 106 compiled CSS files** to every page, including CSS for components search never renders (Table, Switch, Carousel+slick CSS, DetailList, Message, DocumentationMembership*, DocumentSelect, Video, KaTeX CSS). The copy phase needs only the 39 CSS files listed in section 2 (+ katex CSS).

Compiled `lib/` is the golden reference for the CSS: same rules as `src/` after postcss (`postcss-extend-rule` -> `postcss-preset-env` stage 0 [nesting, custom-media, color-function with `importFrom: src/foundation/colors.css`, unresolved ignored] -> `postcss-calc` -> `cssnano` -> `postcss-modules` hashing). Use `lib/**/*.css` to diff the copied/recompiled CSS (modulo hashes).

| Global effect (leaks outside components) | Source (design `src/`) | Notes |
|---|---|---|
| CSS reset | `reboot.css:1-4` -> `~sanitize.css`, `/forms.css`, `/typography.css`, `/reduce-motion.css` (sanitize.css 12.0.1) | `~` webpack prefix; drop `~` in copy |
| `:root` tokens: colors, grays, `--primary:#b75400`, `--primary-dark`, `--danger`, `--on-surface*`, `--surface` | `foundation/colors.css` (131) | search CSS uses `--primary`(32x), `--gray-*`, `--white`, `--black`, `--danger`, `--on-surface` |
| `:root` layout tokens `--page-padding-x/y`, `--main-content-max-width/ratio`, `--main-content-aside-gap`, `--logo-min-width` + `@media (max-width:80rem)` | `foundation/layout.css` | `--page-padding-x` used 12x, `-y` 9x in search CSS |
| `:root` `--spacer:1.5rem` and **global margins** on `h1-h6,p,address,blockquote,ol,ul,dl,pre,figure`, `img,svg{vertical-align:middle}`, **`:first-child{margin-top:0}` / `:last-child{margin-bottom:0}`** | `foundation/spacing.css` (72) | affects every element on every page (search itself references this file in `main/global.css:23`) |
| Typography: `body` font/size/color/bg, `h1-h6` sizes, `:link/:visited` colors + hover underline, `small`, `mark`, `.display`, `.lead`, `.small`, `.mark`, `.initialism` (`:global`) | `foundation/type.css` (251) | `.display` is used in search (`templates/output/update/index.jsx:73,108`); `--h1-font-size` used by search CSS. No `@font-face`/web font anywhere: `--font-family-base` starts with `roboto` but nothing loads it |
| `--component-*`, `--elevation-01..` tokens | `foundation/component.css`, `foundation/elevation.css` | search CSS uses `--elevation-03/04`, `--component-padding-*`, `--component-border-radius` |
| Busy/skeleton states (`[aria-busy=true]` + `%busy/%clip-*`) | `foundation/loading.css` (119) | search CSS also has its own `[aria-busy]` rules |
| `.sr-only` (global utility) | `helpers.css:2` `:global(.sr-only)` | used in search: `modules/title/index.jsx:14`, `modules/copyable-input/index.jsx:70`, and by design Select (`select.jsx:95`) |
| **Native element styling**: all `button`, `[type=button|submit|reset]` | `elements/button/button.css:74-79` (`@extend %button`) | every raw `<button>` in search is styled |
| **Native element styling**: `label`, `::placeholder`, all text-like `input`, `select`, `textarea` (+ `& ~ label`) | `elements/forms/styles.css:321-360` | every raw form control in search |
| **`ul{padding:0;margin:0;list-style:none}`** | `modules/header/advanced-search.css:16` | leaks globally from a module CSS: every `<ul>` on every page loses bullets/padding (when lib CSS is loaded) |
| Component-scoped custom properties declared in `:root` | `forms/styles.css` (`--form-control-border-width`, `--form-control-padding-y`, ...), `forms/text-field.css` (`--form-helper-color`), `select.css` (`--select-clear-input-icon-color`), `button.css` (`--button-*`), `footer.css` (`--footer-*`), `modal.css`, `icon.css`, `link.css`, `progress-spinner/styles.css`, `search-result/styles.css`, `header/styles.css`, `header/advanced-search.css` | search CSS reads `--form-helper-color`(5x), `--form-control-border-width`(2x), `--form-control-padding-y`(1x), `--select-clear-input-icon-color`(1x), so these **must stay global** |
| Vars read by search but defined in neither repo CSS root | `--card-padding-x/y`, `--card-border-radius`, `--card-color` (only consumed with fallbacks inside design `card.css`, defined nowhere), `--body-color` (fallback `#000`), `--link-color` (defined only in `templates/data-providers/styles.module.css`), `--show-more-padding` (search-local) | no action, record |

All search `var(--x)` names (full list from `grep`): `--primary --gray-100..900 --white --black --danger --on-surface --page-padding-x/y --main-content-ratio --main-content-aside-gap --elevation-03/04 --component-* --card-* --form-* --select-clear-input-icon-color --spacer --h1-font-size --body-color --link-color --show-more-padding`. Every one except `--link-color`, `--show-more-padding`, `--card-*`, `--body-color` comes from the files in the table above.

### 3.2 PostCSS features the design CSS relies on (and how search's pipeline differs)

| Feature | Where | Design pipeline | search pipeline (`postcss.config.js`, preset-env 7.8.3 stage 0, cssnano, custom-media, extend-rule) |
|---|---|---|---|
| `@extend %placeholder` / `%name{}` | foundation/type.css, loading.css, forms/styles.css, forms/text-field.css, button/button.css, (table) | `postcss-extend-rule` runs **first** | search lists `postcss-extend-rule` **last** (after preset-env nesting). Order-sensitive when `@extend` is inside nested `&` blocks (forms/styles.css:297-360, text-field.css:54). Must verify by diffing against `lib/**/*.css` |
| `&` nesting | app-bar, button, card, expandable-list, forms, data-provider, metadata-list, header (28x), search-result (10x) | preset-env stage 0 | preset-env stage 0 (ok, search already uses `&`) |
| `@custom-media` | **defined per file with the same name but different values**: `--header-breakpoint-down` = 950px (`cookies/cookies.css:1`), 767px (`select/select.css:1`, `header/advanced-search.css:1`), 768px (`header/styles.css:2`); `--header-breakpoint-up` 767px/768px | resolved per file at build | `postcss-custom-media` also resolves per file; file-local definitions win over `importFrom`. OK but never hoist them into one shared file |
| `@media (--screen-until-desktop)` | `elements/fieldset/fieldset.css:44` | **undefined in design** -> left unresolved in `lib/elements/fieldset/fieldset.css:44` | resolved to `(max-width:767px)` by search's `main/media-queries.css` when Next re-processes the lib CSS. A copy inside search keeps working (same file defines it) |
| `color-mod(var(--primary) alpha(25%))` | `button/button.css:8` | not resolvable (var inside) -> emitted raw (`lib/elements/button/button.css:5`) | preset-env 7 has no color-mod plugin -> invalid value -> **focus ring never renders today**. Verbatim copy preserves the bug |
| `calc()` folding | many | `postcss-calc` | not run in search (browser evaluates) - no visual diff expected |
| CSS Modules camelCase | all components (`styles.cardImg` for `.card-img`) | `.cssmodulesrc {camelCase:true}` | search `next.config.js:63-79` patches css-loader `exportLocalsConvention='camelCase'` through a webpack hack that breaks on newer Next (flag to the Next-upgrade auditor) |
| `.css` (not `.module.css`) imports `import styles from './x.css'` | all 39 | babel css-modules-transform | Next: must rename to `*.module.css` and fix import path |
| Non-pure selectors in module files (`:root`, `button`, `label`, `ul`, `[type=..]`, `::placeholder`) | 12 component CSS files with `:root` + button.css, forms/styles.css, advanced-search.css | allowed (postcss-modules only scopes classes) | **Rejected by Next CSS-Modules `pure` mode**. Split each into `<name>.global.css` (imported from `_app`) + `<name>.module.css`. Keep selector text/order unchanged |

### 3.3 Icon sprite: `design build icons` + `design.config.js`

* Search `package.json` script: `"build": "node ./data/data-loader.js && node ./node_modules/.bin/design build icons && next build"`. Also run implicitly by design's own `postinstall: node bin build` (config + icons) during `npm ci` (Dockerfile:19 `npm ci --include=dev --legacy-peer-deps`), so the explicit step in `build` is redundant but harmless.
* CLI: `bin/index.js` (yargs) -> `bin/build/index.js` -> `config/runner.js` (writes `lib/config.js`) and `icons/runner.js` (svgo 1.x + svgstore). Config loader `bin/config.js` uses **cosmiconfig('design') searching upward from the CLI dir**: it finds (1) `node_modules/@oacore/design/design.config.js` (design's own, 32 icons: 10 mdi + 21 custom svg + dev-only `file-check`) and then (2) `search/design.config.js`, and **deep-merges** them (`deepmerge.all`, arrays concatenated; scalars overridden by search). Output: `search/public/design/icons/*.svg` (individual optimised files) and `search/public/design/icons.svg` (sprite; gitignored). Verified: the sprite currently contains **49 `<symbol>`s (46 files in `public/design/icons/`) with duplicate ids** (`office-building`, `account`, `open-in-new` each twice; first wins in `<use>`).
* search `design.config.js`: 17 mdi icons from `@mdi/svg/svg/*.svg`, `output.path=public/design`, `publicPath='/static/search'`, `icons.files='icons'`, `icons.sprite='icons.svg'`. **`@mdi/svg` is NOT in search's package.json** (resolved transitively through `@oacore/design`: `require.resolve('@mdi/svg/package.json')` at `design.config.js:25`); installed 5.9.55 (design asks `^5.8.55`).
* Runtime URL: `Icon` renders `<use href="{config.iconsPublicPath}#id">` with `iconsPublicPath="/static/search/icons.svg"` (generated into `lib/config.js`). Dockerfile:25 copies `public/design/icons.svg` -> `public/icons.svg`; `next.config.js` rewrites `/static/:path*` -> `/:path*` and sets `assetPrefix=/static/search` for `BUILD_TARGET=azure`. `ICONS_PUBLIC_PATH` build-arg/secret exists in Dockerfile:9,13 and workflows but nothing in search reads it. Copy must keep `/static/search/icons.svg` (or the ops side must change with it).
* Icon ids needed by **design components that search renders** (come from design's own config, not search's):

| Id | Source file | Used by (design src) |
|---|---|---|
| `#check`, `#alert-circle-outline` | mdi | forms/text-field.jsx:32-35 (status icons) |
| `#open-in-new` | mdi (also in search list) | link/link.jsx:68 (`external`) |
| `#core-symbol` | design `assets/core-symbol.svg` | elements/logo/logo.jsx:11 (Header logo) |
| `#office-building` | mdi (also in search list) | logo/data-provider.jsx:27 |
| `#window-close` | mdi | modal.jsx:103, select.jsx:136, header/advanced-search.jsx:32 |
| `#information-outline` | mdi | select.jsx:153 |
| `#menu` | mdi | header.jsx:158 |
| `#magnify` | mdi | header/search-bar.jsx:161 (search itself passes `#magnify` at 8 sites, which is not in search's own list -> relies on design's) |
| `#writing`, `#coreLogo`, `#twitter`, `#linkedin`, `#github` | design `assets/{writing,coreLogo,twitter,linkedin,github}.svg` | footer/footer.jsx:48,59,100,110,117 |

  Also from design's list but unused by search's rendered components: `pencil` (search passes `statusIcon="#pencil"` in `templates/data-provider/claim/claim-modal.jsx:77` - relies on design's list!), `account` (search also lists), `copy-document`, `sw`, `collaborators`, `jisc-logo`, `ou-logo`, `bin`, `active-arrow`, `drop-arrow`, `metadata-validator`, `deduplication`, `orcid`, `sdg`, `enrichment`, `das`, `fresh-finds`, `file-check`(dev only). Of the 20 icon ids search references, exactly three are supplied **only** by design's config (verified by script): `#check` (sort.jsx:59, year/custom-range.jsx:9, year/index.jsx:32), `#magnify` (8 sites), `#pencil` (claim-modal.jsx:77) -> the copy phase's own `design.config.js` must list at least: `alert-circle-outline check open-in-new magnify menu window-close pencil account information-outline office-building core-symbol writing coreLogo twitter linkedin github` + search's current 17 (`chevron-*`, `content-copy`, `tag`, `check-circle`, `emoticon-sad-outline`, `format-quote-open`, `menu-down`, `checkbox-*`, `share-variant`, `download`). Note design repo HEAD has an uncommitted rename `github.svg -> githubF.svg` (do not take assets from the working tree; take them from `node_modules/@oacore/design/assets`).
* Search-side usages of `src="#..."`/`icon="#..."` (all 40) are in section 1 grep set: `templates/**`, `modules/{filters,logo,copyable-input}`, `pages/{search,works,outputs}`; props that take icon ids into design components: `TextField` `icon/statusIcon/prependIcon`, `Select` `prependIcon`, `Fieldset icon`, checkbox-like `checkedIcon/unCheckedIcon` (search-local).

### 3.4 Runtime providers / context / hooks

| Item | Where in search | Design source | Notes |
|---|---|---|---|
| `DesignProvider` (useReducer context, header search-bar state) | `main/index.jsx:2,16` wraps whole app | `context.jsx` + `modules/header/context/*` | Required by `Header.useSearchBar` (called from `pages/search/index.jsx:123`, `pages/works/[id].jsx:128`, `pages/outputs/[id].jsx:111`, `templates/data-providers/index.jsx:125`). Without provider returns `[initialState, ()=>{}]` + dev warning |
| `CookiesProvider` | `pages/_app.jsx:8` | re-export of `react-cookie` `CookiesProvider` (`elements/cookies/cookies-provider.js`) | react-cookie 4.1.1 / universal-cookie 4.0.4 |
| `Cookies` popup | `main/index.jsx:2,19` (`<CookiesPopup />`) | `elements/cookies/{cookies,popup}.jsx` | reads cookies `essential_cookies_allowed`, `analytics_cookies_allowed` |
| `useCookie` | `hooks/use-analytics.js:4` | `hooks/use-cookies.js:45` | gates GA/LogRocket |
| Global `classNames` helper | 37 files | `utils/class-names.js` | wraps `classnames@2.5.1` + CSS-module name mapping (`.from(module)`) |
| PropTypes | design uses `prop-types` in ~all components | | `prop-types` is NOT in search deps (transitive). React 19 ignores `propTypes`; custom validators (`modal.jsx:13 checkAccessibility`) become dead code. Keep dependency or strip in the rewrite |
| React assumption | design `peerDependencies: react ^17.0.1, react-dom ^17.0.1`; built with `@babel/preset-react {runtime:'automatic'}` | | lib uses `react/jsx-runtime` (needs React >=16.14/17). Search has `react@17.0.2` |
| Peer/transitive runtime deps pulled by the lib (versions in search lock) | `@tippyjs/react 4.2.6`, `react-focus-lock 2.13.6`, `react-cookie 4.1.1`, `katex 0.16.22`, `d3-array 1.2.4`, `d3-scale 1.0.7`, `throttle-debounce 3.0.1`, `classnames 2.5.1`, `prop-types 15.8.1`, `sanitize.css 12.0.1`, `react-slick 0.28.1`+`slick-carousel 1.8.1` (+jQuery peer; unused), `react-markdown 5.0.3` (unused), `body-scroll-lock` (declared, not imported), `@mdi/svg 5.9.55`, `svgo 1.x`, `svgstore`, `cosmiconfig`, `yargs`, `deepmerge` (CLI only) | | none of these are declared in search `package.json` today |

Needed after the copy (declare explicitly in search): `classnames`, `prop-types` (or drop), `react-cookie`, `katex`, `@tippyjs/react`, `react-focus-lock`, `d3-array`, `d3-scale`, `throttle-debounce`, `sanitize.css`, `@mdi/svg` + `svgo`/`svgstore` (or replace the sprite pipeline). NOT needed: react-slick, slick-carousel, react-markdown, body-scroll-lock, katex fonts folder of design `public/`.

## 4. React 18/19 and Next 13+ compatibility red flags INSIDE the used design components

Scope: only files in the closure of section 2. Paths are in `../design/src/` (identical in the installed package). Severity = effect once React/Next are upgraded, *before* any copy.

| # | file:line | Pattern | React 18 | React 19 / Next 13+ | Sev |
|---|---|---|---|---|---|
| 1 | `elements/histoslider/histoslider.jsx:112-127` | `Histoslider.defaultProps = {selectedBarColor, rangeColor, unselectedColor, width, height:200, barBorderRadius, barPadding, padding, sliderHeight:20, handleLabelFormat, showLabels...}` on a function component | warns (18.3) | **defaultProps silently ignored** -> `height`, `sliderHeight`, colours, `barPadding`, `handleLabelFormat` become `undefined` (NaN geometry). search passes only `data, selection, className, padding, width, showLabels, selectFunc` (`modules/filters/year/index.jsx:43-51`) | HIGH |
| 2 | `elements/math-markdown/math-markdown.jsx:51-65` | `MathMarkdown.defaultProps` (function component) | warns | ignored; mostly benign because katex has equal defaults (`throwOnError`, `strict:'warn'`, `errorColor`, `output:'htmlAndMathml'`) and `children:null` is already handled at :16-21 | LOW |
| 3 | `elements/expandable-list/expandable-list.jsx:40` | `useCallback` called **after** an early `return` (:29-38, `childrenArray.length <= 4`) - Rules of Hooks | works until child count crosses 4 between renders, then throws "Rendered more/fewer hooks"; StrictMode/ESLint hooks rule flag it | same; also blocks React Compiler. Used by SearchResult (authors/lists) | HIGH |
| 4 | `modules/header/search-bar.jsx:115` | `if (propsIsHidden) useOutsideClick(...)` conditional hook; `propsIsHidden` comes from `useSearchBar()` state (`search-bar.jsx:76,56-64`; pages call `useSearchBar(cfg,{isHidden:false})`, default `true`), so it can flip while the persistent `Header` stays mounted during client-side navigation between pages with different `isHidden` | hook-count change -> crash risk | same | HIGH |
| 5 | `elements/cookies/cookies.jsx:31-36` | `visibleCookiePopup && typeof window !== 'undefined' && <CookiesPopup/>` evaluated during render; initial state from `useCookie` (cookie-dependent) | server returns `false`, client first render returns popup -> **hydration mismatch** (React 18 hydrateRoot error #418/#423, falls back to client render) | same, plus 19 diff-report. Rendered on every page (`main/index.jsx:19`) | MED |
| 6 | `modules/select/select.jsx:96-100` | `canUseDOM && options.length && document.activeElement === inputRef.current ? msg : ''` inside render | possible hydration text mismatch only if focused with options | same | LOW |
| 7 | `elements/math-markdown/math-markdown.jsx:9-14` + `utils/hasMathMLSupport.js:4-12` | DOM write/measure (append + remove `<div>`) during render when `output==='mathml'` (never with defaults) | n/a by default | n/a by default | LOW |
| 8 | `modules/popover/popover.jsx:1,48-63` -> `@tippyjs/react@4.2.6` (`dist/tippy-react.umd.js:364,521` `preserveRef(children.ref, node)`) | reads `element.ref` | ok | **React 19 warns `element.ref` removed** (still functional in 19.0-19.2 but deprecated); child must accept a ref (search passes `Button` = forwardRef, ok; `modules/copyable-input/index.jsx:50-60`). No `findDOMNode` | MED |
| 9 | `hooks/use-cookies.js:2` -> `react-cookie@4.1.1` (`cjs/useCookies.js:32` uses `useLayoutEffect`) | SSR `useLayoutEffect` warning on 17/18 | works; react-cookie 4 predates React 19 (peer `>=16.3`); upgrade to v7/v8 if the lib is kept | MED |
| 10 | `modules/modal/modal.jsx:88-92` | callback ref with block body (returns `undefined`) | fine | fine (a returned non-function would be treated as cleanup in 19 - not the case) | OK |
| 11 | `modules/modal/portal.jsx:8-19` | `document` only in `useEffect`, `createPortal` from `react-dom`, creates `#modal-root` and never removes it | fine (StrictMode double effect re-uses node) | fine; `react-dom` peer pin `^17` in design `package.json` | OK |
| 12 | `elements/{button,link,progress-spinner}/*.jsx`, `elements/forms/{form,control,label,group,addon,text-field}.jsx` | `forwardRef` | fine | fine in 19 (supported, ref-as-prop optional) | OK |
| 13 | `modules/select/hooks/use-options.js:32` | `child.type.displayName === 'SelectOption'`; relies on explicit `Option.displayName` (`select/option.jsx:33`) | fine | fine; **breaks if a wrapper/fragment/string child is passed** (`child.type` undefined) | LOW |
| 14 | `use-options.js:31,60`, `expandable-list.jsx:27,46-67`, `footer.jsx:22-24` | `Children.toArray` + `cloneElement` | fine | fine (no `element.ref` use) | OK |
| 15 | `elements/link/link.jsx:48`, `elements/button/button.jsx:19-26`, `footer.jsx:17`, `header.jsx:97,110,133` | plain `<a href>`; never uses `next/link` | n/a | Next 13: no `legacyBehavior` problem inside design. **Search-side**: `templates/data-providers/result-card.jsx:20-24` wraps design `Link` in `next/link` (-> nested `<a><a>` in Next 13+) and `templates/data-provider/pagination.jsx:72-128` uses `<Link passHref>` around design `<Button tag="a">` (a forwardRef component: needs `legacyBehavior` in Next 13+) | MED (search side) |
| 16 | `hooks/use-window-size.js:4-23`, `hooks/use-outside-click.js:9-13` | `window`/`document` guarded and only inside effects | fine | fine | OK |
| 17 | `utils/can-use-dom.js`, `context.jsx:19`, `search-bar.jsx:31` | `typeof window`, `process.env.NODE_ENV` only; no `process.browser`, no module-scope `window` | fine | fine (bundlers inline NODE_ENV) | OK |
| 18 | `modules/modal/modal.jsx:44-66` | `useCallback(..., [hideManually])` omits `onClose` -> **stale `onClose` closure** (pre-existing behaviour) | same | same; copy verbatim, do not "fix" | NOTE |
| 19 | `modules/header/header.jsx:20-22` | `useCallback(fn)` without deps (new fn per render) | fine | fine | OK |
| 20 | `elements/fieldset/index.jsx:11-13` | `useEffect(() => setActiveBox(items[0].value), [])` - throws if `items` empty | same | same | NOTE |
| 21 | prop-types everywhere, custom validator `modal.jsx:13-33` | | dev warnings | **React 19 stops checking `propTypes`** (dead code, harmless) | OK |
| 22 | Babel `add-react-displayname` in both design and search babel configs | gives anonymous arrows names | fine | explicit `displayName` is set where logic depends on it (`select/option.jsx:33`, `modal/title.jsx:10`, `metadata-list-item.jsx:30`, `expandable-list.jsx:79-80`); other names are cosmetic (DevTools) | OK |
| 23 | Not found in used closure: string refs, `findDOMNode`, legacy lifecycles (`componentWill*`, `UNSAFE_`), `contextTypes`, `ReactDOM.render/hydrate`, `React.PropTypes`, `process.browser` | - | - | - | none |

Unused-but-bundled today because of the barrel (`@oacore/design` -> `lib/index.js` is CJS with no `sideEffects` hint, so webpack keeps everything): `react-slick@0.28.1` (peer React <=17, class component with legacy lifecycles; `Carousel`), `react-markdown@5`, `documentation-membership*`, `docs-select`, `video`, `table`, `switch`, `message`, `detail-list`. They disappear once the copy imports only the 121 files; until then `react-slick` blocks a clean React 19 install without `--legacy-peer-deps` (Dockerfile:19 already uses it).

Other upgrade-relevant facts about the lib itself: built with `@babel/env shippedProposals` (no targets -> ES5 + `@babel/runtime` helpers + `react/jsx-runtime`), single CJS output, no ESM, no `exports` map -> deep imports `@oacore/design/lib/...` only work because of no `exports` field. `@oacore/design` is published to GitHub Packages (private registry `npm.pkg.github.com`, `.npmrc.dist`, `Dockerfile:18` `NPM_TOKEN`) - an install blocker for any auditor/CI without the token.

## 5. Tests, stories, styleguide in design (reusable as reference)

* **No automated tests**: no `*.test.*`, `*.spec.*`, `__tests__`, `*.stories.*`, `.storybook`. `@storybook/*@^3.1` devDependencies are stale leftovers (nothing uses them). CI (`.github/workflows/pull-request-check.yml`) runs only `npm run build` and `npm run lint`; `publish-package.yml` publishes on tag.
* **React Styleguidist** (`styleguide.config.js`, `react-styleguidist@11`, webpack 4): `npm run build:docs` / `dev:docs` renders `docs/intro.md` + **31 component `.md` files (1,542 lines)** with live examples. They are the only behaviour/visual specs. Most valuable for characterization tests:

| Doc | Lines | Covers |
|---|---|---|
| `modules/modal/modal.md` | 268 | Modal + Title/Content/Footer, a11y props, hideManually |
| `elements/forms/text-field.md` | 155 | TextField variants (status, icons, helper, addons) |
| `modules/select/select.md` | 133 | Select, Option, suggestions, prependIcon, variants |
| `modules/popover/popover.md` | 107 | Popover (manual `visible`, triggers, placement) |
| `foundation/README.md` | 106 | colours, spacing, typography tokens |
| `modules/header/header.md` | 63 | Header + `useSearchBar` |
| `modules/search-result/search-result.md` | 62 | SearchResult full example |
| `elements/progress-spinner`, `histoslider`, `expandable-list`, `link`, `button`, `icon`, `card`, `logo/*`, `fieldset`, `metadata-list`, `footer`, `cookies/popup` | 8-51 each | one example each |
| `context.md` | 21 | DesignProvider |

* Build the docs once (`design/node_modules` is present: `npm run dev:docs` runs `node bin build && styleguidist server`) to capture **screenshot baselines per component**; `design/public/` already has 89 files (KaTeX fonts + built styleguide assets).
* Compiled CSS in `node_modules/@oacore/design/lib/**/*.css` can be used as the expected output for CSS diff tests (section 3.2).
* `.github`, `.lintstagedrc`/`.huskyrc` (yarn-based lint-staged, but repo uses npm) - irrelevant to the copy.

## 6. Copy plan

### 6.1 Recommended copy order (leaf first) with size per unit

Counts are *own* files / LOC (from `../design/src`), `.css` included. Aggregator one-liners (`index.js` re-exports, `index.css` `@import` lists) are marked since they may be dropped in the copy.

| Step | Unit | Own files / LOC | Needs first | Coupling / difficulty |
|---|---|---|---|---|
| 0 | Global CSS: `reboot.css`, `helpers.css`, `index.css`(aggregator), `foundation/{colors,component,elevation,layout,loading,spacing,type,index}.css` | 11 / 697 | - | Must be loaded globally and **before** `main/global.css`; keep `@extend %heading`, `:global()` handled |
| 0 | Sprite/config: `config.js` (hard-code `/static/search`, `/static/search/icons.svg`), own `design.config.js` incl. design's icons, copy 6 asset SVGs (`core-symbol, writing, coreLogo, twitter, linkedin, github`) | 1 + 6 svg | - | `@mdi/svg` dep must become explicit; `design build icons` replaced by script or kept via design's `bin/` (~370 LOC: `bin/{index,config}.js`, `bin/build/{index.js,config/*,icons/*}`) |
| 1 | `utils` (`class-names.js`, `can-use-dom.js`, `index.js`) | 3 / 66 | `classnames` | trivial; keep both export shapes (namespace `classNames` + default class) |
| 1 | `hooks` (`use-cookies`, `use-outside-click`, `use-window-size`, `use-switch`, `index`) | 5 / 145 | `react-cookie` | `use-switch` unused by search (can skip) |
| 2 | Icon | 3 / 62 | utils, config | trivial |
| 2 | ProgressSpinner, LoadingBar, Card, Button, Heading | 3/91, 3/46, 3/104, 3/147, 1/33 | utils | trivial; Button has global `button,[type=..]{}` block (`button.css:74-79`) + `color-mod` bug |
| 3 | Link | 3 / 109 | Icon | trivial |
| 3 | MetadataList | 4 / 122 | utils | trivial |
| 3 | MathMarkdown | 6 / 179 | `katex` (+css) | defaultProps (flag #2) |
| 3 | Logo set (`Logo`, `DataProviderLogo`, `LogoGroup`) | 7 / 178 | Icon | trivial |
| 4 | Forms (`Form`, `TextField`) | 10 / 732 | Icon, ProgressSpinner | big CSS (`forms/styles.css` 374 lines, 18 `@extend`, global native control rules) - **hardest CSS**, keep `:root` vars global |
| 4 | ExpandableList | 3 / 138 | Button | hooks-order bug (flag #3) |
| 4 | Fieldset | 2 / 96 | Card, Icon | uses `@media (--screen-until-desktop)` |
| 4 | Histoslider | 5 / 519 | utils, d3-array, d3-scale | defaultProps (flag #1); only one search site |
| 4 | AppBar (+Brand, Item) | 6 / 133 | utils | needed only by Header |
| 4 | Popover | 3 / 142 | Card, `@tippyjs/react` | flag #8 |
| 5 | Modal | 7 / 315 | Button, Icon, react-focus-lock | `:root` block in modal.css |
| 5 | Cookies + CookiesProvider | 5 / 146 | Button, Link, hooks, react-cookie | hydration (flag #5); `cookies.css` defines local `@custom-media` 950px |
| 5 | Footer | 3 / 350 | Icon, Link, MathMarkdown | 5 icon ids, 208-line CSS with `:root` vars, hardcoded core.ac.uk links; **note installed lib differs from stale design/lib** |
| 5 | SearchResult | 4 / 461 | Card, Heading, MetadataList, ExpandableList, MathMarkdown, Logo set, Link | 196-line CSS, 10 nestings |
| 6 | Select (+`header/advanced-search.{jsx,css}`) | 9 / 895 | Forms, Icon, Button | **cycle with Header**; advanced-search.css:16 global `ul{}` reset |
| 6 | DesignProvider/context + `header/context/*` | 4 / 77 | - | search wraps whole app |
| 7 | Header (`header.jsx`, `search-bar.jsx`, `styles.css`, `index.js`) | 4 / 1,057 | AppBar, Button, Icon, Logo, Select, hooks, DesignContext, `throttle-debounce` | **most coupled** (see 6.2) |

Totals: **121 files, ~7,050 LOC** (JS/JSX 82 files ~3,780 LOC; CSS 39 files 3,271 LOC), of which foundation+global 11 files / 697 LOC, Header closure alone (incl. Select, forms, etc.) 58 files / 3,593 LOC. `package.json` deps to add listed in 3.4.

### 6.2 Components that are too coupled to copy "cleanly" (need path/structure edits, no logic changes)

1. **Header + Select + advanced-search + DesignContext**: import cycle (`select.jsx:7` -> `header/advanced-search`; `search-bar.jsx:8` -> `Select` via barrel); `Header.useSearchBar` is a static on the component and writes to `DesignProvider` state through `useDesignContext` (bare alias `context`, `search-bar.jsx:11`); hardcoded absolute links to core.ac.uk; conditional hook (flag #4). Copy as one unit, in one folder, keeping `DesignProvider` semantic identical.
2. **Anything importing through the barrels** (`from '..'`, `from '../../elements'`): rewrite to direct relative imports; otherwise the copy reproduces the cycles and webpack ordering issues.
3. **Forms CSS** and **Button CSS**: global native-element rules + `:root` vars + `@extend` -> cannot be a single `*.module.css` (Next pure-mode); needs a global/module split and `postcss-extend-rule` placed **first** in search's PostCSS plugin order to reproduce the compiled output.
4. **Icon + config.js**: depends on the build-time-generated `lib/config.js` (not present in repo `src/`): must be replaced by constants matching production (`/static/search/icons.svg`), and on the sprite pipeline.
5. **Footer**: pulls MathMarkdown/katex just for a sentence; drag-along dependency but isolated.
6. `Cookies`/`CookiesProvider`/`useCookie*` are thin wrappers over `react-cookie` - copy or replace with `@oacore/core-ui` hooks (section 7).

### 6.3 Verification suggestions for the copy phase (no logic/UI change)
* For each copied CSS file, run search's PostCSS on it and diff against `node_modules/@oacore/design/lib/<same path>.css` after stripping hashes and sourcemap comments (the stale `design/lib` differs from the installed lib in `footer.js/css` and `config.js`, which is why the installed lib is the baseline).
* Compare the set of class names exported by each module with the inlined maps in `lib/**/*.js` (e.g. `lib/elements/icon/icon.js`).
* Visual baselines from the styleguide (`npm run dev:docs` in design) and from the live search pages (search, work, data-provider, data-providers, outputs, 404).
* Keep both `import { classNames }` and `import classNames` working (37 sites).

## 7. Natural equivalents for the final rewrite phase (antd 6 / `@oacore/core-ui` in dashboard)

Dashboard stack: React 19.2, antd 6.3, `@oacore/core-ui` 2.0.20 (exports: CrHeader, CrInput, CrPaper, CrShowMore, CrTabs, CrMessage, CrFeatureLayout, DataProviderLogo, Markdown, CookiesPopup, CookiesView, `useCookieHandler`, `useCookieItems`, `getCookie`, `antdTheme`, `themeTokens`, ...). antd usage in dashboard: Button 49x, Spin 21, message 16, Card 15, Modal 10, Tooltip 8, Form 7, Input 6, Select 4, Popover 3, ConfigProvider 2.

| Design component | Used in search (files) | antd 6 equivalent | core-ui equivalent | Gap / note |
|---|---|---|---|---|
| Button (`variant text/outlined/contained`, `tag`, `href`) | 25 | `Button` (`type=text/default/primary`, `href`) | - | `tag="a"` + next/link usage needs `Button href` / `<Link legacyBehavior>` rethink |
| Card (+Title/Description/Footer, `variant="outlined"`) | 14 | `Card` (+ `Card.Meta`) | `CrPaper` | custom paddings via `--card-*` vars |
| Icon (sprite `<use href="#id">`) | 19 | `@ant-design/icons` / inline SVG | - | search uses mdi ids; keep sprite or map to `@mdi/js` |
| Link (`external` icon) | 9 | `Typography.Link` (`target`, `rel`) | - | external icon manual |
| Modal (+Title/Content/Footer, portal, focus lock) | 9 | `Modal` (title/footer props, built-in focus trap) | - | design has no `open` prop (mounted = open) |
| TextField / Form (+Group/Addon/Label/Control) | 7 / 3 | `Input` (+`prefix/suffix/addonBefore`), `Form`, `Form.Item` | `CrInput` | status icons / floating label are custom |
| Select (suggestion/autocomplete + advanced search menu) | 1 (+Header) | `AutoComplete` / `Select showSearch` | - | custom keyboard behaviour; advanced-search popup custom |
| Header (CORE top bar, search bar, menus) | 5 | `Layout.Header` + `Menu` + `AutoComplete` | `CrHeader` | `useSearchBar` + `DesignProvider` -> zustand/React context |
| Footer | 1 | `Layout.Footer` | - | none in core-ui; static content |
| Cookies / CookiesProvider / `useCookie` | 3 | - | `CookiesPopup`, `CookiesView`, `useCookieHandler`, `useCookieItems`, `getCookie` | `useCookie(name)` -> `getCookie`; keep `react-cookie` or `js-cookie` |
| Popover | 3 | `Popover` / `Tooltip` | `InfoTooltip` | search uses manual `visible` tooltip on copy |
| ProgressSpinner / LoadingBar | 1 / 2 | `Spin` / `Progress` (or skeleton) | - | LoadingBar is top-of-page bar -> custom or `nprogress` |
| MetadataList (+Item) | 3 | `Descriptions` / `List` | - | simple `<ol>` markup; trivial to keep |
| ExpandableList | 1 | `Collapse`/custom | `CrShowMore` | "+N more" behaviour = CrShowMore |
| MathMarkdown | 1 | - | `Markdown` (verify KaTeX support) | search needs KaTeX `htmlAndMathml` |
| SearchResult | 2 | `List.Item` + `Card` + `Typography` | - | no equivalent; keep as local component |
| Histoslider | 1 | `Slider range` + custom histogram | - | no equivalent; keep local (d3) |
| Fieldset (card-radio group) | 1 | `Radio.Group` `optionType="button"` / `Segmented` | `CrToggleTabs` | |
| DataProviderLogo | 1 | `Avatar` | `DataProviderLogo` | direct equivalent |
| DesignProvider | 1 | `ConfigProvider` (theme tokens) | `antdTheme`, `themeTokens` | only carries header search state |
| `classNames` util | 37 | - (use `clsx`/`classnames`) | - | wraps `classnames` + CSS-module mapping |
| Foundation tokens (`--primary:#b75400`, grays) | CSS | `theme.token` / `ConfigProvider` | `themeTokens`, `customColors` | map `--primary` and gray scale to antd tokens |

## 8. Open items / things NOT verified
* No build or runtime was executed (read-only, no `npm install`); the `.next` dir contains only a dev build, so the final bundled CSS (how Next processes `lib/index.css`, e.g. whether `--screen-until-desktop` and `color-mod` end up as claimed) is inferred from configs and compiled lib files, not observed.
* Hydration findings (#5, #6) are from code reading; confirm in a browser console on React 18.
* `MathMarkdown` support in core-ui `Markdown` and exact `Tippy` child-ref behaviour on React 19 were not tested.
* The exact set of Next version-specific CSS Module rules (pure mode, camelCase hack in `next.config.js:63-79`) belongs to the Next-upgrade auditor; the dependency is flagged here because every copied component CSS depends on it.
