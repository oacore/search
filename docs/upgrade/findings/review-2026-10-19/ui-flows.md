# Review: ui-flows (pages, routes, UI states, journeys, preserved quirks)

Reviewer key: `ui-flows`. Subject: `search` @ f5cfc20 (app code), plan docs in `docs/upgrade/`.
Method: full read of `pages/ modules/ templates/ main/ hooks/ store/`, the design source `@qbit/design` (src + compiled lib), and then **I built and ran the baseline** to stop guessing:

- Scratch clone of the repo (APFS clone, `<scratch>/exp/ui-flows/app`), `next build` with Node 18.20.8 + `--openssl-legacy-provider`, `NODE_ENV=production BUILD_TARGET=azure APP_ENV=local`, Next 10.2.3 / webpack 4 (the repo itself was not touched). Only deviations from production: `API_URL` points at a mock, `csp.config.js` in the clone allows `127.0.0.1:*` in `connect-src`, the Dockerfile's `cp public/design/icons.svg public/icons.svg` + `public/images` step was replicated.
- Mock CORE API (`harness/mock-api.js`), SSR outbound stub for `doi.org` / `api.core.ac.uk/internal/*` (`harness/ssr-preload.cjs`), a gateway-equivalent proxy built from `kube/prod/httproute.yaml` (`harness/proxy.js`), Playwright driver (`harness/lib.js`, `e*.js`, screenshots in `harness/shots/`). Chromium headless shell was reused from the other reviewers' Playwright cache (read-only).
- Everything below marked **[RUN]** was observed in that baseline. **[CODE]** = read in code. **[UNCONFIRMED]** = depends on live API payloads or something I could not run.
- Caveat: fixtures are mine (the live API shape for `links[]`, `publishedDate`, `yearPublished`, `sourceFulltextUrls`, `doi` is **UNCONFIRMED**; api.core.ac.uk/docs returned HTTP 403 to a scripted fetch). Where a crash depends on a payload shape I say which shape.
- Process note: I ran `pkill -f "next start"` once while restarting my own server. That pattern may have also stopped another reviewer's `next start`. Their runs may need a restart.

Reproduce: `harness/` scripts are self-contained; start order = `mock-api.js 8000`, `next start -p 3180` (with `--require harness/ssr-preload.cjs`), `proxy.js 3181 3180` (gateway-faithful), `ALLOW_ALL=1 proxy.js 3182 3180` (for local-only pages).

---

## 0. Verdict

The V/J/Q catalogue is a good first draft and most of its claims survive. But the plan has **six defects that would make the Phase-2 suite red on the unchanged baseline or silently blind**, and a long tail of UI states and quirks that nobody has catalogued:

1. **T-708 / J6 as written cannot pass on the baseline.** After hydration the `<head>` of works/outputs pages is corrupted today (JSON-LD and almost all `citation_*`/`DC.*` tags are removed, `viewport`/`charset`/5 favicon links are duplicated). [RUN] (UI-01)
2. **The consent fixture is wrong.** The cookie popup is controlled by `essential_cookies_allowed`, not `analytics_cookies_allowed`. Every Playwright run and every pixel baseline that pre-sets only the analytics cookie would show the banner. [RUN] (UI-02)
3. **The GA contract in T-719/J17 is wrong.** `ReactGA.send({hitType:'search'})` is a no-op that logs `Send command doesn't exist: search` on every load and every client navigation; there are no SPA page-view hits. [RUN + react-ga4 source] (UI-03)
4. **At least 4 server-render 500 paths and 5 post-hydration blank-page paths exist** that are not in the quirk register (e.g. `publishedDate:null` + numeric `yearPublished` -> 500; an output without a DOI on a works page -> blank page). They are fixture-driven and must be in the fixture matrix, or the baseline silently excludes them. [RUN] (UI-04, UI-05)
5. **Every works/outputs page has a nested `<a>` in `<a>` in SSR HTML** (the "Full text" card renders as `<a>`). The browser parser hoists the inner anchors; React 17 silently repairs it, React 18/19 will report a hydration error. Not in R-010/Q-050/Q-051. [RUN] (UI-06)
6. **Test recipes contain wrong selectors and wrong assumptions** (result card id, header covering by modals, `Next` unclickable by mouse, `/error-card/` and `/` not routed by the gateway, `search=` back-link broken even on the happy path). (UI-07, UI-08, UI-11, UI-13, UI-16)

The remaining sections give the corrected catalogue (routes, visual states, widths, journeys, quirks with test IDs) and the answers to the README §8 UI `[VERIFY]` items.

---

## 1. Routes: corrected table

Measured through the gateway-faithful proxy [RUN] unless noted.

| URL | Gateway-reachable in prod? | Result today |
|---|---|---|
| `/` , `/error-card/`, `/404/`, `/api/healthz/` | **No.** `httproute.yaml` routes only `/search`, `/works`, `/outputs`, `/data-providers`, `/static/search`, `/display`. `/` is another app; healthz is probe-only (in-cluster). | `/error-card/` is **not a public route in prod** (Q-005 says "public route"; true only locally / pod-direct). Pod-direct is also not functional for assets (`/static/search/_next/...` 404 without the gateway rewrite), so even the local-only pages need the proxy. |
| `/search` | yes | 308 -> `/search/` |
| `/search/` (no query) | yes | 308 -> `/` (confirmed: not 301) |
| `/search/?q=climate` | yes | 200, `<title>Search CORE</title>` |
| `/search/foo/`, `/works/`, `/outputs/`, `/display/` | yes (prefix match) | **404 "Uh-oh"** page (default title) |
| `/works/:id/` | yes | 200; API 404/410 -> **200** "Uh-oh" (Q-001); `dataProviders:[]` -> **500** (new); some payloads -> **500** (new, UI-04) |
| `/outputs/:id/` | yes | same; no-download + `sourceFulltextUrls:null` -> **500**; key absent -> **500**; `publishedDate:null`+numeric year -> **500** |
| `/outputs/update` | yes | 308 -> `/outputs/update/`; static route wins over `[id]` |
| `/display/:id/` | yes, URLRewrite -> `/outputs/:id/` | **in place** (URL stays `/display/...`); `/display/5001` (no slash) -> **308 to `/outputs/5001/`** (URL changes) |
| `/data-providers/` | yes | 200; `?q=100%25` -> **500** (Q-028) |
| `/data-providers/:id/` | yes | 200; unknown id or any API error -> real **404** "Uh-oh" |
| `_error` (any SSR throw) | - | Next's default `_error` rendered **inside** the layout: header (no search bar) + centered "An unexpected error has occurred." (no status code shown because `_app.getInitialProps` never calls `App.getInitialProps`), `<title>: An unexpected error has occurred`. Not in 07's route table. |

Static asset base: `/static/search/_next/...` stripped by gateway. `/search/_next/data/<build>/...json` is what client navigations fetch (confirmed through the proxy: `data reqs 3` for filter+back+forward, `window.__marker` survived).

---

## 2. Visual-state catalogue (corrected and complete)

Keep V1-V18 from 07 §5 (V19 print: **confirmed none**, no `@media print` in search or the used design CSS; V20 dark/contrast: none). Add the states below. Priority: **P0** = before any wave, **P1** = before the wave that touches it, **P2** = nice to have. "Pre" = JS-disabled / pre-hydration capture.

### 2.1 Corrections to existing V rows

| V | Correction |
|---|---|
| V1 | Capture **both** pre-hydration and post-hydration: SSR HTML has **no header search bar** (`useSearchBar` configures in an effect) and an **empty filters `<ul>`**; post-hydration shows LoadingBlock then facets. Member card is random -> mask or 1-member fixture (as 07 says). |
| V4 | Toast "Link copied" disappears at 2.5 s (confirmed). CSV modal has **no close X, ignores Esc and backdrop** (`hideManually`). Default highlighted radio = "Current page". Add the "reopen after Top 100" state (UI-12). |
| V8 | Fixtures must include: a normal work whose **every output has a DOI** (an output with `doi:null` blanks the page, see V-crash). Add the empty **"View on"** outline button (no href, no name) that shows on works without arXiv/PubMed link (UI-12). |
| V9 | Capture `/outputs/ID/` **and** `/display/ID/` (breadcrumb differs post-hydration, UI-07) and `?source=oai` (OAI box, closes on outside mousedown, not on Esc, sits at z-index 10001 over the header). |
| V11 | The modal backdrop **does not cover the header** (header `z-index:10000` > overlay `1030`) and not all of the "Available Versions" card. Screenshots must include the header region and must not be masked. |
| V15 | Matrix is not "member / non-member": see V-dp below (accounts x billing x SSR-vs-final). |
| V17 | Too coarse. Split into header (with/without search bar, collapsed icon, menus, hamburger) and footer, see V21-V25. |
| V18 | Cookie popup: fixed bottom bar, `animation: fade 1s`, wraps at <=950 px; hidden only by `essential_cookies_allowed`. |

### 2.2 New states

| ID | State | Route(s) | Priority | Widths | Notes |
|---|---|---|---|---|---|
| V21 | Header menus open (Services / Support us / About) | all | P1 | 1440, 1920, 768 | Design `Header` `Menu`; outside click on `document.body` closes. Vendoring must keep it. |
| V22 | Header hamburger expanded (alone, and with Filters open) | all | P1 | 375, 767 | At 375 + Filters open the nav overlays the filters bar (screenshot observed). |
| V23 | Header search affordance matrix: input visible (`/search`, `/data-providers/`), **collapsed magnifier icon** -> click -> input (`/works`, `/outputs`), **none** (`/outputs/update`, `/data-providers/:id`, `/404`, 500, `/error-card`) | per route | P0 | 1440, 375 | Search bar appears only after hydration. `Header.useSearchBar` cleanup removes it on client nav. |
| V24 | **"How to search?" advanced-search panel** open (+ the info icon while focused) | `/search` | P0 | 1920, 1440, 767, 375 | Rules at `93rem`=1488 px and 767 px in `advanced-search.css`. 4 prefill buttons (`search by doi/title/oai/issn`). Missing from V and J entirely. |
| V25 | Suggestions list open | `/data-providers/` | P1 | 1440, 375 | max 10 items, keyboard Arrow/Enter. |
| V26 | **Scrolled** page: sticky header (z 10000) + **fixed** filters bar (z 11, no `top`) over results | `/search` | P0 | 1440, 375 | `fullPage` screenshots cannot capture sticky/fixed behaviour. Take a viewport screenshot at `scrollY` 900. |
| V27 | Scrolled work/output page (sticky header over content) | works/outputs | P1 | 1440, 375 | |
| V28 | **Pre-hydration (JS disabled) snapshots** | R2, R3, R4, R7, R6 | P0 | 1440, 375 | Different from final: empty filters bar, no header search, claim card "Become a member" + badge "Not a member yet" (dp 83), DOI list empty, hoisted nested anchors, `/display` breadcrumb. These are what crawlers and slow clients see. |
| V29 | Tooltips (Tippy): "Download results in CSV", "Copy url" (hover **and focus**), disabled "Download from data provider" (placement right), OAI ellipsis tooltip | R2, R3/R4 | P1 | 1440 | |
| V30 | `/display/:id/` post-hydration (trail reduced to "Search results") | alias | P1 | 1440 | |
| V31 | **500 page** (Next `_error` inside layout) | via fixture | P1 | 1440, 375 | Trigger fixtures in UI-04. |
| V32 | **Blank-page states** (`#__next` empty after hydration; SSR HTML intact): works with output without DOI; works with >=5 distinct DOIs (React #310); provider without `location` (Invalid LatLng); similar works with `dataProviders:[]`; year facet opened with empty year aggregation | R3/R4/R2 | P0 (assertion), P2 (screenshot) | 1440 | Assert `#__next` text length 0 + pageerror/console signature + request log. One screenshot is enough. |
| V33 | Facet boxes: Field (wide, scroll), Author (long), Language (code with no name), Publisher; year box with 0 / 1 / many buckets; selected states | R2 | P1 | 1440, 375 | Mobile facet boxes are absolute / full width. |
| V34 | Overflow states: horizontal page overflow at **501-533 px** (`scrollWidth` 534 at 501; pagination `siblingCount` 2) and at **320 px** (346) | R2 | P1 | 501, 320 | Baseline quirks, do not "fix". |
| V35 | Data-provider page output-error state: " research outputs found" (empty total), placeholder `Search over undefined research outputs in X`, pager "Showing 91-100 of 95" (beyond total), `offset=abc` -> "Showing a lot of-a lot of of 95" | R7 | P1 | 1440 | See Q-080..Q-082. |
| V36 | Data-provider **claim matrix** (SSR vs final): see table in §6 | R7 | P0 | 1440, 375 | |
| V37 | Data-providers list: map with clusters, "Load more" (size 10 -> 20), zero results + add form, add-form states (progress, success, duplicate 409, error), invalid URL | R6 | P1 | 1440, 375 | popup link has `target=_blank`. |
| V38 | Fieldset in modals at <=767 px (CSV, Report form): the only used design CSS that depends on search's `@custom-media` | R2, R4, R5 | P0 | 767, 375 | `lib/elements/fieldset/fieldset.css:44` still contains `@media (--screen-until-desktop)`; search's PostCSS resolves it (built CSS has `@media (max-width:767px)`). Breaks silently if postcss-custom-media/`importFrom` is replaced or the copy lands in a pipeline without it. |
| V39 | Math rendering (KaTeX) in titles/abstracts, long title wrap, 30-author "+N more" collapsed/expanded | R2, R3, R4 | P1 | 1440, 375 | MathMarkdown renders only KaTeX, **not markdown** (`**x**` stays literal), contrary to 07 §1.3 / F15. |

---

## 3. Viewport widths to capture

Computed from every breakpoint that actually applies (search CSS, compiled design CSS actually loaded, JS):

| Width | Why |
|---|---|
| **1920** | `>=1489 px`: design header/advanced-search rule `(max-width:93rem)` stops applying; footer `85rem`=1360 stops. 1440 does **not** cover it. |
| **1440** | main desktop (header rule `<=1488`). |
| 1280 | `foundation/layout.css` `max-width:80rem`. |
| 1024 | mid desktop sanity. |
| **768** | page switches to desktop at >=768; design header `up` = `min-width:768`, `down` = `max-width:768` (both match at 768). |
| **767** | `--screen-until-desktop` (`max-width:767px`): mobile layout, filters collapse, sidebar `display:contents`, member card hidden; design Select/advanced-search 767. |
| 600 / 561 / 560 | design header `max-width:35rem`=560; >560 tablet-mobile. |
| **501 / 500** | JS: `siblingCount = width>500 ? 2 : 0`; observed horizontal overflow at 501 (534 px). |
| 360 | footer `22.5rem` (360). |
| **375** | main mobile (390x844 optional). |
| 320 | smallest; overflow 346 px. |
| 950 | cookie popup action wrap (only visible when consent missing). |
| orientation: portrait | map aspect (`padding-bottom:100%`); every phone-sized capture is portrait, add one landscape 812x375 for a map page. |

Recommended strategy (cost control, M5 wants measurable): **full state matrix at 5 widths** (1920, 1440, 768, 767, 375), **width sweep of the 12 other widths on two light shells** (`/outputs/update/` = header+footer+static content, no API; `/search/?q=climate` = header search, filters, pagination), plus the P0 states in §2 at 375. Pointer vs `hover`: no `@media (hover)` / `prefers-*` in the code (confirmed), so no extra media-feature runs.

---

## 4. Journeys: corrections to J1-J17 and additions

### 4.1 Corrections

| J | Correction |
|---|---|
| J1 | OK. Header input value stays (confirmed). `q` is unencoded in some pushes (`a&b c++` -> `q=a`, extra param `b c  `) [RUN]. |
| J2 | OK, confirmed incl. Back (pills cleared, `Clear all filters` hidden, `window.__marker` survives, aggregate API calls 1+1+1+1). Add: facet box stays open after selecting. |
| J3 | Default year ranges Since 2018/2016/2014, upper bound = `maxYear` of data. Add the **empty-year-aggregation crash** and the **single-bucket** state (no Histoslider). |
| J4 | Add: **`Next` on the last page is reachable only by keyboard** (`.pagination-item-disabled{pointer-events:none}`; Playwright `click()` times out; Tab+Enter pushes `page=26`) [RUN]. The active page button is also `pointer-events:none`. Current page 25 of 25 shows the word **"last"** (not 25). Scroll goes to 0 on every non-shallow push [RUN]. |
| J5 | **Wrong landing page.** Result title links are `links[type=display].url` (absolute `https://core.ac.uk/...`) + `/?t=<searchId>-<id>&search=<raw asPath query>`; plain `<a>` = **full page navigation**, not client nav. E2E must serve fixture `links[].url` from the proxy host (or stub `core.ac.uk`) or the test leaves the site. Author links are relative `/search?q=author:(Smith, John)&t=...` (full nav + 308). The "Search results" back-link on the landing page is **broken even on the happy path** (UI-07). |
| J6 | See UI-01: split into **J6a pre-hydration head** (complete: citation_*, DC.*, JSON-LD) and **J6b post-hydration head** (corrupted today). |
| J7 | Cite: dialog has no `aria-label`; focus lands on the Close button; Esc closes **only if focus is inside** (after clicking the non-focusable copy icon focus is `body` and Esc does nothing) [RUN]; backdrop click closes; `body.style.overflow` is `hidden` while open and `unset` afterwards; focus returns to "Cite". |
| J8 | "Open in the Core reader" has no `target`; "Download PDF" anchor has no `href` (transient anchor). Confirmed in SSR HTML. |
| J9 | CSV: closes immediately after Download; **reopen shows "Current page" highlighted but sends the previous choice** (UI-12). Copy URL expected value confirmed `https://core.ac.uk/search/?q=climate`. |
| J11 | Report modals are all `hideManually`: **no Close X, Esc and backdrop do nothing** [RUN]. Step 2 shows "Repository manager" highlighted while `report.role` is null; Submit disabled and Name/Email hidden until any role box is clicked [RUN]. Body shape confirmed: `{"outputId":5001,"name":"Jane","email":"jane@example.org","message":"please update","updateOption":"issueWithContent","role":"author"}`. **"got it" never triggers a soft refresh** (UI-12). |
| J12 | **Title never gets a query prefix** and the header search input is **empty on `?q=` loads** (UI-12). Marker popups have `target=_blank`. Initial URL is rewritten to `?q=&size=10` after load. |
| J13 | **The first search on the provider page is swallowed** (UI-12). Header badge/claim card flip after hydration (§6). |
| J14 | Add 500 matrix and 404 for `/search/foo/`, `/works/`. |
| J16 | Add the 501/320 overflow and 767/768 boundary. |
| J17 | Re-specify (UI-02, UI-03). |

### 4.2 New journeys

| ID | Journey | Priority | Test |
|---|---|---|---|
| J18 | Advanced search: focus input -> "How to search?" / info icon -> panel -> click "search by doi" -> input becomes `doi:" "` and stays focused -> close X / outside | P0 | T-725 |
| J19 | Header menus (3) + hamburger on mobile, outside click closes | P1 | T-726 |
| J20 | Collapsed search on works/outputs: icon -> input -> type `a&b c++` -> Enter -> URL `/search?q=a&b c++` (unencoded) | P1 | T-727 (extends T-420) |
| J21 | Facet variants: search-in-facet, multi-select, language code with no name, year via select / histogram / quick range | P1 | T-704/T-705 extend |
| J22 | `/display/:id/` alias (308 without slash; in place with slash; breadcrumb flip; Report modal; client nav) | P1 | T-732 (extends T-723) |
| J23 | SSR failure matrix (500 / soft-404 / 404) through fixtures in UI-04 | P0 | T-731 |
| J24 | Blank-page family (V32) with `pageerror` signature | P0 | T-730 |
| J25 | Provider page claim matrix + modals: SIGN IN (new tab) / CREATE ACCOUNT -> edit modal -> empty Continue focuses a field -> valid -> success (text depends on accounts/newEmail) | P0 | T-734 (T-412 extends) |
| J26 | Provider page search (first change swallowed), pager (Prev no-op, Last beyond total), sort (pushes `sort=relevance` for "recent"), request counts | P1 | T-735 |
| J27 | Data-providers add form states | P1 | T-714 extends |
| J28 | Consent flows: popup shown; "Essential cookies only" sets only `essential_cookies_allowed`; "I agree" sets both; no GA until reload | P0 | T-740 (replaces T-416 fixture assumption) |
| J29 | Keyboard-only: Tab order, Esc per modal, focus return, last-page Next, tooltips on focus | P1 | T-736 (extends T-804) |
| J30 | JS-disabled rendering per route | P0 | T-728 |
| J31 | Tooltips (hover/focus) | P2 | T-737 |
| J32 | Map on R6: zoom/cluster click/marker popup (`target=_blank`) | P1 | T-714 |

---

## 5. Quirks to add / correct (proposed Q-069+), with test IDs

Class: PRE = PRESERVE, WATCH = PRESERVE (watch), ESC = ESCALATES candidate. All **[RUN]** unless noted.

| New ID | Quirk | Where | Class | Test (existing / new) |
|---|---|---|---|---|
| Q-069 | **Post-hydration head corruption on works/outputs**: JSON-LD + `citation_*`/`DC.*`/`DCTERMS` removed, `viewport`/`charset`/5 favicons duplicated. Cause: `<Meta>` is a function component inside `next/head`; Next's client head manager only tracks host elements and `next-head-count`. SSR HTML is complete (what no-JS crawlers see). | `pages/works/[id].jsx:143-146`, `pages/outputs/[id].jsx:127-130`, `modules/meta/index.jsx:143-149` | PRE + owner decision (SEO, D1a) | T-602 (pre), **T-729 (new, post-hydration baseline)**; replaces T-708 expectation |
| Q-070 | Cookie popup keyed on `essential_cookies_allowed`; "Essential cookies only" sets only it; "I agree" sets both; attrs `path=/`, `Max-Age` 1 year, no `Domain/Secure/SameSite/HttpOnly`, value `"true"`; consent given after mount applies on next load | design `src/elements/cookies/cookies.jsx:11-13`, `src/hooks/use-cookies.js:55-84` | PRE | T-416, **T-740** |
| Q-071 | `ReactGA.send({hitType:'search'})` is a no-op + `console.warn("Send command doesn't exist: search")` on first load and every `routeChangeComplete`, consent or not. Only `gtag('config')` produces the initial page view (consent + prod). No SPA page views. | `hooks/use-analytics.js:10-16,33`, `node_modules/react-ga4/dist/ga4.js:295-315` | PRE (WATCH for react-ga4 3) | T-305, T-719 (re-specified), **T-741 console baseline** |
| Q-072 | "Full text" sidebar card renders as `<a id=full-text-thumbnail-ID>` (the `tag` prop is spread into design `Card`) and contains `<a>` buttons / OAI links. Browser parser hoists the inner anchors (JS-off DOM: 0 anchors inside; hydrated: 2); React 17 repairs silently. | `templates/output/index.jsx:225`, `templates/output/thumbnail-card.jsx:41-45`, design `Card` `tag` | **ESC (React 18)** | T-701 allow-list, T-417, **T-728** |
| Q-073 | **SSR 500 triggers**: (a) output with no `download` link and `sourceFulltextUrls` `null` (`.length` of null) or absent (`url.match`); (b) `publishedDate:null` + numeric `yearPublished` (`formatCitationDate(2020)` -> `date.split`); string year gives `citation_publication_date="2020/NaN/undefined"`; (c) work with `dataProviders:[]` (`dataProvider.name/logo`); (d) `/data-providers/?q=100%25` (Q-028). Page = Next `_error` inside layout, status 500. | `templates/output/card-dropdown.jsx:18,80`, `modules/meta/index.jsx:21-32`, `pages/works/[id].jsx:78`, `templates/output/index.jsx:212-213` | PRE | T-601, T-602, **T-731** |
| Q-074 | **Post-hydration blank page** (ErrorBoundary without fallback unmounts everything; `#__next` empty): (a) works with an output whose `doi` is `null`/undefined (`item.doi.toLowerCase()` in effect); (b) works with work DOI + >=4 distinct output DOIs (ExpandableList 0 -> >=5 children changes hook count, React #310); (c) provider without `location` (`Invalid LatLng object`); (d) similar-works result with `dataProviders:[]`; (e) year facet opened with empty / out-of-range year aggregation (`yearsAxis[0].y`). Head tags are also stripped on unmount (V32). | `templates/output/index.jsx:65-71`, design `expandable-list.jsx:29-40`, `modules/map/map.jsx:24-30`, `templates/output/similar-works.jsx:53`, `modules/filters/year/index.jsx:40` | PRE (extends Q-047, Q-058, Q-064) | **T-730** |
| Q-075 | `/display/:id/`: server renders the outputs breadcrumb "Search results > Research output from X"; client `asPath` is `/display/...`, so after hydration only "Search results" remains. `/display/:id` (no slash) 308s to `/outputs/:id/`. | `templates/output/index.jsx:81-82`, `kube/prod/httproute.yaml` | PRE (R-010 candidate) | T-723, **T-732** |
| Q-076 | "Search results" back-link is wrong even with `search=` present: SSR `asPath` is re-encoded by Next (`search=q%3Dclimate`), link becomes `https://core.ac.uk/search/?q%3Dclimate&page=2` (param named `q=climate`, empty value); hydration does not patch attributes. Without `search=`: `?ts/5001/` (Q-046). | `templates/output/index.jsx:83-86` | PRE (amends Q-046) | T-419, T-707 |
| Q-077 | CSV modal: reopening shows "Current page" highlighted (Fieldset resets to `items[0]`) but `search.activeLimit` keeps the last choice, so Download sends the old limit. | `design Fieldset index.jsx:11-13`, `store/search.js:31,70`, `download-results.jsx:35-38` | PRE | T-409 |
| Q-078 | Report form: "Repository manager" is highlighted at mount, but `report.role` stays `null`; Submit disabled, Name/Email hidden until a box is clicked. | same Fieldset, `store/report.js:15`, `report-form-modal.jsx:69,122` | PRE | T-411/T-713 |
| Q-079 | Provider page: **the first search is swallowed** (`isInitialised` guard consumes the first user-initiated change); the second works; `q` + `offset=0` pushed; re-submitting the same trimmed value is ignored. | `templates/data-provider/search.jsx:12-19`, `pages/data-providers/[id].jsx:44-55` | PRE | T-715/**T-735** |
| Q-080 | `/data-providers/`: page reads `params.query` but the schema key is `q` -> `query` is always `undefined`: `<title>` is always "Data providers search" (never "q - Data providers search"), header input empty on `?q=` loads while results are filtered. | `pages/data-providers/index.jsx:36,85,129`, `store/data-providers.js:5` | PRE | T-714, T-722 |
| Q-081 | Works page always renders an empty **"View on"** outline button (no href/name) when no arXiv/PubMed link: `Object.values(...).some(v => v !== null)` is true for `undefined` values. [CODE+RUN with fixture lacking those link types; live shape UNCONFIRMED] | `pages/works/[id].jsx:79-83`, `templates/output/index.jsx:173-185` | PRE | T-702 DOM snapshot, V8 |
| Q-082 | Takedown "got it" never soft-refreshes: compares `router.asPath === '/outputs/ID'` but `trailingSlash:true` makes asPath `/outputs/ID/`; no `_next/data` request after "got it". 07 §2.11 says the refresh happens. | `report-success-modal.jsx:30-34` | PRE | T-713 (assert no navigation) |
| Q-083 | Pointer-events traps: `Next` (last page), active page, disabled facet items, active sort item, data-provider disabled arrows all have `pointer-events:none`; JS handlers are unguarded so only keyboard/forced clicks fire. Amends Q-044/Q-045. | `templates/search/styles.module.css:73-82`, `modules/filters/styles.module.css:87-90,105-108`, `templates/data-provider/styles.module.css:192-197` | PRE | T-405, T-406, T-736 |
| Q-084 | `/data-providers/` header search: blur submits only at width < 500 (computed `changeOnBlur`); on `/search`, `/works`, `/outputs` the page's explicit `changeOnBlur:false` overrides it at every width (JSX spread order) [RUN: 499 submits on R6; none on R2 at 375/499/1440]. 07 §2.1 implies width dependence for all. | design `search-bar.jsx:131-137` | PRE | T-714 |
| Q-085 | Modal layering and keyboard: header (z 10000) is above the modal overlay (z 1030) and stays clickable (backdrop click over the logo navigates); Esc closes only when focus is inside; `hideManually` modals (CSV, 3 report, success) ignore Esc/backdrop and have no Close X; `body.style.overflow` ends as `unset` not the original; `aria-label` duplicated on overlay+dialog or absent (Cite). | design `modal.jsx:44-75`, `modal.css`, `header/styles.css` | PRE | T-804, T-733 |
| Q-086 | JSON-LD injection is **executable XSS** (title `</script><script>window.__PWN=1</script>` ran in the prod build; CSP `script-src-elem` has `'unsafe-inline'`). Amends S-4 ("breaks out of the tag"). Fixture W-unicode must be sandboxed in tests. | `modules/meta/index.jsx:131-141` | PRE (security, owner) | T-602 (assert marker set) |
| Q-087 | ClaimCard: SSR always renders "Not a member yet" + "Become a member" for providers with accounts; after hydration flips. Fetch counts on one direct load: accounts>0 -> 1 SSR + **2** browser GETs; accounts=[] -> 1 SSR + **1** browser GET (render-time fetch, parent state update re-renders once). Header badge depends on accounts, not on billing. | `claim-card.jsx:104,114,154`, `templates/data-provider/index.jsx:95-108` | PRE (extends Q-027) | T-412 pins 2/1 browser GETs (+1 SSR) |
| Q-088 | Sticky header + fixed filters bar layering, overflow at 501-533 / 320 px (§2). | `modules/filters/styles.module.css:2-8` | PRE | T-738/T-739 |
| Q-089 | Duplicate ids in the DOM: `about-title` x2 on every page (design Header), `author` x N and `doi` x N (ExpandableList.Items), `data-provider-webpage-title` x N (R6). | design `header.jsx`, `metadata.jsx:21,53` | PRE (axe baseline) | T-803 |
| Q-090 | `checkLogo(id, null)` -> `fetch(API_URL + 'null')` (`GET /internalnull`) for member providers without a logo on `/data-providers/:id`. SearchResult/DropDown additionally fetch `https://api.core.ac.uk/data-providers/{id}/logo` per member result in the **browser** (hooks inside `.map`). | `utils/data-providers-transform.js:21-29`, design `search-result.jsx:85-113` | PRE | T-702 network contract |

---

## 6. Data-provider page: SSR vs final decision table [RUN]

| accounts API | `billingType` | Header badge (final) | Claim text / buttons (final) | SSR HTML |
|---|---|---|---|---|
| `[{...}]` (dp 83, supporting) | supporting | "Supporting member" | "Do you manage {name}? ..." SIGN IN + CREATE ACCOUNT | "Not a member yet" + BECOME A MEMBER |
| `[]` (dp 2, starting) | starting | "Not a member yet" | "Do you manage {name}?" SIGN IN + CREATE ACCOUNT | same as final |
| `[]` | supporting/sustaining | "Not a member yet" | hard-coded "Do you manage Open Research Online?" + Become a member | same |
| `[]` | null | "Not a member yet" | same Become a member | same |
| 401/500 | any | as `[]` | as `[]` | as `[]` |

Never use "member / non-member" fixtures only. Create-account flow: empty Continue calls `getElementById(id).firstChild.focus()` (works because `TextField` Group `id` has the control as first child when no `statusIcon`). `ClaimModal` is unreachable (`setIsClaimModalActive` is only ever called with `false`).

---

## 7. README §8 "UI items from findings 07": answers

| Item | Answer | Evidence |
|---|---|---|
| Which of `citation_pdf_url`, `DC.format`, `DC.issued`, `DC.identifier`, `DC.subject` present? Fallback to `year`? | Absent unless the API payload has literal keys `downloadLink`, `year`, `oai`, `subjects` (pages pass the raw object + `findUrlsByType` keys, none of those names). SSR with my fixture: only `citation_title`, `citation_author` x N, `citation_publication_date`, `DC.creator` x N, `DC.title`, `DCTERMS.abstract`, JSON-LD. `year` is never defined because pages already substitute `publishedDate || yearPublished`; numeric year -> **500**; string year -> `2020/NaN/undefined`. Live payload keys **UNCONFIRMED**. | `modules/meta/index.jsx:3-38`, `pages/works/[id].jsx:70-72`; [RUN] curl of `/works/1001/`, `/outputs/3007-3009/` |
| `</script>` in title/abstract vs JSON-LD? | Breaks the JSON-LD **and executes injected script**. | [RUN] `/works/1004/` -> `window.__PWN === 1` |
| `LinkedData` crash if `dataProvider` undefined? | Yes, but the Template also dereferences it first; result is HTTP 500. | [RUN] `/works/4200/` -> 500 |
| Data-provider sort resets `offset`? | No. Pushes `{...Router.query, sort, page:1}`; `offset` kept; "recent" pushes `sort=relevance`. | `store/search.js:92-104` [CODE] |
| Disabled filter items still fire clicks? | Not with a real pointer (`.disabled{pointer-events:none}`); the handler has no guard, so `dispatchEvent`/`force` fires. Same for active sort item. | `modules/filters/styles.module.css:87-90` |
| `router.push` scrolls to top? | Yes for non-shallow pushes (default `scroll:true`); shallow pushes (`/data-providers` URL sync) do not. 1500 -> 0 observed. | `next/dist/next-server/lib/router/router.js` (`forcedScroll\|\|(isValidShallowRoute\|\|!options.scroll?null:{x:0,y:0})`), `client/index.js:80`; [RUN] |
| Result title click full or client navigation? | **Full navigation**: plain `<a href>` to an absolute URL from `links[type=display]`. | design `search-result.jsx:132-135` + SSR HTML |
| CSV default radio? | "Current page" (first item highlighted by Fieldset effect; `activeLimit` 10). Esc/backdrop do nothing. | `Fieldset index.jsx:11-13`; [RUN] |
| Similar works with empty provider array? | Crashes (TypeError `id` of undefined) -> blank page. API error -> LoadingError; `[]` results -> heading only + "No results" in Related searches. | [RUN] |
| Map with provider lacking location? | Throws `Invalid LatLng object: (undefined, undefined)` -> blank page. | [RUN] `/outputs/3006/` |
| ClaimModal unreachable? | Yes. | `claim-card.jsx` grep: `setIsClaimModalActive` never called with `true` |
| Line of the DOI-list effect (Q-062)? | **`templates/output/index.jsx:65-71`** (state at `:51`); `metadata.jsx` only renders. The effect also crashes at `:68` for `doi:null` outputs. | [CODE+RUN] |
| Exact cookie attributes | See Q-070. | [RUN] |
| Header search placeholder in fallback mode | Confirmed "Search more than 356 million from papers around the world". | [RUN] |
| Is `ClaimCard`'s fetch bounded? | Yes: per direct load 1 SSR + 2 browser GETs when accounts exist, 1 SSR + 1 browser GET when none. | [RUN] `e23.js` |

---

## 8. Test-recipe corrections (07 §8, 40 §2.5/§2.6/§7)

1. **Consent fixture:** pre-set `essential_cookies_allowed=true` (value `true`, path `/`). Add `analytics_cookies_allowed=true` only for the GA test. Setting only the analytics cookie leaves the popup visible and changes every screenshot.
2. **Selectors:** result card id is `work-search-output-{id}` (design `SearchResult` prefixes `work-`), similar card `work-similar-output-{id}`; `#metadata-authors` does not exist (`#metadata-authors-title`); `#doi` appears only after hydration and `id="author"`/`id="doi"` are duplicated per item; `#data-provider-url` is the wrapper (`#data-provider-url-control` is the input); header input is `#select-app-bar-search`; `#about-title` is duplicated in the header on every page. Labels of the pure `Select` can intercept pointer events (R6 header input): use `focus()` or click the label.
3. **Visible text vs DOM text:** many labels are CSS-transformed (`capitalize`, `uppercase`: "Research", "SIGN IN", "Sort By Recent", "ESSENTIAL COOKIES ONLY"); assert with DOM text or `{exact}` locators.
4. **Hostile click targets:** sticky header (z 10000) and the fixed filters bar intercept clicks on elements scrolled under them; `pointer-events:none` on `Next`/active/disabled items (Q-083); modal overlay does not cover the header (Q-085).
5. **Waiting:** treat pre-hydration state as a state. Wait for header search bar, filters (`ul` populated), claim-card flip (network idle on `/internal/data-providers/ID/account`), DOI list, `document.fonts.ready`, KaTeX.
6. **Console allow-list (baseline, prod build):** `warn: Send command doesn't exist: search` (every load and route change); `log: GA` (consent only); `log: Takedown outputId => N`; `log: Copying to clipboard: ...`; `log: {...claim response}`; `error` from `fetchFilters` on API failure; LogRocket warns if its CDN is blocked. React hydration mismatches are **silent in React 17 prod**, so the console gate cannot detect Q-072/Q-075 today: use DOM comparisons (no-JS DOM vs hydrated DOM).
7. **External hosts the browser contacts** (route-stub all): `core.ac.uk/image/*`, `core.ac.uk/images/document-placeholder.svg`, `api.core.ac.uk/data-providers/{id}/logo` (one per member result), `*.tile.openstreetmap.org`, `cdn.lgrckt-in.com` (LogRocket), `www.googletagmanager.com` (consent), plus any absolute `links[].url` the fixture contains. SSR also calls `doi.org` (citations) and `api.core.ac.uk/internal/{statistics,repositories/formap,members}` (loaders, 3 s timeout): the SSR stub must answer these or every SSR request pays up to 3 s.
8. **Harness facts:** `public/icons.svg` and `public/images/*` only exist after the Dockerfile `cp` steps; `build:test` must replicate them (or icons 404). Prod CSP blocks a local mock origin in `connect-src` (APP_ENV=local needs a CSP override), which conflicts with T-603 "CSP parity": use `APP_ENV=production` + `page.route` for the browser, as 40 §2.5 already says; 07 §8.1's `APP_ENV=local` recipe is the wrong choice.
9. **Pod-direct URLs do not work** (assets are under `/static/search/`): every Playwright test, including the local-only pages (`/error-card/`, `/404`), needs the gateway proxy with an extra allow rule for those routes (keep the main proxy gateway-faithful so `/error-card/` correctly 404s there).
10. **Dates:** `publishedDate` format decides Q-050. A zone-less `2020-05-01T00:00:00` renders the same in SSR and every browser TZ (no hydration mismatch); date-only / `Z` / offset values do not. Sample the live API once and record the format in the fixture README; if zone-less, Q-050 is moot for results/dropdowns.

---

## 9. Where the plan docs must change (summary)

- `findings/07` is "not edited" by policy; its corrections belong in `README.md §7 errata` (add: breadcrumb/J5, cookie, GA, selectors, route reachability, Q-045 click, J11 refresh, J12 title, J6 head).
- `30-quirks-register.md`: add Q-069..Q-090 (or merge), amend Q-005, Q-027, Q-044, Q-045, Q-046, Q-047, Q-058, Q-059, Q-062, Q-064, S-4.
- `40-test-strategy.md`: T-416/T-719/T-305/T-708/T-723/T-801/T-804/T-602 rewritten as in §4-5; new T-725..T-741; §2.5 proxy rules; §7 determinism (cookie, clock, hover); V list in T-801 must be the §2 catalogue.
- `10-risk-register.md`: add risks for nested anchors (React 18), head corruption across Next versions, `react-ga4` 3 `send` semantics, Fieldset custom-media dependency, hydration of display alias.
- `90-open-decisions.md`: OD for Q-069 (post-hydration head: preserve corrupted state or fix as D1a SEO) and Q-086 (XSS, outside upgrade scope).
- `60-design-copy-plan.md`: vendored copy must preserve: Header menus, AdvancedSearch, Select `searchBarProps` spread order, Modal z-index/overflow/focus-lock behaviour, Cookies keyed on `essential_cookies_allowed` + cookie options, Fieldset's reliance on host `@custom-media`, Card `tag` pass-through, ExpandableList hook order, SearchResult's per-card logo fetch + hooks-in-map.


---

## 10. Findings index (structured return)

UI-01 head corruption after hydration (T-708/J6); UI-02 consent fixture; UI-03 GA no-op + console baseline; UI-04 SSR 500 matrix; UI-05 post-hydration blank-page family; UI-06 nested anchors / hydration; UI-07 `/display` alias + broken "Search results" link; UI-08 result links are absolute full navigations (J5); UI-09 missing UI states; UI-10 viewport set; UI-11 modal layering, keyboard and pointer-events traps; UI-12 functional quirks not in the register; UI-13 wrong selectors; UI-14 data-provider SSR-vs-final matrix; UI-15 resolved [VERIFY] items; UI-16 routes reachability, 500 page, proxy; UI-17 JSON-LD XSS; UI-18 MathMarkdown is KaTeX only; UI-19 Fieldset depends on host custom-media; UI-20 network/console baseline; UI-21 date format decides Q-050; UI-22 harness build facts; UI-23 hydration mismatches are invisible to the console gate; UI-24 behaviours the vendored design copy must preserve; UI-25 V/T count and matrix size.
