# Review: HTTP / SEO / SECURITY contract (key: http-contract)

Reviewer scope: status codes, redirects, headers (CSP, cache-control, X-Powered-By, content-type, ETag, compression), HTML head (title, description, canonical, robots, Scholar `citation_*`, DC, OG, JSON-LD), robots/sitemap/favicons, gateway routing (`kube/*/httproute.yaml`), `/_next/data`, error pages, for every route of `search`.

Docs reviewed: `docs/upgrade/` README, 00, 10, 20, 30, 40, 50, 90, findings/02, 06, 07. Code reviewed: `csp.config.js`, `next.config.js`, `utils/helpers.js`, `modules/meta/index.jsx`, `pages/**`, `main/head.jsx`, `public/**`, `kube/**`, `Dockerfile`, `.github/workflows/aks_deploy.yml`.

All paths below are absolute under `EXP=<scratch>/exp/http-contract` unless stated.

---

## 0. How this was verified (evidence standard)

The earlier pass could not run anything. This review **ran** the baseline and a version sweep:

1. **Real baseline run.** `EXP/base` = a clone (APFS clone, original tree untouched) of the repo at `f5cfc20`, built with `NODE_ENV=production APP_ENV=production BUILD_TARGET=azure` on Node 18.20.8 with `--openssl-legacy-provider` (`EXP/base/build.log`, exit 0; Next 10.2.3, webpack 4), served with `next start` and a local stub of `api.core.ac.uk` (`EXP/stub-api.js`, wired through the app's own `Internal_API` / `Internal_API_HOST` mechanism). The stub serves **real API v3 payloads** I fetched read-only from `https://api.core.ac.uk/v3` (`EXP/fixtures/works_6948813*.json`, `outputs_17267283.json`). Raw outputs: `EXP/out/base/*.hdr|*.body`.
2. **Gateway-equivalent proxy** `EXP/gateway.js` replicating `kube/prod/httproute.yaml` (PathPrefix is segment-wise; URLRewrite ReplacePrefixMatch). It reproduced `/display`, `/static/search`, 404 "other service".
3. **Version sweep with a mini Next app** (`EXP/mini/`) that uses the repo's **real** `next.config.js` logic (trailingSlash, assetPrefix, both rewrites, CSP headers), the real `csp.config.js`, `utils/helpers.js`, `modules/meta/index.jsx`, the real `_app.jsx` `getDataHref` patch, and the same gSSP shapes (redirect+props, notFound+props, soft 404, App gIP). Built and run (`EXP/sweep.sh`) on: 10.2.3, 11.1.4, 12.3.7 (React 17 and 18.3.1), 13.5.11, 14.2.35, 15.5.28, 16.4.2 (`--webpack` and default Turbopack), through the gateway proxy, with a **headless Chromium** (`playwright-core` + cached chromium-1194) doing client-side navigations, CSP-violation capture, JS-disabled title parse. Results: `EXP/summary-matrix.txt`, `EXP/summary-head.txt`, `EXP/summary-nav.txt`, `EXP/out/<label>/`.
   The mini app reproduced the real app's baseline exactly on every probe I cross-checked (308 + `Refresh`, 404 Cache-Control, 500 no Cache-Control, `X-Powered-By` pages-only), which is why I trust the deltas.
4. Fix candidates were then **re-run** (`mini-fixed`, `mini-bf`, `mini-ns`).

Limits (be honest): macOS arm64, not alpine/musl; mini app has no design lib/MobX/Leaflet; SSR API was a stub (3 real payloads); Cloudflare (which sits in front of `core.ac.uk`: `server: cloudflare`, `cf-mitigated: challenge` on a plain `curl https://core.ac.uk/works/...`) was **not** reachable, so edge behaviour is UNCONFIRMED. I did not try to bypass the challenge.

Registry facts (2026-10-19): `next@latest` = **16.4.2** (published 2026-10-15, `engines.node >=20.9.0`, peer `react ^18.2 || ^19`), `react@latest` = **19.3.1**.

---

## 1. Executive verdict

The HTTP contract in the plan is **directionally right but empirically wrong in five places that would fail silently in production**, and the test design has gaps that would let each of them through:

| # | What the sweep proved | Where it bites |
|---|---|---|
| 1 | The `/search/_next/data/...` -> `/_next/data/...` rewrite **stops working on Next 12.3.7 (404 -> hard navigation) and on Next 15.5.28 / 16.4.2 (200 `text/html` -> the whole app crashes on every client navigation)**. The private `getDataHref` patch itself still applies in all versions. | W4(d) and W7 |
| 2 | `<title>{data.title} - CORE</title>` (works, outputs, data-providers index) SSRs as `Title<!-- --> - CORE` on Next 13.5/14.2 and as an **empty `<title>`** on Next 15/16 (React 19). Browser with JS off: `"…<!-- --> - CORE"` and `""`. | W6(c,d), W7 |
| 3 | Existing 500s that the register calls "200 soft-404" or does not know: works with 410 -> **500**; works with empty `publishedDate` + `yearPublished` (real live id 6948813) -> **500**; works with `dataProviders: []` -> **500**; outputs with `publishedDate:null` + `yearPublished:"2001"` -> `citation_publication_date="2001/NaN/undefined"`. | Phase 2 baseline |
| 4 | The "HTTP parity" row of 40 §1 cannot hold on any bump: Cache-Control on 404/500/redirects, CSP on trailing-slash 308s, ETag/Content-Length, `Refresh`, charset, head tag order and head artefacts all change between versions. | Every wave |
| 5 | JSON-LD `</script>` (S-4) is not just "broken JSON": under the production CSP it is an **executing stored-XSS** (`alert(1)` fired 3x in Chromium on the baseline). | Today |

Both fixes for (1) and the fix for (2) were validated end-to-end (section 5). Everything else is in section 7 (findings index) and section 6 (tests).

---

## 2. Per-route contract table (BASELINE, Next 10.2.3, verified)

Common to every response: `Content-Security-Policy: <csp.config.js string>` (also on 308, 404, 500, API, static, `_next/data`), `Vary: Accept-Encoding`, gzip when `Accept-Encoding: gzip` (`Content-Encoding: gzip`, `Transfer-Encoding: chunked`), `Keep-Alive: timeout=5`, **no** `Set-Cookie`, no HSTS/XFO/nosniff/Referrer-Policy (none from the app; Cloudflare may add: UNCONFIRMED). `X-Powered-By: Next.js` only on HTML page responses (not on 308, API route, `_next/data` JSON, static).
`CC` = Cache-Control. "SSR-CC" = `private, no-cache, no-store, max-age=0, must-revalidate`.

Direct to the app (`EXP/out/base`). "Via gateway" rows use `EXP/gateway.js`.

| Public URL (prod `core.ac.uk`) | Status | Headers that matter | Head / body markers |
|---|---|---|---|
| `/search?q=x` (no slash) | **308** | `Location: /search/?q=x`, `Refresh: 0;url=/search/?q=x`, no CC, no XPB, CSP present | empty body |
| `/search/` (no params) | **308** | `Location: /`, `Refresh: 0;url=/`, no CC, CSP present | gSSP `redirect{permanent:true}`+`props:{}` accepted (`pages/search/index.jsx:19-27`) |
| `/search/?q=climate` | 200 | SSR-CC, ETag, XPB, `text/html; charset=utf-8` | `<title>Search CORE</title>` after the 5 favicon links; no description/canonical/robots/OG |
| `/search/?q=zzzzqqq` (0 hits) | 200 | same | default title `CORE – Aggregating the world’s open access research papers` (QueryError has no `<Head>`) |
| `/search/?q=__status500` (API 500) | 200 | same | ErrorCard, default title |
| `/works/1/` | 200 | SSR-CC, ETag, XPB | `<title>{title} - CORE</title>`; `citation_title`, `citation_author`×N, `citation_publication_date="1911/1/01"`; `DC.creator`×N, `DC.title`, `DCTERMS.abstract`; JSON-LD (`author[].name` is an object `{name:..}`); `<meta name="next-head-count" content="9">`; no `<html lang>` |
| `/works/1` | 308 | `Location: /works/1/`, `Refresh` | |
| `/works/4040/` (API 404) | 200 | SSR-CC | "Uh-oh", default title (soft 404) |
| `/works/4100/` (API 410, JSON or text body) | **500** | **no CC**, XPB, ETag | Next default 500 page rendered inside `_app`; log: `Minified React error #31` (object as React child, `templates/error/404.jsx:15` `{error.message}`, `pages/works/[id].jsx:90-95` `message: error.data`). 06/30 Q-001 says "200" |
| `/works/6948813/` (real: `publishedDate:""`, `yearPublished:2001`) | **500** | no CC | `TypeError: date.split is not a function` at `modules/meta/index.jsx:22` (via `pages/works/[id].jsx:70-72` which feeds the number `yearPublished` into `publishedDate`) |
| `/works/3/` (`dataProviders: []`) | **500** | no CC | `dataProvider.name` TypeError, `modules/meta/index.jsx:99` via `pages/works/[id].jsx:78` |
| `/works/1004/` (title with `</script><script>alert(1)</script>`) | 200 | SSR-CC | JSON-LD cut off; raw `<script>alert(1)</script>` in HTML; **executes** (section 8, HC-29) |
| `/outputs/17267283/` (real output payload) | 200 | SSR-CC | `citation_publication_date="2001/NaN/undefined"` (`publishedDate:null`, `yearPublished:"2001"` -> `formatCitationDate("2001")`); `DC.identifier` and `DC.subject` **present** (output payload has top-level `oai` and `subjects`); JSON-LD `datePublished: 2001` (number) |
| `/outputs/4040/` | 200 | SSR-CC | Uh-oh (soft 404) |
| `/outputs/4100/` (410) | 200 | | "The article with ID 4100 has been disabled" |
| `/outputs/update/` | 200 | **no CC**, ETag, XPB | default title |
| `/data-providers/` | 200 | SSR-CC | **7,104,305 bytes raw / 1,003,968 gz** (full formap in `__NEXT_DATA__`, 6.96 MB); `<title>[q - ]Data providers search</title>`, `<meta name=description content="Search over 15672 repositories…">`, JSON-LD (BreadcrumbList + SearchResultsPage) |
| `/data-providers/179/` | 200 | SSR-CC | default title (no page `<Head>`), no description |
| `/data-providers/999999999/` | **404** | `CC: no-cache, no-store, max-age=0, must-revalidate` (no `private`), XPB | custom `pages/404.jsx`; `notFound:true`+`props:{error}` accepted |
| `/error-card/`, `/` | 200 | **no CC**, XPB | accidental public routes (Q-005/006) |
| `/nope/` | 404 | **no CC**, XPB | `pages/404.jsx`, default title |
| `/api/healthz/` | 200 | JSON `{"status":"ok"}`, `application/json; charset=utf-8`, ETag, **no XPB**, no CC | k8s probes (all three) use this exact path |
| `/api/healthz` | 308 | `Location: /api/healthz/` | |
| `/search/_next/data/<id>/works/1.json?id=1` (gateway: prefix) | 200 | `application/json`, SSR-CC, no XPB | `{"statistics":{…},"__N_SSP":true,"pageProps":{…}}`; works for the 500-SSR fixture too (JSON is 200) |
| `/_next/data/<id>/search.json` | 200 | JSON | `pageProps.__N_REDIRECT:"/"`, `__N_REDIRECT_STATUS:308` |
| `/_next/data/<id>/data-providers/999.json` | 404 | JSON | `{"notFound":true}` |
| `/_next/data/<WRONG>/…` | 404 | HTML 404 page | stale-buildId behaviour (every nightly deploy changes the buildId) |
| `/_next/static/**` (via `/static/search/**`) | 200 | `public, max-age=31536000, immutable`, no XPB | + **27 `.js.map` and 8 `.css.map` (6.6 MB) served with `sourcesContent`** (`@zeit/next-source-maps`) |
| `public/**` (`/static/images/*`, `/icons.svg`, `/images/*` after Dockerfile copy) | 200 | `public, max-age=0`, ETag | `/static/search/static/images/x` and `/static/search/images/x` both resolve |
| Gateway `/display/<id>/` | 200 | rewritten to `/outputs/<id>/` | page renders |
| Gateway `/display/<id>` (no slash) | **308** | `Location: /outputs/<id>/` (**not** `/display/…`) | URL leaves the `/display` namespace |
| Gateway `/display/` | 404 | | |
| Gateway `/static/search` | 200 | | empty app shell (rewritten to `/`) |
| Gateway `/searchx/`, `/robots.txt`, `/_next/…`, `/api/…` | 404 "other service" | `x-gateway: other-service` in my emulation | segment-wise PathPrefix |
| `/_next/image/?url=%2Fstatic%2Fimages%2FerrorCard.svg` via `/static/search/_next/image/` | 200 | | the default image optimizer is publicly reachable; remote URLs 400; no-slash form 308s out of the namespace |

Not served by this app and not routed to it: `robots.txt`, `sitemap*.xml`, `favicon.ico`, web manifest. `public/` contains only `design/` and `static/`; favicons are absolute `https://core.ac.uk/favicon/*` (`main/head.jsx:8-23`); `httproute.yaml` routes only `/search`, `/works`, `/outputs`, `/data-providers`, `/static/search`, `/display`. Which service answers `core.ac.uk/robots.txt` is UNCONFIRMED (Cloudflare challenge blocked my curl).

### Head tags per page type (code + baseline run)

| Page | title | description | canonical | robots/OG/Twitter | citation_* | DC.* | JSON-LD |
|---|---|---|---|---|---|---|---|
| `/search/` with results | `Search CORE` | none | none | none | none | none | none |
| `/search/` empty/error, `/data-providers/:id`, `/outputs/update/`, 404, `/error-card/`, `/` | site default | none | none | none | none | none | none |
| `/works/:id/` | `{title} - CORE` | none | none | none | `citation_title`, `citation_author`×N, `citation_publication_date`; **absent**: `citation_pdf_url` | `DC.creator`×N, `DC.title`, `DCTERMS.abstract`; **absent**: `DC.format`, `DC.issued`, `DC.identifier`, `DC.subject` | BreadcrumbList + ScholarlyArticle |
| `/outputs/:id/` | same | none | none | none | same as works; date can be `2001/NaN/undefined` | adds `DC.identifier` (from top-level `oai`) and `DC.subject` (from `subjects`); **absent**: `DC.format`, `DC.issued` | same |
| `/data-providers/` | `[q - ]Data providers search` | `Search over N repositories and journals around the world` | none | none | none | none | BreadcrumbList + SearchResultsPage |

Common to all: `<meta name=viewport>`, `<meta charSet>`, 5 favicon `<link rel=icon>` (absolute core.ac.uk URLs), `<meta name="next-head-count">`, `<html>` without `lang`.

---

## 3. Version-sweep result matrix (mini app through the gateway proxy)

Raw: `EXP/summary-matrix.txt`. `OK` = identical to 10.2.3.

| Probe | 10.2.3 | 11.1.4 | 12.3.7 (R17) | 12.3.7 (R18) | 13.5.11 | 14.2.35 | 15.5.28 | 16.4.2 (webpack / turbopack) |
|---|---|---|---|---|---|---|---|---|
| **Client nav via `/search/_next/data` (browser)** | OK | OK | **FAIL: 404 -> hard nav** | **FAIL: 404 -> hard nav** | OK | OK | **FAIL: app crash** | **FAIL: app crash** |
| `/search/_next/data/<id>/works/1.json` (rewrite) | 200 json | 200 json | **404 html** | **404 html** | 200 json | 200 json | **200 text/html** | **200 text/html** |
| `getDataHref` patch applied (`window.__patched`) | true | true | true | true | true | true | true | true |
| SSR `<title>X - CORE</title>` | OK | OK | OK | OK | `X<!-- --> - CORE` | `X<!-- --> - CORE` | **empty** | **empty** |
| head order | viewport, charSet, … | same | **charSet, viewport** | same as 12 | same as 12 | same as 12 | same as 12 | same as 12 |
| `<meta next-head-count>` | yes | yes | yes | yes | yes | yes | **removed**, `data-next-head=""` on Next-owned tags | same as 15 |
| Trailing-slash 308: CSP header | yes | yes | yes | yes | **no** | **no** | **no** | **no** |
| gSSP redirect 308: Cache-Control | none | none | present | present | present | none | present | present |
| Unknown-route 404: Cache-Control | none | `private…` | `private…` | `private…` | `no-cache…` (no `private`) | `private…` | `private…` | `private…` |
| SSR 500: Cache-Control | none | `private…` | `private…` | `private…` | none | `private…` | `private…` | `private…` |
| App-gIP-only pages (`/`, `/error-card/`, `/outputs/update/`): CC | none | `private…` | `private…` | `private…` | none | `private…` | `private…` | `private…` |
| HTML ETag / Content-Length | yes | yes | yes | **no (chunked)** | yes | yes | yes | yes |
| `_next/data` Content-Type | `application/json` | same | same | same | same | same | `application/json; charset=utf-8` + `x-nextjs-matched-path` | same as 15 |
| `routes-manifest.rewrites` | array | array | array | array | array | array | **object** `{beforeFiles,afterFiles,fallback}` + new internal rewrite `/static/search/_next/:path+` -> `/_next/:path+` | same as 15 |
| Inline executable `<script>` in HTML | none | none | none | none | none | none | none | webpack: none; **Turbopack: 1 (361 B `globalThis["TURBOPACK"].push`)** |
| gzip, HEAD, POST, `X-Powered-By`, `/api/healthz/` 200, `/api/healthz` 308, `Refresh` on 308s, CSP on pages/404/500/static/API, `_next/static` immutable, `public` `max-age=0` | identical in all versions | | | | | | | |

Other things that did **not** change (useful to know, no test needed beyond the matrix): gSSP `redirect`+`props:{}` and `notFound`+`props:{error}` are accepted on every version (R-045 can be downgraded); `Vary: Accept-Encoding` only; no `x-nextjs-*` on HTML pages; no CSP violations in any version for the mini app.

---

## 4. Findings (full detail)

### HC-01 (critical) The `_next/data` prefix mechanism breaks at 12.3.7 and at 15/16. This is certain, not a risk.

- Evidence: `EXP/out/n1237r17/data_prefixed.hdr` (404 `text/html`), `EXP/out/n1558/data_prefixed.hdr` and `EXP/out/n1642w/data_prefixed.hdr` (200 `text/html`, body is the SSR page; `x-nextjs-matched-path: /works/[id]`), browser logs `EXP/out/n1237r18/nav_works.txt` (`RESP404` then `document NAV /works/1/`, `Failed to load static props`, marker lost) and `EXP/out/n1558/nav_works.txt` (title `Application error: a client-side exception has occurred`, `TypeError: Cannot read properties of undefined (reading 'title')`). 10.2.3, 11.1.4, 13.5.11, 14.2.35 are fine (`summary-nav.txt`).
- Mechanism: `next.config.js:15-27` + `utils/helpers.js:4-25` rewrite `/search/_next/data/:path*` -> `/_next/data/:path*` (an `afterFiles` rewrite). From 12.3 the data URL is recognised before rewrites and a rewrite whose destination is a data URL is no longer treated as one; from 15 the rewritten path is rendered as the **page**. The failure is **not** about `router.pageLoader.getDataHref`: `window.__patched === true` on all 8 builds, including 16.4.2, and the client does request `/search/_next/data/<id>/…` correctly.
- Why it is silent: on 12.3.x the site "works" (hard navigation fallback, no console noise except one `Failed to load static props`) but every navigation becomes a full page load. On 15/16 it is a visible crash, but only in a browser behind the gateway. A curl-level test that checks only `status == 200` passes.
- Plan impact: R-002 says "may break"; OD-03 recommends **A: keep the patch, switch to B when T-702 fails**; CS-N12-3 treats "pageLoader.getDataHref missing" as the failure mode; W4 plans to deploy 12.3 to prod. All three are wrong: the gateway change is a **prerequisite** of W4(d) and W7, not a contingency.
- Candidate fixes (all validated in a browser through the proxy, 12.3.7, 15.5.28, 16.4.2; `EXP/out/f1237|f1558|f1642w`, `b1237`, `s1237|s1558|s1642w`):
  - **B (recommended): gateway rule** `PathPrefix /search/_next/data` + `URLRewrite ReplacePrefixMatch /_next/data`, plus keep the client patch. Network URL stays `/search/_next/data/…` (T-702 and any Cloudflare rules unchanged). It is backward-compatible with 10.2.3 (app serves `/_next/data/…` directly: `EXP/out/base`), so it can ship and soak **before** any framework bump. `kubectl apply -f kube/prod/httproute.yaml` is part of every deploy (`.github/workflows/aks_deploy.yml`), so it ships with the image: roll it out on stage first.
  - **C (app-only fallback): client namespace `/static/search`** (`pages/_app.jsx:96`): the existing `PathPrefix /static/search` rewrite already maps it to `/_next/data/…`; works on 12.3.7, 15.5.28, 16.4.2. Cost: data requests change URL class (`/static/search/_next/data/…`), which falls into the "immutable static" bucket at the edge. Cloudflare cache rules for `/static/search/*` are UNCONFIRMED; responses carry `private, no-cache, no-store` so it should be safe, but this is exactly the thing nobody can see from the origin.
  - D: `rewrites()` in object form with `beforeFiles` fixes **12.3.7 only** (`EXP/out/b1237`), not 15/16 (`b1558`, `b1642w` still HTML). Config-only, useful if the team insists on no ops change at W4, but it does not remove the W7 problem.
- Tests: see T-604 (must assert `application/json` + parseable `pageProps`) and T-702 (assert the data URL prefix and zero `pageerror`). Both must run **twice per wave**: with and without the gateway data rule, so the rule is proven necessary and sufficient.

### HC-02 (critical) SSR `<title>` with multiple children is corrupted on Next 13.5/14.2 and emptied on Next 15/16

- Evidence: `EXP/out/n1311/work1.body`: `<title>The Birds of Kerrville, Texas, and Vicinity<!-- --> - CORE</title>`; `EXP/out/n1558/work1.body` and `n1642w`, `n1642t`: `<title data-next-head=""></title>`. Browser with JavaScript disabled (`EXP/harness/title.js`): 10.2.3 -> `"The Birds … - CORE"`; 13.5.11 -> `"The Birds … Vicinity<!-- --> - CORE"` (RCDATA: the comment is literal text); 15.5.28 -> `""`. The same happens for `data-providers` (`open - <!-- -->Data providers search`, then empty).
- Cause: `{data.title} - CORE` is an array of 2 children. React 18 `renderToString` separates adjacent text with `<!-- -->` (Next 13+ no longer uses static markup for head); React 19 Fizz renders a `<title>` whose children are an array of length >= 2 as empty.
- Sites: `pages/works/[id].jsx:144`, `pages/outputs/[id].jsx:128`, `pages/data-providers/index.jsx:85` (array of `[expr, 'Data providers search']`), dead `modules/title/index.jsx:12`. After hydration the Next head manager joins the array, so `document.title` is correct in a browser; **only the raw SSR HTML is wrong**, which is what Google Scholar, Bing, link unfurlers and non-JS crawlers read.
- Fix (a "keep behaviour working" fix under D1, not a quirk fix): single-string children: `<title>{`${data.title} - CORE`}</title>`. Validated: `EXP/out/f1311|f1442|f1558|f1642w` all produce the exact baseline text (`<title>The Birds … - CORE</title>`, `data-next-head=""` attribute only from 15).
- Plan impact: no CS in 20 covers it. 10 R-003 is about `next/head` dedupe, not about this. T-602 says "normalised `<title>`" and the 40 §1 normalisation list would not flag `<!-- -->` (and a regexp-based extraction would not see the empty title as "wrong" unless compared to the baseline string). T-708 (post-hydration head) **passes** while the SSR is wrong, which is why the pair is needed.

### HC-03 (high, factual error) Works 410 is HTTP 500, not 200; three other 500 paths exist

- `Q-001` and 02 §4.1 ("error -> 200 Error404 (410 shows API message)"): measured `/works/4100/` (API 410 with JSON body) -> **500** and `/works/4101/` (410, `text/plain`) -> **500**. `error.data` is always an object (`api/index.js:88-98` parsed JSON or Blob), and `pages/works/[id].jsx:90-95` passes it as `message`, which `templates/error/404.jsx:15` renders as a React child (React error #31). Outputs 410 is a string and returns 200 (`pages/outputs/[id].jsx:16-37`).
- Real-data 500: live API work **6948813** has `publishedDate: ""` and `yearPublished: 2001`. `pages/works/[id].jsx:70-72` (`publishedDate: work.publishedDate ? … : work.yearPublished`) hands a **number** to `modules/meta/index.jsx:21-25`, which calls `date.split` -> `TypeError` -> **500** on `/works/6948813/` (`EXP/out/base/work6948813.hdr`, `EXP/next-base.log`). In a 3-work sample of 2001 works 1 had an empty `publishedDate`; prevalence over the corpus is UNCONFIRMED (API rate-limited me), but the code path is unconditional.
- `/works/3/` with `dataProviders: []` -> `dataProvider.name` TypeError (`modules/meta/index.jsx:99`) -> **500**.
- The `_next/data` JSON for those works is a 200, so a client navigation hydrates a page whose render throws (ErrorBoundary without fallback, Q-010) while the direct URL returns 500.
- Under D1 these are PRESERVE. They must be pinned with fixtures (T-502, T-601): `W-emptydate` (6948813 shape), `W-410-json`, `W-410-text`, `W-nodp`. 500 responses have **no** Cache-Control on 10.2.3/13.5 and `private, no-cache` elsewhere, so they also belong in the header table (HC-07).
- ESCALATES check (D1a): none of these gets worse by version; the Next 15/16 server error page differs only in headers. Owner should still know that a plausible fraction of `/works/*` pages return 500 today (SEO).

### HC-04 (high, missing quirk) Outputs publish `citation_publication_date="2001/NaN/undefined"`

- `pages/outputs/[id].jsx:71-73` feeds `output.yearPublished` (a **string** `"2001"` in the real v3 output payload `EXP/fixtures/outputs_17267283.json`) as `publishedDate` when `publishedDate` is null. `formatCitationDate("2001")` -> `year="2001"`, `month=undefined`, `day=undefined` -> `"2001/NaN/undefined"` (`modules/meta/index.jsx:21-25`). Baseline run: `<meta name="citation_publication_date" content="2001/NaN/undefined"/>` and JSON-LD `datePublished: 2001` (number). 07 §7.1 says it "falls back to bare year": wrong for both pages.
- Add as quirk Q-069/Q-070 and pin in T-602 with fixtures `O-yearstring` and `W-emptydate`.

### HC-05 (high, resolved [VERIFY]) README §8 SEO items

Resolved from code + baseline run (live API payload shapes checked read-only):
- `citation_pdf_url`, `DC.format`, `DC.issued`: **absent on both works and outputs**. `Meta` reads `downloadLink`, `year`; the API sends `downloadUrl`, `yearPublished`, and `links[{type:'download'}]` (which `findUrlsByType` turns into `download`, not `downloadLink`).
- `DC.identifier`, `DC.subject`: **absent on works** (work payload has `oaiIds`, no `oai`/`subjects`), **present on outputs** (output payload has top-level `oai` and `subjects`). Q-053's "probably absent" is wrong for outputs.
- `citation_publication_date`: format `YYYY/M/DD` (`1911/1/01`, month de-padded, day kept), garbage in the two cases above.
- JSON-LD `author[].name` is the author object (confirmed in the baseline HTML: `"name":{"name":"Lacey, Howard George,"}`).
- JSON-LD with `</script>` in title/abstract: **breaks and injects** (HC-29).
- `LinkedData` crash when `dataProvider` undefined: **yes, 500** on works with `dataProviders: []` (HC-03). Outputs always have `dataProvider`.
- Host header on Node 18: **ignored**. Stub log `EXP/stub-api.log`: `host: 127.0.0.1:18001` although `Internal_API_HOST=api.core.ac.uk` was set (Node 18.20.8). Q-022 confirmed for 18, not only 22.
- Baseline emits client source maps: **yes** (HC-11).
- robots/sitemap/favicon/manifest: not in `public/`, not routed by `httproute.yaml`.

### HC-06 (high, contradiction) The HTTP parity contract (40 §1) is not satisfiable as written

40 §1 requires identical "Status, Location, Content-Type, CSP, X-Powered-By, presence of Cache-Control/ETag" with only ETag/Date values normalised. The sweep shows deltas on **every** version step (matrix in section 3): Cache-Control appears/disappears on 404, 500, 308 redirect and App-gIP pages (inconsistent between 11, 12, 13, 14, 15: e.g. gSSP redirect has no CC on 14.2 but has on 12.3/13.5/15/16; 404 has `private` on all but 13.5); CSP vanishes from trailing-slash 308s from 13.5; ETag and Content-Length vanish with React 18 on Next 12.3.7 (streaming, `Transfer-Encoding: chunked`); `_next/data` gets `; charset=utf-8` from 15. None of these is user-visible, but a strict gate would fail at W4 and every later wave, and teams then bypass the gate.
- `Refresh: 0;url=<Location>` is emitted on **every** 308 (config redirect and gSSP redirect) and appears nowhere in the docs. It must be in the table.
- Recommendation: make the HTTP contract **data**: `e2e/http/contract.baseline.json` (per route: status, location, refresh, cache-control exact, content-type, csp hash, xpb, etag-present, content-encoding under gzip, vary) and `e2e/http/contract.deltas.json` with one entry per **accepted** delta: `{wave, route, header, from, to, reason, signedOffBy}`. Default deny. The deltas above are the first draft; each is benign (only more conservative caching), but they must be signed off because Cloudflare cache rules may key on them (UNCONFIRMED).

### HC-07 (high, missing risk) `assetPrefix`/`BUILD_TARGET` is read at **runtime**; the image must keep `ENV BUILD_TARGET`

- `utils/helpers.js:1-2` + `next.config.js:13`: started without `BUILD_TARGET`, `next start` emits `/_next/static/…` URLs and `"assetPrefix":""`, which the gateway does not route (no `/_next` rule): unstyled page, no JS. Verified on 10.2.3 (real app, `EXP/next-base-nobt.log`) and on 12.3.7, 13.5.11, 14.2.35, 15.5.28, 16.4.2 (mini app, `next start` without the variable).
- It works today only because `Dockerfile:10-15` persists `BUILD_TARGET` with `ENV`; `kube/*/deployment.yaml` does not set it. OD-19 (multi-stage / standalone) and 40 §2.5's "Run:" command (no `BUILD_TARGET`) both break this. A harness that starts the server without it would also run against un-prefixed assets and mask R-021.
- Add T-901 assertion `docker inspect` env contains `BUILD_TARGET=azure NODE_ENV=production`, T-6xx start command with the full env, and a negative control (start without it and require the T-721 asset check to fail) to prove the gate is live.

### HC-08 (medium, factual error) The SSR-snapshot normaliser is specified wrongly

40 §1 strips `data-n-head`/`data-next-*`/`data-reactroot`. Actual artefacts: Next 10-14 emit `<meta name="next-head-count" content="N">`; Next 15+ drop it and add `data-next-head=""` to Next-owned tags (`EXP/summary-head.txt`). Next 12+ swaps the order of the two first Next-owned tags (`charSet`, `viewport`). "Order" is in the contract; keep it for **app-owned** tags (title, citation, DC, description, JSON-LD, favicons) and exclude framework-owned tags. Also: `<title>` must be compared as parsed DOM text (see HC-02), not as a regexp over raw HTML.

### HC-09 (medium, missing test) `/display` edge cases

T-723 covers `/display/:id/` only. Gateway behaviour for others: `/display/<id>` (no slash) -> app 308 with `Location: /outputs/<id>/`, so the user leaves `/display`; `/display/` -> 404 (outputs has no index); `/static/search` -> 200 empty shell. A URLRewrite is invisible to Next, so the app's redirects can never preserve the `/display` prefix. These are baseline behaviours to pin in T-601 through the proxy (all verified with `EXP/gateway.js`; real gateway implementation UNCONFIRMED but the Gateway API spec semantics are the same).

### HC-10 (medium, missing test + resolved [VERIFY]) Public source maps

Baseline serves 27 JS maps and 8 CSS maps (6.6 MB), with `sourcesContent`, at `/static/search/_next/static/**.map` (`@zeit/next-source-maps`, 20 CS-N11-4 "[VERIFY]" resolved: YES). Removing the plugin silently removes them; `productionBrowserSourceMaps: true` only covers JS (CSS maps: UNCONFIRMED). Decide explicitly (OD) whether public source code is intended; either way add a test (existence + `sourceMappingURL` comment + `sourcesContent` present) so the change is deliberate. Security note: add to 30 as S-9 (source code and `API_KEY` placeholder already public, S-1).

### HC-11 (medium, missing test) HTML payload size budget

`/data-providers/` is 7.1 MB raw / 1.0 MB gzip; its `_next/data` JSON is 7.0 MB / 0.99 MB (`__NEXT_DATA__` embeds the full formap). `/search/` is 66 KB / 16 KB. T-007 budgets only JS/CSS. Add per-route raw+gzip byte budgets (±5%) to the header table; React 18/19 serialization, `<!-- -->`, extra preloads or lost compression show up here first.

### HC-12 (medium, process gap) The gateway-equivalent proxy is hand-copied from YAML

40 §2.5 has Caddy/nginx "replicating" `httproute.yaml`; the plan's own R-002 fix (OD-03 B) is a change to exactly that YAML. If the proxy is not derived from the YAML, the test cannot prove the YAML change. Also: Gateway API `PathPrefix` is **segment-wise** (`/searchx/` must 404) and precedence is **longest prefix**, not file order; "/search*" (40 §2.5) reads as a string prefix. Recommendation: generate the proxy rules from `kube/prod/httproute.yaml` and `kube/stage/httproute.yaml` in the test setup (they are identical apart from `hostnames`/namespace; assert that), implement longest-prefix + segment semantics, and add the negative paths (`/searchx/`, `/robots.txt`, `/_next/…`, `/api/healthz/` -> "other service"). The controller behind `public-gateway/gateway-system` is UNCONFIRMED; stage (`stg.core.ac.uk`) is the only real check.

### HC-13 (medium, missing risk) Cloudflare edge is outside every planned test

`core.ac.uk` and `api.core.ac.uk` are behind Cloudflare (`server: cloudflare`; plain curl to `https://core.ac.uk/works/…` returns `cf-mitigated: challenge`). Edge security headers, compression (br), caching rules for `/static/search/*`, Bot management and verified-bot handling are invisible to origin tests. T-904 asks for Google Rich Results / Scholar checks on **staging**; if staging is challenge-protected those cannot be run by a bot. Add an "edge contract" manual checklist (browser DevTools, prod vs stage before/after each wave): final response headers for `/works/<id>/`, `/_next/data`, `/static/search/_next/static/*.js`, `/static/search/icons.svg`, `cf-cache-status` values.

### HC-14 (medium, weak test) T-010 "routes-manifest equal to baseline" cannot be literal

`.next/routes-manifest.json` keeps `version: 3` but from Next 15 `rewrites` changes from an array to `{beforeFiles, afterFiles, fallback}` and Next injects `{source:'/static/search/_next/:path+', destination:'/_next/:path+'}` (a `beforeFiles` rewrite) whenever `assetPrefix` is a path (`EXP/sweep/n1642w/.next/routes-manifest.json`); redirects gain `internal`/`priority`/`missing`; key count 8 -> 14. Compare a normalised tuple set `(source, destination, headers)` and list the injected internal rewrite as an expected addition. The CSP header value is frozen at build time from the build-time `NODE_ENV` (`csp.config.js:56-62`), so assert it per environment (T-116 does the string; T-010 should assert the manifest header equals it).

### HC-15 (medium, weak test) T-604 and T-702 as written would pass on the broken versions

T-604: "200 JSON with `pageProps`": on 15/16 the status is 200; only the content type (`text/html`) and body differ. Assert `content-type` starts with `application/json` and `JSON.parse(body).pageProps` exists, for works, outputs, search (incl. no-params -> `{"pageProps":{"__N_REDIRECT":"/","__N_REDIRECT_STATUS":308}}`), data-providers (404 `{"notFound":true}`), wrong buildId (404 HTML). T-702: also assert every data request URL starts with `/search/_next/data/`, `pageerror` count is 0, and add a **skew variant**: intercept data requests with 404 (stale buildId after the nightly deploy changes `BUILD_ID`) and require exactly one `document` request and no crash. I verified that hard-navigation fallback works on 10.2.3, 14.2.35, 15.5.28, 16.4.2 (`EXP/harness/nav404.js`), so this is the safe degradation the system relies on at every deploy.

### HC-16 (medium) React 18 on Next 12.3.7 (plan step W6(a)) drops ETag and Content-Length

`EXP/out/n1237r18/work1.hdr`: no `ETag`, no `Content-Length`, `Transfer-Encoding: chunked` (React 18 streaming renderer); `HEAD` has neither. ETag returns on 13.5. Within the contract mechanism of HC-06 this is a time-boxed delta, but it also matters for conditional GET (no 304 possible during that wave) and for any monitor that uses `Content-Length`.

### HC-17 (low/medium) CSP specifics the plan does not state

- Prod CSP: `script-src` has **no** `'unsafe-eval'`, `script-src-elem` has `'unsafe-inline' 'unsafe-eval'`. `eval`/`new Function` are governed by `script-src`, so they are **blocked in production**; `'unsafe-eval'` in `script-src-elem` is a no-op. Any upgraded library that evals (Sentry 7 replay, LogRocket 12, KaTeX, tippy) fails only in the browser (T-720 covers; add the explicit statement to 30 S-6).
- Next 16 **Turbopack** adds one executable inline `<script>` (361 B) to every page (`EXP/out/n1642t/work1.body`); the webpack build adds none. Allowed only because `script-src-elem` has `'unsafe-inline'`. Any future nonce-based CSP must account for it. Pin "executable inline script count" in T-603.
- Trailing-slash 308s lose the CSP header from 13.5 (harmless, but part of HC-06).
- `connect-src` lists `sentry.io`, which does not match `oNNN.ingest.sentry.io` (host-source without `*.` matches only the exact host). Whether prod Sentry is silently blocked depends on the DSN host: UNCONFIRMED, check at T-904 with the real DSN (R-026 already hints).
- Zero CSP violations in all 9 builds for the mini app (it has no GA/LogRocket/Sentry/Leaflet): the real app must be re-measured with T-720.

### HC-18 (low, resolved) Host header on Node 18; redirect/notFound props; `getDataHref`

- `api/internalize.js:29` Host override ignored on Node 18.20.8 (stub saw `127.0.0.1:18001`).
- gSSP `redirect`+`props:{}` and `notFound`+`props:{error: new Error()}` are accepted on 11.1.4, 12.3.7, 13.5.11, 14.2.35, 15.5.28, 16.4.2: dropping `props` (02 §2.5) is not needed; R-045 can be Low.
- `router.pageLoader.getDataHref` exists and the patch applies on all versions (so CS-N12-3's "stop if missing" branch will not trigger; the failure is HC-01).

### HC-19 (low) The image optimizer endpoint is reachable

`/static/search/_next/image/?url=%2Fstatic%2Fimages%2FerrorCard.svg&w=64&q=75` returns 200 through the gateway on the baseline (the no-slash form 308s out of the namespace), remote URLs 400 (no `images.domains`). S-5 lists a critical advisory against exactly this endpoint on 10.2.3. After the upgrade the endpoint remains; add an "unused framework endpoints inventory" test (P2) so a version bump cannot silently change what is exposed.

### HC-20 (high, security) JSON-LD injection executes under the production CSP

`modules/meta/index.jsx:132-138` and `pages/data-providers/index.jsx:88-93` inject `JSON.stringify` output with `dangerouslySetInnerHTML`. Baseline `/works/1004/` (title `A </script><script>alert(1)</script> "q" & <b>`): HTML contains a raw `<script>alert(1)</script>` and Chromium fires **three** `alert` dialogs with **no** CSP violation (`EXP/harness/xss.js`), because `script-src-elem` has `'unsafe-inline'`. 30 lists S-4 (broken JSON) and S-6 (CSP) separately, and says "do not tighten". Combined, repository-supplied metadata (CORE harvests third-party repositories) is a stored XSS on `core.ac.uk`. This is already severe today (D1a "security"), not something an upgrade makes worse, but it should not wait for phase 6: owner decision (OD-23 style) and a minimal, behaviour-preserving fix exists (escape `<` as `<` in the JSON string: parsed JSON-LD is identical, only the raw HTML differs). Pin both the current behaviour (T-602: JSON-LD invalid, raw `<script>` present, a dialog-listener proves execution) and, once approved, the fix.

### HC-21 (info / M1) Targets

Latest on the registry today: `next` 16.4.2 (2026-10-15, 4 days old), `react` 19.3.1. The plan's "Next 16.x" and "React 19.x" are right; pin exact versions at execution time and re-run the sweep matrix (`EXP/sweep.sh` is reusable for 16.x patch bumps). Next 16 requires Node >= 20.9 (plan: Node 22). Next 13.5.11 and 14.2.35 are the latest of their lines (published 2025-03 and 2025-12) and 12.3.7 the last 12.x: the plan's stops are real, patch levels as listed.

---

## 5. Validation of the fixes (each re-run end-to-end)

| Fix | Versions | Result |
|---|---|---|
| Gateway rule `PathPrefix /search/_next/data` -> `ReplacePrefixMatch /_next/data` (+ client patch kept) | 12.3.7, 13.5.11, 14.2.35, 15.5.28, 16.4.2 | `nav_works`/`nav_search`: data fetch `/search/_next/data/<id>/…json` 200 JSON, 0 document requests, marker alive, 0 CSP violations, 0 console errors (`EXP/out/f1237..f1642w/nav_*.txt`) |
| Client namespace `/static/search` (no gateway change) | 12.3.7, 15.5.28, 16.4.2 | same pass, request URL `/static/search/_next/data/<id>/…` (`EXP/out/s1237|s1558|s1642w`) |
| `rewrites()` with `beforeFiles` | 12.3.7 only | passes on 12.3.7, still fails on 15.5.28/16.4.2 (`EXP/out/b1237|b1558|b1642w`) |
| Template-literal `<title>` | 13.5.11, 14.2.35, 15.5.28, 16.4.2 | `<title>X - CORE</title>` identical to baseline text (`EXP/out/f1311|f1442|f1558|f1642w/*.body`) |

---

## 6. HTTP behaviours that must be pinned by T-6xx tests, and the upgrade step that threatens each

Wave names from 50-roadmap: W4(a-e) = Next 10 -> 11.1 -> 12.3 (+Node 22), W6(a) = React 18 on 12.3, W6(c) = Next 13.5, W6(d) = 14.2, W7(a) = Next 15, W7(b) = React 19, W7(c) = Next 16.

| # | Behaviour (baseline value) | Threat | Existing test | Needed |
|---|---|---|---|---|
| 1 | Data URL `/search/_next/data/<id>/…` -> JSON via gateway | W4(d) 12.3 (404), W7(a) 15 (HTML) | T-604, T-702 (weak, HC-15) | strengthen; run with and without the gateway data rule; gateway rule as W4 prerequisite |
| 2 | SSR `<title>` exact text on works/outputs/data-providers | W6(c) 13.5, W7(a) 15 | T-602 (normaliser, HC-08) | assert parsed text, JS-disabled; template-literal fix as a CS |
| 3 | Head app-owned tag set and order; framework-owned excluded | W4(d) 12.3, W7(a) 15 | T-602 | fix normaliser list (`next-head-count`, `data-next-head`, `charSet/viewport`) |
| 4 | Status: 308 (slash), 308 (empty search), 404 (dp unknown, unknown route), 200 soft-404, **500 x4 paths** | all | T-601 | add 500 fixtures (410, empty date, no dp), outputs `NaN` date, `/display` edge cases |
| 5 | Header table incl. `Refresh`, CC exact, CSP-on-all, XPB pages-only, ETag/CL, gzip, HEAD, Vary | every wave | T-603 (presence only) | data-driven table + signed delta file (HC-06) |
| 6 | Response size budgets raw+gz (`/data-providers/` 7.1 MB) | W6, W7 | T-007 (JS/CSS only) | add per-route HTML/JSON budgets |
| 7 | Asset contract: `_next/static` immutable, `public` `max-age=0`, source maps, `/static/search/icons.svg`, `/static/search/images/*`, `/static/search/static/images/*` | W4(c) (next-images), W4(e), W9 | T-005, T-721 | add `.map` (JS+CSS) contract; image URL class change `_next/static/images` -> `media` |
| 8 | Runtime env: `BUILD_TARGET`, `NODE_ENV` present in the image | any Docker change (OD-19), W4(e) Node 22 | none | T-901 env assertion + negative control (HC-07) |
| 9 | CSP string on every response class; zero violations; executable inline script count; eval blocked | W2 (Sentry/LogRocket), W6(c) (308 loses CSP), W7 (Turbopack inline script) | T-116, T-603 (HTML only), T-720 | extend T-603 to 308/404/500/data/static/API; inline-script inventory |
| 10 | `routes-manifest` tuples (rewrites/headers) | W7(a) (object shape + internal rewrite) | T-010 (literal) | normalise (HC-14) |
| 11 | Probe contract `/api/healthz/` 200 JSON, `/api/healthz` 308 | all | T-506, T-601 | unchanged; verified OK on all versions |
| 12 | Gateway semantics: segment prefix, longest-prefix precedence, rewrites, stage==prod | W4 pre-step (rule change) | 40 §2.5 (hand copy) | YAML-driven proxy + negative paths (HC-12) |
| 13 | Version-skew: stale buildId data 404 -> hard nav, no crash | every nightly deploy; W4 | none | T-702 skew variant (HC-15) |
| 14 | Stored XSS via JSON-LD (current behaviour) | none (existing) | T-113/T-602 (JSON only) | add execution check; owner decision (HC-20) |
| 15 | Framework endpoints exposed via gateway (`/static/search/_next/image/`) | W4, W7 | none | inventory test (P2) |
| 16 | Conditional GET / HEAD on SSR pages | W6(a) | none | P2: HEAD returns same headers; ETag presence per HC-16 |

Suggested new IDs (the T-6xx band is free from T-608): T-608 header table, T-609 gateway edge cases (`/display`, `/static/search`, negative paths), T-610 asset + source-map contract, T-611 response size budget, T-612 YAML-driven proxy self-test, T-613 runtime-env sensitivity, T-614 CSP inline-script/eval inventory, T-615 framework-endpoint inventory, T-616 skew variant of T-702. Priority P0 for T-608/T-609/T-613/T-616 (they gate W4), P1 for the rest.

Test implementation notes (Playwright `request` fixture): `maxRedirects: 0` (so 308s are visible), explicit `Accept-Encoding` per case (the fixture auto-decompresses and hides `content-length`), parse HTML with a real parser (parse5) and read `<title>` via the DOM text, JS-disabled browser context for the title test, and **negative controls**: each gate must be shown to fail on a deliberately broken build (missing `BUILD_TARGET`, no gateway data rule on 12.3.7).

---

## 7. What I could not confirm

- Cloudflare behaviour (security headers, cache rules for `/static/search/*`, compression, verified-bot handling): not reachable without bypassing bot protection. UNCONFIRMED.
- Which controller implements `public-gateway` (Envoy-based Gateway, Istio, NGF, App Gateway for Containers) and its upstream idle timeout vs Node's 5 s `keepAliveTimeout` (a classic source of sporadic 502): UNCONFIRMED; compare 502 rates at the T-902 soak.
- Prevalence of works with empty `publishedDate` in the live corpus (API rate-limited). The 500 path itself is certain.
- Sentry ingest host vs `connect-src sentry.io` (depends on the secret DSN).
- Behaviour on alpine/musl and the real design lib: the mini app covers the HTTP layer only; the real app must be re-run through `EXP/sweep.sh`-style probes once the phase-2 harness exists (all probes are in `EXP/probe.sh`/`sweep.sh`).

---

## 8. Reproduction index

- Baseline build log: `EXP/base/build.log`; server log (500 stack traces): `EXP/next-base.log`; stub request log (Host header): `EXP/stub-api.log`.
- Per-route outputs: `EXP/out/base/*.hdr|*.body` (real app), `EXP/out/<label>/*` (mini app; labels `n1023 n1114 n1237r17 n1237r18 n1311 n1442 n1558 n1642w n1642t`, fixed `f*`, `b*`, `s*`).
- Matrices: `EXP/summary-matrix.txt`, `EXP/summary-head.txt`, `EXP/summary-nav.txt`; tools `EXP/summarize.py`, `EXP/headcmp.py`.
- Browser scripts: `EXP/harness/nav.js` (client navigation + CSP), `nav404.js` (skew), `title.js` (JS-disabled title), `xss.js` (JSON-LD execution).
- Proxy: `EXP/gateway.js` (set `DATA_RULE=1` for the OD-03 B rule).
