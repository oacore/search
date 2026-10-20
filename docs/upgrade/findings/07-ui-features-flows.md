# 07 - User-visible behaviour: feature and user-flow map (E2E / component / visual / a11y plan)

Scope: `pages/**`, `templates/**`, `modules/**`, `main/**` (+ the hooks/stores they call, read-only).
Method: static read of source only (no build, no run, no install). Everything marked **[VERIFY]** is an inference that must be confirmed against the running baseline BEFORE the upgrade - the baseline run is the source of truth, not this document.
Stack under test: Next 10 (pages router, webpack 4, `trailingSlash: true`), React 17, MobX 6 (decorators), `@oacore/design` (old, "latest"), Leaflet 1.8 + markercluster, next-images, postcss-preset-env + custom-media.

---

## 0. Headline findings (read this first)

1. **`/` renders nothing of its own.** `pages/index.js:1` is `const Index = () => null`. The CORE homepage is served by another app behind the same host (prod rewrites `/search/_next/data`, `next.config.js:rewriteDataPath`). Locally `/` = header + empty `<main>` + footer. Home-page steps in journeys must start at `/search/?q=...` (or a seeded header search from any page).
2. **Filters live inside the `q` string** (Lucene fragments), not in their own URL params: `store/filters.js:176-193` (`q AND field:"v"`), `:241-243` (`AND (yearPublished>=A AND yearPublished<=B)`). "URL sync" = the `q` param. Tests must assert on decoded `q`, not on `?field=`.
3. **There is NO BibTeX file download and NO "export" feature.** "Cite" (`templates/output/citation.jsx`) opens a modal showing a *flattened one-line text* derived from the bibtex entry (title, Journal, year, ISBN, ISSN) with a copy icon. APA is fetched (`CITATION_STYLES=['apa','bibtex']`) but never rendered. The only file download is **search results CSV** (`js-file-download`, `results.csv`) and a **Download PDF** anchor.
4. **SEO is thin and, for Scholar, possibly partly broken today.** Only `/works/[id]` and `/outputs/[id]` emit `citation_*`, `DC.*`, JSON-LD (`modules/meta/index.jsx`). There is **no** `<meta name=description>`, canonical, `og:*`, `twitter:*` anywhere except `/data-providers/` (description + JSON-LD). `Meta` reads `downloadLink`, `year`, `oai`, `subjects`, but pages feed it the raw API object where those keys are `download`, `yearPublished`, `identifiers.oai`, ... so `citation_pdf_url`, `DC.format`, `DC.issued`, `DC.identifier`, `DC.subject` are probably **absent today** **[VERIFY by snapshot]**. The snapshot must freeze *current* output (do not "fix" during the upgrade) and then be diffed after.
5. **Soft-404s:** `/works/[id]` and `/outputs/[id]` on API error return **HTTP 200** with an "Uh-oh" page (props `serverError`, no `res.statusCode`); `/data-providers/[id]` returns a real 404 (`notFound: true`). `/search/` with zero query params 301s to `/` (`permanent: true`). Status codes must be in the baseline.
6. **Dead / unused UI code** (no importers; exclude from E2E, keep for compile-only): `modules/authors-box`, `modules/show-more`, `modules/title`, `modules/logo`, `modules/copyable-input` (only used by unused `templates/output/api-card.jsx`), `templates/output/chips.jsx`, `templates/data-provider/claim/sign-in-modal.jsx` (marked Deprecated), `modules/layout/maintenance-banner.jsx` (commented out in `layout/index.jsx:6,13-17`). `pages/error-card/index.jsx` IS a routable page (`/error-card/`).
7. **Latent behaviour bugs that a naive upgrade or "cleanup" could silently change** (freeze them in baseline tests, tag `@known-bug`):
   - `templates/data-provider/pagination.jsx:87` calls `urlTo('PREVIOUS')` but the switch handles `'PREV'` (`:37`) -> the "Previous" link keeps the *current* offset (no-op). `LAST` yields `offset == total` when `total % limit == 0` (empty page). Disabled arrows are only `aria-disabled` + CSS; links stay clickable.
   - `templates/search/pagination.jsx:96-104`: **Next has no `disabled`** (only a CSS class) -> clicking Next on the last page pushes `page=last+1`.
   - `store/filters.js:326-343` `reset()` -> `q.replace(/ .*/, '')`: "Clear all filters" keeps only the **first word** of a multi-word query ("machine learning AND field..." -> "machine").
   - `store/filters.js:176` un-toggle detection is `query.includes(filterValue)` (substring) - a value that is a substring of another already-applied value/query word flips the wrong way.
   - `templates/output/index.jsx:83-86`: "Search results" back-link uses `asPath.indexOf('search=')`; when absent (direct visit) `pos=-1` -> `slice(6)` -> garbage href.
   - `templates/data-provider/claim/claim-card.jsx:132`: non-member copy is hard-coded "Do you manage **Open Research Online**?" for every provider.
   - `pages/search/index.jsx:118-120`: `useStore()` and `Header.useSearchBar(...)` are called **after** a conditional early `return <ErrorCard/>` (conditional hooks) - on `queryError.status` the hook order differs. Same file: `queryError` WITHOUT `status` falls through to `QueryError` ("no results"), i.e. API outage with no HTTP status looks like "0 results".
   - `modules/dropdown/index.jsx:111`: `getLogoLink()` calls `useEffect` inside a conditionally-invoked helper (hook order depends on `checkBillingType`).
   - `modules/copyable-input` / `citation.jsx:31-34`: guard `!document.queryCommandSupported && !...('copy')` is always false-ish (logic bug, harmless).
   - `templates/data-provider/claim/claim-card.jsx:104` calls `getDataProviderAccounts` (an async fetch) **during render** -> one request per render.
   - `hooks/use-analytics.js:22` leaves a `console.log("GA")`; `_app.jsx:91` calls `LogRocket.init` on **every render** in production.

---

## 1. Page inventory

Global shell for every route (`pages/_app.jsx:82-116`, `main/index.jsx`, `modules/layout/index.jsx`):
`CookiesProvider > ErrorBoundary > Main(StoreProvider > DesignProvider > <Head/> + Layout(Container > [LoadingBar fixed while route changing] + design <Header id="header"> + <main> + design <Footer>) + design <Cookies/> popup)`.
- Global `<title>`: "CORE – Aggregating the world's open access research papers" (`main/head.jsx:6`), favicons are absolute `https://core.ac.uk/favicon/*` (png 64/128/256/512 + svg).
- Route-change loading bar: `routeChangeStart/Complete/Error` -> `<LoadingBar fixed/>` (`_app.jsx:47-68`).
- `isSearchPage = router.asPath.match(/search/gm)` -> applies `styles.header` to the Header (also matches e.g. `/outputs/...?search=`; any URL containing "search").
- `App.getInitialProps` (`_app.jsx:125`) runs for **every** page (disables automatic static optimisation): fetches statistics, data providers, members; falls back to `{totalArticlesCount:'more than 356 million'}`. Header placeholder text "Search {n} from papers around the world" depends on it (number formatted `toLocaleString('en-GB')`; fallback string has no `.toLocaleString` -> **[VERIFY]** the placeholder in fallback mode).
- Dev-only: `NextApp` returns `null` on the server in dev (`_app.jsx:148-155`) - **dev SSR HTML is empty, so SEO snapshots must run against `next build && next start`**.
- Cookie popup / analytics: `useAnalytics` (`hooks/use-analytics.js`) - GA4 via `react-ga4` only when cookie `analytics_cookies_allowed` and `NODE_ENV=production`; page views on `routeChangeComplete`. Third-party: LogRocket (prod), Sentry browser, GA. CSP in `csp.config.js` (img-src allows `*.openstreetmap.org`, `*.core.ac.uk`; no `script-src 'unsafe-inline'` in prod; `style-src 'unsafe-inline'`).
- Breakpoints: only `@custom-media --screen-until-desktop (max-width: 767px)` is actually used in this repo's CSS (`main/media-queries.css`; used in filters, year/selects, search-layout, output, output/update, search). `--screen-until-large-desktop` is defined but unused here. Map container flips on `(orientation: portrait)` (`modules/map/styles.module.css:7`). JS breakpoint: `width > 500 ? 2 : 0` siblings in search pagination (`templates/search/index.jsx:133`).

### 1.1 Route table

| # | Route (trailing slash is canonical: `trailingSlash:true`) | Params | Render mode | File |
|---|---|---|---|---|
| R1 | `/` | - | `getInitialProps` of _app only; page returns `null` | `pages/index.js:1` |
| R2 | `/search/` | `q`, `page` (default 1, max 1000), `limit` (default 10), `sort` (`relevance` default / `recent`), `t` (tracking token `searchId-workId`) | SSR (`getServerSideProps`, `pages/search/index.jsx:18`) | `templates/search/*` |
| R3 | `/works/[id]/` | `id`; query `t` | SSR (`pages/works/[id].jsx:19`) | `templates/output/*` (`useOtherVersions`) |
| R4 | `/outputs/[id]/` | `id` | SSR (`pages/outputs/[id].jsx:43`) | `templates/output/*` |
| R5 | `/outputs/update/` | - | static form (takedown request) | `templates/output/update/*` |
| R6 | `/data-providers/` | `q`, `size` (default 10, +10 per "Load more"), `action=ADD`, `dataProviderUrl` | SSR from cached `data/.formap.json` | `templates/data-providers/*` |
| R7 | `/data-providers/[id]/` | `id`; `q`, `offset` (0), `limit` (10), `sort` (`recency` default), `t` | SSR; `notFound:true` if id not in cached members/providers (`findDataProvider`) | `templates/data-provider/*` |
| R8 | `/error-card/` | - | static | `pages/error-card/index.jsx` |
| R9 | `/404/` (any unknown path) | - | static 404 | `pages/404.jsx` -> `templates/error` |
| R10 | `/api/healthz` | - | JSON `{status:"ok"}` | `pages/api/healthz.js` |

Prod URL namespace: behind the reverse proxy the app is mounted at `/search` (`useInterceptNextDataHref` prefixes `/_next/data`, `_app.jsx:70-80,93-98`; `rewriteDataPath` -> `/search/_next/data/...`; `getAssetsPath` -> `/static/search` when `BUILD_TARGET=azure`; `rewrites: /static/:path* -> /:path*`). **Client-side navigation (`router.push`) is the part most likely to break on a Next upgrade (monkey-patch of `router.pageLoader.getDataHref` - private API).** Test client-side transitions in a prod-like build with the same prefix settings, not only direct loads.

### 1.2 R2 `/search/`

| Aspect | Detail (file:line) |
|---|---|
| Sections | Filters bar (top) / header row "N research outputs found" + Download CSV icon + Copy URL icon + "Sort by" dropdown / result cards (design `SearchResult`) / optional "only first 10.000 articles" notice at `currentPage===1000` / numbered pagination / right sidebar: featured **CORE membership** card (random member) + CORE promo image (`templates/search/index.jsx:64-211`) |
| Data | `fetchWorks` POST `/v3/search/works` (50 s abort, `exclude:['fullText']`), `/members` (random featured member -> **nondeterministic sidebar**), client: `fetchAggregations` for filters, CSV download POST |
| SEO | Only `<title>Search CORE</title>` (when >=1 result). No description/canonical/og. Zero results -> default site title |
| Redirect | no query params at all -> 301 `/` (`:19-27`) |
| Empty | `QueryError`: image `notFound.svg` + "Sorry, we couldn't find any results for "{query}"." (`templates/error/query.jsx`). Also shown for any fetch error without HTTP status |
| Error | `queryError.status` truthy -> `ErrorCard` ("This page is not available now..." + "Try again" -> `/`). Page still HTTP 200 |
| Loading | design `LoadingBar fixed` on route change AND while `search.isLoading` (CSV); filters show `LoadingBlock` (6 fake facets Field/Year/Type/Author/Language/Publisher, each opening a "Loading" spinner box) while first aggregation loads; filter counts show "..." while `filters.isLoading` |
| Responsive | <=767px: filters collapse behind a full-width "Filters" toggle button (`modules/filters/styles.module.css:240-`), grid becomes 1 column, `.main/.sidebar {display: contents}`, member card and promo image `display:none`, header row wraps with a `.solid` divider. >767px: 2 columns + inline filter bar. Pagination siblings 2 (>500px) / 0 (<=500px) |
| Page cap | page > 1000 -> empty results; `offset=(page-1)*10` (ignores `limit`) |

### 1.3 R3 `/works/[id]/` and R4 `/outputs/[id]/` (shared `templates/output`)

| Aspect | Detail |
|---|---|
| Sections | "Search results > Research work / Research output from {provider}" trail; document type chip; OAI id + logo; `<h1>` title (rendered via design `MathMarkdown` - **KaTeX/markdown in title and abstract**); Metadata list (Authors with ExpandableList, Publication date, Publisher, DOI(s)); buttons: **Cite**, (works only) **View on arXiv/PubMed**; Abstract (`MathMarkdown`) or "Abstract is not available."; Keywords (tag links); **Similar works** (client-fetched, `Loader` + error state); **Related searches**; sidebar: "Full text" thumbnail card (Open in the Core reader / Download PDF / provider dropdown), works: "Available Versions" (CardDropdown per output), outputs: **Map card** (Leaflet, one marker), **Report card** ("Having an issue?" -> Report), Licence |
| Data | works: `fetchWork`, `fetchWorkOutputs` (+ per-output `checkLogo`), `fetchCitations(doi, {styles:['apa','bibtex'], locale:'en-GB'})`; outputs: `fetchMetadata`, `fetchDataProvider`, `fetchCitations`; client: `fetchSimilarTo` |
| SEO (critical) | `<title>{title} - CORE</title>` + `<Meta>`: `citation_title`, `citation_author` (x N), `citation_publication_date` (`YYYY/M/D` from `publishedDate`, else year), `citation_pdf_url` (only if `downloadLink`), `DC.format|creator|title|issued|identifier|subject`, `DCTERMS.abstract`, **JSON-LD** `@graph` = `BreadcrumbList` (CORE > `https://core.ac.uk/reader/{id}` > provider search) + `ScholarlyArticle` (headline <=110 chars with ellipsis, author[], datePublished, isAccessibleForFree:true, provider, publisher, image `https://core.ac.uk/image/{id}/large`) - `modules/meta/index.jsx`. **No** canonical / description / og / twitter. `citation_doi`, `citation_abstract_html_url`, `citation_journal_title`, `citation_publisher` are NOT emitted today |
| Errors | `serverError{code,message,prevHistoryUrl}` -> `templates/error/404.jsx`: "Uh-oh" + message + "Go back" (referer) or "Go to homepage" + "Contact us" (`/contact`). 410 -> "The article with ID {id} has been disabled" (outputs) / `error.data` (works). Provider disabled -> "Data provider has been disabled". HTTP status stays 200 |
| Empty/edge | no DOI -> citations `[]` -> **Cite button hidden**; no abstract text; no tags; `fulltextStatus==='disabled'` -> "Full text removed upon author's request" + thumbnail tag is `div`; no `reader` link -> neither Reader nor Download buttons; `?source=oai` -> fixed-position "Repository landing page" modal (outputs only, closes on outside mousedown or Close) |
| Loading | Similar works: `Loader` ("Loading suggested articles...") spinner (CSS `@keyframes spin`), error block "Sorry, we are unable to process this request..." |
| Responsive | <=767px sidebar content flows below main (`display: contents`), see `templates/output/styles.module.css:187-` |

### 1.4 R5 `/outputs/update/` (takedown request)
Header + form ("CORE URL" -> regex extracts numeric id from `core.ac.uk/(outputs|display|download|download/pdf)/N` or bare number, `update/index.jsx:40-67`) -> on success `report.fetchOutput(id)` opens the **same 3-step report modal chain**; error text for `/works` or `/search` links. Static help links, FAQ image. Title: default site title (no `<Head>`).

### 1.5 R6 `/data-providers/`
Header search bar (design `Header.useSearchBar` with `getSuggestions` -> up to 10 suggestions with `#magnify` icon, `initQuery=query`), "Showing 1-N of M", provider cards (name link, webpage external link, country via `i18n-iso-countries`), **Load more** (+10, restores scroll with `window.scroll` in layout effect), "Suggest a new data provider" form (`?action=ADD` or when no results), sidebar: **Leaflet map with all providers (markercluster)** + marketing copy + "Become a data provider". SEO: `<title>{query - }Data providers search</title>`, `<meta description="Search over N repositories and journals around the world">`, JSON-LD `BreadcrumbList` + `SearchResultsPage/ItemList` (first `size` results; positions start at 0). URL sync via `useSyncUrlParamsWithStore` (250 ms debounce, `router.replace` if URL had no query else `router.push`, shallow; alphabetical param order). Empty: "Is there a mistake?" card + the add form.

### 1.6 R7 `/data-providers/[id]/`
Provider header (logo: base64 from API / `checkLogo` / default icon; university name; provider name; "{billing} member" or "Not a member yet"), design `Select` used as a search box (`templates/data-provider/search.jsx`; first `onChange` is swallowed to avoid firing at init; **search fires on blur/select**, comment `TODO: Add debouncing when onBlur is not required`), "N research outputs found" + Sort (recent/relevance, resets `offset`? -> sets `page:1`, **not** `offset` **[VERIFY]**), results (reuses `templates/search/results` **without searchId**), empty "This data provider has not articles yet." / error "An error occured...", offset-based Pagination nav (First/Previous/Next/Last as Next `<Link>` + design Button tag=a), sidebar: Data sources links (multi-repo members), MetaBox (full texts / metadata counts), Leaflet MapCard with country (`Intl.DisplayNames`), **ClaimCard** ("Access Repository Dashboard" -> Sign in / Create account / Become a member) + 3-4 modals (claim, claim-edit, success). **No `<Head>`/title/description** (default site title). `notFound:true` -> real 404.

### 1.7 R8/R9
`/error-card/`: img `errorCard.svg`, h3, "Try again" button -> `/`. 404: `templates/error` with `{status:404,message:"The page you were looking for could not be found"}` -> "Uh-oh", "Go to homepage" (`/`), "Contact us" (`/contact`). Note: for 404 no `Loader` unless `error` is falsy.

---

## 2. Interactive features - exact steps, expected results, a11y, edge cases

Legend: **KB** = keyboard behaviour observed in OUR code (design-lib internals unknown -> verify at baseline). Selectors are suggestions; most of our components have no `data-testid` (see section 8 for the recommended selector strategy: roles/labels, never CSS-module class names - they are hashed).

### 2.1 Header search box (design `Header.useSearchBar`, configured per page)
| Item | Detail |
|---|---|
| Where | R2: `pages/search/index.jsx:123-145` (`useAdvancedSearch:true`, `initQuery=data.query`, `changeOnBlur:false`); R3/R4: `pages/works/[id].jsx:128`, `pages/outputs/[id].jsx:111` (`initQuery:''`, push `/search?q=` / `/search/?q=`); R6: `templates/data-providers/index.jsx:125` (suggestions) |
| Steps (R2) | focus search input (label/placeholder "Search {N} from papers around the world") -> type -> press Enter (or click magnify) |
| Expected | `router.push('/search', {...router.query, q, page:1})` - **keeps `sort`, `limit`, `t`**; drops page; filter fragments in the old `q` are replaced (new q). LoadingBar shows; header input keeps the typed text |
| From a work/output page | `router.push('/search?q=' + searchTerm)` - **term is NOT URL-encoded** (`&`, `#`, `+`, `%` break) - test with `a&b` and `c++` and freeze the result |
| Debounce / suggestions | none on R2/R3/R4 (submit-only). R6 has suggestions from the in-memory provider list (max 10) - test dropdown list + keyboard selection (design lib) |
| KB / a11y | Enter submits; label comes from the design lib - axe the `header` landmark. `changeOnBlur:false` -> blur must NOT submit (assert). R7's own search (`Select`) DOES submit on blur/selection |
| Edge | empty query; leading/trailing spaces (R7 trims, R2 does not); very long query; unicode; quotes `"exact phrase"`; Lucene operators; XSS string `<img src=x onerror=...>` in `q` echoed in `QueryError` (React-escaped - assert no execution); query only whitespace |

### 2.2 Filters bar (`modules/filters/*`, store `store/filters.js`)
Facets (labels after `setFilterLabels`): **field** (fieldsOfStudy), **year** (yearPublished), **type** (documentType), **author**, **language**, **publisher**; a "sort by" label also exists in `templates/search/utils/sort-filter-values.js` but is not rendered in the bar.
| Item | Detail |
|---|---|
| Open a facet | click facet pill (`<div role="presentation">`, **not focusable, not a button**) -> `filters.setActiveFilter`, suggestions = items sorted by count desc, checked first. Click outside (`mousedown` on `document`, `hooks/use-outside-click.js`) closes. Opening another facet does NOT auto-close the first unless the mousedown lands outside its `li` (it does) |
| Checkbox facets (field/type/author/language/publisher) | box shows a "Search" text field (client filter of the visible items, case-insensitive substring) + list of `FilterItem` (`<li role=presentation onClick>` containing a hidden `input type=radio` (`display:none`) + icon + label + count `toLocaleString('en-GB')`). Click item -> `toggleCheckboxFilter` -> `Router.push` with `q = q + ' AND {key}:"{value}"'` (language uses the **code**, not the name) and `page:1`; click again -> removes that fragment. Multi-select = several AND fragments. Items with `count===0` or while `filters.isLoading` get `.disabled` class (pointer events are CSS-only - **[VERIFY]** whether click still fires) |
| After navigation | `FiltersBar` effect (`index.jsx:17-24`) refetches aggregations for the new `q`; `initialData` is kept so counts of non-selected values update; selected items are marked `checked` by substring match of value/code in `q` (`utils/filters-transform.js:120-`) |
| Year facet | 3 quick ranges (`Since 2018/2016/2014`, `setGroupedYearDates([2014,2016,2018])`), "Custom range" row with count, **Histoslider** (design; only when >1 year bucket; width 298; drag handles -> `selectFunc`), two native `<select>`s "from"/"to" (`year/selects`). Any choice -> `setActiveYearDate([from,to])` -> `q = q.replace(/ AND \(year(.*)\)/g,'') + ' AND (yearPublished>=A AND yearPublished<=B)'`, `page:1`. Years considered: 1950..current year (`MIN_YEAR=1950`) |
| Clear all | button "Clear all filters" visible when any item checked (`isVisibleClearButton`) -> `filters.reset(query)` -> push `q` truncated at first space (**bug, see 0.7**), `page:1`, refetch |
| Mobile (<=767px) | "Filters" toggle button shows/hides the bar (`display:none/flex`); facet boxes become absolute/full-width |
| a11y | pills are `div role="presentation"` + `<p>`; list is `<ul>` of `<li role="presentation">`; radio inputs hidden -> **no keyboard path to apply a filter** (baseline = inaccessible; do not assert KB success, assert current behaviour and record axe violations) |
| Edge | query with quotes/parentheses; selecting 2 values in one facet; selecting year then checkbox (year fragment preserved?); back button after filter (history entry per push); language with no name mapping (falls back to code); facet with 1000s of items (scroll `overflow-y:auto` `modules/filters/styles.module.css:66`); aggregation failure (`console.error`, bar stays in loading block) |

### 2.3 Sort (`templates/search/sort.jsx`, `store/search.js:106-116`)
Steps: click "Sort by {relevance|recent}" box (`div role=presentation`) -> list (`FilterItem` radios) -> click "recent" -> `Router.push('/search', {...query, sort:'recent', page:1})`; menu closes. Expected: SSR maps `recent` -> API `recency` (`pages/search/index.jsx:47`); active label updates from SSR `data.sort`. Outside mousedown closes menu. Edge: default shows "relevance" even when URL has no `sort`. **R7 variant** (`setActiveSortOptionData`): choosing "recent" pushes `sort=relevance` (`:100`) - **[VERIFY]**; `delete Router.query.id` hack; `offset` is preserved while only `page:1` is set.

### 2.4 Pagination
R2 (`templates/search/pagination.jsx`, `hooks/use-pagination.js`): numbered buttons with prev/next arrows. Max 1000 pages; `siblingCount` 2 (>500px) else 0; "first"/"last" text replaces `1`/`last` when `currentPage>=5` / `last>=5`; dots are non-interactive `<li>`; click -> `router.push` with `page` (history entry) and local `currentPage` updated immediately (before SSR returns). Prev disabled on page 1; **Next never disabled**. Scroll position after navigation: **no explicit scroll reset in our code** - Next's default router scroll-to-top applies to `router.push` (**[VERIFY]** it still does after upgrade; test `scrollY===0` after clicking page 2). Back button: returns to previous `page`, `currentPage` state resyncs through `useEffect([urlPage])`.
R7 (`templates/data-provider/pagination.jsx`): `<nav aria-label="Pagination Navigation">` with 4 icon links (aria-labels First/Previous/Next/Last, titles), `Showing {offset+1}-{offset+limit} of {total}` (shows `to` even when beyond total), uses `next/link` + `passHref` + `Button tag=a` (**Next 13 `Link` no longer renders `<a>`/passHref semantic - high-risk area**).
R6: "Load more" (`Button`) -> `size += 10`, scroll position preserved (`useLayoutEffect` + `window.scroll`), URL `size=` updated after 250 ms.

### 2.5 Results list (R2, R7) - `templates/search/results.jsx`
Per card (design `SearchResult`): title link (metadata page + `?t={searchId}-{id}&search={current query string}` when `searchId` known), authors, venue, date (`formatDate` en-GB, or year string), abstract, thumbnail (`//core.ac.uk/image/{id}/medium` fallback), data-provider chips/logo only for billing_type supporting/sustaining members, "recommended" flag for sustaining, full-text link (`links[download]` -> else CORE reader via `api.core.ac.uk/reader-ui/`). Steps: click title -> navigates (full page vs client route depends on design lib - **[VERIFY]**); click full-text -> opens target. Edge: no authors, no abstract, long titles, math in titles, missing `links` entries (the code `links.find(...)?.url` is safe, but `findUrlsByType` in SSR does `article.links.map` - missing `links` would 500 the page).

### 2.6 Download results as CSV (`templates/search/modals/download-results.jsx`, `store/search.js:118-134`, `api/search.js:42-49`)
Steps: click download icon (tooltip "Download results in CSV", design `Popover`) -> modal "Download results in CSV" with `Fieldset` radios (Current page=10 / Top 100 / All up to 1,000) -> choose -> **Download** (disabled while `search.isLoading`) -> POST `/v3/search/works` `{q, accept:'text/csv', limit}` -> browser download `results.csv` (blob via `js-file-download`) -> modal closes. Cancel closes. Note: initial `activeLimit` is 10 but no radio is visibly preselected (**[VERIFY]** default selected state); `q` is `search.query` (includes filter fragments - so CSV respects filters). Playwright: `page.waitForEvent('download')`, assert filename and first CSV line (headers); stub API with `route.fulfill` (large payload).
Modal a11y: design `Modal` with `aria-label="Download results in cvs modal"` (typo), `hideManually` -> **Escape / backdrop behaviour is design-lib specific; verify focus trap + focus return**.

### 2.7 Copy search URL (`templates/search/index.jsx:44,98-109`, `hooks/use-copy-to-clipboard.js`)
Click share icon (tooltip "Copy url") -> `navigator.clipboard.writeText('https://core.ac.uk' + router.asPath)` (in dev: `http://localhost:3000`) -> "Link copied" toast (`.notification`, shows for 2500 ms via `setTimeout`) -> hides. Failure path sets status `failed` (no UI). Playwright: `context.grantPermissions(['clipboard-read','clipboard-write'])`, `page.evaluate(() => navigator.clipboard.readText())`; use `page.clock` / fake timers for the 2.5 s expiry. Edge: Safari/insecure context -> promise rejects silently.

### 2.8 Cite modal (`templates/output/citation.jsx`)
Steps: on a work/output WITH DOI click **Cite** (`aria-pressed` reflects open state) -> design `Modal onClose` with `<h2>Citation</h2>` and one block: "{title}, Journal: {j}, : {year}, ISBN: .., ISSN: .." (note the literal `, : ` before the year) -> click copy icon (`Icon onClick`, not a button) -> text copied (innerText of the block via `navigator.clipboard.writeText(textRef.current.textContent)`) + "copied" label appears; closing resets the label. Edge: bibtex parse returns empty -> block omitted -> empty modal; two bibtex entries -> `textRef` points at the last; **no download of .bib**. Missing keys: block list lacks React `key` (console warning). Keyboard: icon is not focusable.

### 2.9 Full-text card & downloads (`templates/output/thumbnail-card.jsx`)
- "Open in the Core reader" = `Button tag=a href=reader` (new tab? no `target` -> same tab). 
- "Download PDF": `Button tag=a download target=_blank onClick=downloadPDF` -> creates a detached `<a href=data.download target=_blank rel=noopener>` appended to `body`, clicks it, removes it. **No href on the visible anchor** (so middle-click / "copy link" gives nothing). Playwright: `page.waitForEvent('popup')` or `download`; assert the transient anchor attributes via `page.exposeFunction`/spy on `HTMLAnchorElement.prototype.click`.
- Hidden when no `reader` link. Disabled-fulltext message when `fulltextStatus==='disabled'`.

### 2.10 Provider dropdown / "Available Versions" (`templates/output/card-dropdown.jsx`, `modules/dropdown/index.jsx`)
Per output: provider logo (fetched from `https://api.core.ac.uk/data-providers/{id}/logo` only for supporting/sustaining members, inside a conditional hook), provider name (h3, whole row `onClick` -> `window.location.href = //core.ac.uk/data-providers/{id}`; `div role` absent -> **not keyboard-accessible**), buttons: "See this paper in CORE" (`window.location.href=href`), "Go to the repository landing page" (`api.core.ac.uk/oai/{oai}` or `https://doi.org/{doi}`), "Download from data provider" (anchor with `sourceFulltextUrls` forced to https, or disabled button + Popover "We don't have a full text link from this data provider"), OAI row with ellipsis (30 chars) + tooltip on hover + **copy OAI icon** (`useCopyToClipboard`, "Copied" toast 2.5 s, `stopPropagation`). Member badge "{Supporting|Sustaining} member" link. "Last time updated on {date}". Edge: `sourceFulltextUrls` array vs string (`httpsValidate`), `http:` -> `https:` rewrite, missing OAI.

### 2.11 Report / takedown chain (`templates/output/report/*`, `store/report.js`)
Steps: sidebar card **Report** -> Modal 1 "Which issue are you reporting?" (2 selectable cards: "The document should not be published" / "The document is outdated"; `Continue` disabled until one chosen; `Close` resets) -> Modal 2 "Fill up your request": role Fieldset (Repository manager / Author / ...), after a role is chosen Name* / Email* (type=email) / Comment (textarea; helper text differs per option) appear; `Submit` disabled until role; native `required` + `onSubmit` guard `outputId && name && email` -> modal 2 closes and `report.submit` POSTs (`api/outputs createReport`) -> Modal 3 "Thank you!" (`Loader` while loading; image upvote vs confirmed by role; text differs by role/option; "got it") -> on "got it" with takedown + on `/outputs/{id}` -> `router.push` same URL (soft refresh). API failure -> `report.error` (message `We couldn't perform the action...`) - **not shown in the modals** (only in /outputs/update) - freeze. Multiple modals use design `Modal` (`hideManually` = no built-in close). Playwright: route-mock `POST createReport` (success/500), assert request body `{outputId,name,email,message,updateOption,role}`.
On `/outputs/update/`: same chain after URL submit; also verify error message (links with /works or /search), `SUBMIT` disabled while `isLoading`.

### 2.12 Similar works + Related searches (`templates/output/similar-works.jsx`, `related-search.jsx`)
On mount `similarWorks.fetchSimilar(id, params)` (works pass `{resultType:'work'}`); states: loader -> list of `SearchResult` (fixed placeholder thumbnail `//core.ac.uk/images/document-placeholder.svg`) or error block. **Related searches** appear when `similarOutputs` loaded: words computed by `utils/related-words.js` from title + similar titles; each links to `//core.ac.uk/search?q={word}` `target=_blank`. Edge: 0 similar -> "No results" item; request aborted when navigating (invalidatePreviousRequests); `dataProviders[0].id` access throws if API returns empty provider array (`similar-works.jsx:53`) -> whole section crashes into ErrorBoundary-less white area **[VERIFY with mocked empty provider]**.

### 2.13 Authors / metadata / keywords
Metadata list (design `MetadataList`, `ExpandableList` with "show more" for long author lists - lib behaviour; author link = `https://core.ac.uk/search?q=authors:(Name)` absolute prod URL; `Surname, Given` -> `Given Surname`); DOI list: `DOI: {UPPERCASE}` for work doi + outputs' dois (unique, computed in `useEffect` -> **flashes empty then populated after hydration; SSR HTML has no DOI items** - SEO/visual note). Keywords: `<ul>` of links to `//core.ac.uk/search?q={tag}` (new tab). Unused: `modules/authors-box`.

### 2.14 Map (Leaflet + markercluster) (`modules/map/*`)
- `modules/map/index.jsx` uses `next/dynamic(() => import('./map'), {ssr:false})` - **SSR-safe** by design (leaflet touched only in the client chunk). Wrapper is `React.memo`'d; container is a padding-bottom aspect box (50%, 100% in portrait) with gray bg - **reserves space during load (no CLS)**.
- `map.jsx`: `L.map('map', {center:[26.5,-43.1], zoom:2, minZoom:1, maxZoom:12})` + OSM tile layer (`https://{s}.tile.openstreetmap.org`, attribution link), `moveend` -> compute in-bounds markers -> state -> rebuild a `MarkerClusterGroup` (popup `<a href=... target=_blank>name</a>`, custom 18px `marker.svg` icon). **`id="map"` is hard-coded** -> two maps on one page (R7 has one, R3/R4 one, R6 one; never two) would collide. Note `zoom={10}` prop passed by `templates/output/map-card.jsx` is **ignored** (map always zoom 2 centre Atlantic), so single-provider maps show the world, not the provider location - freeze in visual baseline.
- Effects: init effect has an empty dep array but uses `locations` from first render; cleanup calls `mapRef.current.remove()` (**in React 18 StrictMode dev double-invoke this crashes: `mapRef.current` null**). If `locations.length===0` on mount, `mapRef.current` is `null` and `mapRef.current.addLayer` throws (R6 guards with `results.length>0`; R3/R4 `location?.latitude` may be undefined -> `L.LatLng(undefined)` throws "Invalid LatLng" **[VERIFY with provider lacking location]**).
- E2E: wait for `.leaflet-container`, `.leaflet-marker-icon` / `.marker-cluster`; click a cluster (zoom), click a marker -> popup link navigates to `/data-providers/{id}`; zoom controls (`.leaflet-control-zoom-in`), keyboard (`Tab` to markers, `+`/`-` keys; Leaflet 1.8 supports keyboard). **Block/mocks tile requests** (`**/*.tile.openstreetmap.org/**`) with a 1x1 png so screenshots are deterministic and CSP doesn't matter.
- Leaflet CSS imports are global in `_app.jsx:15-17`; icon image paths (`marker-icon.png`) default to CSS-relative -> image 404s would show as broken default markers (we use our own SVG icon so OK, but cluster icons are CSS-only).

### 2.15 Add data provider form (R6) (`templates/data-providers/form.jsx`, `use-claim-controller.js`, `store/claim.js`)
Steps: visit `/data-providers/?action=ADD` (or search with no results) -> type URL in "Data provider URL" (type=url, required) -> after **500 ms** debounce (`useDebouncedEffect`, native `checkValidity`/`reportValidity`) `claim.retrieve()` POST `/data-providers {uri}` -> states: progress, success (`created`: "We found X ... sent a confirmation email to ..." + variant success; **Finish** enabled), 409 duplicate (parses `data.message` JSON -> link to existing provider search), other error (variant error, support mailto obfuscated `theteam@core.ac.uk`). Finish submit -> `handleSubmitForm` -> `claim.reset({query:true})`. Cancel -> `action=null`. Also `?dataProviderUrl=` prefill. Edge: invalid URL -> native validation bubble; rapid typing aborts previous request (`invalidatePreviousRequests`); Enter in Safari with `created===null` is ignored.

### 2.16 Claim card & modals (R7) (`templates/data-provider/claim/*`)
Card variants: with accounts or `billingType==='starting'` -> "SIGN IN" (opens `https://dashboard.core.ac.uk/` new tab) + "Create account"; else "Become a member" (`/membership`). Create account -> `ClaimModalEdit` (email, name, justification all required; Continue with empty fields calls `focus()` helpers that do `getElementById(id).firstChild.focus(); .blur()` - **depends on the design TextField DOM structure**) -> `fetchClaim` -> `ClaimSuccessModal` (text depends on accounts/newEmail). `ClaimModal` (first-step, email click opens edit modal; in the current code `setIsClaimModalActive(true)` is never called, so this modal appears unreachable - [VERIFY]). Close behaviours: `Modal onClose`. Mock `fetchClaim` / `fetchDataProviderAccounts` network.

### 2.17 Notifications / toasts
`templates/search/notification.jsx` ("Link copied"), `modules/notification` ("Copied" on OAI copy) - plain `<span>` with CSS positioning, **no `role="status"/aria-live`** (axe will not flag, screen readers will not announce; record as a11y debt). Both vanish after 2.5 s.

### 2.18 Cookie banner, analytics (global)
Design `<Cookies/>` popup (first visit); acceptance sets cookie `analytics_cookies_allowed` -> GA init next load. Playwright: pre-set cookie in `storageState` to suppress the banner in all functional tests; keep ONE test for banner display/accept/reject and assert no network call to `google-analytics.com` before consent.

### 2.19 Show-more / expandable
`modules/show-more` is unused. Expand/collapse that is live: design `ExpandableList` (authors/DOIs), `Authors` `+N MORE` (unused module), filters "Filters" toggle (mobile), OAI-modal.

---

## 3. Critical user journeys (ranked) - Gherkin, Playwright-ready

Conventions: base URL = prod-like `next build && next start` (with `BUILD_TARGET`/prefix matching production); API mocked at the network boundary (`page.route('**/v3/**', ...)` for client calls; for SSR calls run a tiny **mock API server** and set `API_URL`/`API_KEY` env - SSR fetches are NOT interceptable by `page.route`). Pre-set `analytics_cookies_allowed` cookie unless stated. Block `*.tile.openstreetmap.org`, `core.ac.uk/image/**`, LogRocket, GA.

**J1 (P0) Search -> results** 
```
Given I open /search/?q=climate
Then the response status is 200 and <title> is "Search CORE"
And I see "<N> research outputs found" and 10 result cards
And each card has a title link, authors, date and abstract
When I type "machine learning" in the header search and press Enter
Then the URL is /search/?q=machine+learning&page=1 (decoded q = "machine learning")
And the LoadingBar appears then disappears
And the results list is replaced and the input still shows "machine learning"
```
**J2 (P0) Apply and remove a checkbox filter, URL sync, back button**
```
Given I am on /search/?q=climate with filters loaded (no LoadingBlock)
When I click the "type" facet pill and click "research" (count N)
Then the facet box closes only on outside click (still open)
And URL q (decoded) = 'climate AND documentType:"research"' and page=1
And "Clear all filters" is visible and the "type" pill is highlighted
When I press browser Back
Then q = "climate", no pill highlighted, "Clear all filters" hidden
When I forward and click "research" again
Then the fragment is removed
```
**J3 (P0) Year filter - quick range, selects, histogram**
```
Given /search/?q=climate
When I open "year" and click "Since 2016"
Then q contains 'AND (yearPublished>=2016 AND yearPublished<=<maxYear>)' 
When I choose from=2010 to=2015 in the two selects
Then the previous year fragment is replaced (only one yearPublished fragment)
And "Custom range" shows a count
When I drag the Histoslider left handle (mouse down/move/up)
Then q's range changes accordingly
```
**J4 (P0) Pagination and sort**
```
Given /search/?q=climate (total hits > 100)
When I click page "2"
Then URL page=2, "Showing"/results change, scrollY == 0, page "2" button active
When I click Next, then Previous
Then page=3 then page=2
When I open "Sort by relevance" and choose "recent"
Then URL sort=recent&page=1 and the first result differs from baseline relevance order (mocked)
And at page=5 the first/last page buttons read "first" and "last"
And on a 400px viewport only prev, current, next, dots are shown
```
**J5 (P0) Search -> open work -> metadata, then back keeps state**
```
Given /search/?q=climate&page=2&sort=recent
When I click the first result title
Then I land on /works/<id>/?t=<searchId>-<id>&search=q%3Dclimate... (or /outputs)
And <title> is "<title> - CORE"
And h1, authors, publication date, publisher, abstract are visible
When I press Back
Then URL is /search/?q=climate&page=2&sort=recent, results for page 2 are shown, sort label "recent"
And filter pills reflect the q (checked ones highlighted)
```
**J6 (P0) Output SEO contract (SSR HTML, no JS)**
```
Given a work with 3 authors, DOI, abstract and pdf link
When I fetch /works/<id>/ with JS disabled (request().get)
Then HTML contains exactly: citation_title x1, citation_author x3 (in order), citation_publication_date, 
     DC.title, DC.creator x3, DCTERMS.abstract, and one <script type="application/ld+json"> that parses to @graph [BreadcrumbList, ScholarlyArticle]
And <title> ends with " - CORE"
And after hydration (JS on) the same <meta> set is still present in document.head (no duplicates, none removed)
And repeating for /outputs/<id>/
```
(see section 7 for the exact snapshot recipe)
**J7 (P1) Cite**
```
Given a work with DOI and bibtex citation
When I click "Cite"
Then a modal titled "Citation" shows "<title>, Journal: <j>, : <year>"
When I click the copy icon
Then clipboard == the displayed text and "copied" appears
When I close the modal (Esc / close control) and reopen
Then "copied" is gone
And for a work without DOI the Cite button is absent
```
**J8 (P1) Download PDF / open reader / provider links**
```
Given a work page with reader + download links
Then "Open in the Core reader" has href = reader url
When I click "Download PDF"
Then a new page/popup/download starts for the download url (rel noopener)
When I click a provider row in "Available Versions"
Then the browser navigates to //core.ac.uk/data-providers/<id>
And "Download from data provider" is a link for core-hosted files, else a disabled button with the tooltip text
```
**J9 (P1) Copy search link and CSV export**
```
Given /search/?q=climate
When I click the share icon
Then clipboard == "https://core.ac.uk/search/?q=climate" and "Link copied" disappears after ~2.5s
When I click the download icon, choose "Top 100 results", click Download
Then a download "results.csv" starts and the modal closes; request body {q, accept:'text/csv', limit:100}
When I click Cancel instead -> no request
```
**J10 (P1) Similar works + related searches**
```
Given a work page
Then "Loading suggested articles..." appears, then N similar cards under "Similar works" and a "Related searches" block
When the similar API fails (500) Then the error block "Sorry, we are unable to process this request at the moment" shows and the rest of the page is intact
When I click a related-search link Then a new tab opens //core.ac.uk/search?q=<word>
```
**J11 (P1) Report an issue (3-step modal)**
```
Given an /outputs/<id>/ page
When I click "Report"
Then "Which issue are you reporting?" modal; Continue is disabled
When I select "The document is outdated" and click Continue
Then "Fill up your request" modal; Submit disabled; form fields hidden
When I choose "Author", fill name+email+comment and Submit
Then POST createReport body has updateOption=issueWithContent, role=author, outputId, name, email, message
And "Thank you!" modal appears; "got it" closes it and resets the store
Variant: API 500 -> success modal does not appear (error stored, nothing visible) [frozen behaviour]
```
**J12 (P1) Data providers directory: search, load more, map**
```
Given /data-providers/
Then JSON-LD ItemList has 10 items, description meta says "Search over N repositories..."
When I type "open univ" in the header search
Then suggestions (<=10) appear; selecting one / pressing Enter filters results; URL gets q= after ~250ms; title becomes "open univ - Data providers search"
When I click "Load more" Then size=20 in URL, 20 cards, scroll position unchanged
And the map shows clusters; clicking a marker popup link goes to /data-providers/<id>/
```
**J13 (P1) Data provider page: results, search, pagination, claim**
```
Given /data-providers/<id>/
Then logo/name/member label, "N research outputs found", 10 results, map with one marker, MetaBox counts
When I type "thesis" in the provider search and blur
Then URL has q=thesis&offset=0
When I click Next Then offset=10 (and Previous returns to 0 - baseline currently does NOT, tag @known-bug)
When I click "Create account" (or "Become a member" for non-members)
Then claim modal opens, empty Continue focuses first invalid field, valid submit POSTs claim and shows success text
```
**J14 (P2) Error and empty states**
```
/search/?q=zzzzqqq -> "Sorry, we couldn't find any results for "zzzzqqq"." (status 200)
/search/ (no params) -> 301 to /
/search/?q=x&page=1001 -> empty-state
API 500 on search (with status) -> "This page is not available now" + Try again -> /
/works/does-not-exist/ and /outputs/410-id/ -> "Uh-oh" page with 200 status, "Go back" using Referer or "Go to homepage"
/data-providers/999999999/ -> 404 page; /nope/ -> 404 page
```
**J15 (P2) Takedown form and OAI modal**
```
/outputs/update/: submit "abc" -> error text mentioning /works and /search; submit "https://core.ac.uk/download/12345.pdf" -> fetches output 12345 -> Report type modal
/outputs/<id>/?source=oai -> "Repository landing page" modal visible; click outside closes; "Go to the Dashboard" opens new tab
```
**J16 (P2) Responsive navigation (375x812)**
```
/search/?q=climate: filters hidden; click "Filters" -> bar visible; member card & promo hidden; pagination compact;
work page: sidebar below main; header remains usable
```
**J17 (P2) Consent / analytics gating** - first visit shows cookie popup; decline -> no GA request; accept -> `analytics_cookies_allowed` cookie set, GA hit on next navigation.

---

## 4. Fragile UI spots for the upgrade

| # | Area | Where | Why fragile | What to test / watch |
|---|---|---|---|---|
| F1 | **CSS-module class names + camelCase export** | `next.config.js:57-79` patches `css-loader` `modules.exportLocalsConvention = 'camelCase'` by reverse-engineering Next 10's webpack rule. All `.css` files use kebab-case (`.bar-item-wrapper`) but JS uses `styles.barItemWrapper` | Next >=11/12/13 changes the css-loader rule structure (`oneOf`, `.module.css` loader) and **Next 13+ forbids/ignores this patch**; result = `styles.xxx === undefined` for every multi-word class -> whole UI unstyled but no error | Visual regression on every page is the only reliable guard; also a unit script: import each `*.module.css` and assert keys are camelCase |
| F2 | **postcss config** | `postcss.config.js`: `postcss-preset-env stage 0`, `postcss-custom-media importFrom`, `postcss-extend-rule`, `cssnano` | Next 10 accepts object config; newer Next requires plugin names/`string` form and conflicts when a custom config exists; `postcss-custom-media@9+` removed `importFrom` -> `@media (--screen-until-desktop)` silently stops matching (mobile layout lost) | Screenshots at 375px; grep built CSS for `--screen-until-desktop` |
| F3 | **Leaflet / markercluster** | `modules/map/map.jsx` | Already `dynamic ssr:false` (good). Fragile: hard-coded `id="map"`, init effect with `[]` deps and cleanup that nulls `mapRef` (breaks under React 18 StrictMode double-effects), `zoom` prop ignored, `L.MarkerClusterGroup` created twice (empty one added in init effect), CSS imported in `_app`, `bindPopup` with unquoted `href=${href}`, markercluster 1.x with leaflet 1.9 OK but `leaflet.markercluster` attaches to global `L` (needs `import L` first; ESM bundlers + React 18/Next 13 dynamic changes) | Map smoke on R3/R4/R6/R7: no console errors, tiles requested (mock), cluster count > 0, popup opens. Run once with React StrictMode on |
| F4 | **Outside-click / refs** | `hooks/use-outside-click.js` (`mousedown` on `document`, closure captured once with `[]` deps), used by filter pills, loading facets, Sort; `templates/output/index.jsx:60-79` (OAI modal) | Listener closure uses first-render `ref`/callback; React 17+ event delegation root change and portals (design Modal/Popover) can make "outside" detection wrong: clicks inside a portal'd Popover count as outside | Open facet -> click inside facet search input / histogram -> must stay open; open Sort -> click an item -> closes; modal inside OAI modal |
| F5 | **Design `Modal`/`Popover` (portal, focus, scroll lock)** | citation, download CSV, 3 report modals, claim modals; tooltips on download/share icons and disabled download button | Old design-lib implementation (likely class-based, `findDOMNode`/legacy context/`ReactDOM.createPortal` into `body`); behaviour (Esc, backdrop click, focus return, body scroll lock) must be baselined; `hideManually` variants have no built-in close | For each modal: open, Esc, backdrop click, Tab cycling (trap?), focus after close, body `overflow` while open, nested modal stacking (claim modals use `.hide` class swap) |
| F6 | **Focus management** | `templates/data-provider/hooks/use-input.js:13-16` (`getElementById(id).firstChild.focus()`), `claim-modal*.jsx` | Depends on design `TextField` DOM (first child must be the input) | Empty submit -> first invalid field focused, no console error |
| F7 | **Scroll restoration** | `templates/data-providers/index.jsx:42-46` (manual `window.scroll` in layout effect), router.push on pagination | Next scroll behaviour on `router.push` (default scroll-to-top) and SSR layout effect warnings; Next 13 changed `scroll` default for same-page query updates | After page/sort/filter change `scrollY` = 0; Load more keeps `scrollY`; Back restores earlier scroll (Next 10 `experimental.scrollRestoration` is off here - baseline records current "no restoration") |
| F8 | **Timers** | `use-copy-to-clipboard.js` (2500 ms), `use-debounced-effect.js` (250/500 ms), `AbortController` 50 s in `fetchWorks`, `invalidatePreviousRequests` | Real timers make flaky E2E; fake clock needed; unmount-before-timeout safe | Use `page.clock.install()`; assert toasts gone at +2.5 s; debounce coalescing (type fast -> one request) |
| F9 | **Animation / transitions** | loader spin (`loader.module.css`), `dropdown 0.5s ease-in-out` (`modules/dropdown/styles.module.css:115,120`), thumbnail `box-shadow 150ms`, report card `transition-duration`, data-provider `filter 150ms`, design LoadingBar | Screenshots mid-transition | `page.addStyleTag({content:'*{animation:none!important;transition:none!important}'})` before screenshots (also freeze `caret-color`) |
| F10 | **Third-party scripts / SDKs in the page lifecycle** | `LogRocket.init` in render (prod), Sentry (`@sentry/browser` alias in webpack), GA4 (`react-ga4`), `process.on(...)` in `_app.jsx:21-27` (browser `process` polyfill from webpack 4) | Webpack 5/Next 12+ no longer polyfills `process.on` -> `TypeError: process.on is not a function` at app boot; Sentry v5 vs bundler | Boot test on R1: no console errors, no `pageerror`. Block 3rd parties in network |
| F11 | **Head management** | `next/head` with custom component `<Meta/>` inside `<Head>` (`pages/works/[id].jsx:143-146`), array `key={name}` metas, JSON-LD via `dangerouslySetInnerHTML`; title also set by `main/head.jsx` | `next/head` de-duplicates `meta` by `name` unless `key` is set, and handles function components differently between Next versions and between SSR and client head manager; Next 13 `next/head` in pages router still works but dedupe/`key` semantics changed | Snapshot BOTH SSR HTML and post-hydration `document.head`; count of `citation_author` equals authors; exactly one `<title>` |
| F12 | **Images via next-images** | `next.config.js:withImages`; 14 imports (list in section 7.3) of `.svg/.png` returning **URL strings** used as `<img src>` and inside SVG `<image href>` (`claim-success-modal.jsx:36,55`) | Next 11+ built-in images/`next-images` incompatibility: imports become `{src,height,width}` objects (Next 11 `next/image` loader) or webpack5 asset modules; `src={obj}` -> `[object Object]` broken images; `next-images` is unmaintained | Visual baseline of each place + a check that no `<img src="[object Object]">`/404 images (collect `response.status>=400` for `image` resources) |
| F13 | **Icons from design sprite** | `<Icon src="#name"/>` (20 distinct ids, all verified present in `public/design/icons.svg`); sprite built by `design build icons` from `design.config.js` (17 listed icons + design lib's own set) | Icon system comes from the (deprecated) design repo; `#check`, `#pencil`, `#magnify` are not in `design.config.js` list but present in sprite (provided by the design lib) | Component test: render every distinct `Icon src` and assert `<use href>` target id exists in the served sprite; screenshot of icon strip |
| F14 | **MobX decorators / `observe`** (state auditor owns) | `store/filters.js` (`@observable` + `makeObservable(this,null)`) | Rendering of filters depends on exact reactivity; any babel decorators change -> facets stop updating without errors | J2/J3 steps; assert counts update after navigation |
| F15 | **MathMarkdown** (design) for title & abstract | `templates/output/index.jsx:155,192` | KaTeX/markdown pipeline in old lib; XSS surface (abstract is raw HTML/markdown from repositories) | Fixture works with `$x^2$`, `<b>`, `<script>`, unbalanced `$` |
| F16 | **`router.asPath` string logic** | `_app.jsx:101` (`/search/` substring), `templates/output/index.jsx:50,81-86`, `results.jsx:46`, `templates/search/index.jsx:44`, `useSyncUrlParamsWithStore` | With trailingSlash, basePath/prefix and Next versions `asPath` format (hash, trailing slash, locale) shifts; copy-URL and back-links are built by slicing it | Assert exact copied URL and "Search results" href in J5/J9 |
| F17 | **Hooks after conditional return** | `pages/search/index.jsx:118-123`, `modules/dropdown/index.jsx:54-76`, `templates/search/results.jsx:30` (`useRouter` inside `.map` callback) | React 18 dev strict checks / eslint rules-of-hooks; works today because condition is stable per mount | Render with `queryError` and with data in the same session via client nav |
| F18 | **Client navigation data-href monkey patch** | `_app.jsx:70-80` | `router.pageLoader.getDataHref` is private and signature changes in Next 11/12/13 | Prod-like prefix build: client-side nav from /search -> /works must request `/search/_next/data/...` and succeed; verify no full reload (`window.__e2eMarker` survives) |
| F19 | **Fixed/overlay layers** | `layout z-index:10000`, OAI modal `10001`, filters `z-index:11`, sort `10`, claim `110` | New design-lib z-indexes could stack differently | Screenshot with facet open under header; modal over sticky header |
| F20 | **Browser-only APIs without guards** | `navigator.clipboard` (HTTP non-localhost contexts undefined -> `TypeError`), `document.execCommand`, `Intl.DisplayNames`, `window.open`, `window.location.href` redirects in `DropDown` | Throw in insecure contexts / old Safari | E2E over `http://localhost` and (separately) a non-secure host header |

---

## 5. Visual regression plan (baseline BEFORE any dependency change)

Tooling: Playwright `toHaveScreenshot` (Chromium; optionally WebKit for Safari-specific checks of `queryCommand`/clipboard/flex gaps), 1 snapshot dir per browser, run in a pinned Docker image (fonts!) so baselines are reproducible. Capture against the **mock API server** with frozen fixtures (no live API: counts/order change daily).

Global stabilisation (apply in a shared fixture):
- `analytics_cookies_allowed` cookie set (hides cookie popup) except for the explicit cookie-banner shot; set `reducedMotion: 'reduce'` and inject `*{animation:none!important;transition:none!important;caret-color:transparent!important}`.
- Block/mocks: `*.tile.openstreetmap.org` (serve a static 256px png), `core.ac.uk/image/**` and `api.core.ac.uk/data-providers/*/logo` (static png/svg), LogRocket, GA, Sentry. Freeze time: `page.clock.setFixedTime('2026-01-15')` (year filter upper bound = `new Date().getFullYear()`, and "Since" ranges depend on `maxYear` from data).
- Wait for: `document.fonts.ready`, no `.loading-bar`, filters `LoadingBlock` gone, `.leaflet-tile-loaded` / `.leaflet-container` present.
- Viewports: **Desktop 1440x900**, **Tablet 768x1024 (just above the 767 breakpoint)**, **Mobile 375x812**, plus **767x900 (boundary: max-width 767 -> mobile layout)** for R2 and R3 only. Full-page screenshots, but clip long lists to first 3 results via fixture (3 cards).

| # | Page / state | Viewports | Mask / stabilise |
|---|---|---|---|
| V1 | `/search/?q=climate` default (filters loaded, 3 results fixture, relevance) | D, T, M, 767 | mask member card (random pick; fixture 1 member + fixed logo, or mask `[class*=memberInfo]` via locator by text "CORE membership"), thumbnails stubbed |
| V2 | V1 with "Filters" open (mobile) / facet open: field, year (histogram + selects), type | D (all 3 facets), M (toggle open) | hover state off; histogram bars deterministic via fixture |
| V3 | V1 with 2 filters applied + "Clear all filters" visible | D, M | |
| V4 | V1 sort menu open; copy-URL toast visible ("Link copied"); download-CSV modal (with radio selected) | D, M | clock frozen so toast stays |
| V5 | `/search/?q=climate&page=5` (pagination first/last labels + dots) and page 1000 notice | D, M(375) | |
| V6 | `/search/?q=zzzz` empty state; API-status-error `ErrorCard`; `/search/` redirect (no shot, assert only) | D, M | |
| V7 | Filters loading state (delay aggregation response, shoot `LoadingBlock` + open "Loading" box) | D, M | |
| V8 | `/works/<id>/` full (3 authors; many-authors variant 25 authors; with DOI; with 3 versions in "Available Versions"; similar works loaded) | D, T, M | map card absent on works; mask thumbnails; fixed dates |
| V9 | `/outputs/<id>/` full incl. Leaflet map card, Report card, license | D, M | tiles stub; **map screenshot clip/mask** if tiles stub differ; marker svg stays |
| V10 | Output edge variants: no abstract; no DOI (no Cite); fulltext disabled; math title/abstract; long title; no reader link | D | |
| V11 | Modals: Cite (before/after copy), Report type (none / one selected), Report form (no role / role chosen / validation), Report success (repository-manager vs author), OAI landing modal (`?source=oai`) | D, M | backdrop included; focus ring visible state |
| V12 | Similar-works states: loading spinner (hold API), error block | D | animation disabled |
| V13 | `/outputs/update/` default, with error message, with modal chain step 1 | D, M | |
| V14 | `/data-providers/` default (10 cards + clustered map), "no results" + form, form states (progress/success/duplicate/error), suggestions dropdown open | D, M | map tiles stub; clusters deterministic (fixture of ~30 providers fixed lat/lng) |
| V15 | `/data-providers/<id>/` member (logo, MetaBox, claim "Sign in/Create account") and non-member ("Become a member"); empty-outputs state; error-outputs state; pagination bar; claim modal, claim-edit modal, success modals (2 variants) | D, M | base64 logo fixture |
| V16 | 404 page; `/error-card/`; "Uh-oh" works/outputs with and without referer | D, M | |
| V17 | Footer + Header (with/without search bar) on `/`, `/search/`, `/works/..` | D, M | design lib header/footer will change with any design bump |
| V18 | Cookie popup (first visit) | D, M | |
| V19 | Print stylesheet of work page (if any `@media print` - grep showed none) | skip | |
| V20 | Dark/contrast: not supported in code (no `prefers-color-scheme`) | skip | |

Component-level snapshots (Playwright component testing or Storybook-less harness): `Pagination` (pages 1, 4, 5, last, siblingCount 0/2), `FilterItem` states (checked/unchecked/disabled/loading "..."), `YearSelects`, `Sort`, `CardDropdown` (member/non-member, no oai, no fulltext), `Notification`, `Loader`, `Error404`, `QueryError`, Map (with 1, 30, 0 locations).

Tolerances: `maxDiffPixelRatio: 0.002` for pages without maps; maps masked or compared with tiles stubbed (use `threshold 0.2`); text anti-aliasing differences are removed by the pinned Docker image.

---

## 6. Accessibility baseline (axe) - what to run per page/state

Setup: `@axe-core/playwright`, `AxeBuilder.withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'])`; store a **baseline JSON of current violations per URL+state** and fail the upgrade only on NEW or WORSE violations (the app is not clean today; do not make "zero violations" the gate).

| Page / state | Run axe on | Known / expected current findings to record (from source) |
|---|---|---|
| R2 results (default) | full page; then with facet open; with sort menu open; with CSV modal open; with mobile Filters open | facets/sort are `div role="presentation"` with `onClick` (not focusable -> `keyboard`/`nested-interactive` best-practice issues); hidden radios; duplicate ids (`id={value}` on filter inputs); `img alt="img"` on ErrorCard (`pages/error-card/index.jsx:9`); `alt="redirect"` decorative image with alt (`modules/dropdown:129`); share/download icon buttons rely on Popover for name (**button-name** risk); toasts lack `role=status` |
| R2 empty / error | full page | heading order, image alt "No results found" |
| R3/R4 | full page; Cite modal open; Report modals (each step); OAI modal | `h2` Citation inside `Modal`; copy `Icon onClick` not keyboard operable; provider header `div onClick` (click-events-have-key-events, disabled in source via eslint comment `modules/dropdown/index.jsx:107-109`); `aria-hidden` focusable button in authors box (unused); anchors `href="#"` (`templates/output/index.jsx:130-134`, eslint-disabled) -> **link-name/valid-href**; multiple `<h1>`? (modal title `h3`), heading order h1 -> h2 Abstract -> h3 versions; colour contrast of `.notification`, member badges; `Modal` `aria-label` usage; map region (`.leaflet-container` role/keyboard) - add `exclude('.leaflet-container')` only with documented reason |
| R5 | full page; error state (`errorMessage` is a plain `<p>`, not `role=alert`) | form label for `TextField id={url}` (`id` is bound to the *input value*, `update/index.jsx:91`: `id={url}` / `name={outputUrl}` - label association may be broken) -> **label** violation likely |
| R6 | full; suggestions open; form states; no results | header search combobox semantics (design); load-more focus management (focus stays on removed/moved button?); map; `role="img" aria-label=""` emoji spans |
| R7 | full; provider search focused; claim modals; pagination nav | disabled arrows `aria-disabled` but still links; `h5` used for member status; `alt` on logo; `Select` combobox semantics (design) |
| R8/R9 | full | single `h1` ("Uh-oh") check; page has `main` landmark |
| Global | header/footer landmarks, skip link presence, `lang` on `<html>` (Next 10 `_document` absent -> no `lang` attribute unless design adds it -> **html-has-lang likely fails today**), cookie popup (focus, `role=dialog`?) | |

Keyboard smoke (Playwright `keyboard.press`): Tab order from header search -> first result; Enter on header input; Esc in each modal; focus returns to trigger after modal close; Tab reaches pagination buttons and Cite button; Space/Enter on Cite. Record failures as baseline, they must not regress.

Reduced-motion and zoom: run V1/V8 at 200% zoom (viewport 720x450 at DPR 2) to check reflow; text-resize handled by `rem` units.

---

## 7. SEO snapshot recipe (critical: indexing)

Installed versions at audit time: `next 10.2.3`, `@oacore/design 5.0.74`. Everything below must be captured **on the unchanged baseline first**.

### 7.1 What to snapshot per URL
Fetch raw SSR HTML (`request.get(url)` - no JS) AND the post-hydration `document.head` (`page.goto` + `waitForLoadState('networkidle')`), normalise (sort tags, strip `data-n-head`, `/_next/static/...` hashes, nonces) and snapshot the sets below. Diff the two: they must be identical for SEO-relevant tags.

| URL (fixtures) | Snapshot content |
|---|---|
| `/works/<id>/` (fixtures: W-full: 3 authors, DOI, abstract, publishedDate full ISO, pdf link; W-minimal: no authors/abstract/date/DOI; W-many: 30 authors; W-unicode: title with quotes, ampersand, `</script>` inside abstract; W-long: 300-char title) | `<title>`; all `meta[name^=citation_]` (name, content, **order**, count); all `meta[name^=DC.]`/`DCTERMS.`; the `application/ld+json` text (parse -> deep-equal; also assert it is valid JSON when title contains `</script>` - **JSON-LD is injected with `dangerouslySetInnerHTML` and only `JSON.stringify`'d: a title/abstract containing `</script>` would break out of the tag [VERIFY]**); absence of canonical/description/og (record as "none"); `<html lang>`; favicon links |
| `/outputs/<id>/` (same fixtures) | same |
| `/search/?q=climate` | `<title>Search CORE</title>`; no description; X-Robots/`robots` meta (none) |
| `/search/?q=zzzz`, `/search/` | title fallback; redirect status/location (301, `Location: /`) |
| `/data-providers/`, `/data-providers/?q=open` | `<title>`, `meta[name=description]`, JSON-LD (BreadcrumbList + SearchResultsPage ItemList, first `size` items) |
| `/data-providers/<id>/`, `/data-providers/<missing>/` | title (default), status 200 / 404 |
| `/works/<missing>/`, `/outputs/<410>/` | status code (**200 today**), body text "Uh-oh", title |
| `/robots.txt`, `/sitemap*.xml` | not served by this app (**[VERIFY]** handled by the proxy) |
| response headers (all) | `Content-Security-Policy` string (from `csp.config.js`), `Link`, `Cache-Control`, `X-Powered-By: Next.js`, `ETag`, `Content-Type: text/html; charset=utf-8` |

Specific assertions to encode (current behaviour, may be bugs):
- `citation_author` count == `authors.length` and values in API order; names are the raw API strings ("Surname, Given"), NOT the display-swapped form used in the page body.
- `citation_publication_date` format `YYYY/M/D` (month de-zero-padded, day NOT de-padded: `formatCitationDate`, `modules/meta/index.jsx:21-25`), falls back to bare `year` (undefined for the raw API object -> tag omitted) **[VERIFY]**.
- `citation_pdf_url`, `DC.format`, `DC.issued`, `DC.identifier`, `DC.subject` present or absent? - decide from the baseline; any change in either direction = a finding (fix is a separate decision, not part of the upgrade).
- JSON-LD `ScholarlyArticle.datePublished` = `publishedDate` (may be year only), `author[].name` for `authors` as given: `Meta` does `(authors||[]).map(author=>({name: author}))` while `authors` are objects `{name}` -> **`name` would be an object** (`[object Object]`/nested) **[VERIFY]**.
- JSON-LD `@id` uses `https://core.ac.uk/reader/{id}` and `image` `https://core.ac.uk/image/{id}/large`: hard-coded prod host (stays identical in test env - good for snapshot stability).

### 7.2 Google Scholar compliance check (quick)
Scholar needs `citation_title`, `citation_author`+, `citation_publication_date`, and one of `citation_pdf_url` / `citation_abstract_html_url` / full-text HTML; the current implementation depends on `downloadLink`. Add a failing-allowed (xfail) test "works page exposes citation_pdf_url when a download link exists" to document the baseline.

### 7.3 next-images inventory (assets that must still render after upgrade)
`modules/dropdown/index.jsx:12` redirect.svg; `templates/output/update/index.jsx:11-12` faq.svg, takedown.svg; `templates/output/report/report-success-modal.jsx:7-8` upvote.svg, confirmed.svg; `templates/search/index.jsx:12,15,16` CoreB.png, Default.svg, repoPlaceholder.svg; `templates/error/query.jsx:4` notFound.svg; `templates/data-provider/logo.jsx:4` Default.svg; `templates/data-provider/index.jsx:5` arrowRight.svg; `templates/data-provider/claim/claim-success-modal.jsx:5-6` check.svg, invitation.svg (**inside inline `<svg><image href=...>`**); `pages/error-card/index.jsx:4` errorCard.svg. Plus static: `public/static/images/{oai.svg,map/marker.svg,redirect.svg,errorCard.svg}` referenced via `getAssetsPath('/static/images/...')` and rewrite `/static/:path* -> /:path*`. Check: every `img` has `naturalWidth>0` on the relevant screens.

---

## 8. Test-suite scaffolding recommendations (repo has none today: no jest/playwright/cypress/storybook configs, no `tests/`; husky 4 + eslint/prettier/stylelint only)

1. **Build/run mode:** `APP_ENV=local API_KEY=test npm run build && npm start` pointed at a local **mock API server** on `127.0.0.1:8000/internal` (`env.config.js` `local` profile - `API_URL` is inlined at build time, so the mock must exist at build; `npm run build` also runs `data/data-loader.js` which writes `data/.statistics.json`, `.formap.json`, `.members.json` (already present in the checkout - committed snapshots; stub the loader or let it hit the mock) so the build does not call prod). Cover: `/v3/search/works` (POST), `/v3/search/works/aggregate` (POST), `/v3/works/:id`, `/v3/works/:id/outputs`, `/v3/outputs/:id`, citations endpoint (`api/outputs.js`), similar (`fetchSimilarTo`), `/members`, `/data-providers/*` (+`/logo`, stats, outputs), report/claim POSTs. Fixtures as JSON files; error-injection by header/query (`?__fail=500`).
2. **Browser-side calls** go straight to `API_URL` (client bundle) -> `page.route` can override per test; **SSR calls** only through the mock server.
3. **Selectors:** our components expose almost no test ids; prefer `getByRole`/`getByLabel`/`getByText` and ids that exist: `#search-output-{id}` (result card), `#similar-output-{id}`, `#full-text-thumbnail-{id}`, `#metadata-authors`, `#metadata-publication-date`, `#metadata-publisher`, `#doi`, `#abstract`, `#header`, `#add-new-data-provider`, `#data-provider-url`, `#search-filter`, `#data-providers-outputs-select`, `#map`, `#cite-bibtex`, `nav[aria-label="Pagination Navigation"]`, `aria-pressed` on Cite. **Never** select on `styles.*` classes (hashed, and F1 changes them). Where unavoidable, add `data-testid`s in a *separate, behaviour-neutral* commit before the upgrade.
4. **Contract/snapshot layers:** (a) SSR HTML head snapshots (section 7) as plain Node tests using `fetch` - fast, run on every dependency bump; (b) Playwright journeys J1-J17; (c) visual (section 5); (d) axe (section 6); (e) a "console budget" fixture: fail on `pageerror` and on `console.error` (allow-list known warnings from baseline: list them first).
5. **Network-recording baseline:** record the sequence of requests per journey (HAR) once - after upgrade compare URL set (esp. `/_next/data/...` prefix behaviour, `/static/search/...` assets, aggregate calls count per filter change).
6. **Order of confidence work before upgrading:** J6 SEO contract -> J1/J2/J4/J5 -> visual V1/V8/V9/V14/V15 -> modals (J7/J9/J11) -> a11y baseline -> remaining.

## 9. Appendix - component map (what talks to what)

```
_app.jsx -> Main -> Layout(Header[design], Footer[design], LoadingBar) 
R2 search  : pages/search -> templates/search(index, results, pagination, sort, notification, modals/download-results)
                           -> modules/filters(index, bar-item, filter-item, search, loading-block, year/{index,custom-range,selects,hooks})
                           -> modules/search-layout(Search, Main, Sidebar, Result, ResultStats)
R3/R4 work : pages/works|outputs -> modules/meta + templates/output(index, metadata, citation, thumbnail-card, card-dropdown -> modules/dropdown,
                                    other-versions, similar-works -> modules/loader, related-search, keywords, map-card -> modules/map(leaflet), report/*)
R5 update  : templates/output/update -> report/* modals
R6 dp list : pages/data-providers/index -> templates/data-providers(index, result-card, form) -> modules/map, hooks/use-sync-url-params-with-store, use-debounced-effect
R7 dp page : pages/data-providers/[id] -> templates/data-provider(index, search[design Select], pagination[next/link], meta-box, map-card, claim/*)
errors     : templates/error(404, query), pages/error-card
Unused     : modules/{authors-box,show-more,title,logo,copyable-input}, templates/output/{api-card,chips}, claim/sign-in-modal, layout/maintenance-banner
Design-lib components in play: Header(useSearchBar), Footer, Cookies/CookiesProvider/useCookie, DesignProvider, LoadingBar, Button, Card(+Title/Description/Footer), Icon, Link, Modal(+Title/Content/Footer), Popover, Form(Group/Addon/Control/Label), TextField, Select, Fieldset, SearchResult, MetadataList, ExpandableList, MathMarkdown, Histoslider, ProgressSpinner, DataProviderLogo, classNames util
```
