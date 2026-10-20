# 06 — Business logic, HTTP layer & data (characterization-test map)

Auditor scope: `api/**`, `pages/api/**`, `lib/**`, `data/data-loader.js` + `data/*.json`, `utils/**`, business logic in `store/*.js`, the libs `bibtex-parse-js`, `filesize`, `i18n-iso-countries`, `js-file-download` and `throttle-debounce`, plus every page/template call site that feeds them.
Repo state: `f5cfc20` (main). Read-only audit. Nothing was installed or modified in the repo.

**Evidence.** Every behaviour marked **[verified]** was run on the user's machine under Node v22.23.2 (ICU 78.2). The method was to copy the source into a scratch dir outside the repo and run it against a stubbed `fetch` or a local HTTP server. Everything else comes from reading the code. All `file:line` refs point at the current tree.

> **Rule for the test author.** Characterization tests must pin **current** behaviour, including the quirks in §8. If a quirk is to be fixed, fix it in a separate PR **after** the upgrade, and flip the test there on purpose.

---

## 0. TL;DR: top risks (ranked)

| # | Risk | Where | Why it matters for the upgrade |
|---|------|-------|--------------------------------|
| 1 | **The `internalize` Host-header override is silently dropped by native fetch (undici). node-fetch honours it.** | `api/internalize.js:29`, `api/index.js:64-66`, `lib/loader.js:30-34` | **[verified]** `node-fetch@2.6.1` sends `Host: api.core.ac.uk`. Native `fetch` on Node 22 sends the service host instead. Next 10 only polyfills when `!global.fetch` (`next/dist/next-server/server/node-polyfill-fetch.js`). On the Docker image (`node:18-alpine`) native fetch therefore already wins. So SSR→in-cluster routing behaviour depends on the Node/Next/fetch implementation. Moving to Next 13+/axios changes it again: the axios node adapter **does** honour `Host`. This must be confirmed in staging against the real in-cluster service before and after. |
| 2 | **Build-time data snapshot drives runtime routing and membership logic.** | `data/.formap.json`, `data/.members.json` and `data/.statistics.json` are webpack-imported at build time (`utils/data-providers-transform.js:1-2`, `pages/data-providers/index.jsx:4`, `pages/_app.jsx:12`) | `/data-providers/[id]` returns **404 for any provider missing from the build snapshot** (`pages/data-providers/[id].jsx:67`). `data/data-loader.js` needs `node-fetch`, which is **not a declared dependency**: it is transitive via `next@10`. Upgrading Next removes it and `npm run build` breaks. The data-loader also swallows errors as unhandled rejections, which kill the build process on Node ≥15 when the API is down. |
| 3 | **Query-string building has no encoding and relies on substring matching.** | `store/filters.js:174-194, 235-246, 338-342`, `pages/works/[id].jsx:130`, `pages/outputs/[id].jsx:113`, `templates/search/results.jsx:43-50`, `templates/output/related-search.jsx:27` | Filters are added and removed with `String.includes`/`replace` on the raw `q`. "Clear all" keeps only the **first word** of the query. The year-range regex is greedy. `router.push(\`/search?q=${term}\`)` is unencoded, so `#`, `&` and `+` break it. Whether Next.js `Router.push({pathname: undefined, query})` resolves to the current page varies by Next version, and every filter click relies on it. |
| 4 | **Response parsing quirks will change under axios.** | `api/index.js:88-97`, `api/index.js:30-34`, `store/claim.js:38-44` | Only `application/json` (plus optional params) is parsed as JSON. `+json` types and `text/json` become **Blob**s. Errors carry `status`/`data`/`type`/`headers` via `Object.assign`. Callers read `error.status` (`pages/search/index.jsx:77`, `pages/works/[id].jsx:90-93`, `pages/outputs/[id].jsx:22-23`) and `error.status===409` → `error.data.message` (`store/claim.js:47-48`). The data-provider-add POST sends a **string** body, so `Content-Type` is `text/plain;charset=UTF-8`. Axios would send `application/json` and parse differently. `Authorization: Bearer <API_KEY>` and `credentials:'include'` go to **every** host, including `doi.org` and logo URLs. The API key is also inlined into the client bundle via `next.config.js env`. |
| 5 | **Locale, timezone and ICU-dependent output.** | `utils/helpers.js:27-40`, `utils/format-date.js`, `utils/format-number.js`, `templates/data-provider/index.jsx:24-38` (`Intl.DisplayNames`), `i18n-iso-countries` JSON names, many `toLocaleString('en-GB')` calls | Date-only ISO strings are parsed as UTC and formatted in the **process TZ**. **[verified]** `'2020-05-01'` gives `30/04/2020` in America/New_York and `01/05/2020` in UTC. SSR and client can therefore disagree, which is a hydration risk. `Intl.DisplayNames` region names change with ICU (Node 22: `TR→Türkiye`, `CZ→Czechia`, `HK→Hong Kong SAR China`). i18n-iso-countries v6 says `Turkey`/`Czech Republic`. Pin `TZ=UTC` and the Node major in CI, and snapshot per Node major. |

Other high-value findings (details in §8):
- `checkMembership` reads the wrong key (`billingType` instead of `billing_type`). As a result, all 426 `starting` members count as members. On the data-provider page, `billingType` then becomes `'starting'` and the claim card shows the "SIGN IN / Create account" branch.
- `checkType` never matches multi-repo members, because it checks a `number[]` with `.includes(string)`.
- `checkLogo` is called with the wrong arity on the works and outputs pages, so those logos are always `null`.
- `/data-providers?q=100%` → `decodeURI` throws `URIError`, which crashes the render (`store/data-providers.js:42`).
- `fetchWorks`, `fetchWork` and the data-provider `fetchMetadata` always append `?t=undefined` when `t` is absent, because the `isUndefined` logic is dead (`api/search.js:7-10`, `api/works.js:5-9`, `api/data-provider.js:10-14`).
- `ClaimCard` fires `GET /data-providers/:id/account` **during render**, on every render (`templates/data-provider/claim/claim-card.jsx:104-106`).
- `filesize` is **unused** and can simply be removed. `throttle-debounce` is used only inside `@oacore/design`, which pins `^3.0.1` itself.
- `api/sign-in.js` and `api/oai-resolver.js` are **dead code** with no importers. `utils/debounce.js`, `utils/format-date.js`, `sortItemsByNumberAsc`, `sortItemsByAlphabet` and `Filters.filterNamesWithoutPublisher` are unused too.
- `store/search.js:6` imports `findDataProviders` from `utils/helpers`, but **that export does not exist**. The call at `:62` would throw, and it is only unreachable because `dataProviders` is never populated.

---

## 1. HTTP layer

### 1.1 Client: `api/index.js` (custom wrapper around global `fetch`)

`performRequest(url, options)` (`api/index.js:122-125`) runs `prepareRequest` and then `executeRequest`.

| Step | Code | Behaviour (pin it) |
|---|---|---|
| URL | `prepareUrl` `:17-20` | If `pathname` matches `/^\w+:\/\//` it is used as-is (it may also be a `URL` object, which is coerced to a string). Otherwise it becomes `${API_URL}${pathname}`, so `'/members'` → `https://api.core.ac.uk/internal/members`. There is **no slash normalisation**. |
| Query | `prepareParams` `:22-26` | Existing URL params are kept and `new URLSearchParams(options.searchParams)` is appended. Arrays become `a%2Cb`, and `undefined` values become the literal string `undefined` **[verified]**. Duplicate keys are kept (append, not set). |
| Method | `:28` | Default `GET`, upper-cased. |
| Body | `prepareBody` `:30-34` | GET/HEAD → no body. Otherwise an object is `JSON.stringify`'d and a string is sent as-is. **Quirk:** `body:null` → `typeof null=='object'` → sends the string `"null"`, with no Content-Type. `body` undefined → no body **[verified]**. |
| Headers | `prepareHeaders` `:36-51` | `Accept: application/json` and `Authorization: Bearer ${API_KEY}` are always sent, **to every host**: doi.org, logo URLs and in-cluster. `Content-Type: application/json` is set **only when `body` is a non-null object**, so string bodies get the fetch default `text/plain;charset=UTF-8` **[verified]**. Custom headers override. |
| SSR rewrite | `:62-66` | `internalize(url)` (see 1.4) can replace the host and add a `Host` header. |
| Credentials | `:71` | `credentials:'include'` on every request. The browser therefore needs CORS `Access-Control-Allow-Credentials` from api.core.ac.uk **and doi.org**. |
| Pass-through | `:73` | `{...init, ...request}`, so `signal` and any other fetch option pass through. |
| Status | `processStatus` `:76-86` | Any status ≥400 throws `new (fromStatusCode(status))("Request for ${response.url} failed on ${status}", response)`. |
| Parse | `processBody` `:88-97` | The regex `/application\/([\w.-]\+)?json/g` contains a literal `\+`, so it effectively matches only `application/json…`. JSON is parsed for `application/json` and `application/json; charset=utf-8`. **Blob** is returned for `application/vnd.api+json`, `application/problem+json`, `application/ld+json`, `text/json` and a missing content-type **[verified]**. The resolved value is `{data, type, status, headers}`. Invalid JSON with a JSON content-type rejects with `SyntaxError` **[verified]**. |
| Error | `processError` `:99-109` + `executeRequest` `:111-120` | The rejection handler sits on the `.then` after `processStatus`, so it catches both network errors and status errors. `LogRocket.captureException(error)` is called first. If `error.response` exists, the body is parsed (same JSON/Blob rule) and `Object.assign(error, {data,type,status,headers})` runs before the error is re-thrown. Network errors (`TypeError: fetch failed`) are re-thrown untouched, with `status` undefined **[verified]**. |

Error classes (`api/errors.js:19-28`) **[verified]**:

| Status | Class |
|---|---|
| 401 | `UnauthorizedError` |
| 402 | `PaymentRequiredError` |
| 403 | `ForbiddenError` |
| 404 | `NotFoundError` |
| 406 | `NotAcceptableError` |
| other 4xx (400, 409, 410, 422, …) | `BadRequestError` |
| ≥500 | `InternalServerError` |
| else | `NetworkError` |

`error.name` is the class name. A 502 HTML body becomes `data` = Blob (`{}` in JSON) with `type: 'text/html'`.

**Retries:** none anywhere. **Timeouts:** only `fetchWorks` (50 s AbortController, `api/search.js:14-16`) and `lib/loader.js` (3 s).

### 1.2 Environments and base URLs

`env.config.js`: `APP_ENV ∈ {local, development (default), staging, production}`.

| APP_ENV | `API_URL` |
|---|---|
| local | `http://127.0.0.1:8000/internal` |
| development | `https://api-dev.core.ac.uk/internal` |
| staging | `https://api-stg.core.ac.uk/internal` |
| production | `https://api.core.ac.uk/internal` |

- `validate()` throws at config load if `API_KEY` is missing (`env.config.js:19-22`), so tests need `API_KEY` set.
- The whole config object is passed to `next.config.js env` (`next.config.js:12`). **`API_KEY` is therefore inlined into the client JS bundle.**
- Dockerfile default: `APP_ENV=development`.

Derived bases:

| Name | Formula | Example |
|---|---|---|
| internal | `API_URL` | `…/internal` |
| v3 (absolute paths) | `new URL('/v3/...', API_URL)` | `api/search.js`, `api/works.js`, `api/outputs.js` → `https://api.core.ac.uk/v3/...` |
| v3 (string replace) | `API_URL.replace('/internal','/v3')` | `api/data-provider.js:4` |
| root | `API_URL.replace('/internal','')` | `api/sign-in.js:5` (dead) |
| OAI | `new URL('oai/'+x, API_URL)` | `api/oai-resolver.js:4` (dead): the relative URL resolves to `https://api.core.ac.uk/oai/x` because the base has no trailing slash **[verified]** |

**Hard-coded production URLs ignore APP_ENV:**
- `lib/*-loader.js` and `data/data-loader.js:59-63` → `https://api.core.ac.uk/internal/{statistics,repositories/formap,members}`
- `templates/search/utils/featured-member.js:3` and `modules/dropdown/index.jsx:58` → `https://api.core.ac.uk/data-providers/:id/logo`

### 1.3 Endpoint catalogue (build MSW handlers from this)

"Fields read" lists only the fields the code actually consumes. Fixtures must contain at least these.

| # | Fn (file:line) | Method & URL template | Request | Fields read from the response | Callers (SSR/CSR) |
|---|---|---|---|---|---|
| E1 | `fetchWorks` `api/search.js:5-28` | `POST {v3}/search/works?t={t}`. **Always** has `?t=`; becomes `t=undefined` when absent **[verified]** | JSON `{q, offset, limit, t, exclude:['fullText'], sort}` (see §2.1). 50 s abort. | `results[]` (each: `id, title, links[{type,url}], authors, abstract, publishedDate, yearPublished, publisher, dataProviders[{id,url,…}], reader, download, thumbnail_m, display`), `totalHits`, `limit`, `searchId`, plus everything spread into `data` | `pages/search/index.jsx:52` (SSR) |
| E2 | `fetchAggregations` `api/search.js:30-40` | `POST {v3}/search/works/aggregate` | `{aggregations: string[], q: q \|\| ''}` | `aggregations: {fieldsOfStudy:{k:n}, yearPublished:{"2019":n}, documentType, authors, language:{code:n}, publisher}` | `store/filters.js:73` (CSR) |
| E3 | `downloadResultsInCSV` `api/search.js:42-49` | `POST {v3}/search/works` (**no** `?t`) | `{q, accept:'text/csv', limit: 10\|100\|1000}` | Body as Blob (needs `Content-Type: text/csv`), passed to `FileDownload(blob,'results.csv')` | `store/search.js:127` (CSR) |
| E4 | `fetchWork` `api/works.js:4-15` | `GET {v3}/works/{id}?t={t}`, with `?t=undefined` when absent | — | `fullText` (stripped), `links[]`, `identifiers{}`, `doi`, `publishedDate`, `yearPublished`, `sourceFulltextUrls[]`, `dataProviders[0]`, `arxivId`, `pubmedId`, `title`, …(spread) | `pages/works/[id].jsx:30` |
| E5 | `fetchWorkOutputs` `api/works.js:17-23` | `GET {v3}/works/{id}/outputs` | — | array of outputs: `links[]`, `dataProvider{id, logo}`, …(spread) | `pages/works/[id].jsx:32` |
| E6 | `fetchMetadata` `api/outputs.js:3-8` | `GET {v3}/outputs/{id}` | — | `fullText` (stripped), `dataProvider.url`, `sourceFulltextUrls`, `links[]`, `identifiers.doi`, `publishedDate`, `yearPublished`, `id`, `dataProvider` | `pages/outputs/[id].jsx:49`; `store/report.js:71` (CSR) |
| E7 | `fetchDataProvider` `api/outputs.js:9-13` | `GET {output.dataProvider.url}` (absolute URL from the API) | — | `id`, `logo`, …(spread) | `pages/outputs/[id].jsx:53` |
| E8 | `fetchSimilarTo` `api/outputs.js:15-26` | `POST {v3}/recommend` | `{identifier:'core:{id}', limit:5, ...params}`, where `params` is `{resultType:'work'}` on works pages and `{}` on outputs pages **[verified]** | array: `title`, `dataProviders[] \| dataProvider`, `publishedDate`, … | `store/similar-works.js:28` (CSR) |
| E9 | `fetchCitations` `api/outputs.js:28-51` | `GET https://doi.org/{doi}` ×2 in parallel, with `Accept: text/x-bibliography; style={apa\|bibtex}; locale=en-GB` (+ the Bearer header!) | — | body Blob → `.text()` → `[{id:style, style, value:text}]`. Throws `'No citation styles passed'` if `styles` is empty | `pages/works/[id].jsx:106`, `pages/outputs/[id].jsx:88` (SSR; errors swallowed → `citations: []`) |
| E10 | `createReport` `api/outputs.js:53-62` | `POST {origin}/internal/outputs/update` | `{outputId, name, email, message, updateOption:'takeDownFullText'\|'issueWithContent', role:'repositoryManager'\|'author'\|'other'}` | none (any 2xx = success) | `store/report.js:58` (CSR) |
| E11 | `fetchMetadata` (dp) `api/data-provider.js:9-17` | `GET {v3}/data-providers/{id}?t={t}`, with `?t=undefined` when absent | — | `id, name, email, logo` (base64 or URL), `location{countryCode, latitude, longitude}`, `sort?`, `results?`, `query?`, …(spread) | `pages/data-providers/[id].jsx:75` |
| E12 | `fetchStats` `api/data-provider.js:19-22` | `GET {v3}/data-providers/{id}/stats` | — | `countMetadata`, `countFulltext` (spread into `metadata`) | `pages/data-providers/[id].jsx:76` |
| E13 | `fetchOutputs` `api/data-provider.js:24-29` | `GET {v3}/data-providers/{id}/outputs?q=&offset=&limit=&sort=` (values are raw query strings; default `sort=recency`) | — | `totalHits`, `results[]` (spread too) | `pages/data-providers/[id].jsx:107` |
| E14 | `fetchLogo` `api/data-provider.js:31-34` | `GET {logoUrl}` (any host) | — | none: success/throw only | `utils/data-providers-transform.js:29` |
| E15 | `request('/members')` | `GET {internal}/members` | — | array: `organisation_name`, `billing_type`, `activated`, `repo_id` (int \| int[] \| null) | `pages/search/index.jsx:87` (SSR; errors swallowed) |
| E16 | `Claim.retrieve` `store/claim.js:38-44` | `POST {internal}/data-providers` | **string** body `'{"uri":"<url>"}'`, so Content-Type is `text/plain;charset=UTF-8` **[verified]** + abort `signal` | 2xx → `data` = `{name, email}`; 409 → `error.data` = `{message: "<JSON string>"}` and `JSON.parse(message).existingDataProviders[0].{id,name}` | `templates/data-providers/hooks/use-claim-controller.js:35` (CSR) |
| E17 | `fetchClaim` `api/claim.js:5-25` | `POST {internal}/data-providers/{id}/claim` | `{name:''\|x, email:''\|x, rationale:''\|x, repositoryHasAccount: bool}` | ignored (logged) | `templates/data-provider/claim/claim-card.jsx:36` (CSR) |
| E18 | `fetchDataProviderAccounts` `api/data-provider-accounts.js:5-12` | `GET {internal}/data-providers/{id}/account` | — | `.length` only | `claim-card.jsx:68` (CSR, **in render**) |
| E19 | Loader | `GET https://api.core.ac.uk/internal/{statistics\|repositories/formap\|members}` via **global fetch**, no auth header | — | whole JSON, cached | `lib/*` (SSR `_app.getInitialProps`) |
| E20 | data-loader | same three URLs via `node-fetch`, no auth | — | whole JSON written to `data/.*.json` | `npm run build` |
| E21 | raw `fetch` | `GET https://api.core.ac.uk/data-providers/{id}/logo` | — | `response.ok` | `modules/dropdown/index.jsx:59` (CSR) |
| — | `fetchSignIn` `api/sign-in.js` | `POST {root}/login_check` | `{email,password,remember_me}` | — | **no importers (dead)** |
| — | `fetchOaiResolver` `api/oai-resolver.js` | `GET https://api.core.ac.uk/oai/{x}` | — | — | **no importers (dead)** |
| — | `pages/api/healthz.js` | `GET /api/healthz` → `200 {"status":"ok"}` | — | — | k8s probe; trivially testable |

### 1.4 Server-vs-client differences and `internalize`

`api/internalize.js`: `isServer` is evaluated **at module load** (`typeof window === 'undefined'`).

- On the server, it requires both `process.env.Internal_API` and `Internal_API_HOST`. These are deliberately absent from `next.config env`, so they are `undefined` in the browser.
- If `new URL(input).host === Internal_API_HOST`, it rewrites the protocol and host to `Internal_API`'s and returns `{url, headers:{Host: Internal_API_HOST}}`.
- In every other case, including a malformed URL (caught), it returns `{url: input, headers:{}}`.
- `target.host` includes the port. A `Internal_API_HOST` with a port only matches a URL with the same port.

**Characterization cases** (pure function; set `process.env` before import, using `vi.resetModules`):

| Input | `Internal_API` / `Internal_API_HOST` | Output |
|---|---|---|
| `https://api.core.ac.uk/v3/works/1?t=x` | `http://svc.local:8080` / `api.core.ac.uk` | url `http://svc.local:8080/v3/works/1?t=x`, headers `{Host:'api.core.ac.uk'}` |
| `https://doi.org/10.1/x` | (same) | unchanged, `{}` |
| `https://api-dev.core.ac.uk/...` | (same) | unchanged |
| `'not a url'` | (same) | unchanged |
| any URL | either var missing | unchanged |
| any URL | `window` defined at import time | unchanged |

**Runtime-dependent behaviour [verified]:**
- `node-fetch@2.6.1` sends the overridden `Host`.
- Native `fetch` (undici, Node 22) **ignores** it and sends `127.0.0.1:port`, i.e. the service host.
- Next 10 polyfills `fetch` with node-fetch **only if `global.fetch` is undefined**. On Node 18, native fetch is defined, so production is *already* not sending the Host override.

Add an integration test with a local `http.createServer` that echoes `req.headers.host`. Then decide explicitly which behaviour is wanted, and keep it under axios: the axios node adapter honours `Host`.

`lib/loader.js` also calls `internalize`. It does not use `api/index.js`, so no auth header is sent.

### 1.5 Cancellation and races: `utils/invalidatePreviousRequests.js`

This is a legacy (Babel `legacy: true`) method decorator. On each call it:
1. aborts the previous controller, which is held in a **closure per decorated method, shared across all instances**;
2. creates a new `AbortController`;
3. calls the original with `(...args, signal)`. The **signal is appended after whatever args the caller passed** **[verified]**.

Consequences:

| Method | Signal actually used? | Effect / quirk |
|---|---|---|
| `Claim.retrieve(signal)` `store/claim.js:33-53` | **yes**, passed to the request | A previous in-flight add-URL check is aborted. The aborted request **rejects into the catch**, so `this.error = AbortError` is set. It is then reset by the new call's `reset()`, but the order of awaits can leave `error` set briefly. `isLoading=false` from the aborted call's `finally` can arrive **after** the new call set it to `true`. |
| `Filters.fetchFilters(query, sortType, signal)` `store/filters.js:65-108` | no (not forwarded to `fetchAggregations`) | **No cancellation.** A slow earlier response can overwrite a newer one (`setData`), which is a race. `Filters.reset()` calls `this.fetchFilters(q)` with **1 arg**, so `sortType` becomes the AbortSignal and `fullQuery = "${q}?sort=[object AbortSignal]"` **[verified]**. That only affects the `includes()`-based `checked` computation. |
| `Search.downloadResults(signal)` `store/search.js:118-134` | no | none |
| `Report.submit(data, signal)` / `fetchOutput(id, signal)` `store/report.js:52-80` | no | none |
| `SimilarWorks.fetchSimilar(id, params, signal)` `store/similar-works.js:23-45` | no | Race between pages if the user navigates quickly. |

**Migration note (SWR):** SWR dedupes by key and ignores stale responses, so the filter race goes away. If you migrate, add an explicit test showing that the *latest* query wins. Pin the current race only as "documented, not tested" (it is non-deterministic).

---

## 2. Search query construction (URL ⇄ API)

### 2.1 `/search` SSR: `pages/search/index.jsx:18-111`

Input is `context.query`: Next-decoded strings, or arrays when a key is repeated.

```
if Object.keys(query).length === 0  → { redirect: { permanent: true, destination: '/' }, props: {} }   (308)
const { q, page = 1, limit = 10, sort = 'relevance', t } = query
data = { currentPage: +page, query: q, sort }
if (page <= 1000) {                       // string vs number comparison, coerces
  offset = page - 1 > 0 ? (page - 1) * 10 : page - 1     // NOTE: ×10 regardless of limit
  body = { q, offset, limit, t, exclude: ['fullText'], sort: sort === 'recent' ? 'recency' : sort }
  response = await fetchWorks(body)       // E1, URL gets ?t=${t}
  if (response?.results) data = {...data, ...response, results: results.map(w => ({...findUrlsByType(w), dataProviders: transformDataProviders(w.dataProviders)}))}
  else data.results = []
  on throw → return { props: { queryError: { query: q, status: error?.status ?? null } } }
} else data.results = []
members = GET /members filtered (billing_type !== 'starting' && org name && !includes('test'|'demo')), errors swallowed
props = { data, members: featuredMember ? [featuredMember] : [] }
```

Edge-case table (expected values come from the code; the request body is what MSW should assert):

| URL | `data.currentPage` | Body sent to E1 | Notes |
|---|---|---|---|
| `/search` (no params) | — | none | 308 redirect to `/` |
| `/search?page=2` (no q) | 2 | `{offset:10, limit:10, exclude, sort:'relevance'}`. `q` and `t` are dropped by JSON.stringify | URL `?t=undefined` |
| `?q=cancer` | 1 | `{q:'cancer', offset:0, limit:10, …}` | |
| `?q=cancer&page=0` | 0 | `offset:-1` | negative offset sent |
| `?q=x&page=-5` | -5 | `offset:-6` | |
| `?q=x&page=1.5` | 1.5 | `offset:5` | |
| `?q=x&page=abc` | NaN | **no request**, `results:[]` | `'abc'<=1000` is false |
| `?q=x&page=1000` | 1000 | `offset:9990` | template shows the "only first 10.000" note |
| `?q=x&page=1001` | 1001 | **no request** | `results:[]` → QueryError view |
| `?q=x&limit=50&page=2` | 2 | `limit:'50'` (**string**), `offset:10` | offset ignores limit. `limit` is user-controlled and uncapped |
| `?q=x&sort=recent` | | `sort:'recency'` | |
| `?q=x&sort=foo` | | `sort:'foo'` (passed through) | |
| `?q=a&q=b` | | `q:['a','b']` (array) | |
| `?q=x&t=123-456` | | body `t:'123-456'`, URL `?t=123-456` | |
| `?q=%23C%2B%2B` | | `q:'#C++'` | JSON body, so special chars and unicode are safe here |
| `?q=` + 10 kB text | | sent as-is | no length guard |
| E1 throws 500 | | — | `props.queryError.status=500` → `<ErrorCard/>` |
| E1 throws a network error | | — | `queryError.status=null` → falls through to the `QueryError` view (because `data` is undefined) |
| E1 resolves without `results` | | — | `data.results=[]` → `QueryError` view |

### 2.2 How the URL is changed on the client (no encoding layer; all string surgery on `q`)

| Action | Code | Algorithm | Edge cases to pin |
|---|---|---|---|
| Header search submit | `pages/search/index.jsx:126-134` | `router.push({pathname: pathName, query:{...router.query, q: term, page:1}})` | Next encodes it (object form). `t`, `limit` and `sort` are preserved. |
| Header search on works/outputs pages | `pages/works/[id].jsx:130`, `pages/outputs/[id].jsx:113` | ``router.push(`/search?q=${term}`)`` / `` `/search/?q=${term}` `` | **Not encoded.** `C# & C++` → `q=C` (`#` starts a fragment). `a&page=5` injects params. `%` sequences get decoded. |
| Checkbox filter toggle | `store/filters.js:158-195` | `value = (activeFilter.value==='language') ? element.code : element.value`. If `q.includes(value)`, then `q = q.replace(\` AND ${key}:"${value}"\`, '')`. Otherwise `q = \`${q} AND ${key}:"${value}"\``. `page:1`, `pathname: undefined` (FilterBarItem never receives `pathName`) | (a) **substring trap:** with `q='Article'`, toggling documentType `Art` thinks it is present and tries a removal that does nothing, so the filter can never be added. (b) A filter typed manually without the leading ` AND ` cannot be removed. (c) A value containing `"` breaks the syntax. (d) `Router.query.q` undefined → TypeError. (e) `pathname: undefined` relies on Next resolving to the current route (**retest after a Next upgrade**). |
| Year range | `store/filters.js:197-248` | `q = q.replace(/ AND \(year(.*)\)/g, '') + \` AND (${key}>=${y0} AND ${key}<=${y1})\``. Called with `[from, to-1]` from `use-year-filter-controller.js:303` | **Greedy `.*`**: everything after the first ` AND (year` up to the **last** `)` is removed. In `q='x AND (yearPublished>=2000 AND yearPublished<=2001) AND fieldsOfStudy:"Bio(logy)"'` the field filter is lost too. |
| Clear all filters | `store/filters.js:326-343` via `modules/filters/index.jsx:26-28` | `q = query?.replace(/ .*/, '')`: **keeps only the first whitespace-delimited token** of the *original* query, then calls `fetchFilters(q)` (1 arg, see 1.5) | `'machine learning AND language:"en"'` → `'machine'`. `query` undefined → `query.replace` throws on line 342 after `Router.push`. |
| Sort (search page) | `store/search.js:106-116` | `push({pathname:'/search', query:{...q, sort:value, page:1}})` | `value ∈ {'recent','relevance'}`. SSR maps `recent` to `recency`. |
| Sort (data-provider page) | `store/search.js:92-104` | Deletes `Router.query.id` (mutates!) when the path includes `data-providers`. `sort: value==='recent' ? 'relevance' : value` | **Quirk:** choosing "recent" sends `sort=relevance` (inverted). Default sort on that page is `recency`. |
| Search pagination | `templates/search/pagination.jsx:19-28` + `hooks/use-pagination.js` | `push({pathname:'/search', query:{...q, page:n}})`. Page range is `min(max(ceil(totalHits/limit),1),1000)` using **`data.limit` from the API response** | See §3.6 for the `usePagination` table. |
| Data-provider pagination | `templates/data-provider/pagination.jsx:11-51` | `limit = parseInt(url.limit ?? 10)`, `offset = parseInt(url.offset ?? 0)`. NEXT = `min(offset+limit, total - total%limit)`, PREV = `max(offset-limit,0)`, LAST = `total - total%limit`, FIRST = 0 | When `total%limit===0`, LAST points at `offset=total`, an **empty page**. `limit=0` gives `NaN`. Output href is path+query only. |
| Data-provider in-page search | `pages/data-providers/[id].jsx:40-58` | `q = query.trim()`. Return if equal to the current `q`. `url.searchParams.set('q',q)`, `set('offset',0)`, push | Properly encoded (URLSearchParams). |
| Result metadata link | `templates/search/results.jsx:43-50` | `` `${baseLink}/?t=${searchId}-${id}&search=${asPath after '?'}` `` | **Nested query not encoded.** `search=q=x&page=2` makes `page=2` a top-level param of the works URL. The works/outputs template reads it back with `asPath.slice(indexOf('search=')+7)` (`templates/output/index.jsx:83-86`), which round-trips "by accident". Pin it. |
| Reader link rewrite | `templates/search/results.jsx:52-54` | `reader.replace(/(https:\/\/)(core\.ac\.uk)/,'$1api.$2').replace('/reader/','/reader-ui/')` | `https://core.ac.uk/reader/1` → `https://api.core.ac.uk/reader-ui/1` |
| Full-text link choice | `templates/search/results.jsx:56-91` | 1) `links[type=download].url` if present. 2) Else, if the download link or reader link contains `core`/`api.core`, the reader-ui link (+`?t=` when there is a searchId). 3) Else the `download` field. 4) Else `null` | Extract it into a pure fn for testing. The second half of the first condition is dead code. |
| Related searches | `templates/output/related-search.jsx:27` | `` href=`//core.ac.uk/search?q=${item}` `` | unencoded |
| Data providers directory | `store/data-providers.js:41-58` | `term = decodeURI(params.q)`, then a case-insensitive substring match over `name`, `normalizedName`, `urlHomepage`, `normalizedInstitutionName`, `aliases.join('\|')` and `rorId` | **`decodeURI('100%')` throws `URIError` [verified]**, so `/data-providers?q=100%25` crashes the render. Double decoding: a typed `%20` matches a space. A query of `'|'` matches any provider with ≥2 aliases. |
| URL⇄store sync (directory) | `hooks/use-sync-url-params-with-store/index.js` | Writes non-null params, sorted, to the URL (replace if there is no search string yet, otherwise push, shallow). Reads changes back on `routeChangeComplete` with a loose `!=` compare | `query: {...router.query, ...urlParams}`: spreading a `URLSearchParams` gives `{}` (no-op). |

### 2.3 Filters: from aggregation response to UI state

See `transformFiltersData` in §3.2. Labels: `fieldsOfStudy→field`, `documentType→type`, `yearPublished→year`, `authors→author`, everything else unchanged.

`Filters.fetchFilters`:
- requests all six aggregations, except when the active filter is `yearPublished`, in which case it requests the five others;
- on the first call (empty `initialData`), stores the response as `initialData` and renders it directly;
- on later calls, **diffs against `initialData`** so that items missing from the new response get `count 0`;
- if the year counts are all 0, keeps the previous year items (`checkYearPublishedStatis`, `store/filters.js:110-146`);
- sorts every list by count desc, then moves the `'unknown'` value to the front (`setData` `:148-156`);
- regroups years with the hard-coded `[2014, 2016, 2018]` "Since" buckets (`:155`, `:250-281`).

`MAX_YEAR = new Date().getFullYear()` is computed **at module load** (`modules/filters/year/hooks/use-year-filter-controller.js:4`), so freeze the clock in tests.

### 2.4 Data-provider page SSR: `pages/data-providers/[id].jsx:60-122`

1. `q='' , offset=0, limit=10, sort='recency', t` come from the query (strings).
2. `if (!findDataProvider(id)) return {notFound:true}`. This checks the **build-time formap**. `findDataProvider` uses `+id`, so `'0x56'`, `' 86 '` and `'8.6e1'` all resolve to provider 86 **[verified]**, and then E11 is called with the raw string `'0x56'`.
3. E11 + E12 run **sequentially**. Logo = `getBase64ImageSrc(dp.logo) || await checkLogo(dp.id, dp.logo)`. `billingType = checkMembership(dp.id)?.billing_type || null`. Any throw → `{props:{error}, notFound:true}` (404).
4. E13 failure → `data.outputs.error = <Error instance>` in props. In dev, Next's serializability check would throw. In prod it serializes to a mostly-empty object. Pin this as "page still renders with the error message".
5. `getBase64ImageSrc` (`:20-38`):
   - `null`/`''` → `null`
   - an existing `data:image/…` value → returned as-is (trimmed)
   - whitespace is stripped first
   - must match `^[A-Za-z0-9+/]+={0,2}$` with `len%4==0`, else `null`
   - the MIME type is sniffed by prefix (`/9j/` jpeg, `iVBOR` png, `R0lG` gif, `PHN2` svg, `UklG` webp), default png
   - an `http…` URL returns `null` (the `:` fails the regex), so it falls back to `checkLogo`.

---

## 3. Pure functions: behaviour, edge cases, quirks

All outputs marked **[V]** were executed under `TZ=UTC`, Node 22.23.2, ICU 78.2.

### 3.1 `utils/sort.js` (all functions **mutate** the input array and return it)

| Fn | Behaviour | Pinned cases **[V]** | Quirk |
|---|---|---|---|
| `changeIndex(arr, from, to)` `:2-8` | Splice-move | `[1,2,3,4],3,0 → [4,1,2,3]` | mutates |
| `sortItemsByNumberDesc(arr,key)` `:10-11` | `b[k]-a[k]`, stable (V8 TimSort, Node ≥11) | `[{a,1},{b,2},{c,1}] → b,a,c` | |
| `sortItemsByNumberAsc` `:13-14` | comparator `b[k]+a[k]` (**bug**: always >0) | `[3,1,2] → [3,1,2]`; `[1..6] → unchanged` | **Unused.** The result depends on the engine's sort implementation. Don't test it; delete it later. |
| `sortItemsByBoolean(arr,key)` `:16-17` | truthy first | `[F,T,undef,T] → T,T,F,undef` (ids 2,4,1,3) | |
| `sortItemsByAlphabet` `:19-20` | `localeCompare` (ICU-dependent) | `['b','Á','a','Z'] → a,Á,b,Z` | Unused. ICU collation can change. |
| `sortItemsByValueIndex(arr, order, key)` `:22-25` | sort by `order.indexOf` | unknown keys (-1) sort **first**: `x` before `a,b` | |
| `setItemFirst(arr)` `:28-32` | moves `value==='unknown'` to index 0 | `[x,unknown,y] → [unknown,x,y]` | returns `undefined` |

### 3.2 `utils/filters-transform.js`

`checkActiveItems(filters)` (`:4-10`) returns the first filter, excluding the one whose label is `'sort by'`, that has an item with `checked===true`; otherwise `undefined` **[V]**. The result is an object or `undefined`, not a boolean.

`transformFiltersData(initial, next, labelOrder, query)` (`:42-121`):
1. If `next` is null, `next = deepClone(initial)`.
2. `compare(a,b)` recursively unions the keys. A leaf value is `b[key] || 0`, so values missing from `next` become 0. If either side is an object, the function recurses.
3. Convert to `[{value: aggName, label, items:[{value:key.replace(/['"]+/g,''), count}]}]`.
4. Sort the filters by `labelOrder` index.
5. **Language:** `find(value==='language')` is **not null-safe**, so a response without `language` throws `TypeError` **[V]**. For each item, `code = value`, and `value` becomes the English name when `languages.json` has `code.toLowerCase()`. **[V]** `en` and `EN` both become `English`, so there can be **duplicate display values**. Unknown codes such as `xx` stay as-is.
6. **Year:** values go through `parseInt`, so they become numbers.
7. `checked = value.toString() !== '' && (query.includes(String(value)) || query.includes('"'+code+'"'))`. This is a **substring test against the full query+`?sort=`**:
   - year `2019` is checked whenever "2019" appears anywhere in the query, including in a free-text title;
   - `Art` is checked by the query "Article about cats" **[V]**;
   - for non-language items `code` is undefined, so a query containing `"undefined"` checks every one of them.

**[V] fixture result.** Input:
- `agg = {fieldsOfStudy:{Medicine:5,'"Biology"':2}, yearPublished:{'2019':3,'2020':0}, documentType:{research:4}, authors:{'Smith, J':1}, language:{en:7,xx:1,EN:1}, publisher:{'':2,Elsevier:1}}`
- `query = 'cancer AND language:"en" AND yearPublished>=2019?sort=relevance'`

Result:
- fields: Medicine 5, Biology 2 (quotes stripped)
- year: 2019 (checked), 2020
- language: English (checked, code en), xx, English (code EN, unchecked)
- publisher: `''` count 2 (never checked)

A diff call against `next = {fieldsOfStudy:{Medicine:1}, language:{en:1}}` gives every missing key count `0` **[V]**.

### 3.3 `utils/related-words.js`: `relatedWords(title, similarOutputs=[])`

1. Strip `['"\`“”,.!:]`.
2. Split on a **single space**. A double space produces an empty token, and the pair builder then emits `"word "` with a trailing space.
3. For each token with length > 3, or in `['OU','EU','SNP']`, push the token, and also push `token + ' ' + next` if a next token exists. The **next token is not filtered**.
4. For each similar output, push every candidate that appears in `output.title` via **case-sensitive** `indexOf`.
5. Sort with the default (UTF-16) order, dedupe, and return `[0]` if the result is empty (the UI renders "No results").

| Input | Output **[V]** |
|---|---|
| `''`, `[]` | `[0]` |
| `'Deep learning for EU policy: a review'`, titles `['Deep learning methods','EU policy and deep learning']` | `["Deep","Deep learning","EU","EU policy","learning","policy","policy a"]` (note `"policy a"`) |
| `'Deep Learning'`, `['deep learning']` | `[0]` (case-sensitive) |
| `'Deep  learning'` (double space), same | `["Deep","learning"]` |
| `'“Smart” cities, “IoT”!'`, `['Smart cities IoT']` | `["Smart","Smart cities","cities","cities IoT"]` |
| `undefined` title | throws TypeError |
| similar item with `title:null` | throws TypeError |

### 3.4 `utils/validation.js`: `convertAndValidate({schema, params, key})`

For each schema key, first `convert`:
- `'number'` → `Number(v)`
- `'string'` → `v.toString()`
- an `undefined` value is left as-is.

Then `validate`:
- an array means membership;
- `'number'` → `Number.isInteger`;
- `'string'` → `typeof string`.

On failure the `default` is used. If there is no `default`, it throws `Error('Value for schema [object Object] is invalid…')`. Extra params are dropped. With `key`, only that key is processed.

**[V] with the data-providers schema** (`store/data-providers.js:5-20`):

| params | result |
|---|---|
| `{}` | `{q:'', size:10, action:null}` |
| `{q:'abc', size:'20', action:'ADD', extra:1}` | `{q:'abc', size:20, action:'ADD'}` |
| `{q:5, size:'abc', action:'add'}` | `{q:'5', size:10, action:null}` (case-sensitive `ADD`) |
| `{size:'1.5'}` | size 10 |
| `{size:''}` | **size 0** (`Number('')===0`) |
| `{q:['a','b']}` | `q:'a,b'` |

`store/params.js` wraps this in a MobX observable. `changeParams` merges the current values with the new ones and re-validates.

### 3.5 Formatting (locale/TZ/ICU-sensitive)

| Fn | Behaviour | **[V]** outputs (TZ=UTC unless stated) | Quirks |
|---|---|---|---|
| `utils/helpers.js formatDate(date, opts={})` `:27-40` (**used**: results, similar works, card-dropdown, metadata) | If `date.toString().length===4`, return `date` unchanged (a year). Otherwise `Intl.DateTimeFormat('en-GB', opts).format(new Date(date))`. On error, log (non-prod) and return the **input**. | `'2020-05-01' → '01/05/2020'`; long opts → `'1 May 2020'`; `'2020'` and `2020` → returned as-is (string/number); `'bad' → 'bad'`; `null`/`undefined` → returned as-is (TypeError caught); `'2020-05-01T00:00:00.000+02:00' → '30/04/2020'`. **America/New_York:** `'2020-05-01' → '30/04/2020'`. **Asia/Tokyo:** `'2020-05-01T23:30:00Z' → '02/05/2020'` | Callers pass `new Date(x)`, so an invalid date returns a **Date object** **[V]**, which React cannot render as a child (crash). `new Date(2020)` is epoch+2020 ms → `'01/01/1970'`. |
| `utils/format-date.js` (cached formatter) | same idea, no year shortcut | `'2020' → '01/01/2020'`, `2020 → '01/01/1970'`, `null → '01/01/1970'`, `undefined → undefined` | **Unused.** Delete or test. |
| `formatNumber(n, {locale='en-GB', maximumFractionDigits=2, ...})` `utils/format-number.js` | `Intl.NumberFormat`; the string `'NaN'` becomes `'a lot of'` | `0→'0'`, `1234567.891→'1,234,567.89'`, `452015991→'452,015,991'`, `-1.005→'-1.01'`, `0.125→'0.13'`, `'123'→'123'`, `'abc'/NaN/undefined→'a lot of'`, **`null→'0'`**, `'more than 356 million'→'a lot of'`, `1e21→'1,000,…,000'`, `10n→'10'` | Rounding mode is ICU's half-expand. The `'a lot of'` fallback is a user-visible string. |
| `Number#toLocaleString('en-GB')` (statistics, totalHits, filter counts) | | `452015991→'452,015,991'`; a string is returned unchanged | `statistics.totalArticlesCount` is **always the string `'more than 356 million'`** today (see §4). |
| `Intl.DisplayNames(['en'],{type:'region'})` `templates/data-provider/index.jsx:24-38` | `regionDisplayName(code)` trims and upper-cases, returns `''` for null/non-string/empty, and falls back to `code` if `.of` throws | Node 22: `GB→United Kingdom, US→United States, TR→Türkiye, CZ→Czechia, HK→Hong Kong SAR China, MK→North Macedonia, CI→Côte d’Ivoire, PS→Palestinian Territories, MO→Macao SAR China, SZ→Eswatini, XK→Kosovo, ZZ→Unknown Region`; `'G'` throws, so the fallback returns `'G'` | Names differ by ICU version. Snapshot per Node major, or assert on a stable subset (GB, US, FR). |
| `capitalizeFirstLetter(s)` `utils/titleCase.js` | `charAt(0).toUpperCase()+slice(1)` | `'supporting'→'Supporting'`, `''→''`, `'éa'→'Éa'`; `undefined` throws | |

### 3.6 Other helpers

| Fn | Behaviour **[V]** | Quirk |
|---|---|---|
| `getAssetsPath(path='/', target=BUILD_TARGET)` `utils/helpers.js:1-2` | `azure` → `/static/search${path}`, otherwise `path` | Read at **build** time for `assetPrefix`; Dockerfile default target is `azure`. |
| `rewriteDataPath(path, NODE_ENV)` `:4-25` | prod → `{source:'/search/_next/data/:path*', destination:'/_next/data/:path*'}`, otherwise source=destination | Paired with the `getDataHref` monkey-patch in `_app.jsx:70-80`, which **breaks on newer Next** (pageLoader internals). Owned by the Next auditor. |
| `findMin/MaxValueInArray(arr,key)` `:42-52` | `Math.min/max.apply` | `[] → Infinity / -Infinity`; mixed `'2001'`,`1999` → `1999` |
| `findUrlsByType(article)` `:54-61` | for each `links[i].type`, set `article[type] = url of the FIRST link of that type`. **Mutates and returns the same object** | `download` with 2 links → the first one wins. `links` missing → TypeError. |
| `usePagination` `hooks/use-pagination.js` | see table below | Returns **`undefined`** for `currentPage=NaN` or `pageSize=undefined`, and `Pagination` then crashes on `.length`. For `cur=5` it shows `[1,…,3,…]`, where the dots hide just one page. |
| `pickFeaturedMember(members, preferredRepoId)` `templates/search/utils/featured-member.js:12-35` | not an array or empty → `null`; else the member matching `preferredRepoId` (never passed, so `Number(undefined)` is NaN and nothing matches); else a **random** activated supporting/sustaining member; else a random activated non-starting member; else `members[0]` | Mock `Math.random` in tests. |
| `getMemberRepoId(m)` | null → null; array → first truthy; else `repo_id ?? null` | |
| `findMemberByRepoId` | numeric compare, array-safe | |
| `generateMetadata(results)` `templates/data-providers/utils/generate-metadata.js` | JSON-LD string, `position` is **0-based** | Injected via `dangerouslySetInnerHTML` **without escaping `</script>`**, so a provider name containing `</script>` would allow injection. Test with such a name. |
| `normalizeDataProviders(list)` | drops entries without `name`; adds NFD-stripped `normalizedName` and `normalizedInstitutionName` | 15,672 entries today, none without a name. |
| `generateFormMessage({created,duplicated,error})` | precedence error > created > duplicated > normal. `duplicated.message` **must be a JSON string**, otherwise `JSON.parse` throws during render | |
| Takedown URL parser (inline) `templates/output/update/index.jsx:37-66` | `/(http(s)?:\/\/)?core.ac.uk\/(outputs\|display\|download\|download\/pdf)\/\d+\|^\d+$/s`, then `match().join('')`, then the first `\d+` | Unescaped dots: `core2ac3uk/outputs/5` gives id **`2`**. `https://core.ac.uk/download/82976757.pdf ` gives `82976757`. `/works/` and `/search` are rejected. Extract it into a pure fn and test it. |

`usePagination` **[V]** (`totalCount`, `pageSize`, `siblingCount`, `currentPage`):

| Inputs | Result |
|---|---|
| `0,10,2,1` / `5,10,2,1` | `[1]` |
| `95,10,2,1` | `[1..7,'...',10]` |
| `1000,10,2,5` | `[1,'...',3,4,5,6,7,'...',100]` |
| `1000,10,2,50` | `[1,'...',48..52,'...',100]` |
| `1000,10,2,98` | `[1,'...',94..100]` |
| `1000,10,0,50` | `[1,'...',50,'...',100]` |
| `1e9,10,2,1000` or `1001` | `[1,'...',994..1000]` (capped at 1000) |
| `1000,0,2,1` | `[1..7,'...',1000]` |

### 3.7 `utils/data-providers-transform.js` (against the committed `.members.json` / `.formap.json`) **[V]**

Data facts:
- `.members.json`: 477 rows. `billing_type`: starting 426, sustaining 36, supporting 15. `repo_id` is an int in 385 rows, an int[] in 89 and `null` in 3. The keys are **snake_case**.
- `.formap.json`: 15,672 rows, int `id`, unique, all named.

| Fn | Behaviour | Pinned cases |
|---|---|---|
| `checkMembership(id)` `:5-15` | Finds a member whose `repo_id` (array: `.includes(id)`, strict type; scalar: `+a===+b`) matches **and** `item.billingType !== 'starting'`. **Wrong key**, so the condition is always true. | `checkMembership(4835)` (a *starting* member) → truthy. Array member `[8,503]`: `checkMembership(503)` truthy, `checkMembership('503')` **falsy**. `checkMembership(null)` is truthy: it matches one of the 3 members whose `repo_id` is `null` (`+null === +null`, i.e. `0 === 0`). |
| `checkDataProvider(id)` `:17-23` | same, without the billing check | `(503)` truthy |
| `checkType(id)` `:36-43` | array: `.includes(id?.toString())`, so it **never matches** number arrays | `checkType(503)` and `checkType('503')` are both falsy; `checkType(8)` is undefined; `checkType(0)` and `checkType(null)` match a null-repo member; `checkType(undefined)` is falsy |
| `checkLogo(id, url)` `:25-34` | not a member (per checkMembership) → `null`; otherwise `await fetchLogo(url)` (E14), giving `url` on success and `null` on throw | Works and outputs pages call `checkLogo(dataProvider.logo)` (**1 arg**: the URL is used as the id), so the result is **always `null`** (`pages/works/[id].jsx:41`, `pages/outputs/[id].jsx:56`). |
| `transformDataProviders(list)` `:63-76` | `list.map(({url,id}) => ({url, ...formap.find(dp.id===+id)}))` | Unknown id → `{url}` only. `undefined` list → throws, so the **search SSR throws for a work without `dataProviders`** and lands in `queryError`. |
| `findDataProvider(id)` `:78` | `formap.find(dp.id === +id)` | `'86'`, `' 86 '`, `'0x56'`, `'8.6e1'` all give provider 86; `'86abc'` gives undefined |
| `checkUniversity(id)` `:80-103` | Finds a member with `organisation_name`, but then reads **`member?.organisationName`** (wrong key, always undefined). Falls back to `formap.institutionName`, else `''`. | `(4835)` → `'Aberystwyth University'` (from formap); unknown id → `''`; `undefined` → throws TypeError |

---

## 4. Build-time and runtime data

### 4.1 Files

| File | Tracked? | Format (committed) | Producer | Consumers |
|---|---|---|---|---|
| `data/.statistics.json` (348 B) | yes (force-added; `.gitignore` has `data/*`) | **raw** object `{totalArticlesCount, fullTextCount, repositoriesCount, countriesCount, …}` | `data/data-loader.js` (build), `lib/statistics-loader.js` (runtime, only if the file is missing) | `pages/_app.jsx:12` (webpack import, **baked at build**) |
| `data/.formap.json` (5.4 MB) | yes | array `{id, openDoarId, name, urlHomepage, email, rorId, institutionName, otherIdentifiers, aliases[], dataProviderLocation{countryCode, latitude, longitude, countryName}}` | same | `utils/data-providers-transform.js:2` (bundled into **client and server**), `pages/data-providers/index.jsx:4` (sent whole as SSR props) |
| `data/.members.json` (140 KB) | yes | array, snake_case keys (see 3.7) | same | `utils/data-providers-transform.js:1` |
| `data/languages.json` | yes | `[{code:'aa', name:'Afar'}, …]` ISO-639-1 | static | `utils/filters-transform.js:1` |

### 4.2 `data/data-loader.js` (runs first in `npm run build`)

- `require('node-fetch')` at `:5`. **node-fetch is not in package.json.** It comes in transitively through `next@10.2.3` (lock `:10967`). Once Next is upgraded, the build fails with `Cannot find module 'node-fetch'`. Fix by switching to global `fetch` (Node ≥18), or by adding the dependency explicitly.
- `fs.readdir(__dirname, cb)` (`:91`). For every `*.json` (including dotfiles and `languages.json`) it calls `retrieveStats(path)` **without awaiting**.
  - `languages.json` has no API URL → `fetchStats(null)` returns `null` → no-op.
  - For the 3 dotfiles it does a `GET` (no auth, **production URL regardless of APP_ENV**). A status ≥400 rejects. On success it writes the raw JSON (`saveCachedStats`). `saveCachedStats` returns `undefined`, so the function returns `undefined`.
  - A fetch failure is logged, then `throw new Error('Fail. ==> Statistics retrieval failed …')` inside a **non-awaited promise**. That is an `unhandledRejection`, which **terminates the process with exit code 1 on Node ≥15**. Because the build script chains with `&&`, **`npm run build` fails whenever the CORE API is unreachable or returns ≥400 for any of the three URLs**. On Node ≤14 it was only a warning, and the build used the committed cache. Pin this with a test that mocks fetch to fail and asserts a non-zero exit code. Then decide deliberately whether to keep it (fail fast) or fall back to the committed files.
  - Node keeps the process alive until the pending fetches/writes settle, so `next build` always sees the freshly written files when the fetches succeed.
- `loadCachedStats` (the 6 h freshness check) is **never called** (dead).

### 4.3 `lib/loader.js` + `lib/*-loader.js` (runtime, `_app.getInitialProps`, **every SSR request**)

`getData()` works as follows:
1. `readCache()` = `JSON.parse(fs.readFileSync(path.resolve(fileName)))`. `fileName` is resolved against `process.cwd()`, which is `/app` in Docker.
2. If that succeeds, the cached data is returned. **In practice it always succeeds** (the files are committed), so every SSR request does a **synchronous read + parse of ~5.6 MB** (formap + members + stats). That is a performance hot spot, not a correctness issue.
3. If there is no cache, it fetches with a 3 s timeout (`internalize`d, no auth), then `writeCache({data, timestamp: new Date().getDate()})`. **`getDate()` is the day-of-month** (bug). This also uses a **different file shape** (`{data, timestamp}`) from the one data-loader writes (raw).
4. On failure it returns `null`.

The wrappers `getDataProviders`, `getMembers` and `getStatistics` **discard the return value** (`await loader.getData()` with no `return`), so they always resolve to `undefined`. Their only effect is the side-effect cache write.

`_app.getInitialProps` (`pages/_app.jsx:125-137`):
```
await getStatistics(); await getDataProviders(); await getMembers()   // results unused
const { data } = cachedStatistics             // build-time import of RAW stats → data === undefined
statistics = (data && keys(data).length) ? data : { totalArticlesCount: 'more than 356 million' }
```
So **statistics are always `{totalArticlesCount:'more than 356 million'}`** with the committed raw format. The search placeholder reads "Search more than 356 million from papers around the world". The data-providers page shows "Our dataset currently contains a lot of …", because `formatNumber('more than 356 million')` returns `'a lot of'` (`templates/data-providers/index.jsx:197`). Pin both strings. They change the moment someone "fixes" the file shape.

`statistics` is a **module-level `let`** mutated per request (`_app.jsx:118-132`). It is shared across requests, which is harmless today because the value is constant.

### 4.4 Fixture strategy for data files

- Tests must **not** import the 5.4 MB formap. Add a `__fixtures__/data/` folder with ~10 providers: ids 86 (has `institutionName`), 4835, 8, 503, a provider with aliases, one without a location, one whose name contains `</script>`, one with diacritics. Add ~8 members covering: scalar starting, array [8,503] starting, supporting, sustaining, `repo_id:null`, not activated, an "Org Test" name, an "Org Demo" name.
- Map them with the module alias `data/.formap.json → fixtures` (Jest `moduleNameMapper` / Vitest `alias`).
- Add **one contract test** that loads the real committed files and asserts their shape: formap array items have `id:number` and `name:string`; members items have `billing_type ∈ {starting,supporting,sustaining}` and `repo_id ∈ {int, int[], null}`; statistics is a raw object with a numeric `totalArticlesCount`. This catches producer-side format drift.

---

## 5. High-risk user flows (step by step)

### 5.1 "Add a data provider" (directory page `/data-providers`; `store/claim.js` + `use-claim-controller.js` + `generate-form-message.jsx`)

1. `?dataProviderUrl=<url>` in the URL is copied into `claim.query` (`use-claim-controller.js:41-44`). Otherwise the input `onChange` sets `claim.query` (`pages/data-providers/index.jsx:64-69`).
2. A debounced effect (500 ms) runs on `claim.query`. The first run is immediate (`hooks/use-debounced-effect.js:6-11`). It does nothing if the query is `''` or there is no form ref. If `formRef.current.dataProviderUrl.checkValidity()` fails, it calls `reportValidity()` and stops. Otherwise it calls `claim.retrieve()`.
3. `retrieve` (decorated, see 1.5): `reset()` (query kept) → `isLoading=true` → **E16** `POST /internal/data-providers` with the string body `{"uri":query}`.
   - 2xx: `created = data` gives a success message with `created.name` and a `mailto:created.email` link.
   - 409: `duplicated = error.data` → `JSON.parse(duplicated.message).existingDataProviders[0]` gives a link to `https://core.ac.uk/search?q=repositories.id:(ID)`, or "Data provider already exists."
   - Other errors, **including AbortError from a superseded call**: `error = error` → the "We cannot detect a repository…" message.
   - `finally`: `isLoading=false`.
4. Submit (`handleSubmitForm`): if `!claim.created` it is a no-op. Otherwise `reset({query:true})`, which clears the input.
5. Message precedence: `isLoading` → `{variant:'progress'}`, else `generateFormMessage`: error > created > duplicated > neutral helper text.
6. `results` empty → `params.action='ADD'` (form shown). Otherwise it falls back to the initial `action` from the URL (`pages/data-providers/index.jsx:77-80`).

MSW cases:

| Server response | Expected UI state |
|---|---|
| 201 `{name,email}` | success |
| 409 `{message:'{"existingDataProviders":[{"id":86,"name":"ORO"}]}'}` | duplicated with link |
| 409 `{message:'{}'}` | generic duplicate |
| 409 `{message:'not json'}` | **render throws** (pin it) |
| 400/500 | error |
| network error | error |
| two rapid inputs | first aborted, last wins |

Also assert that the **request Content-Type is `text/plain;charset=UTF-8`** and the body is the raw JSON string. Under axios 1.x a string body passes through untouched, but the dashboard-style instance sets a default `Content-Type: application/json`. Migrating would therefore change the header the backend receives. Either pass the object (preferred) and confirm the backend accepts `application/json`, or keep the text/plain behaviour deliberately.

### 5.2 Claim card on `/data-providers/[id]` (`templates/data-provider/claim/claim-card.jsx`)

- **During every render** it calls `getDataProviderAccounts({params:{id, setIsDataProviderHasAccounts}})` (`:104-106`), i.e. **E18** `GET /internal/data-providers/{id}/account`. If the response has `length>0`, it calls `setIsDataProviderHasAccounts(true)`, which triggers one more render and one more request. Errors are swallowed: the function returns `{props:{error}, notFound:true}`, which is meaningless on the client.
- `isDataProviderHasAccounts || dataProviderType==='starting'` → text "Do you manage {name}? … Repository Dashboard", with buttons **SIGN IN** (`window.open('https://dashboard.core.ac.uk/')`) and **Create account** (opens `ClaimModalEdit`).
  - Otherwise it shows "Do you manage **Open Research Online**?" (**hard-coded name**, a quirk) and a **Become a member** button (`window.open('https://core.ac.uk/membership')`).
  - `dataProviderType` = page `billingType` = `checkMembership(id)?.billing_type`. Because of the checkMembership bug, that includes `'starting'` members (see 3.7).
- Header caption: `isDataProviderHasAccounts && billingType !== null` → "`{billingType} member`", else "Not a member yet" (`templates/data-provider/index.jsx:104-106`).
- `ClaimModalEdit` submit needs `name && email && rationale` and calls `getClaim({...options, modalEdit:true})`, which runs `setNewEmail(email)` and then **E17** `POST /internal/data-providers/{id}/claim` `{name,email,rationale,repositoryHasAccount}`. On success it logs `JSON.stringify(response)` and opens the success modal. **On failure nothing visible happens** (the error is swallowed).
- `ClaimModal` (reached from the success modal) submits `{nameFirst, emailFirst, rationale, modalEdit:false}`. Then `email=emailFirst`, `name=nameFirst`, `setNewEmail('')`, and the same POST.
- `SignInModal` is **not rendered** anywhere. `api/sign-in.js` (`POST /login_check`) is **dead**: sign-in is delegated to `dashboard.core.ac.uk`.

MSW/RTL cases:

| Scenario | Expected |
|---|---|
| accounts `[]` | member/non-member text and buttons |
| accounts `[{…}]` | "SIGN IN" branch + caption "`{billingType} member`" |
| accounts → 401/500 | stays false, no crash |
| claim POST 200 | success modal opened |
| claim POST 500 | no modal, no message (pin) |
| | count E18 calls per mount: ≥2 when accounts exist (pin as `toBeGreaterThanOrEqual(1)`, to avoid StrictMode flakiness) |

### 5.3 Takedown / report flow (`/outputs/update`; `store/report.js`)

1. The URL input is parsed (§3.6). Invalid input gives the error JSX "Links starting with …/works or …/search are not accepted…". Valid input → `report.fetchOutput(id)` → **E6**. On success, `output = rest-without-fullText` and the type modal opens. On error, `error = 'We couldn’t perform the action. For any issue contact theteam@core.science'`.
2. Type modal: `updateOption ∈ {'takeDownFullText','issueWithContent'}`. Role fieldset: `role ∈ {'repositoryManager','author','other'}`. Note: the Fieldset *visually* pre-selects the first item but does **not** set `role` until it is clicked.
3. Form submit requires `outputId && name && email`. It calls `report.submit({outputId,name,email,message})`, which **mutates** `data` to add `updateOption` and `role`, then **E10**. Success → `isModalReportSuccessActive=true`. Error → `error=ERROR_MESSAGE`.

### 5.4 Work / output pages (SSR)

**`/works/[id]`** (`pages/works/[id].jsx:19-120`):
1. E4 (+`?t`), then E5, sequentially.
2. For each output: `findUrlsByType`, and the logo is `null` (bug 3.7).
3. `mainDataProviderLink`:
   - arXiv: `https://arxiv.com/abs/{arxivId}` (**arxiv.com, not arxiv.org**, a quirk).
   - PubMed: `https://pubmed.ncbi.nlm.nih.gov/PMC{pubmedId}`.
   - The object is kept when any value `!== null`. Values are `undefined` when absent, so the condition is **always true** and the object is never `null`.
4. `publishedDate = publishedDate || yearPublished`. `sourceFulltextUrls = first || null`. `dataProvider = dataProviders[0]`.
5. On error: `serverError = {code: error.status, message: status===410 ? error.data : 'The page you were looking for could not be found', prevHistoryUrl: req.headers.referer ?? null}`. For a 410, `message` is the **parsed response body (object)**.
6. Citations only when `data.doi` is set. Failures give `[]`.

**`/outputs/[id]`** (`pages/outputs/[id].jsx:43-102`):
1. E6, then E7 (`output.dataProvider.url`).
2. Logo: always `null` (bug).
3. `sourceFulltextUrls` is wrapped as **`[array]`** (nested array, a quirk).
4. Error mapping (`setOutputError`):
   - 410 → "The article with ID {id} has been disabled"
   - otherwise, if `error.message` includes `data-providers` (i.e. E7 failed, because the URL is in the message) → "Data provider has been disabled"
   - else "…could not be found".
   - `code = error.status`. A **non-HTTP error** (e.g. `TypeError` without `.message.includes`) is fine. An error with no `message` throws.
5. Citations come from `identifiers.doi`.

**Citation modal** (`templates/output/citation.jsx:65-104`): `bibtexParse.toJSON(cite.value)` is called for the `bibtex` style only. The display is `title`, then `, Journal: …`, `, : {year}` (a literal stray colon), `, ISBN: …`, `, ISSN: …`. **Malformed BibTeX throws a string** ("Token mismatch, expected }, found ") **[V]** inside `useMemo` during render, which crashes the subtree.

### 5.5 `internalize` and `oai-resolver`

- `internalize`: see 1.4.
- `oai-resolver`: dead. The helper would request `GET https://api.core.ac.uk/oai/{value}` without encoding the value (e.g. `oai:core.ac.uk:123` is fine; `/` or `?` inside the value would break). Delete it or leave it untested.

---

## 6. Third-party libraries in scope

| Lib (installed) | Call sites | Current usage | Upgrade impact | Action |
|---|---|---|---|---|
| `filesize@6.4.0` (`^6.1.0`) | **none** in app code, and none in `@oacore/design` src/lib | — | v10+ dropped the default export (`import { filesize }`), but this is irrelevant here | **Remove the dependency.** Add a lint guard (`no-restricted-imports`) if it is re-added. |
| `throttle-debounce@3.0.1` (`^3.0.1`) | **none** in app code. Used only by `@oacore/design` `src/modules/header/search-bar.jsx:2,91`: `throttle(suggestionsDelay, false, cb)` (v3 positional `noTrailing=false`) | — | v4/v5 signature is `throttle(delay, callback, {noTrailing, noLeading, debounceMode})` (verified from v5.0.2 source in the dashboard). If v5 were ever resolved **for design**, `callback=false` would make the call throw `callback.apply is not a function`. design declares its own `"throttle-debounce": "^3.0.1"`, so npm nests v3 for it. | Remove it from search's `package.json`, or bump it only if search code starts using it. Verify with `npm ls throttle-debounce` that design still resolves 3.x. When re-implementing design's SearchBar locally, use `throttle(delay, cb, { noTrailing: false })` or the dashboard approach. |
| `i18n-iso-countries@6.8.0` (`^6.2.2`) | `templates/data-providers/index.jsx:3,28-31`: `import { countries } from 'i18n-iso-countries/langs/en.json'`, then `countries[CODE]` (array → first element) | No `registerLocale`, no API calls, just a **named import from JSON** | (a) Webpack 5 (Next ≥12) warns for named imports from JSON ("only default export is available soon"). Switch to `import en from '…/en.json'; en.countries`. (b) v7 data changes country **names** (e.g. Turkey→Türkiye, possibly others). That is user-visible text, so snapshot `getCountryName` for ~15 codes before and after. (c) Check that the v7 package `exports` still allows the deep `langs/en.json` import (not verifiable offline here; the registry was blocked). Alternatively use `countries.registerLocale(en); countries.getName(code,'en')`. Note that `getName` returns the **first** alias by default, the same as the current `Array.isArray` logic. | Characterize `getCountryName`: `GB → 'United Kingdom'` (from `['United Kingdom','UK','Great Britain']`), `US → 'United States of America'`, `TR → 'Turkey'`, `CZ → 'Czech Republic'`, `MK → 'North Macedonia, Republic of'`, `KR → 'South Korea'`, `gb → 'United Kingdom'`, `undefined → undefined` (`'UNDEFINED'` key), `null → undefined`. **These were read from the installed v6.8.0 [V]**. |
| `js-file-download@0.4.12` (latest; unmaintained) | `api/search.js:3,48`: `FileDownload(blob,'results.csv')` | Creates `new Blob([data], {type: 'application/octet-stream'})` (no mime passed), then an anchor click. Uses `window.navigator.msSaveBlob` when present. | No upgrade available. Under axios the default `responseType` would give a **string**, not a Blob; pass `responseType:'blob'`. The current code relies on `processBody` returning a Blob for `text/csv`. | Test (jsdom): mock `URL.createObjectURL`, assert the anchor `download="results.csv"` and that the Blob content equals the CSV. In the MSW handler, assert the request body `{q, accept:'text/csv', limit}`. Consider inlining the ~20 lines and dropping the dependency. |
| `bibtex-parse-js@0.0.24` (latest; unmaintained, CJS) | `templates/output/citation.jsx:3,67`: `bibtexParse.toJSON(text)` | Default-import interop of a CJS module | Stable API. ESM interop under newer bundlers: `import bibtexParse from` on CJS → `module.exports` object. Check that `toJSON` is still reachable (it is with webpack 5 and Vite). | Unit-pin **[V]**: the sample DOI BibTeX gives `[{citationKey, entryType:'article', entryTags:{title:'Deep {Learning}: a review', ISSN, journal, year:'2020', month:'jan', …}}]` (braces inside values are kept; keys are case-preserved, `ISSN` and `DOI` upper-case). `''` and `'garbage'` give `[]`. An unbalanced brace **throws a string**. Quoted values (`title = "Quoted"`) parse. Wrap the call in try/catch in a follow-up PR, not during the upgrade. |
| `node-fetch@2.6.1` (**undeclared**, transitive via next@10) | `data/data-loader.js:5`; also Next 10's own polyfill | see §1.4 and §4.2 | Disappears with the Next upgrade | Replace with global `fetch` (engines `>=18`) **before** bumping Next, in its own PR with the data-loader test. |
| `logrocket` (`api/index.js:1,117`) | `captureException` on every failed request | | Test seam: mock `logrocket` in unit tests. | — |

---

## 7. Test plan / matrix (ranked by risk)

### 7.0 Harness recommendations

- **Runner:** Vitest or Jest with `testEnvironment: node` for `api/`, `lib/`, `utils/` and `data/`, and `jsdom` for `store/` + components. Use the same path aliases as `next.config.js:86-100` (`api`, `data`, `utils`, `store`, `templates`, `hooks`, `modules`, `lib`).
- **Babel:** the stores need `@babel/plugin-proposal-decorators {legacy:true}` and class properties (reuse `babel.config.js`).
- **Env:** `TZ=UTC`, `API_URL=https://api.core.ac.uk/internal`, `API_KEY=test-key`, `NODE_ENV=test`. Freeze time (`vi.setSystemTime('2026-01-15T12:00:00Z')`) because of `MAX_YEAR` and `Date.now`. Pin `Math.random` for `pickFeaturedMember` and `reqId`.
- **MSW v2** (`setupServer` from `msw/node`), with handlers keyed by the §1.3 table. Use **`onUnhandledRequest: 'error'`** so any URL drift (e.g. losing `?t=undefined`) fails loudly. For `fetch` under Node 18+, MSW intercepts global fetch. For node-fetch (data-loader), use MSW's `ClientRequest` interceptor, which is also covered by `setupServer`.
- **Snapshot by Node major** for ICU-dependent strings (`__snapshots__/node18`, `node22`), or assert on ICU-stable subsets only.

### 7.1 Fixture strategy (recording real API responses)

1. Write a small script, `scripts/record-fixtures.mjs`, **run manually, never in CI**. It calls **production** `https://api.core.ac.uk` with a read-only API key, for a fixed list of IDs:
   - search `q=machine learning` page 1 + sort=recent + page 1000 + a query with 0 hits + a filter query `AND language:"en"`
   - aggregate for the same q
   - works: one with arXiv, one with PubMed, one with a DOI, one returning 410
   - outputs: one normal, one whose dataProvider is disabled
   - data-provider 86 (meta/stats/outputs), one with a base64 logo, one with a URL logo
   - `/recommend` for one id
   - `/internal/members`
   - doi.org citation (apa + bibtex) for one DOI
   - CSV download (limit 10)
2. Save to `__fixtures__/api/<endpoint>/<case>.json` together with the **status + content-type**. Content-type matters because of `processBody`.
3. **Scrub** emails and personal names in members/claims. **Trim** arrays to ≤5 items, but keep every field listed in §1.3 "Fields read".
4. Add a **contract test** per fixture. A JSON-schema (or zod) schema derived from the "fields read" columns asserts the presence and type of the consumed fields. Optionally a nightly job re-runs the recorder against production and validates the schemas, to detect API drift independently of the upgrade.
5. **Never** record POSTs that mutate state (E10, E16, E17). Hand-write those fixtures from the code paths above (201/409/500).

### 7.2 Matrix

Risk: **H** = user-visible or production-breaking if changed, **M** = visible but minor, **L** = cosmetic or dead code.

| Risk | Module / unit | Type | Concrete cases (input → expected) |
|---|---|---|---|
| H | `api/index.js` request builder | unit (stub fetch) | relative path → `${API_URL}/path`; absolute URL and `URL` object passed through; `searchParams` merge incl. arrays → `a%2Cb`, `undefined` → `'undefined'`, existing URL params kept; method upper-casing; object body → JSON + `Content-Type: application/json`; string body → no Content-Type; `body:null` + POST → body `"null"`; GET with body → no body; headers include `Authorization: Bearer test-key`, `Accept: application/json`; custom headers override; `credentials:'include'`; `signal` passed through |
| H | `api/index.js` response/error | unit + MSW | JSON CT → object; `application/json; charset=utf-8` → object; `vnd.api+json`/`problem+json`/`ld+json`/`text/json`/no CT → Blob; HEAD → Blob; invalid JSON → SyntaxError; 400/401/402/403/404/406/409/410/422/500/503 → the class from §1.1 with `status`, `data`, `type`, `headers` assigned and message `Request for <url> failed on <status>`; 502 HTML → `data` Blob; network error → original TypeError without `status`; `LogRocket.captureException` called once per failure |
| H | `api/internalize.js` | unit | the 6 cases in §1.4 (with `vi.resetModules` + env) |
| H | `internalize` × fetch impl | integration (local http server) | Host header actually received: node-fetch = `api.core.ac.uk`, native = service host. Document the chosen target behaviour, then assert it after the migration. |
| H | E1 `fetchWorks` + `/search` `getServerSideProps` | MSW + unit | every row of the §2.1 table. Assert the **exact request URL (incl. `?t=undefined`) and JSON body**; 50 s abort (fake timers → AbortError → `queryError.status=null`); members filtering (starting/test/demo/no-name excluded; members 500 → `members: []`); props shape snapshot |
| H | E4/E5 + `/works/[id]` | MSW | happy path props snapshot (arXiv → `https://arxiv.com/abs/…`, PubMed → `…/PMC…`, neither → object with undefined values); 404 → `serverError{code:404, message:'The page you were looking for could not be found', prevHistoryUrl: referer\|null}`; 410 with JSON body → `message` = body object; no DOI → `citations:[]`; doi.org 500 → `citations:[]`; doi.org OK → 2 citation objects in order apa, bibtex; request carries the `Accept: text/x-bibliography; style=…; locale=en-GB` header |
| H | E6/E7 + `/outputs/[id]` | MSW | happy path (`sourceFulltextUrls` becomes `[[…]]`); E6 410 → "The article with ID 42 has been disabled"; E7 404 → "Data provider has been disabled"; E6 500 → "could not be found"; logo always null |
| H | E11–E13 + `/data-providers/[id]` | MSW | id not in formap fixture → `notFound`; `'0x56'` → found, and E11 is called with `/data-providers/0x56?t=undefined`; E11 404 → notFound; base64 logo (each signature + invalid length + `data:` passthrough + http URL → checkLogo); `billingType` for a supporting member, a starting member (**'starting'** because of the bug) and a non-member (null); E13 500 → `outputs.error` set and page renders the error text; E13 query string `q=&offset=0&limit=10&sort=recency` |
| H | `store/filters.js` URL algebra | unit (mock `next/router` Router.push/query) | `toggleCheckboxFilter`: add (`q='x'` → `'x AND documentType:"research"'`, page 1); remove (exact substring); language uses `code`; substring trap (`q='Article'`, value `Art`) → push with unchanged q; `setActiveYearDate([2000,2001])` → `' AND (yearPublished>=2000 AND yearPublished<=2001)'` appended after removing the greedy regex match (incl. the case that wipes a later filter); `reset('machine learning AND x')` → q `'machine'`, `fetchFilters` called with `'machine'` + signal; `reset(undefined)` throws; `pathname` passed as `undefined` |
| H | `store/filters.js` fetch/transform | unit + MSW (E2) | first call stores `initialData`; second call diffs (missing → 0); `activeFilter=yearPublished` requests 5 aggregations; all-zero years keep the previous years; `setData` sorts desc + unknown first; `groupedYearDates` for [2014,2016,2018] counts; `isVisibleClearButton` follows `checkActiveItems`; E2 500 → `console.error`, `isLoading` false |
| H | `utils/filters-transform.js` | unit | §3.2 fixture + missing-language throw + year parseInt + duplicates EN/en + quote stripping + substring-checked quirk |
| H | `utils/data-providers-transform.js` | unit (fixture data) | every row in §3.7 |
| H | `data/data-loader.js` | integration (MSW node + tmp dir copy) | success writes raw JSON to the 3 files and leaves `languages.json` untouched; 500 → process `unhandledRejection` (spawn child: exit code ≠0); network down → same; no `node-fetch` → after migration it must use global fetch |
| H | `lib/loader.js` | unit (memfs or tmp dir) | cache present → returned without fetch; cache missing + 200 → `{data, timestamp: <day of month>}` written & returned; 3 s timeout → null; 500 → null; malformed cache JSON → falls through to fetch; wrapper fns resolve `undefined` |
| H | `_app.getInitialProps` | unit | with the committed raw statistics → `{totalArticlesCount:'more than 356 million'}`; with a `{data:{…}}` shaped file → that data (documents the latent fix) |
| H | Claim add flow (`store/claim.js`) | unit + MSW | the §5.1 table; request Content-Type `text/plain;charset=UTF-8`; abort of the previous call |
| H | Claim card (`claim-card.jsx`) | RTL + MSW | the §5.2 table |
| H | Search CSV download | unit + MSW + jsdom | body `{q, accept:'text/csv', limit: activeLimit}` (default 10); file named `results.csv`; error → console.error, `isLoading` false; modal closes (`setActiveDownloadModal(false)`) |
| M | `store/data-providers.js` search | unit | match on name, normalized name (`'Universite'` finds `'Université'`), homepage, institution, aliases, rorId; case-insensitive; `'100%'` throws URIError; `'%20'` decoded |
| M | `utils/validation.js` / `store/params.js` | unit | §3.4 table + `changeParams` merge |
| M | `templates/search/results.jsx` link logic (extract to pure fns first, behaviour-preserving) | unit | reader rewrite; full-text selection order; metadata link with/without `searchId`; `checkType` → `useLogo` only for supporting/sustaining **scalar** repo ids |
| M | `usePagination` + both Pagination components | unit / RTL | §3.6 table; data-provider NEXT/PREV/LAST/FIRST incl. `total%limit===0` |
| M | `store/report.js` + takedown parser | unit + MSW | §5.3; parser cases: `https://core.ac.uk/outputs/1`, `core.ac.uk/display/12`, `http://core.ac.uk/download/pdf/34`, `https://core.ac.uk/download/82976757.pdf `, `123`, `https://core.ac.uk/works/1` (reject), `core2ac3uk/outputs/5` → `'2'` |
| M | `store/similar-works.js` | unit + MSW (E8) | body with/without `resultType:'work'`; `dataProviders` fallback to `[dataProvider]`; error → `error:true`; reset clears |
| M | `utils/format-number.js`, `helpers.formatDate`, `regionDisplayName`, `getCountryName` | unit (TZ=UTC; per-Node snapshots for ICU) | §3.5 tables + §6 i18n row |
| M | `utils/related-words.js` | unit | §3.3 table |
| M | `generateFormMessage`, `generateMetadata`, `normalizeDataProviders`, `pickFeaturedMember`, `getMemberRepoId` | unit | §3.6 (incl. the `</script>` name) |
| M | `bibtex-parse-js` via citation | unit | §6 row |
| L | `utils/sort.js`, `titleCase`, `helpers.getAssetsPath`/`rewriteDataPath`/min/max/`findUrlsByType` | unit | §3.1 / §3.6 |
| L | `pages/api/healthz` | unit | 200 `{status:'ok'}` |
| L | dead code: `api/sign-in.js`, `api/oai-resolver.js`, `utils/debounce.js`, `utils/format-date.js`, `sortItemsByNumberAsc`, `sortItemsByAlphabet`, `filterNamesWithoutPublisher`, `loadCachedStats`, `store/search.js` `setWorkDataProviders` | — | Don't test. Propose deletion in a separate PR (and confirm with grep in CI). |

### 7.3 Order of work

1. Write the harness and fixtures, plus the H-risk unit tests for `api/index.js`, `internalize` and the utils. These are pure and fast.
2. Write the MSW SSR tests for the 4 `getServerSideProps` and for `_app`.
3. Test the store URL algebra.
4. Test the data-loader and loader.
5. **Only then:** first replace `node-fetch` with global fetch, then upgrade Next, then migrate to axios+SWR. Keep the §1.3 MSW handlers **identical** through the migration, so the tests become the contract.

---

## 8. Quirk register (pin now; fix later in dedicated PRs)

| # | Quirk | Location | Current observable behaviour |
|---|---|---|---|
| Q1 | `?t=undefined` always appended | `api/search.js:7-10`, `api/works.js:5-9`, `api/data-provider.js:10-14` | `isUndefined` is always false or undefined, so the ternary is always true |
| Q2 | JSON regex has a literal `\+` | `api/index.js:93` | `+json` content types become Blob |
| Q3 | `body:null` sends `"null"` | `api/index.js:30-33` | |
| Q4 | Bearer + credentials sent to every host (doi.org, logos); API key in client bundle | `api/index.js:36-40,71`, `next.config.js:12` | |
| Q5 | String body → `text/plain` | `store/claim.js:40-42` | |
| Q6 | Signal appended after args; `reset()` passes it as `sortType` | `utils/invalidatePreviousRequests.js:10`, `store/filters.js:342` | `?sort=[object AbortSignal]` |
| Q7 | Only `Claim.retrieve` actually cancels; filters race | `store/filters.js:73` | |
| Q8 | Offset is always ×10, ignoring `limit`; `limit` is a string and uncapped; negative offsets possible | `pages/search/index.jsx:39-45` | |
| Q9 | Unencoded `q` in pushes and links | `pages/works/[id].jsx:130`, `pages/outputs/[id].jsx:113`, `templates/output/related-search.jsx:27`, `templates/search/results.jsx:49` | |
| Q10 | Filter add/remove by substring | `store/filters.js:176-194` | |
| Q11 | Greedy year regex | `store/filters.js:241` | |
| Q12 | "Clear all" keeps the first word only | `store/filters.js:338,342` | |
| Q13 | Data-provider sort `recent` → `relevance` | `store/search.js:100` | |
| Q14 | `checkMembership` uses `billingType` (camelCase) | `utils/data-providers-transform.js:9,13` | starting members count as members |
| Q15 | `checkType` compares a number array to a string | `:40` | multi-repo members never matched |
| Q16 | `checkUniversity` reads `organisationName` | `:90` | always the formap fallback |
| Q17 | `checkLogo` called with 1 arg | `pages/works/[id].jsx:41`, `pages/outputs/[id].jsx:56` | logo always null |
| Q18 | Statistics shape mismatch | `pages/_app.jsx:130-132` vs the raw `.statistics.json` | always `'more than 356 million'` / `'a lot of'` |
| Q19 | Loader timestamp uses `getDate()`, wrappers discard the result, sync 5.6 MB parse per request | `lib/loader.js:37`, `lib/*-loader.js` | |
| Q20 | data-loader unhandled rejections; undeclared `node-fetch`; prod URLs regardless of env | `data/data-loader.js` | |
| Q21 | `decodeURI` on an already-decoded `q` | `store/data-providers.js:42` | `URIError` on `%` |
| Q22 | `formatDate(new Date(invalid))` returns a Date object | `utils/helpers.js:31-39` + callers | React render error |
| Q23 | `sourceFulltextUrls` double-wrapped | `pages/outputs/[id].jsx:61-66` | |
| Q24 | `mainDataProviderLink` never null; arXiv `.com` | `pages/works/[id].jsx:52-83` | |
| Q25 | Claim card fetches accounts during render; hard-coded "Open Research Online"; claim failure silent | `claim-card.jsx:104,132,46-53` | |
| Q26 | `findDataProviders` import does not exist | `store/search.js:6,62` | latent TypeError |
| Q27 | Data-provider LAST page = empty when `total%limit==0` | `templates/data-provider/pagination.jsx:41` | |
| Q28 | `usePagination` returns `undefined` for NaN/undefined inputs | `hooks/use-pagination.js` | crash |
| Q29 | JSON-LD not escaped for `</script>` | `templates/data-providers/utils/generate-metadata.js`, `pages/data-providers/index.jsx:91-96` | |
| Q30 | Takedown regex has unescaped dots | `templates/output/update/index.jsx:40-41` | |
| Q31 | `transformFiltersData` throws if the response has no `language` aggregation | `utils/filters-transform.js:87-89` | `fetchFilters` catches → console.error, filters not updated |
| Q32 | Malformed BibTeX throws a string inside render | `templates/output/citation.jsx:67` | |
| Q33 | `generateFormMessage` `JSON.parse(duplicated.message)` throws on non-JSON | `templates/data-providers/utils/generate-form-message.jsx:53` | |
