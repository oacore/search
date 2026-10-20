# Adversarial review — React 17→18→19 and MobX / mobx-react-lite (key: `react-mobx`)

Reviewer scope: search app code (`store/ hooks/ modules/ templates/ pages/ main/ utils/ lib/`), the code that will be vendored from `@oacore/design@5.0.74` (installed `node_modules/@oacore/design/lib` + design repo `src/` at `bbc35a0`) and its React runtime deps, versus the plan docs (`docs/upgrade/10, 20, 30, 40, 50, 60, 90`, `findings/03`).
Date: 2026-10-19. Read-only. All experiments in `<scratch>/exp/react-mobx/` (packages fetched with `npm pack`, never installed into any repo, no scripts run).

## 0. Verdict

The plan's React/MobX inventory is mostly accurate on *what exists in the code* (no legacy React APIs in app/design lib, no `useObserver`, `enableStaticRendering` set, per-request SSR store, only 2 design `defaultProps`). Where it fails is the *behaviour of the new React versions*. Several statements are wrong when checked against the real React 18.3.1 / 19.3.1 and Next 12.3.7 / 13.5.11 / 16.4.2 code, and two failure modes that break silently in production are missing completely:

1. **Critical, missing.** On React 19 the SSR `<title>` of every works, outputs and data-providers page is **empty**. On Next ≥13 with React 18 it contains a literal `<!-- -->`. The client head-manager repairs `document.title` after hydration, so only a raw-HTML check can see it (§1).
2. **The defaultProps analysis has the wrong mechanism.** React 19 still applies `defaultProps` for `React.createElement` (classic runtime, which search uses today). It drops them only for elements built with `react/jsx-runtime`. So the plan's own CS-R19-1 (switch to the automatic runtime) is what breaks Histoslider. React 19 by itself breaks the design-internal MathMarkdown call sites (§2).
3. **The Q-050 "minimal fix" does not work on React 19.** React 19 no longer patches suppressed text mismatches. The fix also targets a text node that search does not render (§3).
4. **The hydration gate cannot characterise today's state, and its main fixture hides the most frequent mismatch.** React 17 production logs nothing. Dev mode never SSRs (Q-052). Playwright presets the consent cookie, which hides Q-051 (§4, §5).
5. **Missing ESCALATES candidates:** the `/display/:id/` structural mismatch and `Intl.DisplayNames` region names (§6, §7).
6. **M1:** MobX latest is 7.0.6 and mobx-react-lite latest is 5.1.0. The plan pins 6.15 / 4.1, says "never 7/5", and its 6.x target is not the newest 6.x (6.16.1). Babel 8 is out, but the plan does not record why it is rejected. The evidence is in §8 and §9.

Under M5/M7 the React layer has **no measurable stability gate** today (§13). Without the changes below, the ≥95% claim does not hold for this dimension.

---

## 1. CRITICAL — React 18/19 SSR break `<title>` with multiple children (missing risk + change site)

**Sites** (JSX children = array of 2):
- `pages/works/[id].jsx:144` `<title>{data.title} - CORE</title>`
- `pages/outputs/[id].jsx:128` (same)
- `pages/data-providers/index.jsx:85` `<title>{query ? `${query} - ` : ''}Data providers search</title>`. `query` is always `undefined` because the Params schema key is `q` (`store/data-providers.js:5-16`), so today's title is always "Data providers search". This is a PRESERVE quirk.
- `modules/title/index.jsx:12` (dead: not imported anywhere)

**How Next renders it.** The `next/head` children are rendered by `_document` through React itself:
- Next 12.3.7: `ReactDOMServer.renderToStaticMarkup(document)` (`dist/server/render.js:894`). This is safe.
- Next 13.5.11: `renderToString` → `renderToReadableStream` (`dist/server/render.js:84-85,919`).
- Next 16.4.2: same, `dist/server/render.js:84-87,967`.
- Next does not normalise title children (`dist/shared/lib/head.js` only dedupes).

**Experiment** (`exp/react-mobx/scripts/title.js`, `title-stream.mjs`), `NODE_ENV=production`:
```
18.3.1 renderToReadableStream: <title>Paper title<!-- --> - CORE</title>
19.3.1 renderToReadableStream: <title></title>
19.3.1 renderToStaticMarkup:   <title></title>   (dev: "React expects the `children` prop of <title> tags to be a string…")
18.3.1 renderToStaticMarkup:   <title>Paper title - CORE</title>
```
`<title>` is RCDATA, so the browser shows the `<!-- -->` literally until the client head-manager rewrites `document.title`. The rewrite joins the array: `next16 dist/client/head-manager.js:107-113`.

**Why it is silent.** T-708 (post-hydration head) and T-801 (pixels) see the corrected title. Only T-602 sees it, and only if its `<title>` "normalisation" does not strip comments or whitespace. Crawlers that do not run JS (and the first pass of those that do) index an empty or garbled title. This is an SEO loss of the kind R-003 is about.

**Fix (D1-allowed, it keeps today's output).** Use a single template-literal child: `<title>{`${data.title} - CORE`}</title>`. The SSR text then stays byte-identical to Next 10. Add it as a CS in W6(c) (Next 13.5, the first Fizz-document version) and keep it through W7.

**Tests.** T-602 must assert the **raw** title text from the HTTP response: no `<!--`, not empty, exactly equal to the baseline. Add a Jest unit that renders each page head with `react-dom/server` `renderToReadableStream`.

---

## 2. HIGH — The defaultProps mechanism is wrong. CS-R19-1 causes R-012; React 19 alone hits the design-internal call sites

**What the docs say** (03 §1, R-012, R-059, CS-R19-1/2/3): "React 19 ignores defaultProps on function components → Histoslider broken". Also "switch to the automatic runtime to remove the 'outdated JSX transform' warning; ref-as-prop needs the automatic runtime".

**What React 19.3.1 does**
- `react/cjs/react.production.js:471-474` is `createElement`. It still runs `if (type && type.defaultProps) … props[propName] = defaultProps[propName]`.
- `react/cjs/react-jsx-runtime.production.js` (`jsxProd`) contains no `defaultProps` handling at all.
- Experiment (`scripts/title.js`): `F.defaultProps={height:200}`. React 19 `createElement(F)` gives `<svg height="200">`, and `jsx(F,{})` gives `<svg>`. React 18 gives `height="200"` for both.
- The "outdated JSX transform" warning (`react.development.js:1087-1094`) fires only when `"__self" in config`, i.e. the dev JSX transform. `babel.config.js:12` (`'@babel/react'`, no `development` option) never adds `__self`, so the warning never fires.
- `ref` is copied into props by `createElement` in 19 (`react.production.js:457-463` keeps every key except key/__self/__source). So ref-as-prop works with the classic runtime as well.

**Consequences**
1. **Search-compiled call sites** (classic runtime today):
   - Histoslider at `modules/filters/year/index.jsx:43-51`.
   - MathMarkdown at `templates/output/index.jsx:155,192`.

   Both keep their defaults on React 19 **until CS-R19-1** switches the runtime. W7(b) bundles CS-R19-1…6 together. If CS-R19-1 lands first, R-012 fires; if CS-R19-2 lands first, it is masked. Either way the docs name the wrong cause. A later move to SWC / `next/jest` (automatic runtime) or Babel 8 (`@babel/preset-react` 8 defaults to automatic) would also trigger it.
2. **Design-internal call sites** use `react/jsx-runtime`. 61 of the 114 `lib/**/*.js` files `require("react/jsx-runtime")`, for example `lib/modules/search-result/search-result.js:19,180,247` and `lib/elements/footer/footer.js:143` (both `jsx(MathMarkdown, …)`). So **React 19 alone** drops MathMarkdown's defaults in every search result and in the footer on every page. The vendored compiled copy behaves the same way (60 §2 says the vendored JS is "the same compiled output, `react/jsx-runtime`").
3. **Jest would give a false green.** T-404 runs through `babel-jest` with the classic config, so it passes even if production used the automatic runtime.

**MathMarkdown impact (checked).** `latexify` passes options with `Object.create(options)` to `katex.renderToString` (design `src/elements/math-markdown/utils/latexify.jsx:19-27`). Every dropped default equals KaTeX's own default, or is falsy where the code tests truthiness (`breakLine`, `enforceOutput`). Output should be identical, so R-059 Low stays, but the affected sites are search results and the footer, not only the output page.

**Recommendation**
- Rewrite R-012/R-059: the trigger is "element created by `jsx()` on React 19".
- Make CS-R19-2/3 (defaults inside the component) **precede** any runtime switch.
- Drop CS-R19-1 from the track or make it its own PR gated by T-404 + T-801.
- Run T-404 under both runtimes: add a Jest project with `@babel/preset-react {runtime:'automatic'}`.
- The T-801 math fixture must include `/search` results and the footer.

---

## 3. HIGH — The Q-050 minimal fix is wrong for React 19, cannot be placed where CS-R18-2 says, and the escalation is unproven

1. **`suppressHydrationWarning` semantics differ between 18 and 19.**
   - React 18.3.1 patches the text: `react-dom.development.js:22270-22272` (`prepareToHydrateHostTextInstance` → `markUpdate`), with the suppression check at `:11391-11395`.
   - React 19.3.1 does **not** patch: `react-dom-client.development.js:13198-13205` returns true for a suppressed mismatch with no update; `:5628-5633` handles host elements the same way.
   - So on React 19 the text stays the **server (UTC) date**, which is a visible change from today, where React 17 patches it to the local date. A re-render in an effect that recomputes the *same* client string does not fix it either. The fiber already holds the client string, so React sees no prop change and the DOM keeps the server text.
2. **Wrong file.** The date text node is not rendered by search.
   - `templates/search/results.jsx:33-37` passes `publicationDate` as data to design `SearchResult`.
   - SearchResult renders it inside `MetadataList.Item` (design `src/modules/search-result/search-result.jsx:177-183`).
   - `suppressHydrationWarning` cannot be put on that node without editing the vendored component (D4 says verbatim).
   - `card-dropdown.jsx:184-187` renders "Last time updated on {date}" through design `Card.Description`. That is two text nodes, and the prop must reach the `<span>`.
3. **A fix that keeps behaviour and works on 17/18/19.** On the first client render, format with `timeZone: 'UTC'` (equal to the SSR string). After mount, switch to the local format. Today's visible sequence is the same: UTC in the HTML, local after hydrate.
   - This needs **one** `useState`/`useEffect` at the top of `Results` (`templates/search/results.jsx:10`), **not inside the `.map`**. A hook inside the map changes the hook count when the result count changes, which crashes with "Rendered more hooks". Today only `useRouter` (= `useContext`, no hook slot) sits in the map: `next16 dist/client/router.js:139-145`.
   - It also needs an assertion that the server TZ is UTC. `kube/prod/deployment.yaml` sets no `TZ`, and alpine has no tzdata.
4. **The escalation is conditional and unverified.**
   - A shift happens only if the API timestamps carry `Z`/an offset or are date-only.
   - An ISO date-time **without** an offset (`2019-01-01T00:00:00`) is parsed as *local* time on both sides, so there is no mismatch. `modules/meta/index.jsx:21-24` splits on `T`, which shows a time part exists, but nobody checked for an offset (UNCONFIRMED; the live site is behind a Cloudflare challenge).
   - The format must be read from the recorded fixtures (40 §2.4) before Q-050 is classed ESCALATES. If there is no offset, it is PRESERVE.

---

## 4. HIGH — T-701 cannot pin today's hydration state; no pre-upgrade inventory of mismatch sources

- T-701 (`40-test-strategy.md:344`) says "On React 17 the allow-list includes today's 'Text content did not match' warnings".
  - React 17 emits those messages **only in development** builds.
  - All Playwright runs use `next build && next start` (40 §7.8).
  - Dev mode never SSRs because of Q-052 (`pages/_app.jsx:149-155`).
  - So the baseline allow-list will be **empty**. No test written before the upgrade can reproduce Q-050/Q-051 or any unknown mismatch, which violates D1a's "pinning test green on the current stack first".
- From React 18 on, detection depends on the channel.
  - Next 12.3.7 calls `hydrateRoot(domEl, reactEl)` with no handler (`client/index.js:337`), so React's default `reportError` is used.
  - Next 13.5.11 / 16.4.2 pass `onRecoverableError` → `reportError(cause)` (`client/react-client-callbacks/on-recoverable-error.js`, `report-global-error.js`). The error goes to window `error` events, not `console.error`.
  - React 19 production uses code `#418` with an argument `"text"`/`"HTML"` (`react-dom-client.production.js:2966-2975`). There is no `#425` in 19.

**Recommendation (phase 2)**
- **(a) Hydration inventory on React 17.** Run `next dev` with the dev wrapper bypassed (a local, uncommitted patch or a test-only env flag, OD-30). Capture React 17 dev warnings for `Text content did not match`, `Expected server HTML to contain a matching`, `Did not expect server HTML to contain`, and `validateDOMNesting`, across every T-601 route × fixture × TZ {UTC, LA, Tokyo} × consent cookie {absent, present}. The result is the authoritative list of mismatch sites. Each one becomes a Q row (PRESERVE or ESCALATES).
- **(b) A version-independent detector, P0.**
  - For each route, compare the text of `#__next` in the HTTP response (Playwright `request`) with the DOM text after hydration, excluding nodes pinned by ESCALATES rows.
  - Also run an init-script `MutationObserver` on `#__next` that flags text and node mutations committed in the hydration commit.
  - This pins Q-050/Q-051/the new ones on React 17 and proves the fix later.
- **(c)** T-701 must listen to `pageerror`, `console.error` **and** an init-script `window.addEventListener('error')`. Match `#418|#419|#422|#423|#425|Hydration failed|did not match`.
- **(d)** Run `html-validate` (content-model rules) over the T-602 SSR snapshots. The HTML parser restructures invalid nesting, and that becomes a React 18 hydration error. A heuristic scan of `<p>`/`Card.Description` found none, but it cannot see nesting across components.

---

## 5. HIGH — The consent cookie preset hides Q-051. Q-051's real blast radius is missing

- 07 §J17 / 40 T-801 preset the consent cookie for stable runs, and T-701 does not specify a cookie state. With the cookie present, design `Cookies` renders `false` on both sides and there is no mismatch (`src/elements/cookies/cookies.jsx:11-13,31-36`). The mismatch exists only **without** the cookie: every first visit, private windows, and **every crawler render**.
- On React 18+ that mismatch triggers a full root client render. The consequences the docs miss:
  - **Sentry flood.** `reportError` dispatches a window `error` event, and `@sentry/browser` GlobalHandlers (`onerror` is on by default) captures one event per first-visit page view. That burns quota and hides real errors. The failure is SILENT for ops.
  - **Render-phase side effects run twice.** The failed hydration render plus the client render each call `LogRocket.init` (`pages/_app.jsx:90-91`), the claim-card `/account` GET (`templates/data-provider/claim/claim-card.jsx:104-106`) and the render-time `extend` (idempotent).
- **Recommendation.** Make T-701, T-702 and the request-log journeys run in a {cookie absent, cookie present} matrix. Add "Sentry ingest requests = baseline" and "`/account` requests = baseline" in both states. Record the Sentry consequence in R-010/Q-051.

---

## 6. HIGH — New ESCALATES candidate: `/display/:id/` structural hydration mismatch. R-010 names the wrong site

- The gateway rewrites `/display/*` → `/outputs/*` (`kube/prod/httproute.yaml:49-65`). The server sees `asPath=/outputs/<id>/…`. The client router initialises `asPath` from `location` (`getURL()`, `next16 dist/client/index.js:144`; same in Next 10), giving `/display/<id>/…`.
- `templates/output/index.jsx:81-82` computes `isTypeOutputs = asPath.includes('/outputs/')`. At `:127-137` it renders `<span>›</span><a>Research output from …</a>` only when that is true. The server renders those nodes and the client does not.
  - React 17 prod silently deletes them, so users on `/display/…/` URLs never see that breadcrumb tail (pin it).
  - React 18 throws a hydration error, and the whole root re-renders on every such visit.
- `pages/_app.jsx:101` (listed in R-010) is **not** a mismatch. Neither path contains "search", and the query string is identical.
- The main journey may be affected. Search results link the API `display` URL plus `/?t=…&search=…` (`templates/search/results.jsx:29,110-112`). The trailing slash means no 308 redirect, so the browser stays on `/display/…`, if the API returns `/display/` URLs (UNCONFIRMED; check the recorded fixtures).
- **Tests.** T-723 must assert the SSR-vs-DOM breadcrumb (§4b). Add a Q row (ESCALATES at React 18). Minimal fix that keeps behaviour: compute `isTypeOutputs`/`isTypeWorks` from the server value on the first render, then from the client `asPath` after mount. Today's visible end state (no tail on `/display/`) is preserved.

## 7. MEDIUM — New ESCALATES candidate: `Intl.DisplayNames` region name in SSR text

- `templates/data-provider/index.jsx:23-38,184-188` renders "{name} is based in {regionDisplayName(code)}" on the server with Node ICU and on the client with the browser ICU. The names differ by ICU and CLDR version (06 §376: Node 22 gives `TR→Türkiye`, `HK→Hong Kong SAR China`). Browsers without `Intl.DisplayNames` get the raw code (`{of:(v)=>v}`).
- React 18 → full client re-render for those users. The pinned Chromium in the container probably matches Node, so the gate will not see it.
- **Reproduce** by stubbing `Intl.DisplayNames` in an init script so the client name differs from the server name. Add a Q row. The fix pattern is the same as §3 (server value first, client value after mount).

## 8. MEDIUM — M1: MobX / mobx-react-lite targets are below latest

- Registry on 2026-10-19 (`npm view`):

  | Package | Latest | Latest in old major | Date |
  |---|---|---|---|
  | mobx | 7.0.6 | 6.x: 6.16.1 | 2026-06-08 |
  | mobx-react-lite | 5.1.0 | 4.x: 4.1.1 | 2025-09-27 |

  mlr 5.1.0 peers `mobx ^7, react ^18||^19`. mlr 4.1.1 peers `mobx ^6.9, react ^16.8–19` and depends on `use-sync-external-store ^1.4` (its shim works on React 17).
- The plan targets "6.15 / 4.1" and "never 7/5" (OD-13, CS-MOBX-3, R-046).
- The mobx 7.0.0 CHANGELOG (packed tarball) removes:
  - legacy decorators;
  - `observable.ref/.shallow/.deep/.struct`, `computed.struct`, `action.bound`, `comparer.*` (replaced by named exports);
  - `configure({useProxies})`;
  - from mlr 5: `useObserver`, `useLocalStore`, `observerBatching`/batching imports, `Provider/inject`, legacy contextTypes.
- In search the only blocker is the 26 MobX legacy decorators in `store/filters.js:16-345` (CS-BAB-1). A grep finds none of the removed APIs. The custom `@invalidatePreviousRequests` is a Babel decorator, independent of MobX.
- **Recommendation.**
  - W3 → mobx **6.16.1** + mlr **4.1.1**.
  - Add a step after W7: CS-BAB-1, then mobx 7.0.x + mlr 5.1.x, gated by T-203/T-2xx/T-3xx/T-4xx. Or record an explicit M1 justification in OD-13 that names phase-6 MobX removal as the "reach latest" step, with a fallback if phase 6 slips.

## 9. MEDIUM — The Babel-8 rejection has no evidence (the BAB section is incomplete)

- `@babel/plugin-proposal-decorators@8.0.2`:
  - `lib/index.js:159-179` accepts `version: 'legacy' | '2023-11'`. `{legacy:true}` without `version` falls to the **2023-11** path. Depending on option validation, that is a build error or a silent change of decorator semantics, which breaks MobX legacy decorators and `invalidatePreviousRequests (target,key,descriptor)`.
  - `engines` is `node ^22.18.0 || >=24.11.0`, so the `node:18` Docker build fails.
- Next 16 builds app code with its **bundled** `@babel/core` 7.2x (`next/dist/compiled/babel/bundle.js` contains `version:"7.26.3"`), so Babel-8 plugins would run inside a Babel 7 core.
- `@babel/preset-react` 8 defaults to the automatic runtime, which triggers §2.
- Put this evidence in 20 §Babel and OD-12 as the M1 justification. "Latest" is reachable only after leaving Babel (W9/SWC).

## 10. MEDIUM — React 19 SSR head changes are missing from the parity normalisations

Experiments (`scripts/head-order.mjs`, `imgpreload.mjs`, `imgfrag.mjs`), React 19.3.1 vs 18.3.1 via `renderToReadableStream`:
- **Reordering.** Hoistables (`meta`, `link`, `title`) are emitted first. `noscript` and `script` go after them, so the JSON-LD `<script>` moves after every `<meta>`. The relative order of metas is preserved.
- **Auto image preloads.** React 19 auto-injects `<link rel="preload" as="image" href=…>` for every non-`loading="lazy"` `<img>`. In a body-fragment render (which is how Next pages renders the app) it emits them, plus any `<title>`/`<meta>` rendered in the body, **before** the `#__next` markup.

40 §1 normalises only `<link rel=preload>` "for Next chunks". At W7, T-602 would raise false failures, or invite "fixes". Add explicit normalisations: image preloads, and the head order of non-SEO tags. Keep asserting the order of the SEO metas and the parsed JSON-LD.

## 11. MEDIUM — ESCALATES PR order and placement

- W6(b) lands the Q-050/051/052 fixes *after* the React 18 bump (50 §4, 20 CS-R18-2..4).
  - The fixes are visually neutral on React 17, so land them **before** CS-R18-1.
  - Their 0-px identity is then proven against the phase-2 baseline on the same React version, and the React 18 PR starts with zero hydration errors.
- Q-051 can be fixed **in search** with a mounted flag around `<CookiesPopup/>` at `main/index.jsx:22`. The vendored `cookies.js` then stays verbatim (D4), and the fix does not depend on W5.

## 12. MEDIUM — StrictMode in characterization tests pins behaviour production never has

- `reactStrictMode` is unset. Next 16 maps `null` to `false` (`server/config-shared.js:130`, `build/define-env.js:149`).
- The plan still proposes StrictMode in tests: 03 §5.2 "StrictMode on", OD-22 "Tests may wrap components in `<StrictMode>`", T-301 "StrictMode mount → 1 immediate + 1 delayed".
- Under StrictMode, `modules/filters/index.jsx:17-24` fires two `fetchFilters`. The second takes the merge branch (`store/filters.js:83-101`), so facet state differs from production.
- **Rule.** `test/utils/render.js` never wraps gating tests in StrictMode. StrictMode runs are investigative only and non-gating.

## 13. MEDIUM — No measurable React-layer gate for M5/M7

Propose a numeric gate for S (and for each of W3, W6, W7), all against the golden baseline:

| ID | Requirement |
|---|---|
| G-R1 | 0 hydration errors (channel set in §4c) over T-601 routes × fixtures × TZ{UTC,LA,Tokyo} × cookie{absent,present} × {Chromium, WebKit, Firefox} |
| G-R2 | The §4b SSR-vs-hydrated text diff is empty, except for nodes that an approved ESCALATES fix intentionally changes |
| G-R3 | Raw SSR `<title>` and SEO meta byte-equal (§1) |
| G-R4 | Request counts per journey (API, `/account`, Sentry, GA, LogRocket) equal the baseline in both cookie states |
| G-R5 | Jest console gate green |
| G-R6 | T-203 reactivity table unchanged |
| G-R7 | T-404 green under both JSX runtimes |
| G-R8 | 0 new Sentry issue types during the 24 h staging soak |

## 14. LOWER-SEVERITY CORRECTIONS

- **R-056 is wrong about react-cookie, and CS-R19-5 targets the wrong allow-list.**
  - `react-cookie@4.1.1` `cjs/useCookies.js` calls `useLayoutEffect` only under `isInBrowser()`, so there is no SSR warning.
  - `@tippyjs/react@4.2.6` `children.ref` (`headless/dist/tippy-react-headless.esm.js:360,517`) warns only in **dev**: the React 19 production element keeps a plain `ref` field (`react-jsx-runtime.production.js`). T-701 runs production builds, so CS-R19-5's T-701 allow-list is moot. The **Jest** `setup-dom` allow-list is what needs it.
- **R-039 / Q-049 trigger.** `templates/data-provider/index.jsx` is not an observer, so mlr 4 scheduling is irrelevant. Updates come only from the parent's React state (ClaimCard's render-time fetch → `setIsDataProviderHasAccounts`). The client-singleton `search.sortOptions` carries values from a previous `/search` page. T-408/T-715 need an "arrive by client navigation from `/search`" variant.
- **Batching (03 §1.3) misses one mechanism.** MobX writes outside actions after `await` each trigger a separate synchronous re-render in React 17: mlr 3 forceUpdate outside a React batch (`store/report.js:53-80`, `store/claim.js:45-51`, `store/similar-works.js:39-43`). React 18 merges them into one render. No effect depends on those intermediate states (grep of effect deps), so the risk is low. Tests must assert final states, not render counts.
- **Q-052 is not D1a-severe** (dev only). Treat it as a change site. Proof: a hash of `.next/static` excluding the buildId is unchanged. It is a prerequisite for the §4a inventory.
- **eslint-plugin-react-hooks 7.1.1.**
  - Its `recommended` preset = `rules-of-hooks` + `exhaustive-deps` + React Compiler rules (purity, refs, immutability, …), per the README and `recommendedRuleConfigs`.
  - On this code it would flag `store/index.jsx:32` (ref read during render), `templates/search/pagination.jsx:77` (`Math.random`) and dozens of `[]`-deps effects. "Fixing" them changes behaviour.
  - CS-LINT-2 must enable only `rules-of-hooks` and set `exhaustive-deps: off`.
- **React 19 drops `src=""` and non-`<a>` `href=""`.** Experiment `scripts/emptysrc.mjs`; `react-dom-client.development.js:21657-21672`. The current code guards `img` (DataProviderLogo), but design `Icon` `<use href={resolve(src)}>` with an empty `src` would lose the attribute. Add to R-0xx and T-417.
- **T-209 (server branch) implementation detail.**
  - `isServer` is computed when the module loads (`store/index.jsx:6`), and `enableStaticRendering` is process-global.
  - The test must run in the node Jest project with `jest.isolateModules`.
  - With mlr 4, call `clearTimers()` (exported by mlr 4.1.1 `src/index.ts`) in `afterEach`.
- **Design runtime deps, latest vs pinned (60 D5 pins the installed versions and has no later step to latest).**

  | Package | Installed | Latest | Notes |
  |---|---|---|---|
  | react-cookie | 4.1.1 | 8.1.2 | peer `>=16.3`; universal-cookie major changes, behind T-416/T-719 (UNCONFIRMED parsing changes) |
  | react-focus-lock | 2.13.6 | 2.13.7 | peer ^19 |
  | @tippyjs/react | 4.2.6 | 4.2.6 | unmaintained since 2022-04 |
  | react-slick | 0.28.1 | 0.31.0 | pruned by D2 |
  | react-markdown | 5.0.3 | 10.1.0 | ESM, API rewrite; pruned by D2. **Note:** `react-markdown@5` has function-component `defaultProps = {transformLinkUri}` (`lib/react-markdown.js:92-94`). A React 19 `jsx()` call site would silently drop link-URI sanitising, so keep it pruned. |
  | body-scroll-lock | 3.1.5 | 4.0.0-beta.0 | stable is 3.1.5 |

## 15. VERIFIED OK (no change needed)

- No `findDOMNode`, string refs, legacy context, `UNSAFE_*`, `ReactDOM.render`/`hydrate`, `createFactory` or `test-utils` in search code, the design compiled lib (only `createPortal`), or the design runtime deps (react-slick 0.28.1, react-focus-lock, use-sidecar, react-clientside-effect, react-cookie, html-to-react).
- Design `defaultProps`: exactly 2 (`histoslider`, `math-markdown`) in both `src/` and the installed `lib/`. Tippy and react-slick merge defaults by hand.
- Ref-as-prop (React 19): no `ref` is passed to an `observe()`-wrapped component. Every ref-receiving design component used by search is a `forwardRef` (`app-bar/item`, `button`, `forms/control`, `forms/addon`, `link`). The plain-function `Heading` receives a ref only in `content/heading.jsx`, which search does not use.
- `enableStaticRendering(isServer)` is set at `store/index.jsx:10`. The SSR store is per render (`useInitStore` → `initStore` → `new RootStore`). The decorated (signal) methods never run on the server, so there is no cross-request leak.
- Next ≥12.3 + React 18 render routes inside `startTransition` (12.3.7 `client/index.js:341-343`, 13.5.11 `:412-413`, 16.4.2 `:405-407`). Render-time `extend` stays idempotent across discarded renders (`store/root.js:37-40`), but render-phase fetches can repeat (§5).
- The `useLayoutEffect` server guard in `templates/data-providers/index.jsx:33-34` is correct.
- MathMarkdown with dropped defaults gives the same KaTeX options (§2).

## 16. Resolved [VERIFY] items

- **Latest versions (npm registry, 2026-10-19):**

  | Package | Latest |
  |---|---|
  | react, react-dom | 19.3.1 |
  | next | 16.4.2 (latest patches: 12.3.7, 13.5.11, 14.2.35, 15.5.28) |
  | mobx | 7.0.6 (6.x 6.16.1) |
  | mobx-react-lite | 5.1.0 (4.x 4.1.1) |
  | @testing-library/react | 16.3.3 (peer @testing-library/dom ^10; dom 10.4.2) |
  | eslint-plugin-react-hooks | 7.1.1 |
  | logrocket-react | 7.0.1 (installed 6.0.3 already declares peer react >=18: `npm ls` shows invalid) |

- **Q-062 line:** the DOI list effect is `templates/output/index.jsx:65-71` (state at `:51`), rendered by `templates/output/metadata.jsx:50`. It is not in `metadata.jsx`.
- **`reactStrictMode` default** for pages in Next 16: `null` → `false`.
- **Does React 19 drop defaultProps everywhere?** No. `createElement` still applies them; only `jsx()` drops them (§2).
