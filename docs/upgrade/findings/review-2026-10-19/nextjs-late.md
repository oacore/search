# Review `nextjs-late`: Next.js 12.3 → 13.5 → 14.2 → 15 → 16 (pages router, `--webpack`)

Reviewer key: `nextjs-late`. Date: 2026-10-19. Subject: `search` (branch `docs/upgrade-plan`, app code = `f5cfc20`). Read-only on all repos. Every experiment ran in scratch.

## 0. Method and evidence base

Reading the docs was not enough here. The two Critical risks (R-001, R-002) depend on Next internals, so I **built and ran a replica app** on every target version. The replica runs behind a gateway-equivalent proxy and is driven with headless Chromium.

- **Registry, 2026-10-19:** `npm view next dist-tags` → `latest 16.4.2` (published 2026-10-15), `backport 15.5.28` (2026-10-14), `next-14 14.2.35`, `next-13 13.5.11`, `next-12-3-2 12.3.7`. `npm view react dist-tags` → `latest 19.3.1`.
- **Engines and peers (registry):**

  | next | engines.node | react peer |
  |---|---|---|
  | 12.3.7 | >=12.22.0 | `^17.0.2 \|\| ^18.0.0-0` |
  | 13.5.11 | >=16.14.0 | `^18.2.0` |
  | 14.2.35 | >=18.17.0 | `^18.2.0` |
  | 15.5.28 | `^18.18.0 \|\| ^19.8.0 \|\| >= 20.0.0` | `^18.2.0 \|\| 19.0.0-rc-de68d2f4-20241204 \|\| ^19.0.0` |
  | 16.4.2 | >=20.9.0 | same as 15 |

- **Tarballs:** `npm pack` of 12.3.7, 13.5.11, 14.2.35, 15.5.28 and 16.4.2, extracted to `<scratch>/exp/nextjs-late/packs/n<ver>/package/`. All code citations below are against these.
- **Replica app:** `<scratch>/exp/nextjs-late/app-src/` reproduces the parts of `search` that touch Next:
  - a verbatim copy of `next.config.js:45-77` (the camelCase hack, including the early `return config` that skips the aliases) and the same aliases, including the `react`/`react-dom` directory aliases;
  - `@sentry/node` aliased with the `config.isServer` bug;
  - `next-images@1.8.5` with `images.disableStaticImages:true` (CS-N11-3) and `resolve.fallback.fs=false` (CS-N11-1);
  - identical `babel.config.js`, `postcss.config.js` (preset-env 7.8.3, cssnano 4.1.11, custom-media 8 `importFrom`, extend-rule), `.browserslistrc`, `csp.config.js`, `env.config.js` and `utils/helpers.js`;
  - `trailingSlash`, `assetPrefix=/static/search` (`BUILD_TARGET=azure`), and the production rewrites and headers;
  - a verbatim `useInterceptNextDataHref` from `pages/_app.jsx:70-80`, plus module-scope `process.on`, `App.getInitialProps`, the dev `NextApp` wrapper and `utils/sentry.js`;
  - the gSSP shapes `redirect`+`props`, `notFound`+`props(Error)` and an `Error` inside props;
  - a custom `<Meta>` fragment inside `<Head>` and multi-child `<title>` elements as in `pages/works/[id].jsx:144`;
  - `<Link legacyBehavior passHref shallow>` around a forwardRef Button `tag="a"`, and `<NextLink legacyBehavior>` around a forwardRef Link that renders its own `<a href>` (both mirror `@oacore/design` `lib/elements/button/button.js` and `link/link.js`);
  - `Router.push({pathname: undefined, …})` and `/display` routing.
- **Gateway proxy:** `scripts/gateway.js` replicates `kube/prod/httproute.yaml`: the `/search|/works|/outputs|/data-providers` prefixes pass, `/static/search/*` → `/*`, `/display/*` → `/outputs/*`, and anything else returns "OTHER SERVICE 404". It can optionally add the proposed rule `/search/_next/data/*` → `/_next/data/*`.
- **Matrix:**

  | Next | React | Node |
  |---|---|---|
  | 10.2.3 (baseline) | 17.0.2 | 18.20.8, with `--openssl-legacy-provider` as in the Dockerfile |
  | 12.3.7 | 18.3.1 | 22.18.0 |
  | 13.5.11 | 18.3.1 | 22.18.0 |
  | 14.2.35 | 18.3.1 | 22.18.0 |
  | 15.5.28 | 18.3.1 and 19.3.1 | 22.18.0 |
  | 16.4.2 (`--webpack`) | 18.3.1 and 19.3.1 | 22.18.0 |

  12.3 through 16.4 also built on Node 24.18.1. Every run used `next build` followed by `next start`.
- **Drivers:**
  - `scripts/probe.py`: HTTP status, headers and SSR HTML.
  - `scripts/nav.js`: client navigation through the proxy, logging document vs data requests, page errors and DOM state.
  - `scripts/headjs.js`: head tags with JS off and on.
  - `scripts/scroll.js` and `scripts/hydr.js`.
  - The browser is `playwright-core@1.56.1` with the cached Chromium 141 (rev 1194).
  - Raw outputs: `exp/nextjs-late/probe-*.json`, `nav-*.json` (in-app rewrite), `navBF-*` (`beforeFiles` rewrite variant), `navGW-*` (gateway rule).
- **Limits:** this is a replica, not the real app (no `@oacore/design`, MobX, Leaflet or real API). Next 11.1 and Next 15.0–15.3 were **not** run. Claims about them are marked UNCONFIRMED.

---

## 1. Executive summary

The chosen order (12.3 → R18 → 13.5 → 14.2 → 15 → R19 → 16 `--webpack`) is viable. But the plan as written would **ship two production regressions it does not anticipate**, and it **hits two loud blockers with no prepared change site**:

1. **The `_next/data` gateway trick (R-002) breaks in a way the plan does not model.** The private `getDataHref` patch still works on 12.3 through 16.4. What breaks is the **server-side rewrite** `/search/_next/data/:path*` → `/_next/data/:path*`:
   - 12.3.7 returns **404**, so every client navigation becomes a full reload.
   - 13.5 and 14.2 work.
   - 15.5.28 and 16.4.2 return **200 text/html**. The client then renders the page with `{}` props, which crashes and leaves a **blank page** on every client navigation.

   The gateway rule (OD-03 option B) fixes every version and is byte-for-byte neutral on today's 10.2.3. It must land **before W4**, not "when T-702 fails".
2. **Multi-child `<title>` elements break SSR titles** (SEO), and nothing in 20/30/10 covers it:
   - Next 13 through 16 with React 18 emit `<title>Work …<!-- --> - CORE</title>`.
   - Next 15/16 with React 19 emit `<title></title>`, an **empty** title.

   The fix is a template literal at 3 sites. It is byte-identical today.
3. The camelCase CSS hack is **not** a silent no-op on 13+. The verbatim code **throws** (`TypeError: reg.test is not a function`) and fails the build on 13.5, 14.2 and 15.5. A verified version-proof replacement is given below.
4. From 12.3 the `config.isServer` alias bug becomes live. The **server runs `@sentry/browser`** (verified at runtime). Fixing it to `isServer` restores today's behaviour, and that edit is allowed under D1.
5. `next build` on 11 through 15 runs ESLint over `pages/` and `lib/`. Both have existing ESLint errors, so the build fails (verified on 15.5.28 with an ESLint 9 flat config). `eslint.ignoreDuringBuilds` is needed until 16, where the key is removed.
6. Head-manager semantics change at 15.0. On 10 through 14 the `<Meta>` tags are **removed** from the live DOM after hydration. On 15+ they are kept. T-708's expectation ("none removed") is false on the baseline.
7. Several header, attribute and browser-floor diffs will trip the parity contract. They need pre-registration and owner sign-off rather than fixes. Node 22 as the track target is EOL on 2027-04-30.

Most of these fixes (gateway rule, title literals, `legacyBehavior`, robust CSS patch, Sentry `isServer`, `ignoreDuringBuilds`) were verified **neutral on today's Next 10.2.3**. They can run as a W0 "Next-proofing" wave, which shrinks W4, W6 and W7 to version bumps.

---

## 2. Findings

### NL-01 CRITICAL: the `/search/_next/data` rewrite breaks on 12.3.7 (404) and on 15.4+/16 (HTML 200, then a client crash); the patch is fine
- **Docs:** 20 (CS-N12-3), 10 (R-002), 90 (OD-03), 50 (W0/W4/W7), 40 (T-604/T-702, proxy), README §4/§7, findings/02 §1.3.
- **What the plan says:** R-002 risks "router internals / `pageLoader` shape". CS-N12-3 says "if `pageLoader.getDataHref` no longer exists, stop: OD-03". OD-03 recommends "A. keep the patch while it works; switch to B when T-702 fails". findings/02:88 says the failure fallback is a "hard navigation… site still works".
- **Evidence (empirical, `probe-*.json` and `nav-*.json`):**
  - `GET /search/_next/data/<BID>/works/1.json?id=1` direct to `next start`:

    | Version | Result |
    |---|---|
    | 10.2.3 | 200 `application/json` |
    | 12.3.7 | **404 text/html** |
    | 13.5.11, 14.2.35 | 200 JSON |
    | 15.5.28 (R18 and R19), 16.4.2 (R18 and R19) | **200 `text/html`** (the full page) |

    `GET /_next/data/<BID>/works/1.json` (unprefixed) returns 200 JSON on **all** versions.
  - Browser through the proxy (`nav-401x.json`):
    - 12.3.7: every click → `404 /search/_next/data/...`, then a `document` request (full reload), plus console "Failed to load static props".
    - 15.5/16.4: `200 text/html` on the data request, then `TypeError: Cannot read properties of undefined (reading 'id'/'results')`. The body is reduced to the route announcer (`'/works/2/'`), and later clicks time out.
  - The patch itself is fine. `window.__patchApplied=true` on every version. Since 12.3 the args are an object, e.g. `{"href":"/works/[id]?id=2","skipInterpolation":true,"asPath":"/works/2/"}`. The call sites are `this.pageLoader.getDataHref({...})` (`packs/n16.4.2/package/dist/shared/lib/router/router.js:1405,1521`; also 13.5 :1094, 15.5 :1179).
  - Root cause on 15.4+: the pages route module flags a data request only from the **original `req.url`**: `if (pathHasPrefix(parsedUrl.pathname,'/_next/data')) isNextDataRequest = true` (`n16.4.2/.../server/route-modules/route-module.js:405-416`; 15.5.28 :303). The rewritten path never reaches it. Per unpkg, 15.0–15.3 lack this check; 15.4.1 has it. 15.0–15.3 behaviour is UNCONFIRMED.
  - Client consequence: `fetchNextData` returns `json: tryToParseAsJSON(html)` = null, so `props: fetched.json || {}` (`router.js:400,1540`).
  - A `beforeFiles` rewrite variant (`probeBF-*`, `navBF-*`) fixes 12.3 but **not** 15.5/16.4.
  - **Gateway rule variant** (`navGW-*`): 10.2.3, 12.3.7, 15.5.28 (R18 and R19) and 16.4.2 (R18 and R19) all get `200 application/json`, zero document requests and identical URLs, titles and DOM. On 10.2.3 it is identical to the current baseline.
- **Recommendation:** promote OD-03 B to a **mandatory W0 change**: add a rule to `kube/{prod,stage}/httproute.yaml` (and to the test proxy). Keep the client patch and the app rewrite as they are, so the client still requests `/search/_next/data/...`. Per the Gateway API spec, the longest prefix wins, so `/search/_next/data` outranks `/search` (`apis/v1/httproute_types.go`: "'Prefix' path match with largest number of characters").
  ```yaml
  - matches: [{path: {type: PathPrefix, value: /search/_next/data}}]
    filters: [{type: URLRewrite, urlRewrite: {path: {type: ReplacePrefixMatch, replacePrefixMatch: /_next/data}}}]
    timeouts: {request: 35s, backendRequest: 30s}
    backendRefs: [{name: core-frontend-search, port: 80}]
  ```
  Then:
  - Rewrite CS-N12-3 and R-002 to describe this mechanism.
  - Make the W4(d) 12.3 production deploy conditional on the rule being live.
  - Add a T-604b that pins the **direct** (no-gateway) response per version, so nobody relies on the in-app rewrite.

### NL-02 HIGH: T-702 and T-604 as written can pass while the page is blank on 15/16
- **Docs:** 40 (T-604, T-702, T-701, J-tests).
- **Evidence:** T-702 (40:345) asserts "exactly 1 document request… every navigation fetched `/search/_next/data/<id>/…json` → 200; `window.__marker` survives". On 15.5/16.4 all three hold: status 200, no document request, no reload. Yet the root unmounted (NL-01). T-701 loads routes directly, so it never sees the client-navigation crash.
- **Recommendation:** T-702 must also assert, per data request:
  - `content-type` starts with `application/json`;
  - the body parses and has a `pageProps` key.

  It must also assert, per step, `pageerror` = 0 and a content marker such as the result-list count or the work title. T-604 must assert content-type and JSON parse, not only the status. Run both **through the proxy with the new rule**, and also direct-to-Next.

### NL-03 CRITICAL: multi-child `<title>` breaks SSR titles on Next 13+ (`<!-- -->`) and empties them on React 19
- **Docs:** 20 (new CS), 10 (new risk / R-003), 30 (note), 40 (T-602), 50 (W0).
- **Sites:**
  - `pages/works/[id].jsx:144` `<title>{data.title} - CORE</title>`
  - `pages/outputs/[id].jsx:128` (same)
  - `pages/data-providers/index.jsx:85` `<title>{query ? \`${query} - \` : ''}Data providers search</title>`
  - `modules/title/index.jsx:12` is the same pattern but unused (no importer found).
- **Evidence (`curl` SSR):**

  | Next / React | `/works/1/` | `/data-providers/?q=abc` | `/data-providers/` |
  |---|---|---|---|
  | 10.2.3, 12.3.7 | `<title>Work 1 … - CORE</title>` | `<title>abc - Data providers search</title>` | baseline |
  | 13.5–16.4 with R18 | `<title>Work 1 …<!-- --> - CORE</title>` | `abc - <!-- -->Data providers search` | — |
  | 15.5/16.4 with R19 | `<title data-next-head=""></title>` | empty | empty |

  The browser tab is correct after hydration, because the client head-manager sets `document.title`. So the bug is visible only to non-JS consumers: Scholar, social scrapers, and `curl`-style SEO tests. Dev mode never SSRs (Q-052), so it is invisible in dev. With the template literal `<title>{`${data.title} - CORE`}</title>`, the output is byte-identical to the baseline on every version (verified on the `outputs` page).
- **Recommendation:**
  - Add a change site for the 3 template-literal changes. It is D1-allowed, keeps current output and lands in W0.
  - Add a risk: SILENT, SEO, Critical.
  - Make T-602 compare the **raw bytes** of `<title>`, with no comment stripping. Note it in 30.

### NL-04 HIGH: the CSS camelCase hack throws on 13+; its "silent no-op" premise is wrong
- **Docs:** 20 (CS-N11-2 + new CS-N13), 10 (R-001), README §4, findings/02 §1.3-2.
- **Evidence:**
  - The verbatim copy of `next.config.js:50-77` builds on 10.2.3 and 12.3.7 (1 css-loader patched per compiler; `hack-report.jsonl`).
  - On 13.5.11, 14.2.35 and 15.5.28 the build fails: `HACK THREW: TypeError: reg.test is not a function` at the `rules.find(m=>m.oneOf&&m.oneOf.find(({test:reg})=>reg.test('file.css')))` line (`r13/build.log`, `r14/build.log`, `r15-18/build-verbatim.log`).
  - Cause: from 13 every CSS rule is merged into one `oneOf`. Its first entry is the next/font rule, whose `test` is a **string path** (`blocks/css/index.js:183-187` in 16.4.2: `test: fontLoaderTarget` = `require.resolve('next/font/google/target.css')`). Pages css-module rules also gained `issuerLayer` (13.5 `:233-255`).
  - Also, the early `return config` at `:55` returns **before** the aliases at `:86-100`. If it ever triggered, the imports `api`, `store`, `main` and so on would fail to resolve, which is a loud failure, not a silent one.
  - A version-proof replacement was verified. It produces identical CSS (md5 `196d7faf…` on 10.2.3 for both variants; `6ad4b9e0…` on 12.3.7) and works on 13.5–16.4 (1 patch per compiler, correct classes in the SSR HTML). The built class map keeps both keys on every version (`{"container-inner":…,containerInner:…}`).
  ```js
  let n = 0
  const visit = (r) => { if (!r || typeof r !== 'object') return
    ;(r.oneOf || []).forEach(visit); (r.rules || []).forEach(visit)
    const tests = Array.isArray(r.test) ? r.test : [r.test]
    if (!tests.some((t) => t instanceof RegExp && t.test('file.module.css')) || !Array.isArray(r.use)) return
    r.use.forEach((u) => { if (u && typeof u.loader === 'string' && /[\\/]css-loader[\\/]/.test(u.loader) && u.options && u.options.modules) { u.options.modules.exportLocalsConvention = 'camelCase'; n += 1 } }) }
  rules.forEach(visit)
  if (n === 0) throw new Error('camelCase css-module patch matched 0 rules')
  ```
- **Recommendation:** replace the hack in W0, landing it in a separate PR gated by T-002/T-003/T-801 (0 diff verified). Add a CS-N13 row. Fix R-001's "Shows as" (LOUD on 13+; silent only if a future shape matches nothing, which is why the assert is there) and README §4.

### NL-05 HIGH: from 12.3 the server runs `@sentry/browser` (the alias bug becomes live); fixing it is allowed by D1
- **Docs:** 20 (new CS-N12), 10 (R-040), README errata #3, 30 (Q-065), 40 (T-004).
- **Evidence:** the server `_app.js` and the runtime value of `Sentry.NodeClient ? 'node' : 'browser'` rendered in SSR:

  | Version | Server `_app.js` requires | Runtime SDK |
  |---|---|---|
  | 10.2.3 | `require("@sentry/node")` | `node` |
  | 12.3.7, 13.5.11, 14.2.35, 15.5.28, 16.4.2 | `@sentry/core`, `@sentry/integrations`, `@sentry/replay`, `@sentry/utils` (browser SDK bundled) | `browser` |

  Changing `config.isServer` → `isServer` (the destructured arg, `next.config.js:37,97`) restores `require("@sentry/node")` and `node` on 16.4.2. The client still bundles the browser SDK. Next 11.1 is UNCONFIRMED.
- **Recommendation:** add CS-N12-x: "`'@sentry/node': isServer ? …`". It is identical behaviour today (on 10.2.3 externals win anyway), so it can land in W0. Keep T-004 as the detector. Remove "watch" from errata #3.

### NL-06 HIGH: `next build` on 11 through 15 lints `pages/` and `lib/` and fails on the existing ESLint errors
- **Docs:** 20 (new CS), 50 (W1/W4 ordering), 05 tooling.
- **Evidence:**
  - `ESLINT_DEFAULT_DIRS = ['pages','components','lib','src']` (12.3.7 `dist/lib/constants.js:46-51`; `app` is added in 14.2). Lint errors throw `CompileError` (12.3 `dist/lib/verifyAndLint.js:50`; 14.2 :54-56).
  - The baseline has errors in `lib/loader.js` (max-len ×2, class-methods-use-this) and `pages/search/index.jsx` (no-console ×4) (`findings/baselines/eslint-baseline.json`).
  - 11–14 only detect `.eslintrc*`. 15 detects `eslint.config.*` too (15.5.28 `runLintCheck.js:128-129,272-273`).
  - **Verified:** a 15.5.28 build with ESLint 9.39.5 and a flat config fails: "Failed to compile. ./lib/x.js 1:26 Error: Unexpected console statement. no-console".
  - In 16, `next build` no longer lints, and the `eslint` config key is gone from `config-schema.js`.
  - W4 entry requires only W2/W3, so W4 can run while `.eslintrc.yml` (ESLint 7) is still present. Then Next 11/12 lint with it and fail.
- **Recommendation:** add `eslint: { ignoreDuringBuilds: true }` to `nextConfig` in W0 (a no-op on 10.2.3). Delete it in W7(c) (16) to avoid the "Unrecognized key" warning. Linting stays in the CI lint gate (T-001).

### NL-07 HIGH: head-manager change at 15.0; T-708's baseline expectation is wrong
- **Docs:** 40 (T-708, parity row), 10 (R-003), 30, 90 (new OD), findings/07:260.
- **Evidence (`headjs.js`, `/works/1/`, JS off vs JS on):**

  | Version | JS off | JS on |
  |---|---|---|
  | 10.2.3, 13.5.11, 14.2.35 | citation 1, DC 1, ld+json 1, viewport 1, charset 1 | **citation 0, DC 0, ld+json 0, viewport 2, charset 2** |
  | 15.5.28, 16.4.2 | (same as JS off below) | citation 1, DC 1, ld 1, viewport 1, charset 1 |

  After a client navigation to `/works/2/`, the 15/16 DOM still carries Work 1's citation tags (`headnav.js`). Code: ≤14 uses `meta[name=next-head-count]` (14.2.35 `client/head-manager.js:126`); 15+ uses `${type}[data-next-head]` (15.5.28 :53, 16.4.2 :52). Present since 15.0.0 (unpkg). T-708 (40:351: "same SEO tag set as T-602 (no duplicates, none removed)") and findings/07:260 contradict the baseline.
- **Recommendation:** rewrite T-708 to pin the **baseline** post-hydration head: Meta-component tags removed, charset and viewport duplicated. Add a risk for the 15.0 change: the rendered DOM keeps JSON-LD and citation tags, which Googlebot renders. Open an OD: accept the 15+ behaviour, or replicate it. Replicating would mean rendering the `<Meta>` children as direct DOM children of `<Head>`, which changes SSR order and keys, so it is not trivially identical. The fix side belongs to the owner.

### NL-08 MEDIUM: framework header and markup diffs the parity contract will flag, with no remedy in the plan
- **Docs:** 40 §1 (parity contract), 90 (new OD), 10.
- **Evidence (probe):**

  | Item | 10.2.3 | 12.3.7/R18 | 13.5–14.2 | 15.5–16.4 |
  |---|---|---|---|---|
  | Cache-Control on gSSP 308 `/search/` | none | `private, no-cache, no-store, max-age=0, must-revalidate` | same | same |
  | Cache-Control on App-gIP-only pages `/error-card/`, `/outputs/update/`, `/404/` | none | same `private…` | same | same |
  | 404 Cache-Control | `no-cache, no-store…` | `private, no-cache…` | same | same |
  | HTML ETag | `"1110-…"` | **absent** (chunked stream) | fnv `"igsj…"` | fnv |
  | `_next/data` Content-Type | `application/json` | same | same | `application/json; charset=utf-8` + new `x-nextjs-matched-path` |
  | Script tags | `async` | `defer` | `defer` | `defer`, R19 `noModule` |
  | Head attrs | `next-head-count` | same | same | `data-next-head=""`, no count |
  | CSS-module hash | `__2Z0d7` | `__yi1Xz` | `__Jv1Ov` | `__Jv1Ov` |
  | 308 body | empty | `/` | `/` | `/` |

  Unchanged everywhere: `X-Powered-By`, `Vary: Accept-Encoding`, CSP on HTML, data and static responses, static `Cache-Control: public, max-age=31536000, immutable`, every status code in T-601, `/display` → `/outputs`, next-images asset URLs (identical hashed file `errorCard-dd089c27….svg`), and `router.query` shapes. No `x-nextjs-cache`.
- **Recommendation:** add an "expected framework diffs" table per version to 40 §1, with owner sign-off (new OD). T-603 should compare `Cache-Control` **values**, not only presence. Normalise CSS-module hashes in any HTML snapshot.

### NL-09 MEDIUM: the browser-support floor rises regardless of `.browserslistrc` (OD-16 premise wrong)
- **Docs:** 90 (OD-16), 10 (R-065), 40 (T-724).
- **Evidence:**
  - Next client `main-*.js` contains `?.`/`??`: 0 on 10.2.3, 2/1 on 12.3 through 16.4.
  - webpack arrow-function module wrappers: `=>` count in the Babel-compiled `_app` chunk is 0 on 10–14 and 20 on 15.5 (16 on 16.4); the framework chunk goes 0 → 9.
  - Next 16 states a floor of Chrome/Edge/Firefox 111, Safari 16.4 (`dist/shared/lib/modern-browserslist-target.js`; v16 guide).
  - With the repo's caniuse-lite 1.0.30001754, `.browserslistrc` resolves to targets that include `ie_mob 10/11`, `op_mini all` (not excluded by `not op_mini > 0`), `kaios 2.5`, `and_uc 15.5` and `baidu 13.52`.
- **Recommendation:** change OD-16 to: "the JS runtime floor rises at 12.3 and 15/16 whatever `.browserslistrc` says; keep `.browserslistrc` for CSS/Babel parity and accept the Next floor explicitly". Pull the GA browser share before W4. Add one Playwright smoke run on an engine at the floor.

### NL-10 MEDIUM: Node 22 as the track target is EOL on 2027-04-30; Node 24 is verified
- **Docs:** README §3, 20 (CS-N12-6, CS-NODE-1, CS-N16-1), 90 (OD-05).
- **Evidence:**
  - `nodejs/Release schedule.json`: v22 end 2027-04-30; v24 LTS 2025-10-28, maintenance 2026-10-20, end 2028-04-30; v26 LTS 2026-10-28.
  - Latest releases: 24.22.0 and 26.12.0 (2026-10-14).
  - 12.3.7, 13.5.11, 14.2.35, 15.5.28 and 16.4.2 all built on 24.18.1, and 12.3.7 also ran on 22.18.0. That resolves the CS-N12-6 VERIFY.
- **Recommendation:** make Node 24 the track target, at the end of W4 or with CS-N12-6. Add a post-S step to evaluate Node 26 LTS (M1). The ICU snapshot policy (OD-05) is unchanged.

### NL-11 MEDIUM: M1 gaps, i.e. deprecated paths with no later step to retire them
- **Docs:** 20, 50 (phase 7, post-S), 90.
- **Evidence:**
  - `legacyBehavior` has been deprecated since 15.3.0, via a dev-only `errorOnce` "…will be removed in a future release" (16.4.2 `client/link.js:404-408`; absent in 15.2.0 per unpkg).
  - React 18 on Next 16 warns at build time: "React 18 support is deprecated in Next.js 16 and will be removed in Next.js 17" (`r16-18/build.log`).
  - The future of `--webpack` is UNCONFIRMED: docs still list it as an opt-in, and no removal notice was found.
  - next-images makes Next 16 warn: "Unrecognized key(s) in object: 'serverRuntimeConfig'" (`next-images/index.js:3-8`).
- **Recommendation:** add to phase 7 (antd): migrate the 5 `<Link legacyBehavior>` sites (`new-link`-style), drop next-images (built-in imports, `.src`), and drop the `webpack()` dependence (W9). Track webpack-in-Next status as an OD.

### NL-12 MEDIUM: W0 "Next-proofing" wave; the changes are verified neutral on 10.2.3, so the W6/W7 blast radius shrinks
- **Docs:** 50 (§2/§4), 20.
- **Evidence:**
  - Gateway rule: identical on 10.2.3 (`navGW-4010`).
  - Title literals: byte-identical on 10/12.
  - `legacyBehavior`: on 12.3 `legacyBehavior` already defaults to true (`client/link.js:161`); on 10.2.3 the prop is ignored. The resulting DOM was identical across all versions.
  - Robust CSS patch: identical CSS md5 on 10 and 12.
  - Sentry `isServer`: on 10.2.3 externals win, so `require("@sentry/node")` was already the result.
  - `ignoreDuringBuilds`: no lint step on 10.
- **Recommendation:** add W0b with these 6 PRs, each gated by T-002/T-003/T-602/T-702/T-801 = 0 diff on 10.2.3. W4, W6 and W7 then become pure version bumps.

### NL-13 MEDIUM: `/display/*` hydration mismatch is a guaranteed React-18 recoverable error, and T-701 does not cover it
- **Docs:** 30, 40 (T-701, T-723), 10 (R-010).
- **Evidence:** loading `/display/3/` fresh produces `#425` + `#423` on 12.3, 13.5 and 16.4 with R18, and `#418` on 15.5/16.4 with R19. Nothing on 10.2.3, and no other route errors (`hydr.js`). Sources: server `asPath=/outputs/…` vs client `/display/…` (`pages/_app.jsx:101`, `templates/output/index.jsx:50,81-86`). R-010 lists it, but there is no ESCALATES entry or change site. T-701 covers only T-601 200-routes, and `/display` is a gateway-only URL.
- **Recommendation:** add `/display/:id/` (through the proxy) to T-701's route list. Pin the post-hydration DOM vs React 17 in T-723. Open an OD: ESCALATES (e.g. compute the asPath-dependent values after mount) or accept.

### NL-14 MEDIUM: from 14 the SWC binary is mandatory (no WASM fallback); from 15 sharp musl binaries are pulled
- **Docs:** 10 (R-027), 20 (CS-N12-4), 40 (T-008).
- **Evidence:**
  - The v14 guide says "The WASM target for next-swc has been removed".
  - `optionalDependencies`: 13.5.11 and 14.2.35 pin `@next/swc-*` at 13.5.9/14.2.33; 15.5.28 adds `sharp ^0.34.3||^0.35.5`; 16.4.2 adds `sharp ^0.35.5`.
  - Every build logs "Disabled SWC as replacement for Babel…", but the binary is still loaded for the minifier (13+ default).
  - R-027 still says "or WASM SWC is used".
- **Recommendation:** for 14 and later, a missing `@next/swc-linux-arm64-musl` is a hard build failure. T-008 must assert that `@next/swc-linux-arm64-musl` and (from 15) `@img/sharp-linuxmusl-arm64` exist in the lock and in `node_modules` inside `node:<ver>-alpine` arm64.

### NL-15 MEDIUM: intermediate production versions carry open advisories, and the image optimizer is publicly reachable
- **Docs:** 30 (S-notes), 50 (prod deploy policy), 90.
- **Evidence:**
  - The npm bulk-advisory API reports, among others:
    - GHSA-ggv3-7p47-pfv8 (HTTP request smuggling in rewrites, <15.5.13; the app uses rewrites);
    - GHSA-p9j2-gv94-2wf4 (SSRF in rewrites, <15.5.21);
    - image-optimizer DoS and RCE ranges (<15.5.16 and <15.5.24).

    These match 12.3.7, 13.5.11 and 14.2.35. 15.5.28 and 16.4.2 are outside all listed ranges.
  - `/static/search/_next/image/?url=…` through the proxy: 200 on 10.2.3; 400 for SVG on 13/16, which means the endpoint is live.
- **Recommendation:** keep production dwell on 12.3 and 14.2 short (stage-only for 13.5 and 15.5, as planned). For 15, take ≥15.5.24, i.e. the latest 15.5.28. OD: block `/static/search/_next/image` at the gateway. It is behaviour-neutral because the app has no `next/image`.

### NL-16 LOW: resolved VERIFY items (R-006, `path`, aliases, gSSP shapes)
- **Docs:** 10 (R-006, R-044, R-045), 20 (CS-N11-1, CS-N11-6, CS-N13-3), README checklist.
- **Evidence:**
  - No `process.on is not a function` page error on 12.3 through 16.4. The polyfill is `dist/build/polyfills/process.js` → `next/dist/compiled/process` (`.on=noop`).
  - Client `path` falls back to `next/dist/compiled/path-browserify` (16.4.2 `webpack-config.js:1531`; 12.3 :875).
  - The `react`/`react-dom` directory aliases build and hydrate on 13–16 with R18 and R19.
  - `redirect+props` → 308 `/` and `notFound+props(Error)` → 404 on every version. An `Error` inside props serialises to `{"status":500}` everywhere.
- **Recommendation:** downgrade R-006 and R-044 for 12.3+ (11.1 not run). Mark R-045 MITIGATED-by-evidence. Keep the tests.

### NL-17 LOW: R-013 "LOUD-browser" is wrong; without `legacyBehavior` it is silent in production
- **Docs:** 10 (R-013).
- **Evidence:** 13.5.11 `client/link.js:268-272` throws "Invalid <Link> with <a> child" only when `process.env.NODE_ENV==="development"` **and** `children.type === "a"`. The design `Button`/`Link` children are components, so a production build would render `<a><a>` silently.
- **Recommendation:** change "Shows as" to SILENT. T-406/T-407 already check the DOM.

### NL-18 LOW: scroll after navigation; one real change that this app does not trigger
- **Docs:** 10 (R-052), 40 (T-706).
- **Evidence:** a shallow `<Link>` with a query change leaves `scrollY` at 2258 on 10.2.3 and 12.3.7, but resets it to 0 on 13.5 through 16.4. 13+ Link passes `scroll: scroll ?? true`; the router still exempts `isValidShallowRoute` (13.5 `router.js:900-902`). `router.push`, back and other-page navigations are identical everywhere, and `history.scrollRestoration` stays `auto`. The app renders `<Pagination total=… />` with no `shallow` (`templates/data-provider/index.jsx:144`), so the change does not apply. CS-N16-3 is correct: the only `scroll-behavior` is `auto` under reduced motion (`sanitize.css/reduce-motion.css:16`).
- **Recommendation:** downgrade R-052 and keep T-706. Add a comment to CS-N13-1: "do not start passing `shallow` to Pagination".

### NL-19 LOW: Next 13.5+ installs its own crash handlers, so server log output changes
- **Docs:** 30 (Q-009/Q-065 area), 10 (R-055), 40 (T-606, T-902 log allow-list).
- **Evidence:** 13.5.11 `server/lib/start-server.js:211-220` adds `process.on("uncaughtException"|"unhandledRejection", console.error)`. 16.4.2 `server/lib/router-server.js:719-722` adds `_log.error('uncaughtException: ', err)` plus a rejection listener. The process stays alive as today, but errors are logged twice, and handlers exist before `_app` loads.
- **Recommendation:** note it in R-055. The T-606/T-902 log assertions must allow-list the new lines.

### NL-20 LOW: `next/jest` ignores `babel.config.js`; test-path details per version
- **Docs:** 40 §2.2, README checklist.
- **Evidence:**
  - `next/jest` hard-wires the SWC transformer (16.4.2 `dist/build/jest/jest.js:203-210`). Legacy decorators (`store/filters.js`) and `export x from` need Babel, so use `babel-jest` with the project config.
  - RouterContext:

    | Next | Module |
    |---|---|
    | 10.2.3 | `next/dist/next-server/lib/router-context` |
    | 12.3 | `next/dist/shared/lib/router-context` |
    | 13.5–16.4 | `next/dist/shared/lib/router-context.shared-runtime` |

  - T-002 class-map extraction: the regex `"<kebab>":"<file>_<kebab>__<hash>"`, `<camel>:"…"` is stable 10 → 16.
- **Recommendation:** record these answers in 40 §2.2 and tick them off in the README checklist.

### NL-21 LOW: an execution detail on 15 and 16, the `upgrade` codemod also bumps React
- **Docs:** 20 (CS-N15-1, CS-N16-5).
- **Evidence:** the v15 and v16 guides lead with `npx @next/codemod@canary upgrade latest`. It "install[s] the latest Next & React versions", and its escape hatch is `--skip-react-upgrade`.
- **Recommendation:** in CS-N15-1, install with `npm i next@15.5.28 --save-exact` (React stays 18), or use the codemod with `--skip-react-upgrade`. Use exact pins at each step.

### NL-22 LOW: clarity, so later sessions do not re-investigate the v13–v16 breaking-change matrix
- **Docs:** 20.
- **Evidence:** see §3. Most guide items are N/A here (AMP, runtime config, `images.domains`, `next lint`, middleware/proxy, `@next/font`, `next export`, `target`, experimental keys, sync request APIs, `swcMinify`, fonts).
- **Recommendation:** add a compact "checked, N/A" row per guide item to 20, citing this report.

### NL-23 LOW: Next 13.5 `env` validation warnings
- **Docs:** 40 (T-901 log allow-list).
- **Evidence:** `r13/build.log` shows "Invalid next.config.js options detected: "env.SENTRY_DSN" is missing, expected string" when values are undefined (local builds). Docker ARG→ENV yields `""`, so CI is unaffected.
- **Recommendation:** allow-list the warning, or default the values to `''` in `env.config.js` only if T-116 shows identical client inlining. Otherwise just document it.

---

## 3. Breaking-change matrix (official guides; pages router)

Guides: <https://nextjs.org/docs/pages/guides/upgrading/version-13>, …/version-14, …/version-15 (lastUpdated 2026-10-15), …/version-16 (lastUpdated 2026-10-15); blog <https://nextjs.org/blog/next-16>.

| Ver | Change | Applies here? | Evidence / action |
|---|---|---|---|
| 13 | Supported browsers: modern only | **Yes**: the runtime ignores `.browserslistrc` | NL-09 |
| 13 | Node ≥16.14 | Yes (Docker Node 22/24 by then) | registry engines |
| 13 | React ≥18.2 | Yes | W6 order OK |
| 13 | `swcMinify` default true | Yes (minifier only; Babel kept) | needs the SWC binary (NL-14) |
| 13 | `next/image` → `next/legacy/image` | No (`next/image` unused) | grep |
| 13 | `next/link` renders `<a>` | **Yes**, 5 sites | `legacyBehavior` (CS-N13-1/2) verified; can land in W0 (NL-12) |
| 13 | `target` removed | No | `next.config.js` |
| 13 | Script/font changes | No | grep: no `next/script`, no web fonts |
| 13 (undocumented) | `_document`/head rendered via Fizz → multi-child `<title>` gets `<!-- -->` | **Yes** | NL-03 |
| 13 (undocumented) | CSS rules merged into one `oneOf` with a string `test` | **Yes** | NL-04 |
| 13.4 | Router-server rewrite | Works on 13.5/14.2 | NL-01 |
| 14 | Node ≥18.17 | Yes | — |
| 14 | `next export` removed | No | — |
| 14 | `ImageResponse` import, `@next/font` | No | — |
| 14 | WASM SWC removed | **Yes** (arm64 musl) | NL-14 |
| 14.2 | Server strips `assetPrefix` itself (`/static/search/_next/static/*` → 200 direct) | Harmless | probe "asset direct with prefix" |
| 15 | Pages router supports React 18 **or** 19 | Yes | CS-N15-1 correct |
| 15 | `useFormState`/`useFormStatus` | No | — |
| 15 | `@next/font` removed | No | — |
| 15 | `bundlePagesExternals` → `bundlePagesRouterDependencies` | No (default false) | — |
| 15 | `serverExternalPackages` rename | No | — |
| 15 | Speed Insights | No | — |
| 15 | `NextRequest.geo`/`ip` | No (no middleware) | — |
| 15 | sharp becomes an optional dep | Yes (install footprint) | NL-14 |
| 15.0 (undocumented) | head-manager uses `data-next-head` | **Yes** | NL-07 |
| 15 (undocumented) | `_next/data` Content-Type + `x-nextjs-matched-path` | Yes | NL-08 |
| 15 (undocumented) | `next build` lints flat config | **Yes** | NL-06 |
| 15.3 | `legacyBehavior` deprecated (dev) | Yes | NL-11 |
| 15.4+ (undocumented) | data-request detection from the original `req.url` | **Yes**: breaks the rewrite | NL-01 |
| 16 | Node ≥20.9 | Yes | Node 24 recommended (NL-10) |
| 16 | TS ≥5.1 | No (JS) | — |
| 16 | Browsers Chrome/Edge/Firefox 111, Safari 16.4 | Yes | NL-09 |
| 16 | Turbopack default; a `webpack` config makes `next build` fail | **Yes** | Verified error text: "This build is using Turbopack, with a `webpack` config and no `turbopack` config". Use `next build --webpack` and `next dev --webpack` (CS-N16-2 correct) |
| 16 | `experimental.turbopack` → `turbopack` | No | — |
| 16 | `middleware` → `proxy` | No | — |
| 16 | `next/image` defaults (`localPatterns`, `minimumCacheTTL`, `imageSizes`, `qualities`, local IP, `maximumRedirects`); `images.domains` deprecated | No (`next/image` unused; `disableStaticImages` still in schema, `config-schema.js:732`) | — |
| 16 | Separate `.next/dev`; lockfile | Dev only | — |
| 16 | ESLint flat default in plugin | No (`eslint-config-next` not used) | — |
| 16 | `scroll-behavior` override removed | No `smooth` anywhere | CS-N16-3 correct |
| 16 | No size metrics in build output | Yes (T-007) | CS-N16-4 correct (verified) |
| 16 | Config not loaded twice in dev | No | — |
| 16 | `sass-loader` 16 | No Sass | — |
| 16 | AMP removed | No | — |
| 16 | `next lint` removed / `eslint` key removed | Scripts use eslint directly; remove `ignoreDuringBuilds` (NL-06) | — |
| 16 | Runtime config removed | Not used, but next-images sets the key, so a warning only | NL-11 |
| 16 | `devIndicators` options | No | — |
| 16 | `dynamicIO`/`ppr`/`rootParams`/async request APIs/cache APIs/parallel routes | No (app-router features) | — |
| 16 (build log) | React 18 deprecated, removal in 17 | Yes | W7 order (React 19 before 16) is right |
| all | `X-Powered-By`, gSSP Cache-Control, status codes, `trailingSlash` 308s, healthz | Unchanged | NL-08 table |
| all | CSP: no inline scripts added, no `securitypolicyviolation` events on 10–16 | OK | `nav-*.json` `csp: []`, probe `inline_non_json=0` |

## 4. W6/W7 sequence validation and proposal

The plan's order is **sound on the React axis**:
- React 18 lands first on 12.3, which allows `^18.0.0-0`.
- 13.5 and 14.2 require `^18.2`.
- React 19 lands on 15.5, which allows 18 and 19.
- 16 comes last, which avoids the deprecated 16+R18 combination.

What has to change is around it:

0. **W0b "Next-proofing", deployed on today's Next 10.2.3** (each step verified neutral):
   - (a) gateway `/search/_next/data` rule, prod and stage, plus the test proxy (NL-01);
   - (b) title template literals ×3 (NL-03);
   - (c) `legacyBehavior` on the 5 Links (CS-N13-1/2 moved earlier);
   - (d) robust CSS patch with assert (NL-04);
   - (e) Sentry alias `isServer` (NL-05);
   - (f) `eslint.ignoreDuringBuilds` (NL-06).
1. **W4:** 11.1 → 12.3.7. Production only after W0b(a) is live. Then Node **24** (not 22).
2. **W6:** React 18.3.1 on 12.3.7 (12.3 streams: chunked responses, no ETag, a transient diff) → 13.5.11 (stage) → 14.2.35 (production). Pre-register the NL-08 diffs and resolve the NL-13 `/display` decision before the R18 step.
3. **W7:** 15.5.28 with React 18 (stage; install exact, no `upgrade` codemod; head-manager OD from NL-07 decided before) → React 19.3.1 on 15.5.28 → 16.4.2 `--webpack` (production; remove `ignoreDuringBuilds`; expect the next-images `serverRuntimeConfig` warning).
4. **After S (M1):**
   - re-read `latest` at execution time;
   - move to Node 26 LTS when it is LTS;
   - phase 7 removes `legacyBehavior` and next-images;
   - W9/Turbopack per OD-10;
   - track whether Next 17 drops webpack (UNCONFIRMED).

**Next-specific additions to the S gate (M5/M7):**
- raw `<title>` bytes per fixture;
- data route through the proxy: JSON content-type plus a `pageProps` parse;
- client-navigation journeys with `pageerror` = 0 and content markers;
- server Sentry SDK = `node` (T-004);
- post-hydration head as pinned (T-708, rewritten);
- header **values** matrix vs the pre-registered diffs;
- camelCase patch count >0 per compiler;
- build-log warning allow-list (next-images key, env warnings, React 18 deprecation if present).

## 5. Resolved VERIFY items
See the structured index. The raw evidence is in `exp/nextjs-late/`.

## 6. How to reproduce
```
cd <scratch>/exp/nextjs-late
HACK=robust bash scripts/build.sh r16-19 v22.18.0 --webpack   # or r10 v18.20.8 / r12 / r13 / r14 / r15-18
bash scripts/start.sh r16-19 v22.18.0 4116                    # next start :4116 + gateway :5116 (GW_DATA_RULE=1 adds the fix)
python3 -I scripts/probe.py 4116 ; node scripts/nav.js 5116 $PWD/pw
```
