# Review: business logic, API layer, stores, data (key: business-logic)

Reviewer scope: `api/**`, `store/**`, `data/**`, `lib/**`, `utils/**`, `hooks/**`, every page's data fetching, and the plan docs that describe them
(`findings/06`, `30-quirks-register`, `40-test-strategy`, `10-risk-register`, `20-change-sites`, `50-roadmap`, `90-open-decisions`).
Date: 2026-10-19. Subject: `search` @ f5cfc20 (docs commit 497ff4c). Nothing in the search/dashboard/design/core-ui repos was modified (`git status` clean at the end).

Evidence tags used below: **[RUN]** observed by running the real app or a replica, **[CODE]** read from source (path:line), **[REG]** registry/official doc, **UNCONFIRMED** could not be verified.

---------------------------------------------------------------------------------------------------

## 0. Verdict

The earlier pass is accurate on most pure functions and on the static HTTP-wrapper reading. It is **wrong or incomplete in 6 places that matter for "M3 bugs stay exactly as they are" and "M5/M7 nothing is broken"**, and its phase-6 plan (axios + swr + zustand "with semantics pinned") cannot be executed as written without silent behaviour changes. Biggest items, all verified:

1. The claim-add flow does **not** have "last wins" semantics. After two overlapping requests the *aborted first call's error sticks* and the UI shows "We cannot detect a repository…" even though request #2 succeeded (real browser, BL-01).
2. `/works/{id}` with a 410 whose body is a JSON object returns **HTTP 500**, not the "Uh-oh" 200 page that Q-001 says (BL-02).
3. Several data-shape crashes (output without `sourceFulltextUrls` = SSR 500; output with `doi:null` = SSR 200 then blank page after hydration) mean recorded "happy" fixtures will not pin real production behaviour (BL-03).
4. `checkLogo` fires spurious requests to `{API_URL}null` and `{API_URL}undefined` (BL-04).
5. Under axios, **every consumer of the error object breaks silently** (`error.data` gone, `error.message` has no URL, serialized error leaks config + `Authorization` + stack into `__NEXT_DATA__`), the string-body claim POST becomes `application/x-www-form-urlencoded` (a third value the docs do not list), and Blob/`.text()` code paths turn into silent `citations: []` (BL-05..07).
6. The `Host` override question is resolved (ignored by native fetch on Node 18.20.8 inside the real Next 10.2.3 server), but **staging cannot validate it** because staging never internalizes the main API calls, and **MSW cannot see it** because MSW reports the app-supplied header, not the wire (BL-08..10). The pinned `msw` plan also breaks on Node 18 (BL-11).

I built and ran the real app (Next 10.2.3, Node 18.20.8, production build from a copy-on-write clone in scratch) against a wire-logging mock of the CORE API. This was not possible for the first pass ("could not run the app"). All harness files are in `<scratch>/exp/business-logic/` (see §9) and should be promoted into the Phase-2 test infrastructure.

---------------------------------------------------------------------------------------------------

## 1. How I verified (method and reproducibility)

| Experiment | What | Where |
|---|---|---|
| App under test | `next build` + `next start` of a clone of the repo, Node 18.20.8, `NODE_ENV=production APP_ENV=local API_KEY=test-key-123`. Build took ~1 min and succeeded. A scratch-only patch removed `LogRocket.init` so test sessions are not sent to the real project. No other source change. | `exp/business-logic/app/` |
| Mock CORE API | Node http server on 8000 (public), 8001 (in-cluster), 8002 (doi.org stand-in). Logs every request (method, url, **wire** `Host`, `Authorization`, `Accept`, `Content-Type`, `User-Agent`, body) to `mock/requests.ndjson`. CORS enabled so the browser can call it. | `exp/business-logic/mock/mock.js` |
| App-side recorder | `--require preload-fetch.js` wraps `globalThis.fetch` and logs what the **app code** hands to fetch (including the `Host` init header), then forwards. Redirects `https://doi.org` to the mock. | `mock/preload-fetch.js` |
| Server env | `Internal_API=http://127.0.0.1:8001`, `Internal_API_HOST=127.0.0.1:8000` (same mechanism as `kube/prod/deployment.yaml:46-52`) | `mock/start.sh`, `app/next-start.sh` |
| Browser | In-app browser against a CSP-stripping pass-through proxy on :3200 (the app's CSP `connect-src` forbids 127.0.0.1:8000). Drove filter toggle, clear-all, header search, pagination, claim form, claim card. | `mock/proxy.js` |
| Client library probes | axios 1.20.0, node-fetch 2.6.1, native fetch on Node 18.20.8 and 24.18.1; SWR 2.5.1 source defaults; zustand 5.0.15 peers | `exp/business-logic/x1/` |
| data-loader | Real `data/data-loader.js` (URL swapped to a local mock) under Node 18.20.8 and 14.19.0: success, 500, connection reset, 200 `[]`, 200 HTML, hang | `exp/business-logic/x2/` |
| Claim race | Faithful replica of `invalidatePreviousRequests` + `Claim.retrieve` with real fetch + delayed local server, Node 18.20.8 and 24.18.1; later reproduced in the real browser | `exp/business-logic/x3/race.js` |
| MSW | msw 2.4.13 / 2.7.6 / 2.10.5 / 2.11.6 / 2.15.0 `require('msw/node')` on Node 18.20.8, 20.x, 22.x, 24; 2.10.5 as an SSR `--require` preload under `next start` | `exp/business-logic/msw/` |

Not verified (UNCONFIRMED): anything that needs the real CORE API (actual 410 body shape, real `Content-Type` values, CORS allow-list, what the in-cluster service does with each `Host`); the real prod gateway; Next 11+ behaviour.

---------------------------------------------------------------------------------------------------

## 2. (a) Exact endpoint contract

### 2.1 Wire-level facts common to every `api/index.js` call [RUN unless noted]

| Aspect | Today (Node 18.20.8 native fetch in the Next 10.2.3 server; browser fetch on the client) |
|---|---|
| Server fetch implementation | Native undici. `node_modules/next/dist/next-server/server/node-polyfill-fetch.js:2` only polyfills `if(!global.fetch)`; the preload saw `ua: node` on the mock. node-fetch is not used at runtime on Node >= 18. |
| Headers the app passes | `Accept: application/json`, `Authorization: Bearer <API_KEY>`, `Content-Type: application/json` **only if** `body` is a non-null object, plus `Host: <Internal_API_HOST>` when internalized (`api/index.js:36-66`). `credentials:'include'`. |
| Headers on the wire (server) | `host` = **service host** (override dropped), `user-agent: node`, `accept-encoding: gzip, deflate`, `accept`, `authorization`, `content-type` only for JSON bodies. Verified identical on Node 24.18.1. |
| Authorization sent to third parties | Yes, to `doi.org` (E9) and to any logo host (E14, e.g. `https://example.org/logo.png` in my fixture): `Bearer test-key-123` on the wire. |
| Browser CORS | Every browser call with `Authorization` is preflighted: `OPTIONS` precedes it. Chromium caches the preflight 5 s, so in a burst only the first call shows an OPTIONS (observed: clear-all = 1 OPTIONS + 2 POSTs). |
| Base URL | `API_URL` is **inlined at build time** into server and client bundles (`next.config.js:12`, `env.config.js:24-35`). local `http://127.0.0.1:8000/internal`, development `https://api-dev.core.ac.uk/internal`, staging `https://api-stg.core.ac.uk/internal`, production `https://api.core.ac.uk/internal`. v3 URLs use `new URL('/v3/…', API_URL)` (origin only); `api/data-provider.js:4` uses `API_URL.replace('/internal','/v3')`; E10 uses `new URL('/internal/outputs/update', API_URL)`. |
| Internalize | Server only, per call: `host === Internal_API_HOST` -> protocol+host of `Internal_API`, adds `Host`. Prod and stage set `Internal_API_HOST=api.core.ac.uk`. **Stage's API_URL host is `api-stg.core.ac.uk`, so main-API calls are never rewritten on stage** (BL-09). |
| Response | `Content-Type` matching `/application\/([\w.-]\+)?json/` => parsed JSON else Blob. Result `{data,type,status,headers}`. Status >= 400 throws a class from `api/errors.js` with `{data,type,status,headers}` assigned. Network/abort errors are rethrown untouched (no `status`). |
| Retries | none. Timeouts: only E1 (50 s AbortController) and loader (3 s). Gateway `backendRequest` is 30 s (`kube/prod/httproute.yaml:27-28`), so E1's 50 s is unreachable in prod. |
| Caching | None in the app. gSSP pages respond `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`; `/error-card/` (no gSSP) has no Cache-Control [RUN]. |
| Cookies | SSR reads none and sets none. Browser sends cookies to api.core.ac.uk only via `credentials:'include'`. The only first-party cookies are the design consent cookies `essential_cookies_allowed`, `analytics_cookies_allowed` (`react-cookie`, `path:/`, `maxAge` 1 y; `design/src/hooks/use-cookies.js:79-82`), never read on the server. |

### 2.2 Catalogue (E1-E22). New or corrected rows are marked **NEW/FIX**

| # | Call (file:line) | Method + URL (as observed) | Body / headers | Response handling and error mapping | Where | Verified |
|---|---|---|---|---|---|---|
| E1 | `fetchWorks` `api/search.js:5-28` | `POST {origin}/v3/search/works?t=<t>`; `t` absent => literal `?t=undefined` | JSON `{q,offset,limit,t,exclude:["fullText"],sort}` (undefined keys dropped). `limit` is a **string** when given in the URL, number 10 by default. 50 s abort. | JSON; any throw => `props.queryError{query,status:error.status??null}`; `status` truthy => `<ErrorCard/>` (HTTP 200), null => QueryError view | SSR `/search` | [RUN] |
| E15 | `apiRequest('/members')` `pages/search/index.jsx:87` | `GET {API_URL}/members` => `/internal/members` | none | array; filtered; errors swallowed. **Sent only after E1 succeeded** (E1 error returns early) and **after** E1 (sequential) | SSR `/search` | [RUN] |
| E2 | `fetchAggregations` `api/search.js:30-40` | `POST {origin}/v3/search/works/aggregate` | `{aggregations:[6 names] or 5 when year facet open, q: q||''}` | JSON; error => `console.error`, `isLoading=false`, facets stay empty. No abort/cancel (signal never forwarded) | CSR `FiltersBar` effect + `Filters.reset` | [RUN] |
| E3 | `downloadResultsInCSV` `api/search.js:42-49` | `POST {origin}/v3/search/works` (no `?t`) | `{q: store.query, accept:'text/csv', limit: activeLimit(10/100/1000)}`; header `Accept` stays `application/json` | Blob => `FileDownload(blob,'results.csv')`; error => console only | CSR | [CODE] |
| E4 | `fetchWork` `api/works.js:4-15` | `GET {origin}/v3/works/{id}?t=<t>` (`?t=undefined` when absent) | - | JSON; error => `serverError{code:error.status,message,prevHistoryUrl}` (HTTP 200 except BL-02) | SSR `/works/[id]`, before E5 | [RUN] |
| E5 | `fetchWorkOutputs` `api/works.js:17-23` | `GET {origin}/v3/works/{id}/outputs` | - | array | SSR | [RUN] |
| E6 | `fetchMetadata` `api/outputs.js:3-8` | `GET {origin}/v3/outputs/{id}` | - | SSR: errors via `setOutputError` (410 / message includes `data-providers` / else); CSR (`Report.fetchOutput`): error => constant message | SSR `/outputs/[id]`; CSR `/outputs/update` | [RUN] SSR |
| E7 | `fetchDataProvider` `api/outputs.js:9-13` | `GET <output.dataProvider.url>` (absolute, API-supplied; internalized if host matches) | - | object; failure message contains `/data-providers/` => "Data provider has been disabled" | SSR outputs | [RUN] |
| E8 | `fetchSimilarTo` `api/outputs.js:15-26` | `POST {origin}/v3/recommend` (passes a `URL` object as the url) | `{identifier:"core:{id}",limit:5,...params}`; params `{resultType:"work"}` on works, `{}` on outputs | array; error => `similarWorks.error=true` | CSR, once on mount (`similar-works.jsx:29-31`) | [RUN] |
| E9 | `fetchCitations` `api/outputs.js:28-51` | `GET https://doi.org/{doi}` x2 **in parallel** (apa then bibtex) | `Accept: text/x-bibliography; style=<s>; locale=en-GB` **plus Authorization Bearer** | Blob => `.text()`; any error => `citations: []` silently | SSR works+outputs | [RUN] |
| E10 | `createReport` `api/outputs.js:53-62` | `POST {origin}/internal/outputs/update` | JSON `{outputId,name,email,message,updateOption,role}` | any 2xx = success; error => `report.error` (no UI on output pages) | CSR | [CODE] |
| E11 | dp `fetchMetadata` `api/data-provider.js:9-17` | `GET {origin}/v3/data-providers/{id}?t=<t>` | - | throw => `{props:{error},notFound:true}` (404) | SSR | [RUN] |
| E12 | `fetchStats` | `GET .../v3/data-providers/{id}/stats` (sequential after E11) | - | spread into `metadata` | SSR | [RUN] |
| E14 | `fetchLogo` `api/data-provider.js:31-34` via `checkLogo` | `GET <logoUrl>`; **NEW/FIX:** `logoUrl` null => `GET {API_URL}null`, undefined => `GET {API_URL}undefined` (BL-04) | Authorization Bearer to any host | success/throw only (throw => `null`) | SSR dp/works pages | [RUN] |
| E13 | `fetchOutputs` | `GET .../v3/data-providers/{id}/outputs?q=&offset=0&limit=10&sort=recency` via `URLSearchParams` (observed) | - | failure => `data.outputs.error` = the Error instance, serialized into `__NEXT_DATA__` as `{name,response:{},data,type,status,headers:{}}` [RUN] (06 says "mostly-empty": it contains the API body) | SSR | [RUN] |
| E16 | `Claim.retrieve` `store/claim.js:33-53` | `POST {API_URL}/data-providers` | **string** `{"uri":"…"}`; wire `Content-Type: text/plain;charset=UTF-8` [RUN, browser]; abort `signal` | 2xx `{name,email}`; 409 `error.data={message:"<json>"}`; other incl. AbortError => `claim.error` | CSR | [RUN] |
| E17 | `fetchClaim` `api/claim.js` | `POST {API_URL}/data-providers/{id}/claim` | JSON `{name,email,rationale,repositoryHasAccount}` | response only `console.log`ged; failure silent | CSR | [CODE] |
| E18 | `fetchDataProviderAccounts` | `GET {API_URL}/data-providers/{id}/account` | - | `.length>0` => `setIsDataProviderHasAccounts(true)`. Relies on a JSON content type (otherwise Blob, `.length` undefined) | **SSR fire-and-forget during render (un-awaited)** and CSR **every ClaimCard render** | [RUN] |
| E19 | `lib/loader.js` | `GET https://api.core.ac.uk/internal/{statistics,repositories/formap,members}` (hard-coded prod) | no auth | only when cache file missing; results unused. Browser: runs on client navigation to pages without gSSP (Q-011) [CODE; not run to avoid contacting prod] | `_app.getInitialProps` | [CODE] |
| E20 | `data/data-loader.js` | same 3 URLs via node-fetch | no auth, no timeout | see §4 | `npm run build` | [RUN] |
| E21 | `modules/dropdown/index.jsx:58-60` | `GET https://api.core.ac.uk/data-providers/{id}/logo` | raw `fetch`, **no credentials, no Authorization** (simple CORS GET, no preflight) | `ok` => logo; else `LogRocket.captureMessage` | CSR per member card | [CODE] |
| E22 **NEW** | design `SearchResult` logo `design/src/modules/search-result/search-result.jsx:85-110` (installed `lib/modules/search-result/search-result.js:135`) | `GET https://api.core.ac.uk/data-providers/{id}/logo` **once per card per data provider, no dedupe**, when `useLogo` | same as E21 | `ok` => DataProviderLogo; error => `console.log` | CSR on `/search`, `/data-providers/[id]` results and similar works | [CODE]; not catalogued in 06 |
| - | `/api/healthz` | `200 {"status":"ok"}` | | | k8s probes | [RUN] |
| dead | `api/sign-in.js`, `api/oai-resolver.js` | no importers | | | | [CODE] |

### 2.3 Ordering of SSR calls per page (measured, wire log)

- `/search/?q=x`: E1 -> E15. E1 error => E15 not sent. `page>1000` or NaN page => E15 only.
- `/works/{id}`: E4 -> E5 -> (E14 per output, parallel) -> E9 apa ‖ E9 bibtex (only if `doi`).
- `/outputs/{id}`: E6 -> E7 -> (E14 only if the provider is a member and `logo` is a member-id-looking value) -> E9 x2.
- `/data-providers/{id}`: E11 -> E12 -> (E14) -> E13 -> **E18 un-awaited** (5th request, outlives the response).
- `/data-providers/` and `/error-card/`: no outbound call (loader cache hit; ~31 ms synchronous `JSON.parse` of the 5.4 MB formap per request, Node 18, measured).

---------------------------------------------------------------------------------------------------

## 3. (b) Stores

All stores are MobX 6.13.7 classes created inside `Root` (`store/root.js`). `Root` is built **per SSR request** on the server and **once (module singleton) on the client** (`store/index.jsx:6-21`). Only two things are hydrated from the server: `statistics` (via `_app` props) and `dataProviders` (via `/data-providers` gSSP `initialState`, `Root.extend` guarded by `!this.dataProviders`). Everything else starts empty on both sides and is filled by client effects, so SSR HTML never contains store-derived content (e.g. Sort options, similar works, facets). No `configure({enforceActions})` anywhere.

| Store | Fields (obs = annotated observable) | Actions / computed | Async + cancellation | Non-obvious |
|---|---|---|---|---|
| Root | `statistics` obs, `dataProviders` obs (null), `claim` obs, `filters` obs; `similarWorks`, `search`, `report` plain | `extend` action | - | `extend` runs during render; client keeps first `DataProviders` forever (U3 in Q-048). |
| Claim `store/claim.js` | `query,request(unused),created,error,isLoading` obs; **`duplicated` NOT annotated** | `retrieve` (action + `@invalidatePreviousRequests`), `reset` | `retrieve` is the only method that uses the signal | A 409 sets the plain `duplicated` field, then `isLoading=false` (observable) triggers the re-render that reads it. Post-await writes are outside actions. |
| SimilarWorks | `error,similarOutputs,isLoading` obs | `fetchSimilar` action + decorator | signal appended but unused (race) | fetched once on mount only (Q-055). |
| Search | `works,query,isLoading,dataProviders(unused),sortOptions,activeLimit(10),activeDownloadModal` obs | `setWorks,setIsLoading,setQuery,setSortOptions,downloadResults,setActiveSortOption,reset,setWorkDataProviders` annotated; **`setActiveLimit,setActiveDownloadModal,setActiveSortOptionData` not annotated** | `downloadResults` decorator unused signal | `reset()` (activeLimit=1000) has no caller. `setActiveSortOptionData` mutates `Router.query` (`delete Router.query.id`). `setSortOptions` mutates the module-level `sortFilterValues` objects. |
| Filters | `data,initialData,activeFilter,activeFilterSuggestions,aggregationsNames,groupedYearDates,isLoading,yearWorksCount,isVisibleClearButton` obs via decorators + `makeObservable(this,null)` | actions listed in `store/filters.js`; computed `maxYear,filterNamesWithoutYear` | `fetchFilters` decorator, signal unused; `reset` passes the signal in the `sortType` slot | `activeFilterSuggestions` aliases `data[i].items` (R-030). `toggleCheckboxFilter` sets `isLoading=true` and nothing clears it until the next `fetchFilters`. |
| Report | `output,updateOption,role,isLoading,error` and the 3 modal flags are annotated observable; only `reset` is an action (`submit`/`fetchOutput` are not) | `reset` | decorators, signals unused | State survives client navigations: a failed report on an output page leaves `report.error` set for `/outputs/update/` (BL-26). |
| DataProviders + Params | `data` obs (deep: 15,672 objects), `params` = `Params` instance (obs `q,size,action` via `extendObservable`), computed `results` | `search`; `Params.changeParams` action | - | `results` recomputed on every access during SSR (`enableStaticRendering`). `decodeURI(q)` throws on `%`. |

URL <-> state sync exists only for `DataProviders.params` (`hooks/use-sync-url-params-with-store`, 250 ms debounce, replace-then-push, shallow, loose `!=` on `routeChangeComplete`). All other flows are state -> `Router.push` (stores import the `next/router` singleton) and URL -> state through gSSP props and the `FiltersBar` effect.

---------------------------------------------------------------------------------------------------

## 4. (c) Build-time data and the data-loader

`npm run build` = `node ./data/data-loader.js && design build icons && next build` (`package.json`), executed inside `docker build` (`Dockerfile:25`) by both workflows on **every push to main/stage and nightly (03:00 / 04:00 UTC)** (`.github/workflows/aks_deploy.yml:3-8`). There is no `.dockerignore`; CI checkout is clean so the committed `data/*.json` are only the baseline that the build overwrites.

What it does [RUN, Node 18.20.8, real file, URL swapped to a local mock]:

| Case | Exit | Files after | Note |
|---|---|---|---|
| all 200 JSON | 0 | all three overwritten | `languages.json` untouched |
| members 500 | **1** | formap overwritten, members/stats unchanged (race: whichever response arrived before the crash) | un-awaited `retrieveStats` => unhandled rejection |
| formap connection reset | 1 | stats/members unchanged | |
| all 200 with body `[]` | **0** | **all three overwritten with `[]`** | no shape validation. `/data-providers/*` would all 404, directory empty, statistics fallback, members empty. **Silent empty deploy** |
| 200 HTML | 1 | unchanged | `res.json()` fails |
| server accepts but never responds | **never exits** (still running at 12 s) | | no timeout; no `timeout-minutes` in the workflows, so the GitHub 360-min default |
| 500 on Node 14.19.0 | 0 | partially overwritten | only a warning; this is the pre-Node-15 behaviour the docs mention |

Consequences not in the docs:
- An API outage at build time blocks **every** deploy, including a push-to-main hotfix, not just the nightly. The running pods keep the previous image (no outage), so the failure is invisible unless someone watches Actions.
- A degraded-but-200 API response is deployed (empty/odd JSON). Q-026 covers the 4xx/network case only.
- The three URLs are hard-coded to production (`data-loader.js:59-63`), so staging images carry prod data and any unmodified `npm run build` in CI (T-901, W0 gate) needs live prod access (BL-19).
- `lib/*-loader` at runtime never fetches while the committed/built files exist (every SSR does a sync read+parse; ~31 ms for formap on Node 18). If it did write, it would use the `{data,timestamp:getDate()}` shape that differs from the raw shape.

On a nightly rebuild with the API down: docker build fails at `RUN npm run build`, the workflow stops before "Sync secrets"/"Deploy", the old deployment keeps running with the previous night's data (stale membership/formap/stats), Actions shows red. No alert exists in the repo. Recovery = rerun.

---------------------------------------------------------------------------------------------------

## 5. (d) Behaviours the docs missed or got wrong, each with a characterization test

IDs are proposals for `30-quirks-register.md` (continue after Q-068). "Test" is what must exist before phase 3.

### Wrong in the docs

**BL-01 / Q-new-1 Claim overlap: error sticks, "last wins" is false.** [RUN real browser + replica]
`utils/invalidatePreviousRequests.js:5-11` aborts #1 synchronously inside call #2. #2's `reset()` and `isLoading=true` run first; #1's rejection is delivered afterwards, so `store/claim.js:46-49` sets `error=AbortError` *after* #2's reset and `finally` sets `isLoading=false` while #2 is in flight. `generateFormMessage` precedence is error > created > duplicated (`generate-form-message.jsx:14-75`), so #2's success is hidden. Observed in the browser: typed `http://slow.example.org/a`, waited 1.5 s, replaced with `http://fast.example.org` (mock returned 201 for it): final text "We cannot detect a repository or a journal at this address…". Replica: after the aborted handlers ran `isLoading=false message=ERROR(AbortError)`, and it stays. Reachable whenever the probe takes > 500 ms (the real endpoint harvests an OAI endpoint, so likely seconds).
Docs: 06 §1.5 ("can leave error set briefly"), 06 §5.1 MSW table row "two rapid inputs | first aborted, last wins". Test: T-205 add "two overlapping retrieve(), first slower: final `error` is an AbortError, `created` is set, `isLoading` false, message = error variant"; Playwright J12 with a delayed stub. A naive SWR/`useSWRMutation` port silently *fixes* this (latest wins), which is an M3 violation.

**BL-02 / Q-001 `/works/{id}` 410 returns 500 if the body is a JSON object.** [RUN with mock 410 body `{"message":"gone","code":410}`]
`pages/works/[id].jsx:91-94` puts `error.data` (the parsed object) in `serverError.message`; `templates/error/404.jsx:12` renders `<p>{error.message}</p>` => React error #31 => **HTTP 500** "Internal Server Error". `/outputs/{id}` is fine (string message), `/works/4040` is a 200 soft-404. The real API's 410 body shape is **UNCONFIRMED** (string => 200, object => 500). Docs say "renders the Uh-oh page with HTTP 200 … the parsed body object on works". Test: T-502/T-601 both variants (string body and object body) with the exact status asserted; record the real 410 body once with a key.

### Missed (all PRESERVE; none observable in the docs' fixtures)

**BL-03 Data-shape-dependent crashes.** [RUN]
(a) An output returned by `/works/{id}/outputs` without a `sourceFulltextUrls` key => `httpsValidate(undefined)` throws (`templates/output/card-dropdown.jsx:13-19`) => `/works/1003/` HTTP 500. `null` is fine. (b) An output with `doi:null` => SSR 200, but `templates/output/index.jsx:65-71` (`item.doi.toLowerCase()` in an effect) throws on hydration and the ErrorBoundary has no fallback: `__next` has 0 children, `document.title` empty [browser]. (c) Related, from 06: work without `dataProviders` => search `queryError`; `links` missing => TypeError.
Test: add a "shape-variance" fixture set to 40 §2.4 (null/undefined for every field the code dereferences without a guard) and pin status + post-hydration DOM. "Trim to <= 5 items but keep every field" (06 §7.1) will not capture these; they come from real records.

**BL-04 `checkLogo` side-request.** [RUN]
`utils/data-providers-transform.js:25-34`: for a "member" (any of 477 incl. `starting`) with a null/undefined URL it calls `fetchLogo(null|undefined)`, which `prepareUrl` turns into `{API_URL}null` / `{API_URL}undefined`. Observed: `/data-providers/86/?t=nologo` => `GET http://127.0.0.1:8001/internalnull`; `/works/1004/` (output provider `logo:null`) => `GET …/internalundefined`, both with Bearer. (`checkMembership(null)` is truthy through the 3 `repo_id:null` members.) Docs describe `checkLogo` arity (Q-024) but not these requests. Test: T-502/T-504 handlers for the two paths, assert them in the request log (with `onUnhandledRequest:'error'` they would otherwise fail loudly).

**BL-13 Clear-all fires two identical aggregation POSTs.** [RUN]
`store/filters.js:342` (`reset` -> `fetchFilters(q)`) plus the `FiltersBar` effect after navigation (`modules/filters/index.jsx:17-24`): `OPTIONS`, POST (+0 ms), `_next/data` SSR (works + members), POST (+105 ms), same body, no abort. 03 §1.2 mentions two aggregations only for StrictMode. Test: T-201/T-202/T-702 assert 2.

**BL-14 Refining a query keeps stale facets.** [RUN]
`FiltersBar` treats any new `q` that *contains* the previous `q` as "same search" (`!initialQuery?.includes(query)`), so `routeChanged()` is skipped and `initialData` is not reset. After `cancer` -> `cancer therapy` the Field facet shows `Oncology 4, Medicine 0, Biology 0` (old buckets at zero). Test: T-201/T-403 with two different aggregate responses.

**BL-15 `/data-providers` ignores its own `q` in title and header search.** [RUN]
`pages/data-providers/index.jsx:36` destructures `params:{action, query, size}` but the schema key is `q` (`store/data-providers.js:6`). `?q=open`: results are filtered (10 cards) but `<title>` is `Data providers search`, the header input is empty, `query` prop is undefined (`templates/data-providers/index.jsx:129`). 07 line 91 says the title is `{query - }Data providers search`. Test: T-602 + T-714/T-722.

**BL-16 / E22 design `SearchResult` per-card logo fetch** (see §2.2). Hard-coded prod host, simple CORS GET (no credentials, no Authorization, no preflight). N cards of the same member = N identical GETs. Matters for M4 (search will own this code) and phase 6 (BL-12, BL-23).

**BL-17 `t` is interpolated unencoded.** [RUN]
`/works/1001/?t=a%26b%3Dc%20d` => upstream `…/v3/works/1001?t=a&b=c+d` (two params). `?t=x&t=y` => `t.split` TypeError before any request => 200 soft-404 with zero outbound calls. Applies to E1, E4, E11. Test: T-501/T-502/T-504. axios `params:{t}` would encode and drop `undefined`.

**BL-20 Upstream failures are invisible in production logs.** [RUN]
`utils/logger.js:2` logs only when `NODE_ENV !== 'production'`; E1/E4/E6 failures render 200 pages; the server log of my production run contained only `console.time` lines. T-902's "SSR 5xx count" cannot see an API outage. Add the wire-recorder error rate as the soak signal.

**BL-25 / BL-26 Reactivity and persistence details.** `Claim.duplicated`, `Search.setActiveLimit/setActiveDownloadModal/setActiveSortOptionData`, `Report.submit/fetchOutput` are un-annotated: the UI updates only because an adjacent observable changes in the same flow. T-203's generated table must list un-annotated fields so a zustand port keeps the same timing (e.g. 409: `duplicated` then `isLoading=false`). Singletons persist across client navigations: `report.error` leaks to `/outputs/update/`, `Search.activeLimit` persists, `Filters.initialData` persists (BL-14). Test: T-206, T-722-style SPA hop.

### Things the docs got right (spot-checked)
Q-002 (308 `Location: /`), Q-003, Q-004 (`356 million` and `a lot of` strings), Q-013/Q-016 request bodies (`offset`, `limit:"50"`, `q` array, page 1001 => no E1), Q-019 (`text/plain;charset=UTF-8` in the browser), Q-022 (see BL-08), Q-027 (confirmed, plus the SSR un-awaited request), Q-035 (`/data-providers/0x56/` => E11 with `0x56`).

---------------------------------------------------------------------------------------------------

## 6. Phase-6 behaviour contract (what axios + swr + zustand must reproduce)

### 6.1 Request count and order per user action [RUN unless tagged C = code-derived]

| User action | Server (SSR) | Browser |
|---|---|---|
| Load `/search/?q=x` | E1 -> E15 (sequential) | after hydration: `[OPTIONS]` + E2 x1 |
| Header search (new q) / toggle filter / year range (client nav, new q) | `_next/data` => E1 -> E15 | E2 x1 |
| Header search where new q **contains** old q | same | E2 x1, stale facets (BL-14) |
| Page change, sort change (same q) | E1 -> E15 | **no** E2 |
| "Clear all filters" | E1 -> E15 | **E2 x2** (identical) |
| Open download modal -> Download | none | E3 x1 (modal closes immediately, Q-056) C |
| Load `/works/{id}` | E4 -> E5 -> E14* -> E9 apa ‖ bibtex | E8 x1 (`resultType:work`) + E21/E22 per member card |
| Load `/outputs/{id}` | E6 -> E7 -> E14* -> E9 x2 | E8 x1 (no params) |
| Client nav `/outputs/A` -> `/outputs/B` | `_next/data` | **no** E8 (Q-055) C |
| Load `/data-providers/{id}` | E11 -> E12 -> E14 -> E13 -> **E18 (un-awaited)** | E18 x2 if accounts exist (state flips true), x1 if none; **+1 per ClaimCard re-render** (opening the claim modal => +1) [RUN] |
| `/data-providers/` type a URL (500 ms debounce) | none | E16 per settled value; overlapping => BL-01 |
| Report: enter URL | none | E6 (CSR) |
| Report submit | none | E10 |
| Client nav to `/outputs/update/`, `/404`, `/error-card/` (no gSSP) | none | up to 3 E19 GETs to prod (3 s timeout each), results discarded (Q-011) C |

### 6.2 SSR vs client split
SSR: E1, E15, E4, E5, E6, E7, E9, E11-E14, E18 (accidental). Client: E2, E3, E6 (report), E8, E10, E16, E17, E18, E19 (nav), E21, E22. Nothing in the client bundle can reach `Internal_API` (not in `next.config env`); client always uses the public host baked at build.

### 6.3 Error -> UI mapping and loading states

| Flow | Error mapping | Loading |
|---|---|---|
| E1 | status truthy => ErrorCard (200); null status or empty results => QueryError "no results" | route loading bar (`routeChangeStart`) |
| E4/E6/E7 | soft-404 page (200), messages per BL-02/`setOutputError`; `code` is `error.status` | - |
| E2 | none visible; facets empty | `isLoading` => `LoadingBlock` only while `initialData` empty, "..." counts otherwise |
| E8 | `similarWorks.error=true` => "Sorry, we are unable to process this request…" | "Loading suggested articles..." |
| E16 | error => "We cannot detect…", 409 => duplicate text (**JSON.parse of `message` throws on non-JSON**) | `{variant:'progress'}` |
| E10/E17/E3/E18 | silent (console or nothing) | `report.isLoading`, `search.isLoading` => `LoadingBar`, Download disabled |
| E21/E22 | logo omitted, console/LogRocket only | - |

### 6.4 Defaults that silently differ (evidence)

| Area | Today | axios 1.20.0 default | SWR 2.5.1 default | zustand 5.0.15 |
|---|---|---|---|---|
| Error object | `{name,message:"Request for <url> failed on <s>",data,type,status,headers,response}` [RUN] | `AxiosError`: `message:"Request failed with status code 404"`, **`data` undefined** (body at `response.data`), `status` present [RUN x1] | error passed through | - |
| `JSON.stringify(error)` in props | `{name,response:{},data,type,status,headers:{}}` | `toJSON` => `config` incl. **`Authorization`**, `stack`, `code` (~1.9 kB) [RUN] | - | - |
| JSON parsing | only `application/json` (+1-char vendor); else Blob | parses any JSON-looking body regardless of type: `text/json` and `application/vnd.api+json` => object, no content type + `123` => **number** [RUN] | - | - |
| Text bodies | Blob, `.text()` | `text/csv`, `text/x-bibliography` => **string** (so `blob.text()` throws => silent `citations: []`); `responseType:'blob'` returns a **String in the Node adapter** [RUN] (browser XHR returns Blob) | - | - |
| String POST body | `text/plain;charset=UTF-8` | **`application/x-www-form-urlencoded`** [RUN]; dashboard instance forces `application/json` [CODE `dashboard/src/config/axios.ts:6-10`] | - | - |
| `Host` override on SSR | **dropped** (undici) | **honoured** (like node-fetch) [RUN] | - | - |
| UA / encoding on SSR | `user-agent: node`, `accept-encoding: gzip, deflate` | `axios/1.20.0`, `gzip, compress, deflate, br` [RUN] | - | - |
| Params | `URLSearchParams`: arrays `a%2Cb`, `undefined`=>`undefined`, `null`=>`null`, `,()!~'` encoded | arrays `arr[]=x&arr[]=y`, `undefined`/`null` **dropped**, `,()!~'*` left literal, space `+` [RUN] | key serialization is the caller's | - |
| Abort | DOMException `AbortError`, `status` undefined | `CanceledError` (`ERR_CANCELED`), `status` undefined [RUN] | - | - |
| Keep-alive on SSR | undici pool | Node 18 `http.globalAgent.keepAlive=false`; true from Node 20 [RUN] | - | - |
| Revalidation / dedupe / retry | none / none / none | - | `revalidateOnFocus:true`, `revalidateOnReconnect:true`, `revalidateIfStale:true`, `dedupingInterval:2000`, `focusThrottleInterval:5000`, `shouldRetryOnError:true` with **unbounded exponential backoff** (`errorRetryInterval 5000`, capped 2^8), `loadingTimeout:3000` (`swr/dist/config-context-*.js:554-584`) | - |
| Dashboard SWR/axios config | - | adds request headers `Cache-Control:no-cache`, `Pragma:no-cache`, `x-custom-dashboard-header`, `withCredentials:true` default, 15 min timeout (`config/axios.ts`, `config/swr.ts` fetcher) | `revalidateOnFocus:true`, `dedupingInterval:10000`, `keepPreviousData:true`, `compare:JSON.stringify` | - |
| Store lifetime | per-request on server, singleton on client | - | - | `create()` is a **module singleton**: cross-request state leak on SSR (dashboard pattern `features/Doi/store/doiStore.ts:15`, `store/authStore.ts` uses `persist`) |
| Derived data | MobX `computed` (`DataProviders.results`) | - | - | v5 selectors returning a new reference loop infinitely; wrap with `useShallow` or derive in `useMemo` (official guide https://zustand.docs.pmnd.rs/migrations/migrating-to-v5); peer `react >=18` [REG] |

### 6.5 Why SWR cannot hold "request counts = baseline" (R-029 mitigation is not executable)
Baseline has: 2 identical E2 on clear-all, E18 once per render, E22/E21 once per card with no dedupe, E8 re-run (with loading reset) on every mount, no retry. SWR's value is dedupe/cache/revalidate/retry. Matching the baseline means turning all of those off *and* keeping per-render/per-card call sites imperative, i.e. not using SWR for them. SWR also does not fetch during SSR, so the un-awaited server E18 disappears (no UI effect, request count changes). A keyed cache shows stale data on remount where today a loader shows (E8). Decision needed per flow (BL-12/BL-29).

### 6.6 Recommended execution shape (so phase 6 is measurable)
1. **Adapter first**: one module (`api/http`) that exposes today's contract exactly: `request(url,{method,body,headers,searchParams,signal}) -> {data,type,status,headers}`, errors as today's classes with `{data,type,status,headers}` and the `Request for <url> failed on <s>` message, Blob for non-`application/json` types, same headers (`text/plain` for string bodies, no `Content-Type` for GET), `Host`/`User-Agent`/`Accept-Encoding` policy chosen explicitly. Swap the implementation (fetch -> axios) behind it; no caller changes.
2. **Dual-run gate**: T-101/T-102/T-104/T-205 and the wire-recorder suite run against *both* implementations in one job; green on both before any caller changes.
3. Then zustand (per-request store via context, T-209 isolation), then per-flow SWR only where the table in 6.1 allows, each as its own PR with T-702 request-log diff = 0 or an OD entry.
4. Node must be >= 20 (keep-alive default) before axios on SSR, or pass an explicit `httpAgent` with `keepAlive`.

---------------------------------------------------------------------------------------------------

## 7. Plan-level findings (execution blockers)

**BL-08 [resolved] Host override on Node 18.** README:181, OD-20(1). Native fetch ignores `Host`: Node 18.20.8 and 24.18.1 (own probe), and inside the real Next 10.2.3 server (mock saw `host: 127.0.0.1:8001` while the app passed `Host: 127.0.0.1:8000`). node-fetch 2.6.1 and axios 1.20.0 send the override.

**BL-09 Staging does not exercise `internalize`.** `env.config.js:11-13` (staging API host `api-stg.core.ac.uk`) vs `kube/stage/deployment.yaml:46-52` (`Internal_API_HOST=api.core.ac.uk`) and `api/internalize.js:24`. Only the prod canary exercises the in-cluster path. OD-20 "[VERIFY with ops]" and T-902/T-607 cannot be closed on stage. Ops-side option: stage `Internal_API_HOST=api-stg.core.ac.uk` + stage API service, or a prod-canary Host probe.

**BL-10 MSW cannot observe the wire.** With MSW 2.10.5 as an SSR preload (works, see BL-31), the request MSW sees has `host: 127.0.0.1:8000` (app-supplied), no `user-agent`, no `accept-encoding`; the real wire differs. 40 §1 "Network (server)" lists `Host` and relies on the MSW preload (§2.5). Use a real HTTP stub as the authority for the server-side network contract (my `mock.js` is a working prototype), keep MSW for Jest only.

**BL-11 `msw` pin breaks on Node 18.** `require('msw/node')` on Node 18.20.8: OK for 2.4.13, 2.7.6, 2.10.5; **ERR_REQUIRE_ESM for 2.11.6** (`until-async` is ESM-only) and >= 2.12 (adds ESM-only `rettime`). 2.15.0 works only on Node >= 20.19 / >= 22.12 (also fails on 22.5.1). Registry: latest is **3.0.3, `engines.node >=22.12.0`**. 40 §2.4/§2.7 say "msw 2.x [VERIFY latest 2.x]" and use a CJS `--require` preload; with the latest 2.x that fails on the Node 18 baseline, and under Jest 29 (CJS) the ESM-only deps need `transformIgnorePatterns`. M1: end state msw 3.x after Node >= 22.12; baseline phase: pin <= 2.10.5.

**BL-31 [resolved] MSW preload under `next start`** (README:171): works for msw 2.10.5 on Node 18.20.8 + Next 10.2.3 (app rendered the mocked title; real server saw nothing). A plain `globalThis.fetch` wrapper preload also works and is what I used.

**BL-18 data-loader** (§4). Needs three more pinned cases (200 `[]`, hang, partial write) and an explicit OD-08 statement that A (preserve) keeps: fail-fast, no validation, no timeout, outage blocks all deploys. CS-N12-1 ("use global fetch") changes timeout semantics subtly only if Node's fetch defaults differ; keep none.

**BL-19 Any unmodified `npm run build` hits live prod** (`data-loader.js:59-63`). T-901 (real Docker build) and the W0 "build identical" gate need a stub: test-only `NODE_OPTIONS=--require` fetch/http interception, or a hosts entry + `NODE_TLS_REJECT_UNAUTHORIZED=0` in the test build only.

**BL-27 Phase-6 contract has no home.** 06 §1.3 + R-028/R-029 describe it in prose; the per-action request table (§6.1) and defaults table (§6.4) should live in `NEW:35-phase6-behaviour-contract.md` and be the acceptance oracle for T-702 / T-5xx / wire-recorder.

**BL-28 Normalisations for T-702.** Preflight `OPTIONS` appears/disappears with Chromium's 5 s cache; axios in the browser uses XHR so `resourceType` becomes `xhr` instead of `fetch`. Assert methods/URLs/bodies/headers, normalise OPTIONS and resource type.

**BL-22 Node 18 + axios**: no keep-alive connection pool (`http.globalAgent.keepAlive=false` on 18, true on 20/22/24 [RUN]). The deployment already carries port-range sysctl and `UV_THREADPOOL_SIZE` and `internalize.js` mentions SNAT/egress issues, i.e. connection pressure has bitten before. Mitigation: Node >= 20 first, or explicit `httpAgent`.

**BL-23 Dashboard config adoption**: copying `config/axios.ts`/`swr.ts` verbatim adds headers that force preflight allow-list changes and CDN revalidation and `withCredentials:true` for the credential-less logo GETs (E21/E22). Any CORS rejection is swallowed by the logo `catch`, so logos vanish silently while MSW tests pass.

**BL-21 axios params**: only E13 uses `searchParams`; compare decoded params, not raw URL strings, in T-504.

**BL-24 zustand v5**: see §6.4.

**BL-30 Open decisions to add/extend** (90): OD-20 add (5) `Content-Type` has three candidates (`text/plain` / `application/x-www-form-urlencoded` axios default / `application/json`), (6) UA/Accept-Encoding policy, (7) keep-alive; new OD-28 request-count parity policy for E2-double, E18-per-render, E22-per-card, server E18; new OD-29 error-object adapter vs touching callers; new OD-30 CORS/credentials policy for E21/E22 when vendored.

---------------------------------------------------------------------------------------------------

## 8. Resolved `[VERIFY]` / open items

| Item | Answer | Evidence |
|---|---|---|
| README:181 "Host ignored on Node 18 too?" | Yes | §2.1, probe on 18.20.8 and 24.18.1, real server run |
| README:171 "MSW `--require` preload intercepts SSR under `next start`?" | Yes with msw <= 2.10.5 on Node 18; breaks with later 2.x (BL-11) | `exp/business-logic/msw/` |
| README "can the app be built/run on Node 18" | Yes, `next build` ~1 min, `next start` ok with `NODE_OPTIONS=--openssl-legacy-provider` at build | `app/build.log` |
| Q-004 strings | Confirmed ("356 million", "a lot of") | `/data-providers/?q=open` HTML |
| Q-011 browser fetches on client nav | not run (would contact prod); code + build config (`next.config.js:38-42`) agree | UNCONFIRMED |
| Real 410 body for works | UNCONFIRMED | needs API key |
| Real `Content-Type` of E3/E18/E10/E17 | UNCONFIRMED | needs API key |
| Real API CORS allow-headers | UNCONFIRMED | needs API |

---------------------------------------------------------------------------------------------------

## 9. Reproduce

```
EXP=<scratch>/exp/business-logic
$EXP/app/build.sh                 # next build, Node 18.20.8
$EXP/mock/start.sh                # mock API (8000/8001/8002) + next start :3100  (foreground)
node $EXP/mock/proxy.js           # :3200 CSP-stripping proxy for the browser
$EXP/mock/hit.sh "/works/1001/"   # curl + show app fetch() calls and wire log
$EXP/mock/show.sh <line>          # request log slice;  mark.sh prints current line count
$EXP/x1/host-test.js, axios-test.js ; $EXP/x2/run.sh (data-loader) ; $EXP/x3/race.js ; $EXP/msw/*
```
Mock fixtures are intentionally small; fixture ids 1002 (output `doi:null`), 1003 (no `sourceFulltextUrls`), 1004 (output provider `logo:null`), 4100 (410 object body), `q=__status500`, claim URLs containing `slow`/`dup`/`bad` are the shape-variance cases to promote into the plan's fixture table (40 §2.4).
