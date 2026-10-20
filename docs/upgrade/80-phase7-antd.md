# 80 — Phase 7: antd restyle and design ownership

**Purpose.** How phase 7 turns every used design unit into antd restyled to 0 px or into readable search-owned source, behaviour unchanged (D5, D9, D11).
**Read it** at GATE-A sign-off and at each 7.x step start; execute with [01](01-playbook.md). **Owns:** phase-7 entry; 7.0 infrastructure, token table, icons, spike; 7.1 ownership and owned global CSS; 7.2 order, equivalence, acceptance; forms; 7.F; CS-AN-1..6. Elsewhere: DU dispositions [60](60-design-ownership.md) §3, gates [55](55-gates-and-confidence.md), versions [02](02-version-matrix.md), tests [41](41-test-inventory.md), calendar [50](50-roadmap.md) §6.

## 0. Entry

All true at 7.0 start; evidence in `records/7.0.md`.

1. GATE-A signed by the Owner (55 §4). No antd code on `main` before (D10, OC-24).
2. OD-28(c) DECIDED, owner `SIGNED:` ([90](90-open-decisions.md), default approve): (a) T-602 (SSR head) and T-729 (post-hydration head) ignore antd `<style>` elements, i.e. `style[data-antd-ssr]` and cssinjs runtime tags [VERIFY: runtime tag attributes, 7.0]; (b) inside a replaced unit's root (its root element plus its portal subtrees: antd `getPopupContainer` set to a marked per-unit container) only wrapper elements, nesting, class tokens, `style` and `data-*` the app does not read may change; behavioural attributes ([40](40-test-strategy.md) §1), roles, accessible names, focus order and keyboard behaviour may not (review:00 X80.1).
3. OD-49 DECIDED (default: per-route first-load JS gzip ≤ B0 +10 %, cumulative (T-007); T-611 budgets).
4. OD-34: no `@oacore/core-ui` (review:00 X60.10).
5. OD-16: antd 6 supports "last 2 versions" (search: `last 3 versions`, `.browserslistrc:1`) and `layer` emits `@layer` (Chrome ≥99, Firefox ≥97, Safari ≥15.4 [VERIFY: caniuse, 7.0]); accepted as an AD row `ref: [OD-16]` after VF-25 (review:00 X80.6).
6. 02 re-resolved (02 §5): antd and `@ant-design/*` at latest, exact pins (minors change DOM; review:00 X80.2).
7. DV7 done (6.9, 60 §5): design CSS frozen as pure CSS.

## 1. 7.0 — antd infrastructure, theme, spike

Branch `upgrade/70-antd-infra` (01 §2); one deploy (01 §4); no unit replaced.

| PR | CS | Change | Proof (beyond 01 §6) |
|---|---|---|---|
| 1 | harness (40 §8) | OD-28(c) normaliser; replaced-unit root and portal list for T-605, T-417, T-728 and C4 (empty); T-801 pre-hydration capture of V states that will hold antd; T-805 layer probes (X80.1) | green on unchanged `main` |
| 2 | CS-AN-1 part 1 | `pages/_document.tsx` (extension as `pages/_app`), default markup only: `<Html><Head /><body><Main /><NextScript /></body></Html>`, **no `lang`** (Q-054); none exists today (review:dashboard-target.verdicts DT-19) | T-601, T-602, T-603 identical, no new normalisation; T-801 0 px |
| 3 | CS-AN-3 deps | antd, `@ant-design/icons`, `@ant-design/cssinjs` exact per 02; `npm ls @ant-design/cssinjs` = one version in antd's range | T-008 strict; T-004 |
| 4 | CS-AN-1 part 2, CS-AN-3, CS-AN-2 | Extraction, providers, theme (below) | 7.0 exit |
| 5 | AD row | OD-16 row signed; T-015 floor recorded (R-077) | CI green |

Code shape (ran on Next 16.4.2 + React 19.3.1, no console errors; review:dashboard-target §5.4, §6):

```tsx
// pages/_document.tsx, CS-AN-1 part 2 (render() as in PR 2)
static async getInitialProps(ctx) {
  const cache = createCache()                    // @ant-design/cssinjs
  const renderPage = ctx.renderPage
  ctx.renderPage = () => renderPage({ enhanceApp: (App) => (props) => (
    <StyleProvider cache={cache} layer><App {...props} /></StyleProvider>) })
  const initial = await Document.getInitialProps(ctx)
  return { ...initial, styles: <>{initial.styles}<style data-antd-ssr
    dangerouslySetInnerHTML={{ __html: extractStyle(cache, true) }} /></> }
}
// pages/_app, CS-AN-3: outermost around today's tree (Anchor `<CookiesProvider>`, pages/_app.jsx:104)
<StyleProvider layer><ConfigProvider theme={searchTheme} wave={{ disabled: true }}>
  <App component={false}>{/* today's tree */}</App></ConfigProvider></StyleProvider>
```

- `layer` in `_document` and `_app` keeps SSR and client equal: antd sits in `@layer antd`; search CSS stays unlayered and wins (never layer it). Without it antd's `<style>` (after Next's `<link>`s) wins ties: `.ant-btn{border-radius:40px}` computes 2px, 40px with it (R-074; review:00 X10.12).
- `searchTheme` (`styles/antd-theme.ts`) = the token table + `cssVar: { key: 'css-var-search' }`; the explicit key drops the default key's `useId` dependency (`antd/es/config-provider/hooks/useTheme.js`, antd 6.3.2 in ../dashboard) [VERIFY: pinned antd → VF-12; core-ui part moot (OD-34)].
- Not used: `antd/dist/reset.css`; `@ant-design/nextjs-registry` (App Router only); `@ant-design/static-style-extract` unless OD-33 demands it.
- `wave` off: no ripple in the design [VERIFY: T-802 pressed state, 7.2.DU-03]. Motion tokens (`motionDurationFast`, `motionDurationMid`, `motionDurationSlow`, `motionEase*`) are set per unit so the T-805 motion census equals B0. `App component={false}` adds no node [VERIFY: T-605, PR 4]. CSP `style-src` has `'unsafe-inline'` (`csp.config.js:35`).

**Theme token table (CS-AN-2).** From the design foundation (frozen by DV7; source `../design/src/foundation/` at `bbc35a0`), never the dashboard/core-ui `antdTheme` (dashboard-specific, e.g. Input `controlHeight` 44, `../dashboard/src/config/theme.ts:115`; review:00 X60.11). A token is proven when its first-proof unit passes T-802 at 0 px and T-805 shows the property.

| `theme.token` | Value | Design source | First proof |
|---|---|---|---|
| `colorPrimary` | `#b75400` | `colors.css:80` `--primary` | DU-03 |
| `colorLink` | `#b75400` | `type.css:102` `var(--link-color, var(--primary))` | DU-05 |
| `colorLinkHover` | `#812700` | `type.css:107` → `--primary-dark` (`colors.css:82`) | DU-05 |
| `colorText` | `#000` | `type.css:35` `var(--body-color, #000)` | DU-04 |
| `colorTextHeading` | `#212121` | `type.css:2` → `--gray-900` (`colors.css:53`) | DU-06 |
| `colorBgContainer` | `#fff` | `colors.css:68` `--surface` | DU-04 |
| `fontFamily` | `--font-family-base` list verbatim | `type.css:3-15` | DU-03 |
| `fontSize` | 16 | `type.css:32` `var(--font-size-base, 1rem)` [VERIFY: root 16 px, T-805] | DU-04 |
| `lineHeight` | 1.5 | `type.css:34` | DU-04 |
| `borderRadius` | 2 | `component.css:5` `--component-border-radius` | DU-03, DU-04 |

Component values (paths under `../design/src/`: Button `elements/button/button.css`, Card `--elevation-01` `elements/card/card.css:41`, Modal z 1030 `modules/modal/modal.css:9`, TextField danger `elements/forms/text-field.css:67-78`) go into `theme.components.<Name>` or unlayered overrides in the unit's 7.2 PR, which appends rows here (01 §9).

**Icons, imperative APIs.** `@ant-design/icons` is pinned exactly with antd (per 02; antd 6 needs icons ≥6, review:dashboard-target.verdicts DT-17). The owned MDI sprite (DU-02) stays the source of design glyphs: where antd draws an icon (Modal `closeIcon`, Select `suffixIcon`/`clearIcon`, Spin `indicator`) pass the owned `Icon` or `null`; an antd glyph only where T-802 is 0 px with it. Static `message.*`, `notification.*`, `Modal.confirm|info|success|error|warning` ignore `ConfigProvider` (review:00 X80.5) and are forbidden; use `App.useApp()` or `message.useMessage()`. Per-PR check (POSIX classes: `git grep -E` on macOS ignores `\b`): `git grep -nE "(^|[^[:alnum:]_])(message|notification)\.(open|success|error|info|warning|loading)\(|Modal\.(confirm|info|success|error|warning)\(" -- ':!docs'` = 0. The toast (`modules/notification/index.jsx`) is search code; it stays.

**Spike (5 working days, time-boxed; review:00 X80.2).** Branch `upgrade/70-spike-0px` from the PR-4 head, never merged (D10): DU-06 Modal and DU-08 Select with `IMPL=antd`, every T-802 state (fallback DU-03 + DU-06, reason recorded). `records/7.0.md`: diff pixels and causes per state, hours, projected 7.2 effort (VF-17), VF-12 result. Both 0 px with their §3 items green → 7.1 may start. Else stop (01 §8); the owner picks (i) a longer time box, (ii) reclassifying the unit as owned in 60 §3 (D9 allows it), (iii) halting phase 7, as a new OD (01 §9). A pixel diff is never accepted (D7).

**Exit 7.0** (antd mounted, no unit replaced): T-801 0 px, full matrix incl. V28 and pre-hydration captures; T-602 identical under (a), block present; T-601, T-603, T-610 identical; T-701/T-728 no new event, no `css-var-*` diff SSR vs hydrated (VF-12 CLOSED); T-805 probes pass; one cssinjs copy; T-007/T-611 within OD-49; spike outcome or owner decision recorded. Rollback: 01 §5; PR 2 (antd-free) may re-land alone.

## 2. 7.1 — Ownership (DV8) and owned global CSS

Scope: every DU with 60 §3 disposition "owned" (review:design-system §6.2: DU-01, DU-02, DU-09, DU-10, DU-12, DU-14, DU-16–DU-20, DU-22–DU-24). antd-target units skip ownership: vendored → antd in 7.2 (review:00 X60.3). Branch `upgrade/71-ownership`, one PR per item, one deploy (01 §4). Entry: 7.0 DONE.

1. **Owned CSS** (DU-23, DU-24). `styles/global/index.css` replaces the DV7 import at `pages/_app.jsx:18` (`styles/global/design/index.css`, 60 §5) and `@import`s the same DV7 files in the same order, bytes unchanged: global-only files (reboot + inlined sanitize.css, foundation, helpers, DV7 externals) in `styles/global/`, owned units' files beside their port, antd-target files in `styles/global/pending/<lib path>`, fonts and media (DU-24) under the same names. Only `pages/_app` imports them (R-086). Proof: CSS SHA-256 per `<link>` identical, sourcemap comments stripped (VG-3 method, 55 §6); T-003 sequence and T-005 media identical; T-801 0 px.
2. **One PR per owned unit** `[7.1][DV8] Port DU-nn <name>`, leaf first: DU-01, DU-02, DU-14, DU-12, DU-22, DU-20, DU-19, DU-16, DU-17, DU-18, then DU-08 + DU-09 + DU-10 together (import cycle, context identity; DU-08 turns antd at 7.2.DU-08, 60 §3).
   - Characterize first: the unit's 60 §6 assertions and pins (Q-047, Q-051, Q-066–Q-068, Q-070, Q-090) green in T-417 on the vendored package; missing pins land first, own PR.
   - Port `git -C ../design show bbc35a0:src/<path>` (lib rebuilds 220/220 from it, 60 §2) to `components/<group>/<unit>/index.tsx` (`layout`: DU-09, DU-10, DU-18; else `common`). Keep hook order, defaults, statics, prop spread order, DOM, frozen class strings, both `classNames` shapes. No cleanup, no fixes (D1).
   - Re-point search imports (`git grep -n "<Name>" -- '*.jsx' '*.tsx'`); vendored units keep internal copies until 7.F.
   - Proof: T-417 identical (port vs package), T-802 and T-801 0 px, T-605 identical; plus DU-02 T-005/T-418, DU-17 T-416/T-740, DU-19 T-404/T-705, DU-20 V39, DU-16 E22 count (Q-090), DU-09/DU-10 T-714, T-727, V21–V25.
3. Held deps of owned units (throttle-debounce, react-cookie, d3, katex) move only in their `7.2.<DU>` step (02 §3–§4).

**Element rules during coexistence (R-087; review:00 X80.3).** Unlayered design rules beat layered antd on every antd element they match (5.0.74 package paths): `button`, `[type=button|reset|submit]` (`lib/elements/button/button.css:8`), `label` (`lib/foundation/type.css:304`, `lib/elements/forms/styles.css:307`), `input`/`select`/`textarea` (`lib/elements/forms/styles.css:331`), `ul` (`lib/modules/header/advanced-search.css:15`). Search has 1 raw `<button>` (`modules/show-more/index.jsx:23`), 9 raw `ul`/`input`/`select`/`label` sites. Every 7.2 PR reaches 0 px with the rules present. A rule group is retired, one per PR, when its last design consumer goes (latest 7.F): raw sites get an owned class with the declarations they computed (T-805 identical), dead selectors leave `styles/global/`, T-801/T-802 0 px. Rules colliding with nothing stay owned (DU-23).

**Exit 7.1:** `git grep -n "from '@oacore/design" -- ':!docs' ':!vendor'` finds only antd-target units and the T-802 `IMPL=design` path; deployed.

## 3. 7.2 — One unit per PR, leaf first

Scope: DUs with 60 §3 disposition "antd restyle" or "antd composite", then owned units that render them. Step `7.2.DU-nn` = one PR, branch `upgrade/72-du<nn>-<slug>`, deployed via 01 §4; the next starts after the previous record (OC-21). Order: review:00 X80.4; DU-13, DU-15 placed by the same rule (review:design-system §6.2).

| # | Step | Unit → antd | Unit-specific items |
|---|---|---|---|
| 1 | 7.2.DU-21 | ProgressSpinner → `Spin`, owned SVG `indicator` | determinate (`value`/`max`) and indeterminate states |
| 2 | 7.2.DU-13 | DataProviderLogo → `Image`/`Avatar` | logo requests (T-702); `preview={false}` (the design logo is a plain `<img>`, `../design src/elements/logo/data-provider.jsx:25`) |
| 3 | 7.2.DU-03 | Button (25 files) → `Button` | no focus ring (Q-066); uppercase, letter-spacing; `tag="a"` → `href`, one `<a>` per control (T-406, T-407); `htmlType` = today's computed `type` (the design Button sets none, `../design src/elements/button/button.jsx:7-26`, so it submits inside a form, e.g. `templates/output/update/index.jsx:102`; antd defaults to `button`; T-605) |
| 4 | 7.2.DU-05 | Link, BaseLink → `Typography.Link` | `external` icon; visited colour |
| 5 | 7.2.DU-04 | Card + statics → `Card` | `tag` passthrough; nested anchors unless Q-072 fixed at W5.5 (T-728) |
| 6 | 7.2.DU-11 | Popover (Tippy) → `Popover` | `trigger={['hover','focus']}`; V29, T-737 |
| 7 | 7.2.DU-06 | Modal + statics → `Modal` | z 1030; first-render `onClose`; mounted = open; body `overflow: unset` after close; duplicated aria-label (Q-068, Q-085; T-806) |
| 8 | 7.2.DU-07 | TextField, Form + statics → `Form`, `Form.Item`, `Input` | §4; floating label, status icons owned |
| 9 | 7.2.DU-15 | Fieldset → `Radio.Group` (button) or `Segmented` | `items[0]` highlighted without `onClick`; throws on empty `items` (Q-068); V38 |
| 10 | 7.2.DU-08 | Select + advanced search → `AutoComplete` composite | Q-084 spread order; V24, V25; T-802 edge states (0, 1, 11 options, a long option, empty query) |
| 11+ | 7.2.DU-nn (owned) | re-point onto the replacements; then held deps per 02 §4, one PR each | DU-09 header search bar last: V21, V22, body-click menus (60 §6) |

**Interactive defaults.** Every antd prop with an interactive default is set explicitly to the design behaviour and listed in the unit's items: Image `preview`; Modal `maskClosable`, `keyboard`, `closable`; Select/AutoComplete `virtual`, `notFoundContent`, `defaultActiveFirstOption`, `showSearch`, `allowClear`; Popover `mouseEnterDelay`, `mouseLeaveDelay`, `arrow`; Card `hoverable`; Typography `ellipsis`, `copyable`; Input `allowClear`. Proof: the T-417 interaction census (incl. its overlay window-event clause), design vs antd, identical.

**Behaviour-equivalence checklist** (7.1 and 7.2; review:00 X80.4, X60.9):

| Item | Pinned by |
|---|---|
| Overlay below the header (z 10000): backdrop click over the logo navigates | Q-085; T-733 |
| Focus return; Esc only with focus inside; `hideManually` = no Esc, backdrop or X | Q-085; T-804, T-736 |
| Hover + focus triggers | 60 §6; T-737, T-805 |
| Collapsed header search per route | V23; T-727 |
| First provider-page search swallowed | Q-079; T-715, T-735 |
| Header blur submits only below 500 px on `/data-providers/` | Q-084; T-714 |
| Hook-order quirks (ExpandableList #310, SearchResult hooks in `.map`) | Q-047, Q-090; T-417 |
| SSR "Not a member yet" first paint, then flip | Q-087; T-412, T-734, V36 |
| Consent keyed on `essential_cookies_allowed` | Q-070; T-416, T-740 |
| `pointer-events:none` traps keyboard-reachable | Q-083; T-736 |

**Per-PR acceptance** (binary): (1) T-802 `IMPL=antd` 0 px vs the unit's baselines in the approved chain, all listed viewports (D5, D7); (2) checklist and unit items green with `IMPL=antd` and in the app, T-806, T-804, T-736 identical; (3) T-803 no new violation; (4) T-801 0 px; (5) T-701, T-728 no new event; (6) T-702 identical (T-412 for claim UI); (7) OD-49 via T-007, T-611; (8) T-805 probes: antd layered, overrides unlayered, `!important` only if a probe needs it; (9) T-605, T-728, T-417 and C4 DOM/class checks identical outside the unit's root, (b) inside (root and portals listed via 40 §8); behavioural attributes (40 §1) identical everywhere; T-417 behaviour checks unchanged; (10) static-API grep 0, one cssinjs copy, no design import of the unit left; (11) owner `SIGNED:` per component (X80.2); (12) on each 7.2 step head (01 §4 step 3a): `gate-s.yml` C4 N ≥500, whose per-URL aspects are (9)'s C4 checks, and the triggered C1-Q clause patches (55 §1).

Exceptions only for non-visual, non-behavioural items (a class token beyond (b)): an AD row with owner `SIGNED:`; behavioural attributes never. Pixel, ARIA, focus, keyboard, network and console diffs never are (M2; review:00 §4). Rollback: revert the step; the vendored unit stays until 7.F.

## 4. Forms (D3)

In 7.2.DU-07, one PR per form, antd `Form` + `Form.useForm()` replace design `Form`/`TextField`: claim (`templates/data-provider/claim/claim-modal.jsx`, `claim-modal-edit.jsx`, `sign-in-modal.jsx`), report (`templates/output/report/report-form-modal.jsx`), add-provider (`templates/data-providers/form.jsx`), update link (`templates/output/update/index.jsx`); `modules/filters/search.jsx` has `TextField` only (review:00 X80.7).
- The existing handler runs with the same arguments from `onFinish` or native `onSubmit`, whichever keeps today's timing; requests unchanged (T-702).
- No antd `rules`; validation and `<form>` attributes (e.g. `noValidate`) as today [VERIFY: antd `Form` output, T-605/T-806].
- All texts byte-identical; Enter-to-submit, disabled/loading states, focus after submit or error identical. Every form test submits twice, by clicking the visible submit control and by Enter, and asserts the E10/E16/E17 counts (41 §2.2).
- Tests: T-411, T-412, T-413, T-713, T-714, T-734, V11, V13, V36, V37 + §3 acceptance.

## 5. 7.F — Retirement (DV9) and L2

Entry: every 7.2 step DONE, 48 h watch over. Branch `upgrade/7f-retirement`, PRs in order:

1. Harness (40 §8): drop T-802 `IMPL=design`, T-417 package comparisons and T-016; baselines stay.
2. **CS-AN-4:** drop `legacyBehavior` (deprecated since Next 15.3; review:00 X20.7) at `templates/data-provider/pagination.jsx:72,87,101,115` (Anchor `<Link href={urlTo(` ×4), `templates/data-providers/result-card.jsx:20` (Anchor `<NextLink href=`): `Link` renders the one `<a>`, no `shallow`/`scroll` change. Proof T-406, T-407, T-702, T-801; the warning leaves the T-701 allow-list. Risks R-013, R-052.
3. **CS-AN-5:** replace next-images (`next.config.js:3,106`, Anchors `require('next-images')`, `withImages(`) by a webpack asset rule that behaves the same: inline below 8,192 B (default `inlineImageLimit`, `node_modules/next-images/index.js:11`), same extensions, output paths, string export; `images.disableStaticImages` stays (CS-N11-3). Proof T-005 (9 file URLs + 5 data URIs, same names), T-721, T-702, T-601, T-801 [VERIFY: file-name template]; its `serverRuntimeConfig` warning leaves the T-901 allow-list. Sets differ → stop, raise an OD (a `.src` codemod turns 5 data URIs into requests; review:00 X20.20). Drop `@mdi/svg` if still declared. Risks R-007, R-021.
4. **CS-DSN-7** (60): delete `vendor/oacore-design/`, the empty `styles/global/pending/`, design deps (02 §3 rows closing 7.F), the GitHub Packages token (S-3).
5. **CS-AN-6:** CI-1 guard (42 §10): `git grep -n -e '@oacore/design' -e "from ['\"]design" -- . ':!docs' ':!*.md'` = 0 hits, else red (R-075).
6. **L2 sweep** (the GATE-F sweep; its last commit sets Tr, 55 GATE-x.1): 02 §5 on every row; every row closing at 7.F or a 7.2 step reaches latest in its own PR with the full suite; antd and `@ant-design/*` only with T-802 + T-801 fully re-run (X80.2). After it no 02 row is EXCEPTION unless an owner-signed OD created before Tr covers it (GATE-F.13; 55 §4 (b)).
7. Only if OD-33 = P2: CSS Modules → global CSS, own PRs, T-003 sequence identical, T-801 0 px (R-086). Default P1: nothing.
8. OD-10 (Turbopack) re-evaluated after 7.F; no bundler change in 7.F.

Exit: GATE-F (55 §5).

## 6. Effort

pd, bottom-up (review:roadmap-process RP-19): 7.0 6–9 (incl. spike); 7.1 12–18; 7.2 30–48 (≈10 antd units × 3–5 + re-points); 7.F 6–10 (+8–12 if OD-33 = P2). Total 54–85 [VERIFY: 7.0 spike → VF-17]. Calendar: 50 §6.
