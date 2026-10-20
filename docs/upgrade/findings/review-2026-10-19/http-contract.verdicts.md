# Verifier log: http-contract (key: http-contract-V)

Scope: independent re-check of HC-01..HC-26. Scratch: `exp/http-contract-V/` (APFS clones of the reviewer's built apps, own ports, own browser runs). Repo trees untouched (`git status` clean).

## What I re-ran myself (not just re-read)

| Check | How | Result |
|---|---|---|
| Next 12.3.7 and 15.5.28 data route behind gateway replica | cloned `sweep/n1237r17`, `sweep/n1558`, `next start` with `BUILD_TARGET=azure`, curl + `harness/nav.js` | 12.3.7: `/search/_next/data/..` 404 text/html, browser hard-navigates (`marker: undefined`, "Failed to load static props"). 15.5.28: 200 text/html, "Application error". Reproduced. |
| Gateway data rule (`DATA_RULE=1`) | same apps | soft navigation, marker alive, 0 console errors on 12.3.7, 15.5.28, 16.4.2 (own clone of `sweep/n1642w`). Reproduced. |
| 16.4.2 without rule | own run | "Application error". Reproduced. |
| JS-off `<title>` | `harness/title.js` | 12.3.7: correct. 15.5.28 and 16.4.2: `""`. Hydrated title on 15.5.28 is correct. 13.5/14.2 `<!-- -->` seen in the reviewer's SSR bodies (regex check). |
| Real app (`base`, Next 10.2.3, Node 18.20.8) with own stub | clone of `base`, stub on 19011 | `/works/4100/` 500, `/works/4101/` 500, `/works/6948813/` 500, `/works/3/` 500, `/outputs/4100/` 200, `/outputs/17267283/` `citation_publication_date="2001/NaN/undefined"`, JSON-LD `"datePublished":"2001"` (string). Reproduced. |
| XSS execution | `harness/xss.js` on real baseline via gateway | 3 alert dialogs, 0 CSP violations. Reproduced on the real app (not only the mini app). |
| Skew fallback and normal nav on real baseline | `nav.js`, `nav404.js` | normal nav fetches `/search/_next/data/<id>/works/1.json` and keeps the marker; forced data 404 gives a clean hard navigation. Reproduced. |
| Gateway edge cases | curl on real baseline via gateway replica | `/display/<id>/` 200, `/display/<id>` 308 `Location: /outputs/<id>/`, `/display/` 404, `/static/search` 200, `/searchx/` and `/robots.txt` 404. Reproduced (replica, real controller UNCONFIRMED). |
| Source maps | `find .next/static`, curl via gateway | 27 `.js.map`, 8 `.css.map`, 6764 KB, `sourcesContent` non-empty, JS and CSS maps return 200 through `/static/search/_next/static/`. Reproduced. |
| Sizes | curl | `/data-providers/` 7,104,305 raw, 1,003,968 gzip (exact match), `/search/?q=climate` 65,711, `/works/1/` 67,297. |
| Image optimizer | real baseline | local SVG 200 `image/svg+xml`, remote URL 400, no-slash 308. Reproduced. |
| BUILD_TARGET at runtime | `next start` without the var on 12.3.7 and 15.5.28 | script src `/_next/static/...` (no prefix). Reproduced. |
| Registry | `npm view next` | latest 16.4.2 (2026-10-15), engines node >=20.9.0; react latest 19.3.1; 15.5.28 backport, 14.2.35, 13.5.11, 12.3.7, 11.1.4 as listed. |
| Live API | curl `api.core.ac.uk/v3/works/6948813` | `publishedDate: ""`, `yearPublished: 2001` (number). Confirmed today. |
| Cloudflare | curl `core.ac.uk/works/6948813/` | 403 `cf-mitigated: challenge`, `server: cloudflare`. Docs contain zero mentions of "Cloudflare". |
| Playwright request fixture | tiny local server | default follows 308 (need `maxRedirects:0`); `content-length` header is still present (compressed size) with `content-encoding: gzip` and a decompressed body. |

## Verdicts

- HC-01 partially. Breakage reproduced exactly on 12.3.7, 15.5.28 and 16.4.2, fix B reproduced. Overstated part: "OD-03 A is wrong / W4(d) would reach prod broken". OD-03 already says "switch to B the moment T-702 fails, B prepared in advance", and T-702 (P0, W4) runs through the YAML-replicating proxy, so as written the gate fails before prod. Correct statement: the failure is certain, so B must become a scheduled prerequisite (ops PR soaked on stage first) instead of a contingency.
- HC-02 confirmed. Nuance: T-602 compares `<title>` identically, so it would flag the drift once built; the gap is that no CS plans the fix and T-708 passes. Googlebot renders JS, so the impact is on non-JS readers (Scholar is UNCONFIRMED).
- HC-03 confirmed on the real baseline (JSON and text/plain 410 both 500; outputs 410 stays 200). Real API 410 body type is UNCONFIRMED but `error.data` is an object for any JSON object or Blob body.
- HC-04 confirmed (live API re-fetched, baseline 500). Prevalence UNCONFIRMED.
- HC-05 partially. `2001/NaN/undefined` confirmed. "numeric datePublished" is wrong: the output JSON-LD has the string `"2001"`. A numeric one can only occur on works, which 500 first.
- HC-06 confirmed.
- HC-07 confirmed (header tables re-tabulated across 8 builds).
- HC-08 confirmed (runtime read reproduced). Mitigation: 40 sec.2.6 fails on any script/stylesheet >=400, so the test harness would notice; the production risk is a lost image ENV (OD-19, not in the track). Plan finding 06 sec.4 also says "read at build time", which is wrong.
- HC-09 confirmed (real baseline). Recommendation touches M3: the `<` escape is a bug fix; D1a only covers bugs that become severe after an upgrade, this one is severe today. Valid only as an owner-approved separate security change. Extra observation: on 12.3.7 the same `</script>` fixture crashes hydration (`Cannot read properties of null (reading 'content')`, out/n1237r17/nav_dp_work.txt); 10.2.3, 11.1.4, 13.5, 14.2 do not.
- HC-10 partially. `data-n-head` and `data-reactroot` never appear (0 hits in baseline body), and `next-head-count`, `data-next-head`, charSet/viewport swap are real. Low practical impact because the compare set is app-owned tags and `data-next-*` already covers `data-next-head`.
- HC-11 confirmed (replica).
- HC-12 confirmed. CS-N11-4 already conditions `productionBrowserSourceMaps` on the baseline emitting maps; what is missing is the CSS map question and a test.
- HC-13 confirmed.
- HC-14 confirmed (`aks_deploy.yml` and `aks_stage_deploy.yml` both `kubectl apply` the httproute on push and nightly; prod vs stage differ only in namespace and hostname).
- HC-15 confirmed.
- HC-16 confirmed (8 to 14 keys, rewrites object, injected `/static/search/_next/:path+`).
- HC-17 partially. T-702 text already asserts `/search/_next/data/<id>/...json -> 200` and exactly one `document` request, and 40 sec.2.6 fails on `pageerror`; T-604 says "JSON with pageProps". So the gates would fail on 12.3.7/15/16. Real gap that remains: no stale-buildId skew case (fallback verified on the real baseline).
- HC-18 confirmed.
- HC-19 confirmed (low).
- HC-20 confirmed.
- HC-21 confirmed as an option analysis (same plan-impact caveat as HC-01).
- HC-22 confirmed.
- HC-23 confirmed (R-045 shapes accepted on all builds; patch applied on all builds).
- HC-24 confirmed. Minor correction: Playwright keeps `content-length` (compressed) and `content-encoding`; what is hidden is the 308 (default redirect following) and the decompressed size.
- HC-25 confirmed. Recommendation clause "keep Node 22" is below latest (Node 22 Jod is Maintenance LTS since 2025-10-21, Node 24 Krypton is LTS, Node 26 enters LTS 2026-10-28): M1 only if the runtime counts as a library.
- HC-26 confirmed.
