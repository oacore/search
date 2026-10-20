# 30 - Known quirks register (Q-001..Q-098, S-1..S-10)

**Purpose.** Existing bugs and odd behaviour found by the audit, what users and crawlers see today, its class under [00](00-decisions.md) D1/D1a, and the tests that pin it.
**Read** before touching code that looks wrong, or when a characterization test fails "for a weird reason": if it is listed, it stays. **Owns** the Q rows, the Q to T map ("Pinned by"), §E and the security notes. Bare numbers are files `NN-*.md`; statuses: [STATUS](STATUS.md) §4.

## 1. Rules

1. **Class.** A row is **PRESERVE** (D1, D8: the test pins today's behaviour, nobody fixes it) unless its ID says **WATCH** (PRESERVE plus a named trigger that would make it ESCALATES; the listed test detects it); every §E row is **ESCALATES** (D1a: severe on a named version). Pins are proven per **clause**: the behaviour cell (§E: *Today (pinned)*) split on top-level `;` and before `(b)`…`(e)` items, labelled by position (`Q-058 c3`), not new IDs (`docs:check --cases-out` emits them). A clause is pinned when its own C1-Q fault, the minimal fix as a valid patch, turns at least one "Pinned by" test red (a whole-page oracle it turns red joins "Pinned by" in the same PR); a row is PINNED when each clause is pinned, exempt or marked `none` ([55](55-gates-and-confidence.md) C1-Q). **C1-Q-exempt** (behaviour set by a deploy workflow or a prod secret outside every image): Q-095 (workflow tag; pinned by T-903, T-604) and Q-096 (prod DSN and CSP outcome, VF-04; pinned by T-904 and C6-prod row 8); list governance: 55 C1-Q.
2. **ESCALATES lifecycle** (OD-09 + OD-40, DECIDED 2026-10-20; state in STATUS §4, default CANDIDATE): CANDIDATE -> PROVEN (pre-fix test red on a React 18/19 spike at W5.5, green on the current stack) -> FIX-APPROVED (owner signs the PR) -> FIXED; else REJECTED = PRESERVE. Q-050..Q-052 are on the approved list (OQ-8); their §E "Proof" still applies. A fix follows D1a (00) and 01 §3: own `escalates` PR, pinning test green before and after, owner signature.
3. Works SSR 500s (Q-001, Q-073) and blank pages (Q-074) stay PRESERVE even if a version changes how they fail (OD-09/OD-40). A changed failure mode keeps its status code, `Location` and `<title>`: T-601 and T-731 status cells are never AD-acceptable. Only the framework error page's look and text (R-085, OD-38) and the OD-39 header deltas may become AD rows (42 §8). If code cannot keep the status: stop (01 §8), the owner decides (OD-09).
4. Not quirk fixes: changes that only keep today's behaviour working after an upgrade (e.g. `Histoslider` props on React 19) are CS rows. Security notes are preserved like quirks (D16 WITHDRAWN; S-4: OD-36).
5. IDs are stable, not monotonic by section; Q-086 is unallocated (folded into S-4); sub-IDs Q-048.U1-U4. `path:line` is valid for tree `a825839`; design `src/...` is `../design` at `bbc35a0`; a PR that moves pinned code updates the Where (55 C1-Q freshness); a PR that edits a behaviour cell re-maps its clause patches and `none` marks in the same PR; a CS or AD row that removes a clause's behaviour (e.g. Q-069 c1–c3 at W7a, OD-39) marks it `none` in the same PR (an acceptance change, 40 §8 rule 8). `Xnn.n` = `review:00` entry (`findings/review-2026-10-19/`). `[VERIFY: x]` -> VF-## in STATUS §3.
6. A quirk whose input the framework produces (query parsing, param decoding, routing) needs a G- or H-layer pin ([40](40-test-strategy.md) §3); F-layer tests build `context` by hand and do not count for it.

## 2. Summary

97 quirks (Q-086 unallocated): **PRESERVE 86**, **WATCH 5** (Q-014, Q-027, Q-047, Q-065, Q-071), **ESCALATES 6** (approved Q-050..Q-052; candidates Q-072, Q-075, Q-093).

## A. Routing, status codes, SSR, head

| ID | Quirk and what is observed | Where | Pinned by |
|---|---|---|---|
| Q-001 | **Soft 404:** API errors render "Uh-oh" with **HTTP 200**. Except works **410**: `serverError.message` gets the parsed body (object, or Blob for text) and rendering it throws React #31: **HTTP 500**; outputs 410 = string, 200. Live 410 body: VF-03. X30.2 | `pages/works/[id].jsx:89-98` | T-502, T-503, T-601, T-731 |
| Q-002 | **Empty `/search/` redirects permanently:** 308 `Location: /`. | `pages/search/index.jsx:19-27` | T-601, T-501 |
| Q-003 | **Search error vs "no results":** upstream error with a status -> ErrorCard (200); network error -> "no results". | `pages/search/index.jsx:73-81` | T-501, T-716, T-401 |
| Q-004 | **Statistics always use the fallback:** placeholder "...more than 356 million..."; `/data-providers` says "...contains a lot of...". | `pages/_app.jsx:118-132` | T-119, T-602, T-606 |
| Q-005 | **Gateway reachability:** only `/search`, `/works`, `/outputs`, `/data-providers`, `/static/search`, `/display` reach the app. Not routed: `/`, `/404`, `/api/healthz/`, `/error-card/`. `/display/<id>` 308 -> `/outputs/<id>/`; `/display/` 404; `/static/search` 200 empty shell; `/searchx/`, `/robots.txt` other service; unknown path under a routed prefix: "Uh-oh" 404. X30.22 | `kube/prod/httproute.yaml:12-65` | T-601, T-612, T-723 |
| Q-006 | **`/` is an empty shell** if the pod is hit directly; never routed (Q-005). | `pages/index.js:1` | T-601 |
| Q-007 | **Module-level `statistics` mutated per request** (same constant); harmless. | `pages/_app.jsx:118-132` | T-119 |
| Q-008 | **`isSearchPage` is a substring regex:** any URL containing "search" gets the search header style. | `pages/_app.jsx:101` | T-415, T-801 |
| Q-009 | **Process hooks in `_app` module scope; `LogRocket.init` in render; conditional hook.** With a build-time DSN `@sentry/node` 5.30 exits 1 after a flush on an uncaught exception despite the app handler; without a DSN it survives (prod DSN: VF-04). Sentry 8+ survives (R-055, CS-SEN-2, OD-14). X10.4 | `pages/_app.jsx:21-27,90-98` | T-608, T-606, T-701 |
| Q-010 | **ErrorBoundary has no fallback:** a render error blanks the page, one Sentry report (Q-074). | `pages/_app.jsx:29-45` | T-415, T-730 |
| Q-011 | **Client `App.getInitialProps`:** client navigation to `/outputs/update/`, `/404`, `/error-card/` makes up to 3 browser GETs to `api.core.ac.uk/internal/*`. | `pages/_app.jsx:125-137` | T-702 |
| Q-012 | **Unencoded query strings:** `C# & C++` gives `q=C`; `a&page=5` injects params. | `pages/works/[id].jsx:130` | T-420, T-402, T-707 |
| Q-013 | **`/search` paging maths:** `offset` ignores `limit`; `page=0` -> `offset:-1`; `page=abc` or `>1000` -> no request, `results:[]`. | `pages/search/index.jsx:30-45` | T-501, T-601 |
| Q-014 **WATCH** | **`getDataHref` patch forwards one arg;** prod data URL `/search/_next/data/...`. Client side: R-002; the server rewrite breaks from 12.2 (R-068, CS-OPS-1). Trigger: Next 12+ passes an object. | `pages/_app.jsx:70-80` | T-604, T-702 |
| Q-015 | **Search with a work lacking `dataProviders`:** the transform throws; the search shows `queryError`. | `utils/data-providers-transform.js:63-76` | T-501 |
| Q-053 | **SEO meta is smaller than the code suggests:** `modules/meta` reads `downloadLink`, `year`, `oai`, `subjects`; pages pass the raw API object, so these tags need those exact payload keys. JSON-LD `author[].name` is an object, `datePublished` raw. `citation_publication_date`: `2024-01-01...` -> `2024/1/01`; string year `"2001"` -> `2001/NaN/undefined`; numeric year -> 500 (Q-073). | `modules/meta/index.jsx:4-38,91-100` | T-602, T-729 |
| Q-069 | **Post-hydration head corruption (works/outputs):** `DC.creator` cut to 1; `DC.title`, `DCTERMS.abstract`, `DC.identifier`, `DC.subject` and JSON-LD vanish; viewport, charset, 5 favicons duplicate (survivors vary with author/subject counts); stale after client nav. SSR HTML is complete; Googlebot renders JS; Next 15 keeps all tags (R-071, OD-39). X10.8 | `pages/works/[id].jsx:143-146` | T-602, T-729 |
| Q-073 | **SSR 500 triggers** (Q-098): (a) empty `publishedDate` + numeric `yearPublished` (live works 6948813, 19211324; prevalence VF-03); (b) works with `dataProviders: []`; (c) output with no download link and `sourceFulltextUrls` null or absent; (d) `?q=100%25` on `/data-providers/` (Q-028). `_next/data` stays 200 while the direct URL is 500; SEO fixes: OD-23. X30.3 | `modules/meta/index.jsx:21-25,99`, `templates/output/card-dropdown.jsx:80` | T-601, T-602, T-731 |
| Q-074 | **Post-hydration blank page** (SSR intact, `#__next` empty): (a) output with `doi: null`; (b) work DOI + >=4 distinct output DOIs (React #310); (c) provider without `location` (Q-058); (d) similar results with `dataProviders: []` (Q-064); (e) year facet with empty/out-of-range aggregation. X30.4 | `templates/output/index.jsx:65-71` | T-730 |
| Q-098 | **No `pages/_error`:** an uncaught SSR exception shows Next's built-in error page in the layout (10.2.3 title `: An unexpected error has occurred`); varies per Next version (R-085, OD-38). X20.13 | none | T-601 (forced 500), T-731 |

**Q-053 per page type** (SSR; every page has viewport, charset, 5 favicon links from `main/head.jsx`; `/data-providers/:id/`, `/outputs/update/` keep the default site title and no tags).

| Page | `<title>` | App-owned tags |
|---|---|---|
| `/works/:id/` | `{title} - CORE` | `citation_title`, `citation_author` xN, `citation_publication_date`, `DC.creator` xN, `DC.title`, `DCTERMS.abstract`, JSON-LD |
| `/outputs/:id/` | `{title} - CORE` | as works, plus `DC.identifier`, `DC.subject` only if the payload has `oai` / `subjects` keys [VERIFY: VF-03 sample] |
| `/search/` | `Search CORE` | none |
| `/data-providers/` | `Data providers search` (query never shown: Q-080) | `description`, JSON-LD |

Absent unless the live payload has the exact keys (VF-03 sample): `citation_pdf_url`, `DC.format`, `DC.issued`. Always absent: canonical, robots, Open Graph, Twitter, `<html lang>` (Q-054). robots.txt, sitemap, manifest, favicon.ico: not this app (VF-14).

## B. HTTP layer and data

| ID | Quirk and what is observed | Where | Pinned by |
|---|---|---|---|
| Q-016 | **`?t=undefined` always appended** when `t` is absent; `?t=a%26b%3Dc%20d` reaches upstream as `?t=a&b=c+d`; repeated `t` throws: 200 soft 404, 0 upstream calls. | `api/works.js:5-9` | T-501, T-502, T-504, T-601, T-607 |
| Q-017 | **JSON regex has a literal `\+`:** `+json`, `text/json`, no content type -> Blob. | `api/index.js:93` | T-102 |
| Q-018 | **`body:null` sends the string `null`,** no Content-Type. | `api/index.js:30-33` | T-101 |
| Q-019 | **Claim POST body is a string** (`text/plain;charset=UTF-8`). | `store/claim.js:40-42` | T-205 |
| Q-020 | **AbortSignal appended positionally:** `reset()` makes `sortType` the signal (`sort=[object AbortSignal]`). | `store/filters.js:342` | T-121, T-202 |
| Q-021 | **Only `Claim.retrieve` cancels;** the last *resolved* aggregation or similar-works response wins (RG-4 in 55). | `store/filters.js:73` | T-211 |
| Q-022 | **Host override ignored by native fetch:** in-cluster calls carry the service host (Node 18-26 verified); node-fetch and axios send the override (OD-20, VF-02). | `api/internalize.js:29` | T-104, T-607 |
| Q-023 | **Wrong member keys:** code reads `billingType`, data has `billing_type`, so all 477 rows (426 `starting`) count as members; `checkType` compares a number array with a string. | `utils/data-providers-transform.js:5-15` | T-106, T-402 |
| Q-024 | **`checkLogo` called with one arg:** logo always `null` on works/outputs (requests: Q-090). | `pages/works/[id].jsx:41` | T-502, T-503 |
| Q-025 | **Loader cache quirks:** `timestamp=getDate()`, results discarded, sync 5.6 MB read per SSR request. | `lib/loader.js:37` | T-118 |
| Q-026 | **data-loader fails the build when the API is down:** API >=400 or network error -> exit 1 (blocks deploys); one URL 500 -> partial write; 200 `[]` overwrites all three files, exit 0; a hang never exits. CS-N12-1 changes log text, adds a 300 s timeout (R-017, OD-08). | `data/data-loader.js:88-99` | T-117 |
| Q-027 **WATCH** | **ClaimCard fetches in render:** `GET /internal/data-providers/{id}/account` every render incl. SSR; claim POST failure is silent (counts: Q-087). Trigger: unbounded refetch on React 18. | `templates/data-provider/claim/claim-card.jsx:104-106` | T-412, T-734 |
| Q-028 | **`decodeURI` on a decoded `q`:** `?q=100%25` throws `URIError` (SSR 500, Q-073d). | `store/data-providers.js:42` | T-208 |
| Q-029 | **`formatDate` on an invalid date** returns a Date object; React crashes (Q-050). | `utils/helpers.js:27-40` | T-108 |
| Q-030 | **`sourceFulltextUrls` double-wrapped** (`[[...]]`). | `pages/outputs/[id].jsx:61-66` | T-503 |
| Q-031 | **`mainDataProviderLink` never null; arXiv uses `.com`** (Q-081). | `pages/works/[id].jsx:52-83` | T-502 |
| Q-032 | **`findDataProviders` import does not exist:** latent TypeError, unreachable. | `store/search.js:6,62` | T-001 |
| Q-033 | **`transformFiltersData` needs a `language` aggregation;** else a caught TypeError and stale filters. | `utils/filters-transform.js:87-89` | T-105 |
| Q-034 | **Filter `checked` by substring:** year `2019` anywhere in `q`; `Art` by "Article". | `utils/filters-transform.js:107-121` | T-105 |
| Q-035 | **Provider id coercion:** `/data-providers/0x56/` resolves provider 86, calls the API with `0x56`. | `utils/data-providers-transform.js:78` | T-504, T-106, T-601 |
| Q-036 | **Takedown regex has unescaped dots:** `core2ac3uk/outputs/5` -> id `2`. | `templates/output/update/index.jsx:40-41` | T-411 |
| Q-037 | **Malformed BibTeX throws a string in render;** Cite text `"{title}, Journal: {j}, : {year}"`; APA never shown. | `templates/output/citation.jsx:65-104` | T-114, T-410 |
| Q-038 | **Non-JSON 409 message throws** in render. | `templates/data-providers/utils/generate-form-message.jsx:53` | T-413 |
| Q-039 | **`usePagination` returns `undefined`:** NaN page or undefined size crashes Pagination. | `hooks/use-pagination.js` | T-303 |
| Q-087 | **ClaimCard SSR always "Not a member yet";** after hydration badge and text flip by whether `/account` returns accounts (not billing). One load: 1 SSR + 2 browser GETs with accounts, 1 + 1 without. X30.13 | `templates/data-provider/claim/claim-card.jsx:114,154` | T-412, T-734 |
| Q-090 | **Logo requests:** (a) `checkLogo` GETs `{API_URL}null` (provider page, member without logo) or `{API_URL}undefined` (works/outputs when `logo` is null). (b) design `SearchResult` hooks inside `.map` (Q-047) fire a browser GET `api.core.ac.uk/data-providers/{id}/logo` per member result (E22; no credentials, no dedupe). X30.10, X30.15 | `utils/data-providers-transform.js:25-34`, design `src/modules/search-result/search-result.jsx:84-110` | T-502, T-504, T-417, T-702, T-402 |
| Q-091 | **Claim flow: an aborted call's `AbortError` sticks:** #1's rejection lands after #2's `reset()` and `isLoading` goes false while #2 runs; error > created hides #2's success. An SWR latest-wins port would fix it (forbidden, D1). X30.9 | `store/claim.js:35-52` | T-205, T-734, T-121 |

## C. UI behaviour

| ID | Quirk and what is observed | Where | Pinned by |
|---|---|---|---|
| Q-040 | **Filter add/remove by substring:** `q='Article'` + `Art` cannot be added. | `store/filters.js:176-194` | T-202 |
| Q-041 | **Greedy year regex** wipes later filters. | `store/filters.js:241` | T-202 |
| Q-042 | **"Clear all filters" keeps the first word** (`machine learning AND ...` -> `machine`); undefined query throws after the push. | `store/filters.js:326-343` | T-202, T-704 |
| Q-043 | **Data-provider sort inverted:** "recent" and "relevance" both push `sort=relevance`; deletes `Router.query.id`, pushes `page:1`, keeps `offset`. | `store/search.js:92-104` | T-204, T-715, T-735, T-408 |
| Q-044 | **Data-provider pagination:** Previous points at the current offset (`'PREV'` case); LAST is empty when `total%limit==0`; disabled arrows only `aria-disabled` (Q-083). Error state (V35): pager "Showing 91-100 of 95". | `templates/data-provider/pagination.jsx:37,41,87` | T-406, T-715, T-735 |
| Q-045 | **Search "Next" never disabled:** the last page pushes `page=last+1` (Q-083). | `templates/search/pagination.jsx:96-104` | T-405, T-736 |
| Q-046 | **Back-link garbage:** without `search=`, `slice(6)` of `asPath` builds a nonsense href; wrong with it too (Q-076). | `templates/output/index.jsx:83-86` | T-419, T-707 |
| Q-047 **WATCH** | **Rules-of-hooks violations:** 7 sites listed in R-033, incl. design SearchResult hooks in `.map` (Q-090). Crash only if a condition flips on a mounted instance; lint must not force fixes (OD-15). | R-033 (10) | T-401, T-417 |
| Q-048 | **`/data-providers` URL sync:** U1 Back to a URL without `q` is eaten; U2 unknown params stripped; U3 a client revisit keeps old params; U4 no results flips `action=ADD`. | `hooks/use-sync-url-params-with-store/index.js` | T-302, T-722, T-209 |
| Q-049 | **Missing `observer`:** Sort shows an empty menu unless something re-renders (variant: from `/search?sort=recent`, R-039). | `templates/data-provider/index.jsx:40-202` | T-408, T-715 |
| Q-054 | **No `<html lang>`, a11y debt** (`div role="presentation"` pills, toasts without `aria-live`); current axe violations are the baseline. | `templates/output/update/index.jsx:91` | T-803, T-806 |
| Q-055 | **Similar works fetched only on mount:** `/outputs/A` -> `/outputs/B` keeps A's. | `templates/output/similar-works.jsx:29-31` | T-712 |
| Q-056 | **CSV modal closes before the download finishes.** | `templates/search/modals/download-results.jsx:36-37` | T-409 |
| Q-057 | **Header search config captured at mount** (re-search reuses mount-time sort, t, limit). | design `src/modules/header/search-bar.jsx:14-67` | T-420 |
| Q-058 | **Map quirks:** 0 locations -> TypeError `:53`; no `location` -> `Invalid LatLng`, blank page (Q-074c); `zoom` ignored; popup `href` unquoted. | `modules/map/map.jsx` | T-414, T-730 |
| Q-059 | **GA quirks:** `hitType:'search'` (Q-071); `title` ignored; `send` runs without consent; consent applies next load (Q-070); `console.log("GA")`. Accepting analytics with `GA_TRACKING_CODE` unset: `ReactGA.initialize` throws, the page unmounts. | `hooks/use-analytics.js:7-50` | T-305, T-719 |
| Q-060 | **Report API error not shown in modals** (message only on `/outputs/update/`). | `store/report.js` | T-411, T-713 |
| Q-061 | **Unreachable claim UI:** `ClaimModal` never activated, `sign-in-modal.jsx` unused. | `templates/data-provider/claim/claim-modal.jsx` | T-412 |
| Q-062 | **DOI list appears only after hydration;** the effect crashes on `doi:null` (Q-074a). | `templates/output/index.jsx:65-71` | T-602, T-707, T-419 |
| Q-063 | **"Download PDF" has no href** (transient anchor). | `templates/output/thumbnail-card.jsx` | T-710 |
| Q-064 | **Similar-works crash on empty `dataProviders`** (blank page, Q-074d). | `templates/output/similar-works.jsx:53` | T-419, T-730 |
| Q-070 | **Consent popup keyed on `essential_cookies_allowed`:** "Essential only" sets it; "I agree" also sets `analytics_cookies_allowed`; value `true`, `path=/`, 1 year, no other attributes; consent after mount applies next load. | design `src/elements/cookies/cookies.jsx:11-13` | T-416, T-740 |
| Q-071 **WATCH** | **GA `search` hit is a no-op:** warns `Send command doesn't exist: search` on every load and route change (react-ga4 2.1.0 and 3.0.1); only hard-load `gtag('config')` makes a page_view (VF-13). Trigger: re-check at the react-ga4 bump (W4c). X30.8 | `hooks/use-analytics.js:10-16,33` | T-305, T-719, T-741 |
| Q-076 | **"Search results" back-link** uses the SSR-re-encoded `asPath` (`?q%3Dclimate&page=2`); hydration does not patch it. X30.6 | `templates/output/index.jsx:83-86` | T-419, T-707 |
| Q-077 | **CSV modal reopen** highlights "Current page" but `activeLimit` keeps the last choice. | `templates/search/modals/download-results.jsx:35-38` | T-409, T-711 |
| Q-078 | **Report form highlights "Repository manager" but `role` is null;** Submit disabled. | `store/report.js:15` | T-411, T-713 |
| Q-079 | **Provider page: the first search is swallowed** (`isInitialised` guard). | `templates/data-provider/search.jsx:12-19` | T-715, T-735 |
| Q-080 | **`/data-providers/` reads `params.query`** (key is `q`): title always "Data providers search", header input empty. | `pages/data-providers/index.jsx:36,85` | T-714, T-722, T-602, T-505 |
| Q-081 | **Works page renders an empty "View on" anchor** without arXiv/PubMed link (live shape: VF-03). | `pages/works/[id].jsx:79-83` | T-602, T-801 |
| Q-082 | **Takedown "got it" never soft-refreshes** (`asPath` has a trailing slash). | `templates/output/report/report-success-modal.jsx:30-34` | T-713 |
| Q-083 | **`pointer-events:none` traps** (last-page Next, active page, disabled facets, active sort, provider arrows); keyboard/forced clicks fire. | `templates/search/styles.module.css:73-82` | T-405, T-406, T-736, T-706 |
| Q-084 | **Header search blur** submits only below 500 px on `/data-providers/`; elsewhere `changeOnBlur:false` wins (spread order). | design `src/modules/header/search-bar.jsx:131-137` | T-714 |
| Q-085 | **Modal layering:** header (z 10000) above overlay (z 1030), so a backdrop click over the logo navigates away; Esc needs focus inside; `hideManually` modals ignore Esc/backdrop, no X; body overflow ends `unset`. X30.14 | design `src/modules/modal/modal.jsx:44-75` | T-733, T-804, T-736, T-409 |
| Q-088 | **Sticky header over a fixed filters bar;** horizontal overflow (534 px at 501, 346 px at 320). X30.23 | `modules/filters/styles.module.css:2-8` | T-738, T-739, T-801 |
| Q-089 | **Duplicate DOM ids:** `about-title` x2, `author` / `doi` x N, `data-provider-webpage-title` x N. | `templates/output/metadata.jsx:21,53`, design `src/modules/header/header.jsx:245,251` | T-803 |
| Q-092 | **Filter requests:** clear-all sends 2 identical aggregation POSTs (toggle or new `q` 1; page/sort 0); a refined query containing the previous `q` keeps stale buckets with count 0. X30.11 | `modules/filters/index.jsx:17-24` | T-201, T-202, T-403, T-702 |
| Q-094 | **Client store singleton persists across navigations** (`report.error`, `activeLimit`, `Filters.initialData`). Code reading only [VERIFY: T-713 SPA-hop]. | `store/index.jsx:12-21` | T-206, T-713 |
| Q-097 | **MathMarkdown renders KaTeX only;** `**x**` stays literal. | `templates/output/index.jsx:155,192` | T-801, T-602 |

## D. Design system (inherited)

| ID | Quirk and what is observed | Where | Pinned by |
|---|---|---|---|
| Q-065 **WATCH** | **Sentry alias keyed on `config.isServer`** (always `undefined`): maps to `@sentry/browser`; the server is right only because Next 10 externalises `@sentry/node` first. Webpack 5 (W4b) would bundle the browser SDK into the server (R-040); CS-W0b-3 fixes it (W0b). | `next.config.js:97` | T-004 |
| Q-066 | **Button focus ring never renders** (`color-mod(...)` unresolved). | design `lib/elements/button/button.css:5` | T-003, T-801 |
| Q-067 | **Duplicate sprite ids** (`office-building`, `account`, `open-in-new`; first wins); prod sprite 48 symbols (dev 49). | `public/design/icons.svg` (generated) | T-005 |
| Q-068 | **Design global leaks, stale closures:** global `ul{...list-style:none}`; Modal uses the first-render `onClose`; Fieldset throws on empty `items`. | design `src/modules/header/advanced-search.css:16` | T-801, T-417 |

## E. ESCALATES (evidence: X30.6, X30.19, X30.24)

| ID | Quirk and where | Today (pinned) | Escalates at; how it shows | Proof | Minimal fix (keeps today's visible result) | Pinned by |
|---|---|---|---|---|---|---|
| Q-050 | **SSR dates in server TZ (UTC)** (`templates/search/results.jsx:33-37`, `templates/output/card-dropdown.jsx:75-77`; Q-029). | SSR shows UTC; React 17 patches it to browser-local. Zone-less ISO values match everywhere | React 18: hydration error, root re-render for users whose TZ shifts the day | VF-03 or the C4 corpus responses (55 C4): dates carry `Z`, offset or date-only (zone-less: WATCH, no fix); T-701/T-728 red in Los_Angeles and Tokyo on the spike | CS-R18-2 (20): server-equivalent first render, browser-local text after mount (hook at the top of `Results` and `CardDropdown`); not `suppressHydrationWarning` (fails on React 19); never a fixed UTC | T-108, T-701, T-728, T-801 |
| Q-051 | **Cookie popup rendered from `typeof window`** (design `src/elements/cookies/cookies.jsx:31-36`). | No popup in SSR; the first client render shows it when `essential_cookies_allowed` is absent (first visits, crawlers); React 17 inserts it silently | React 18: hydration error, root re-render on every first-visit load; with a DSN a Sentry event per view; `LogRocket.init` and the ClaimCard fetch rerun | T-701/T-728 red on the spike, no cookie | CS-R18-3 (20): popup rendered after mount; visible result unchanged | T-416, T-701, T-728, T-740 |
| Q-052 | **Dev mode disables SSR** (`pages/_app.jsx:139-157`). | `next dev` serves empty HTML; production unaffected | React 18: "Hydration failed" overlay on every dev page hides Q-050/Q-051 (developer workflow only) | Production `.next/server` and `.next/static` identical before and after (T-014 method, 42) | CS-R18-4 (20): delete the non-production `NextApp` wrapper | T-701, T-014 |
| Q-072 | **Nested `<a>` in `<a>`:** FullTextThumbnail passes `tag='a'` to design `Card` unless `fulltextStatus === 'disabled'`; the card holds `<a>` buttons (`templates/output/index.jsx:225`). | The parser hoists inner anchors (no-JS DOM 0 inside, hydrated 2-6); React 17 repairs silently | React 18/19 hydration error, root re-render [VERIFY: VF-23] | VF-23: T-701/T-728 red on the spike | CS-ESC-1 (20): minimal DOM fix removing the nested anchor; pixels and behaviour equal today's | T-701, T-417, T-728, T-802 |
| Q-075 | **`/display/:id/` breadcrumb:** the gateway rewrites to `/outputs/*`, client `asPath` stays `/display/...` (`templates/output/index.jsx:81-82`). | Server tail "> Research output from X" is silently deleted by React 17; `/display/ID` -> 308 `/outputs/ID/` | React 18/19 #425/#423/#418: root re-render on every `/display` load | T-728 red on the spike via the proxy (T-612); API `/display/` links: VF-03 | CS-ESC-2 (20): first render replicates the server breadcrumb, client value after mount | T-723, T-732, T-728 |
| Q-093 | **`Intl.DisplayNames` region text** (`templates/data-provider/index.jsx:24-38`). | Server (ICU 74) and Chrome 152 differ for FK, HK, MO, PS; no `DisplayNames` prints the raw code; React 17 patches silently | React 18: root re-render on `/data-providers/:id/` for such providers | T-728 red on the spike for one | CS-ESC-3 (20): server-equivalent first render, browser value after mount | T-108, T-728 |

## F. Ops quirks

| ID | Quirk and what is observed | Where | Pinned by |
|---|---|---|---|
| Q-095 | **Deploy behaviour:** tag `<sha7>-prod`: a same-SHA nightly rebuild re-pushes the tag and rolls nothing out; `IfNotPresent` allows a mixed fleet [VERIFY: a prod rollout's `_next/data` 404 count, T-903 (55 C6-prod row 10)] whose builds 404 each other's `_next/data/<buildId>/`. X30.20 | `.github/workflows/aks_deploy.yml:40` | T-903, T-604 |
| Q-096 | **Sentry environment:** the stage client bundle has no `Sentry.init` (`SENTRY_DSN` empty at stage build); the legacy DSN host `o318858.ingest.sentry.io` (in `master` history) does not match CSP `connect-src sentry.io`, so prod browser events are probably blocked (prod DSN: VF-04). X30.20 | `csp.config.js:52` | T-904, T-720 |

## Security notes (outside upgrade scope)

| # | Observation | Where | Note |
|---|---|---|---|
| S-1 | **API key is public:** `API_KEY` is inlined into the client bundle. | `next.config.js:12`, `env.config.js:25-32` | Treat as public. |
| S-2 | **API key goes to every host:** `Authorization: Bearer` + `credentials:'include'` on every `api/index.js` request, incl. `doi.org` and logo URLs. At 6.3 an unwrapped `AxiosError` would leak it into `__NEXT_DATA__` (R-028). | `api/index.js:36-51,71` | Kept (D1); T-101, T-122, T-610; decide before 6.3 (OD-20). |
| S-3 | **`NPM_TOKEN` in image history and runtime secrets.** | `Dockerfile:6,18` | BuildKit secret at 2.1 (CS-W0-8), kept because it directly affects the plan: CI images of the same Dockerfile must carry no token (00 §6); the token goes when no `@oacore/*` comes from GitHub Packages (60 DV6). |
| S-4 | **Executable stored XSS via JSON-LD:** `JSON.stringify` leaves `<` unescaped, so `</script><script>...` in a title or abstract runs in the prod build (`window.__PWN === 1`, 0 CSP violations: `script-src-elem` has `'unsafe-inline'`) and corrupts `document.head`. Source: harvested repository metadata. X30.1 | `modules/meta/index.jsx:128-141`, `templates/data-providers/utils/generate-metadata.js:2`, `pages/data-providers/index.jsx:91-96` | **Preserved** (OD-36, 2026-10-20; D16 and CS-SEC-1 WITHDRAWN): today's behaviour pinned in T-602 (fixture 1004, sandboxed browser) and T-113; no fix in this track. |
| S-5 | **Open Next advisories,** incl. critical GHSA-2xp9-vwfh-vxw4 (image optimizer RCE) on 10.2.3 and every interim prod stop below 15.5.24; also node-fetch 2.6.1, svgo 1, lodash. | 10 R-072 | Short dwell per stop; optimizer endpoint as today (OD-41); CI-8. |
| S-6 | **CSP:** `script-src-elem` allows `'unsafe-inline' 'unsafe-eval'`; prod `script-src` has no `'unsafe-eval'`, so eval is blocked and that token is a no-op. Next 16 Turbopack adds a 361 B inline script per page; 308s lose the CSP header from Next 13.5 (R-083); every 308 carries `Refresh: 0;url=<Location>`. X30.21 | `csp.config.js:20-31` | Do not tighten (D1); CS-LR-2 adds a LogRocket host (AD row, OD-39). T-603 pins CSP per response class and the inline-script count. |
| S-7 | **MathMarkdown renders repository-supplied titles/abstracts:** XSS surface. | `templates/output/index.jsx:155,192` | A `<script>` fixture (T-602, T-801) pins current escaping. |
| S-8 | **Container runs as root; one image holds dev deps.** | `Dockerfile` | Out of scope. |
| S-9 | **Public client source maps:** 27 `.js.map` + 8 `.css.map` (6.6 MB, with `sourcesContent`) under `/static/search/_next/static/**`. X30.21 | `next.config.js:3-4,106` | Kept (OD-42): CS-N11-4 sets `productionBrowserSourceMaps: true`, else they 404; intent confirmed (OD-42, 2026-10-20). T-601 `.map` rows. |
| S-10 | **Image optimizer reachable:** `/static/search/_next/image/?url=...&w=64&q=75` -> 200 for a local SVG, 400 for remote; the app does not use `next/image`. X30.21 | `kube/prod/httproute.yaml:33-48` | As today on every version: no gateway block, no off-switch (OD-41); T-612 keeps it routed. A status change caused by a Next bump alone is an owner-signed `delta` AD row (42 §8) [VERIFY: whether Next ≥12.1 answers the local SVG with 400 without `dangerouslyAllowSVG`; W4c framework probe]. See S-5. |
