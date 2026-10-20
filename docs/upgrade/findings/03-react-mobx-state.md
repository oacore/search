# 03 — React + MobX state-management audit

Scope: `pages/ main/ templates/ modules/ hooks/ store/ utils/ api/` of `search` (Next 10.2.3, React 17.0.2, mobx 6.13.7, mobx-react-lite 3.4.3, Babel legacy decorators, JS/JSX).
Target: React 17 → 18 → 19, mobx-react-lite 3 → 4 (4.1+ for React 19), later MobX → zustand + swr (dashboard style).
Method: exhaustive grep plus a full read of every store, hook, page and observer component. Line numbers are from the working tree at commit `f5cfc20`.

> TL;DR: the code has **no** hard-removed React APIs (no `ReactDOM.render`, findDOMNode, string refs, legacy context, UNSAFE_ lifecycles or test-utils). The risk is in **behaviour**:
> (1) the dev-only "SSR disabled" hack becomes a hard hydration error under React 18;
> (2) Results are rendered on the server with timezone-dependent dates, and React 18+ turns any text mismatch into a full client re-render;
> (3) the design-system `Histoslider` loses its `defaultProps` under React 19;
> (4) side effects in render, a missing `observer`, and non-idempotent effects behave differently under StrictMode and concurrent rendering;
> (5) the URL⇄store sync for `/data-providers` sits on a client-singleton store and is already buggy.
> The mobx-react-lite 3→4 change itself is low risk (no `useObserver`, `useLocalStore` or `useLocalObservable` usage).

---

## 1. React 18/19 breaking-API inventory

| Check | Result | Location / note |
|---|---|---|
| `ReactDOM.render` / `hydrate` / `unmountComponentAtNode` | none in app (Next owns the root) | Next ≥12.2 uses `hydrateRoot` when React 18 is installed. |
| `findDOMNode` | none (app + design `src`) | — |
| String refs | none | — |
| Legacy context (`contextTypes`, `childContextTypes`, `getChildContext`) | none (app + design `src`) | — |
| `defaultProps` on function components | **none in app**. **Design lib: 2** | `design/src/elements/histoslider/histoslider.jsx:112` (used by `modules/filters/year/index.jsx:43-51`, which passes only width/padding/showLabels/data/selection/selectFunc). **React 19 ignores these defaults**, so `height`, `sliderHeight`, `barPadding`, colours and `handleLabelFormat` become `undefined`. Expect a broken or NaN SVG. `design/src/elements/math-markdown/math-markdown.jsx:51` (used in `templates/output/index.jsx:155,192`); its defaults mostly equal KaTeX's own, so low risk, but verify `breakLine`/`enforceOutput`. |
| `propTypes` | none in app. Design: 28 files | React 19 silently ignores them. No functional impact. |
| Class components | 1: `pages/_app.jsx:29-45` `ErrorBoundary` | Has only `componentDidCatch` and no `getDerivedStateFromError` or fallback UI, so on any render error the **whole tree unmounts (blank page)**. React 19: caught errors now go to `console.error` / `onCaughtError`, and Sentry capture in `componentDidCatch` still works. No legacy lifecycles. |
| `forwardRef` | 1 in app: `templates/data-providers/form.jsx:6`. Design: 41 | Deprecated (still works) in 19. `ref` becomes a plain prop. Codemod later. |
| `element.ref` access | none | — |
| `react-dom/test-utils`, `act` | none (there are **no tests at all**) | Use `act` from `react` and `@testing-library/react` ≥16. |
| `useLayoutEffect` on server | guarded: `templates/data-providers/index.jsx:33-34` (isomorphic pattern) | OK. |
| `React.Children` / `cloneElement` | `modules/show-more/index.jsx:19,32` | Still supported. Crashes if `children` is empty (`childrenArray[-1]`). |
| `createPortal` | design `src/modules/modal/portal.jsx:19` (mount-then-portal pattern) | Hydration-safe. Under StrictMode double effect it appends `#modal-root` only once (it looks it up first). OK. |
| `next/dynamic` | `modules/map/index.jsx:7` (`ssr:false`) | OK. |
| JSX transform | `babel.config.js` uses `'@babel/react'` (**classic runtime**) | React 19 warns "outdated JSX transform", and `ref`-as-prop needs the automatic runtime. Switch to `['@babel/preset-react', {runtime:'automatic'}]` (or SWC). |
| `key` spread from props object | none found | — |
| Rules-of-hooks violations (break under React Compiler or eslint-plugin-react-hooks 5, and crash if the condition flips) | **5** | `pages/search/index.jsx:118→120,123` (early `return <ErrorCard/>` **before** `useStore()` / `Header.useSearchBar()`. If the same mounted page goes from `queryError` to OK during client navigation you get "Rendered more hooks…"). `templates/search/results.jsx:30` (`useRouter()` inside `.map`; useContext so no crash, but a dev warning when the result count changes). `modules/dropdown/index.jsx:54-111` (`useEffect` inside `getLogoLink()`, called only when `checkBillingType` is truthy, so a crash if it flips). `pages/_app.jsx:93-98` (hook under `NODE_ENV` condition; constant per build). Design `src/modules/header/search-bar.jsx:115` (conditional `useOutsideClick`). |
| Side effects in render | **2** | `templates/data-provider/claim/claim-card.jsx:104-106` calls `getDataProviderAccounts()`, which **fires an HTTP request on every render, including SSR**, then calls a parent `setState`. `store/index.jsx:32-35` `useStore(initialState)` runs the MobX action `root.extend()` during render (see §2). |
| Hydration-mismatch sources rendered on the server | see table §1.1 | — |

### 1.1 Hydration risk (React 17 patches text silently; React 18/19 throw a recoverable error and **client-render the whole root**)

| # | Location | Why it can differ server ↔ client | Severity |
|---|---|---|---|
| H1 | `pages/_app.jsx:148-155` | In **dev**, `NextApp` returns `null` on the server, so the HTML is empty. React 17 logs a warning. React 18 `hydrateRoot` raises "Hydration failed…" on **every dev page load** (the Next dev overlay shows it). It also means **SSR is never exercised in dev**, so no hydration bug has ever been seen locally. | **High** (dev workflow + hidden prod bugs) |
| H2 | `templates/search/results.jsx:33-34` → `utils/helpers.js:27-40` `formatDate(new Date(publishedDate))`, `Intl.DateTimeFormat('en-GB')` in **local TZ** | The server pod (UTC) and a browser in UTC−x can render a different day for date-only or `Z` timestamps. Results are SSR-rendered on `/search` and `/data-providers/[id]`. | **High** on React 18 (full client re-render, CLS, console errors) |
| H3 | `templates/output/card-dropdown.jsx:77` same `formatDate` | Same TZ issue on output/works pages. | Medium |
| H4 | `templates/data-provider/index.jsx:24-27,186` `Intl.DisplayNames` | The Node ICU/CLDR version differs from the browser's, so the region name can differ. | Low |
| H5 | `pages/_app.jsx:101` `router.asPath.match(/search/)` → layout class | `asPath` can differ under the `/search` namespace rewrite (`useInterceptNextDataHref`, `next.config.js` rewrites). Verify in prod build. | Low–Med |
| H6 | `toLocaleString('en-GB')` (`pages/search/index.jsx:122`, `works/[id].jsx:127`, `outputs/[id].jsx:109`, `templates/search/index.jsx:75`) | Number formatting is stable across ICU. | Low |
| — | `Math.random` keys (`templates/search/pagination.jsx:77`) | Keys are not in the DOM. No mismatch, but the item remounts on every render. | Info |
| — | `featured-member.js:25,32` `Math.random` | Runs in gSSP only, and the result is passed via props. Safe. | — |
| — | `use-window-size.js` | The initial `{undefined}` matches on server and client first render. Safe. | — |

### 1.2 StrictMode (React 18 dev double-mount, React 19 double-render with memo reuse)

`reactStrictMode` is not set in `next.config.js` (off). The table shows what breaks if it is enabled (recommended, as in dashboard `src/main.tsx:51`).

| Location | Effect | Behaviour under double-mount |
|---|---|---|
| `modules/filters/index.jsx:17-24` | `filters.fetchFilters(initialQuery, sortType)` | **Two** aggregation requests. `@invalidatePreviousRequests` aborts a controller whose signal `fetchFilters` **ignores** (`store/filters.js:67`). The first response takes the `initialData === {}` branch and the second takes the **else/merge branch** (`store/filters.js:83-101`), so filter state differs from a single mount. This also exposes a real prod race when filters are toggled quickly. |
| `templates/output/similar-works.jsx:29-31` | `fetchSimilar` | Two requests. The signal is ignored and the last response wins. OK. |
| `hooks/use-debounced-effect.js:4-9` | `firstUpdate` ref survives the simulated unmount, so the 2nd mount takes the **debounced** branch | `use-sync-url-params-with-store` runs `setUrlParams` immediately and again 250 ms later (idempotent compare). `use-claim-controller.js:26-39` gets a second debounced run (no-op while `claim.query === ''`). |
| `hooks/use-analytics.js:18-39` | Init + `reportPageview` | Two pageviews in dev. `window.ga` is set to null and then re-set. OK. |
| `modules/map/map.jsx:32-64,66-79` | Leaflet create/remove | Cleanup removes the map and nulls the ref, then the effect re-creates it. OK **only if `locations.length>0`**: when it is empty, `mapRef.current.addLayer` → TypeError (bug exists today on mount). |
| Design `search-bar.jsx:28-54` `Header.useSearchBar` | CONFIGURE → DISABLE → CONFIGURE | Fine, plus a dev warning "Search bar is already configured". |
| `store/index.jsx:28-37` `useStore` render-time `extend` | — | Idempotent (`if (!this.dataProviders)`). React 19 reuses `useRef` across the double render. OK. |
| `claim-card.jsx:104` render-time fetch | — | 2× requests per render in dev. Concurrent re-renders also duplicate it in prod. |

### 1.3 Automatic batching (React 18)

MobX already batches inside actions, and mobx-react-lite 3 installs `unstable_batchedUpdates` as the reaction scheduler, so store-driven UI changes little. React-state updates in async callbacks (`use-copy-to-clipboard.js:6-9`, `citation.jsx:38-47`, `claim-card.jsx:29-45`, `dropdown/index.jsx:56-68`, `map.jsx:29` from a Leaflet native event) are single `setState` calls, so batching changes nothing visible. **No code reads the DOM synchronously between two setStates.** Low risk.

Note the `templates/data-providers/index.jsx:42-45,84-86` scroll restore: it stores `window.scrollY` in the click handler, the MobX write `params.size` follows, and a layout effect restores the scroll. Under mlr4 (useSyncExternalStore, sync lane) the layout effect still runs before paint. Cover it with an E2E "Load more keeps scroll position" test.

---

## 2. MobX architecture

### 2.1 Wiring (`store/index.jsx`)

| Line | What | Notes / risk |
|---|---|---|
| 6, 10 | `enableStaticRendering(isServer)` | Still exported in mlr 4 and 5. Keep it. |
| 12-21 | `initStore`: **new `RootStore` per call on server** and a **module singleton on client** | Server isolation is correct, because `_app` renders per request. The client singleton persists across all client navigations: `report`, `similarWorks`, `filters`, `search`, `claim` and `dataProviders` carry state between pages. |
| 23-26 | `StoreContext` default `{}` | Rendering a consumer outside the provider fails silently (destructuring `undefined` stores). |
| 28-38 | `useStore(initialState)` calls `storeContext.extend(initialState)` **during render**, guarded by a ref | (a) A state mutation in render: mlr4 plus useSyncExternalStore can warn "Cannot update a component while rendering a different component" if another observer already reads `root.dataProviders` (today only `pages/data-providers/index.jsx` reads it, so no warning). (b) `Root.extend` only acts once per client lifetime (`store/root.js:37-40`), so **a second client-side visit to `/data-providers?q=X` ignores the new `initialState.params`** and the old params win (see §3.3 bug U3). |
| 40-41 | `useInitStore` = `useMemo(() => initStore(init), [])` | React 19 StrictMode reuses the memo. OK. |
| 43-46 | `observe(C)` = `observer(C)` wrapped in an extra arrow component `(props) => <Obs {...props}/>` | Works in mlr4. Side effects: two fibers per component, the wrapper's displayName is lost, and refs can't be forwarded. Replace with plain `observer` during the upgrade, or leave as is. |
| `main/index.jsx:11,16` | Provider placed above `DesignProvider` and `Layout` | — |
| `pages/_app.jsx:108,118-137` | `statistics` comes from `getInitialProps` (**module-level `let statistics`**, overwritten per request with the same cached JSON) | No cross-user data, so no leakage. |

**No usage** of `useLocalObservable`, `useLocalStore`, `useObserver`, `<Observer>`, `observerBatching`, `mobx-react-lite/batching*`, `configure()`, `autorun`, `reaction`, `when`, `flow`, `runInAction`, `toJS` or `observable.ref` anywhere. **No reactions to dispose.** The mlr 3→4 API surface used is only `observer` + `enableStaticRendering`, so it is a drop-in. mlr ≥4.1.0 is needed for a React 19 peer. mlr 4 requires mobx ≥6.9 (installed: 6.13.7).

### 2.2 Store construction styles (three different ones, which matters for migration and toolchain)

| Store | File | Style | Decorators used |
|---|---|---|---|
| Root | `store/root.js:26-32` | `makeObservable(this,{…})` with an annotation map | — |
| Search | `store/search.js:36-52` | annotation map | `@invalidatePreviousRequests` (custom legacy decorator) `:118` |
| Filters | `store/filters.js:16-42` | **legacy MobX decorators** `@observable/@action/@computed` + `makeObservable(this, null)` | also `@invalidatePreviousRequests` `:66` |
| Claim | `store/claim.js:21-31` | annotation map | `@invalidatePreviousRequests` `:33` |
| Report | `store/report.js:28-39` | annotation map | `@invalidatePreviousRequests` `:52,67` |
| SimilarWorks | `store/similar-works.js:15-21` | annotation map | `@invalidatePreviousRequests` `:23` |
| DataProviders | `store/data-providers.js:32-38` | annotation map (`data` observable deep, `results` computed) | — |
| Params | `store/params.js:11-15` | `makeObservable` (action) + **`extendObservable(this, validatedParams)`** (dynamic keys from schema) | — |

**Toolchain risk:** `@babel/plugin-proposal-decorators {legacy:true}` (`babel.config.js:17-22`) is required by `store/filters.js` **and** by the custom `utils/invalidatePreviousRequests.js:1-14` (legacy `(target,key,descriptor)` signature). If the upgrade moves to Next's SWC compiler, or TS with 2022.3 (stage-3) decorators, **both break**. MobX 6.11+ supports stage-3 decorators, but `invalidatePreviousRequests` does not (it needs a rewrite to `(value, context)`), and `makeObservable(this, null)` with stage-3 decorators should become `accessor` fields. Recommendation: keep Babel during the React upgrade, or convert `filters.js` to an annotation map first (a mechanical change, covered by tests in §5).

### 2.3 Actions / async correctness (MobX default `enforceActions: "observed"` → console warnings today)

| Location | Issue |
|---|---|
| `store/claim.js:34-53` | `retrieve` is annotated `action`, but writes after `await` (`created`, `duplicated`, `error`, `isLoading`) run **outside an action**, so a MobX warning fires. **`duplicated` is not annotated observable** (`:21-31`). The UI only updates because `isLoading` flips in the same tick (`pages/data-providers/index.jsx:114` → `generate-form-message.jsx:51`). |
| `store/report.js:53-80` | `submit` and `fetchOutput` are **not actions at all**. They write after `await`. |
| `store/similar-works.js:24-45` | Writes after `await` are outside the action. `reset` is not annotated as an action. |
| `store/search.js:70-80,92-116` | `setActiveLimit`, `setActiveDownloadModal`, `setActiveSortOptionData` are not actions. |
| `store/search.js:9-18,82-90` | `setSortOptions` **mutates a module-level array** (`sortFilterValues`). MobX clones plain objects on assignment, so state isn't shared. Keep it in mind for zustand (do not reuse module objects). |
| `store/filters.js:65-108` | `@action async` only wraps the sync prefix. Inner calls are actions, so OK. |
| Direct writes from components (outside actions) | `pages/data-providers/index.jsx:54,60,66,72,78-79`, `templates/data-providers/hooks/use-claim-controller.js:43`, `templates/output/hooks/use-report-controller.js:9,13,21,25,29,37` |
| `templates/output/update/index.jsx:55-61` → `report.error` | Stores a **JSX element in a deep observable** (MobX clones the element into an observable object). It works today, but React 19 changed the element shape (`react.transitional.element`, non-enumerable dev fields). **Must be tested on 19.** Better: store a flag or string, not JSX. |

`utils/invalidatePreviousRequests.js` details:
- The `controller` lives in a **closure per decorated method, shared by all instances** (and by all SSR requests, though no decorated method runs on the server today).
- The signal is appended as the **last positional argument**. Only `Claim.retrieve` uses it. In `Filters.fetchFilters(query, sortType)`, any call with one argument puts the AbortSignal into `sortType`: `store/filters.js:342` `this.fetchFilters(query.replace(...))` → `fullQuery = "q?sort=[object AbortSignal]"`. This is a real bug that a characterisation test should pin.
- Because the other methods ignore the signal, "invalidate" is a no-op and **out-of-order responses can overwrite newer state**.

### 2.4 Missing `observer` (stale UI)

| Component | Reads observable | Effect |
|---|---|---|
| `templates/data-provider/index.jsx:40-202` (**not observer**) | `search.sortOptions` at `:128`, which is written in its own effect `:51-55` | The `Sort` dropdown on `/data-providers/[id]` gets the **stale (empty) array** and shows "Sort by" with a blank value and an empty menu, unless something else re-renders the parent. `setIsDataProviderHasAccounts(true)` from the render-time fetch masks the bug for member providers only. The effect also sets `search.works/query/sort` to `undefined` (`data.sort/results/query` don't exist on this page's data). |
| `templates/search/sort.jsx` (not observer) | receives `options` (observable array) | OK because the parent observer re-renders on array replacement and `FilterItem` (observer) reads `item.checked`. |
| `pages/search/index.jsx`, `pages/works/[id].jsx`, `pages/outputs/[id].jsx` (not observer) | `statistics` | Static, so OK. |
| `templates/data-providers/index.jsx:98` (`React.memo`, not observer) | `results` items (observable objects, static) | OK. |

All other consumers are wrapped in `observe()`. Under mlr4 a missing observer still yields stale UI, unchanged.

### 2.5 SSR / isolation summary

- MobX stores: per request on the server and a singleton on the client. **No cross-request leakage found.** No store state is serialised to the client. Every SSR-visible value comes from props (`data`), and store-driven UI is empty at hydration on both sides, so the store causes no hydration mismatch.
- **Migration warning:** the dashboard's pattern `export const useXStore = create(...)` (`dashboard/src/features/Doi/store/doiStore.ts:15`) is a **module singleton**. That is fine in a Vite SPA, but **on a Next SSR server it leaks state across users and requests**. The search app must use `createStore()` per request plus a React context provider (the official zustand Next.js pattern), or keep stores client-only and fetch with swr (`fallbackData` from gSSP props).

---

## 3. Full state model

### 3.1 Per-store detail

**Root** (`store/root.js`)
- Fields: `statistics` (obs deep, from `_app.getInitialProps`, shape `{totalArticlesCount, …}` or `{totalArticlesCount:'more than 356 million'}` as fallback), `dataProviders` (obs, `null` until `extend`), `claim` and `filters` (obs ref to class instances), `search`, `similarWorks`, `report` (plain fields).
- Action `extend({dataProviders})`: creates `DataProviders` **once**.

**Search** (`store/search.js`)
| Field | Default | Written by | Read by |
|---|---|---|---|
| `works` | `[]` | `setWorks` (`templates/search/index.jsx:48`, `templates/data-provider/index.jsx:53`) | nobody (dead state) |
| `query` | `null` | `setQuery` (same effects) | `downloadResults` body |
| `isLoading` | `false` | `downloadResults` | `templates/search/index.jsx:68`, `modals/download-results.jsx:71` |
| `dataProviders` | `[]` | never | `setWorks` (so `setWorkDataProviders` is dead code) |
| `sortOptions` | `[]` | `setSortOptions(value)`, which produces `[{value:'recent',checked},{value:'relevance',checked}]` | `templates/search/index.jsx:112-114`, `templates/data-provider/index.jsx:128` |
| `activeLimit` | `10` (reset → `1000`) | `setActiveLimit` (download modal Fieldset) | `downloadResults` |
| `activeDownloadModal` | `false` | `setActiveDownloadModal` (`templates/search/index.jsx:87`, `download-results.jsx:37,63`) | `templates/search/index.jsx:207` |

Side effects: `setActiveSortOption` → `Router.push('/search', {...Router.query, sort, page:1})`. `setActiveSortOptionData` → `delete Router.query.id` (**mutates the router object**) then push to `/data-providers/[id]` with `sort: value==='recent' ? 'relevance' : value` (**inverted mapping, pin it**). `downloadResults` → POST CSV + `js-file-download`. Note `download-results.jsx:36-37` calls `downloadResults()` and then `setActiveDownloadModal()` with **undefined**, which closes the modal before the download completes.

**Filters** (`store/filters.js`). The most complex store.
| Field | Default | Meaning |
|---|---|---|
| `data` | `[]` | `[{value:'fieldsOfStudy'|'yearPublished'|…, label:'field'|'year'|'type'|'author'|'language'|'publisher', items:[{value, count, checked, code?}]}]`, ordered as `aggregationsNames`, items sorted by count desc with `'unknown'` first |
| `initialData` | `{}` | First raw aggregation response for the current base query. Its emptiness decides the code path. |
| `activeFilter` | `{}` | The facet whose dropdown is open (an object **from `data`**) |
| `activeFilterSuggestions` | `[]` | Items shown in the open dropdown. **Aliased to `activeFilter.items` (same observable array) after `bar-item.jsx:20-21`**, and sorted in place. |
| `aggregationsNames` | 6 names | constant |
| `groupedYearDates` | `[]` | `[{yearFrom:2018|2016|2014, count, checked}]` sorted desc |
| `isLoading` | `false` | |
| `yearWorksCount` | `null` | count for the custom year range |
| `isVisibleClearButton` | `false` | |
| computed `maxYear` | — | **throws** if no `label==='year'` facet |
| computed `filterNamesWithoutYear` | — | |
| getter `filterNamesWithoutPublisher` | — | unused |

Actions and side effects:
- `fetchFilters(query, sortType)` POSTs aggregations (all names, or without year when the year facet is open). On first load it does `setInitialData` + `setData(transform(aggs))`. Otherwise it calls `checkYearPublishedStatis(transform(initialData, aggs))`, which keeps the previous year items if all new year counts are 0, then `setIsVisibleClearButton()`.
- `toggleCheckboxFilter(el, pathName)` flips `checked` **in place**, re-sorts, then `Router.push` with `q` ± ` AND key:"value"` (uses `el.code` for language) and `page:1`.
- `setActiveYearDate([from,to], pathName)` replaces any ` AND (year…)` with ` AND (yearPublished>=from AND yearPublished<=to)`.
- `reset(query, pathName)` resets fields, pushes `q = query.replace(/ .*/,'')` (**truncates at the first space**, e.g. "machine learning" → "machine") and refetches (passes the AbortSignal as `sortType`).
- `routeChanged()` clears `activeFilter`, `initialData`, `yearWorksCount`.
- **`pathName` is never passed** by callers (`modules/filters/index.jsx:27,60`, `use-year-filter-controller.js:45`), so `Router.push({pathname: undefined, …})` works only because Next resolves a relative `?q=` URL. **Verify after every Next bump.**
- `checked` is derived by **substring match of the item value inside the query string** (`utils/filters-transform.js:107-116`), so e.g. year "2010" is "checked" whenever "2010" appears anywhere in `q`.

**Claim** (`store/claim.js`): `query ''`, `request null` (unused), `created null`, `duplicated null` (**not observable**), `error null`, `isLoading false`. `retrieve()` POSTs `/data-providers {uri: query}` with the abort signal. 409 → `duplicated`, other errors → `error`. `reset({query})` clears and optionally sets `query=''`.

**Report** (`store/report.js`): `output {}`, `updateOption`, `role`, `isLoading`, `error`, and three modal flags. `fetchOutput(id)` stores metadata minus `fullText`, then `isModalReportTypeActive=true`. `submit(data)` mutates the **caller's object** (`data.updateOption`, `data.role`), POSTs, then `isModalReportSuccessActive=true`. Flow: Type modal → Form modal → Success modal (`templates/output/report/*`, `templates/output/update/index.jsx`).

**SimilarWorks** (`store/similar-works.js`): `similarOutputs null|[]`, `isLoading`, `error`. `fetchSimilar(id, params)` resets, fetches, and enriches each result with `transformDataProviders`. **Fetched only on mount** (`similar-works.jsx:29-31`, `[]` deps). On client navigation `/outputs/1 → /outputs/2` Next keeps the page instance, so **similar works stay those of output 1** (existing bug; a key on `articleId` fixes it).

**DataProviders** (`store/data-providers.js`): `data` (**deep observable of the whole formap JSON**: thousands of objects converted during render on the first visit, a perf hot-spot) and `params: Params(schema {q:'' string, size:10 number, action: 'ADD'|null})`. Computed `results = search(params.q)` does decodeURI, case-insensitive substring over name, normalizedName, urlHomepage, normalizedInstitutionName, aliases and rorId.

### 3.2 Store → consumer dependency table

| Store.field | Consumers (file:line) | Observer? |
|---|---|---|
| root.statistics | `pages/search/index.jsx:120`, `pages/works/[id].jsx:123`, `pages/outputs/[id].jsx:105`, `pages/data-providers/index.jsx:34,116` | only data-providers |
| root.dataProviders.{data,results,params.*} | `pages/data-providers/index.jsx:34-80` → props to `templates/data-providers/index.jsx` | yes (page) |
| search.isLoading / activeDownloadModal / sortOptions | `templates/search/index.jsx:68,112,207`; `templates/search/modals/download-results.jsx:71` | yes |
| search.sortOptions | `templates/data-provider/index.jsx:128` | **NO, stale bug** |
| search.set* actions | `templates/search/index.jsx:47-53,87`; `templates/data-provider/index.jsx:51-59`; `download-results.jsx:31-37,63` | — |
| filters.isLoading/initialData/data/isVisibleClearButton | `modules/filters/index.jsx:54-62` | yes |
| filters.activeFilterSuggestions | `modules/filters/bar-item.jsx:37`, `year/hooks/use-year-filter-controller.js:14,27`, `year/index.jsx:55` | yes |
| filters.activeFilter.items | `modules/filters/search.jsx:13` | yes |
| filters.groupedYearDates / yearWorksCount / maxYear | `modules/filters/year/index.jsx:27,40`, `use-year-filter-controller.js:41` | yes |
| filters.isLoading | `modules/filters/filter-item.jsx:31` (also used by **sort** dropdown items in `templates/search/sort.jsx:56`) | yes |
| claim.* | `templates/data-providers/hooks/use-claim-controller.js:12-44`, `pages/data-providers/index.jsx:66,110-115`, `templates/data-providers/utils/generate-form-message.jsx:13` | yes (via page) |
| report.* | `templates/output/hooks/use-report-controller.js` → `report-card.jsx`, `report-type-modal.jsx`, `report-form-modal.jsx`, `report-success-modal.jsx`, `templates/output/update/index.jsx` | yes |
| similarWorks.* | `templates/output/similar-works.jsx:25-31`, `templates/output/related-search.jsx:10-11` | yes |

Local React state that duplicates store/URL state, a likely source of desync:
- `modules/filters/index.jsx:14` (`query` base).
- `templates/search/pagination.jsx:11-15` (`currentPage` mirrors `urlPage`).
- `templates/search/sort.jsx:12,32-38` (`activeOption` mirrors `options`).
- `modules/filters/year/selects/index.jsx:9-27` (snapshots `years` once).
- `templates/data-provider/search.jsx:9-22` (skips the first `onChange`, "isInitialised" hack).

### 3.3 URL ⇄ state sync (the classic breakage point)

There are **four different URL strategies** in the app:

| Page | Source of truth | Mechanism |
|---|---|---|
| `/search` | **URL → gSSP → props** | Every change (query, sort, filter, year, page) is a full `Router.push` and **non-shallow**, so it re-runs gSSP. The store only holds UI state. `Header.useSearchBar.onQueryChanged` (`pages/search/index.jsx:125-134`) is captured **once at mount** (design hook `useEffect([])`), so `router.query` is the snapshot from mount: sort/t/other params from mount time are re-applied when the user searches again on the same mounted page. |
| `/data-providers` | **MobX `Params` ⇄ URL (shallow)** | `hooks/use-sync-url-params-with-store/index.js` (below) |
| `/data-providers/[id]` | URL → gSSP | `useSearch` (`pages/data-providers/[id].jsx:40-58`) pushes `q`, `offset=0`. Pagination uses `<Link>` (`templates/data-provider/pagination.jsx`). Sort goes via `search.setActiveSortOptionData`. |
| dead | — | `templates/data-provider/hooks/use-state-to-url-effect.js` is **unused** (it writes `action=add` lowercase, which the schema would reject). Delete. |

`useSyncUrlParamsWithStore(paramsInstance)` semantics:
1. **Store → URL** (`:71-79`, through `useDebouncedEffect`). Deps are the param **values** sorted by key (`[action, q, size]`). The first run is **immediate**; later runs are debounced by 250 ms. `setUrlParams` (`:8-45`) builds `URLSearchParams` from non-null params, sorts them, and compares with `window.location.pathname+search`. If they differ it calls `router.replace` when the current search is empty (first sync) and otherwise `router.push`, with `as = pathname?sorted`, `{shallow:true}`. `query: {...router.query, ...urlParams}`: **spreading a `URLSearchParams` yields `{}`** (no-op).
2. **URL → Store** (`:47-68`). On `routeChangeComplete` (subscribed once, `[]` deps) it parses the next URL and calls `changeParams` with keys whose value `!=` the store value (loose compare because URL values are strings).
3. Loop termination relies on (a) the string compare in step 1 and (b) the loose compare in step 2. One user change produces one push, one routeChangeComplete and one no-op. OK.

**Bugs or behaviours to pin before touching it:**
- **U1:** URL→store only applies keys **present** in the URL. Pressing Back to a URL **without** `q` leaves the old `q` in the store. Step 1 then pushes the old `q` again, so **the Back button is "eaten"**.
- **U2:** Unknown params (`utm_*`, `t`) are stripped from the URL by step 1, because `params` only contains schema keys.
- **U3:** The client singleton + `extend` once (§2.1) means a client navigation to `/data-providers?q=new` keeps the old params, and step 1 **rewrites the URL to the old query**.
- **U4:** Writers outside actions (`pages/data-providers/index.jsx:54,60,72,78-79`). The `useEffect([results])` at `:77-80` forces `action='ADD'` when there are no results, which writes back to the URL. Typing a query with no match therefore changes the URL to `…&action=ADD`. When results come back the effect restores **`initialAction` from the first render** (`useMemo([])`).
- **U5:** `params.size` "Load more" (`templates/data-providers/index.jsx:86`) goes `size+10` → URL push. The page doesn't re-run gSSP (shallow).
- Under React 18 the `routeChangeComplete` handler is a stale closure over `paramsInstance` (fine while the instance is stable). If the store is ever made per-page or per-render (zustand, swr), the handler must read **current** state, not a closure.
- Next ≥13 pages router: `router.events` and shallow routing still exist. The `as` argument is still supported. Re-test `replace` on the first visit (no search) vs `push`.

---

## 4. Custom hooks: semantics and edge cases

| Hook | File | Contract | Edge cases / upgrade notes | Test (renderHook) |
|---|---|---|---|---|
| `useDebouncedEffect(cb, deps=[], delay=250)` | `hooks/use-debounced-effect.js` | Runs `cb` **synchronously on the first effect**, then debounced (trailing) on each deps or delay change. The pending timer is cleared on change and on unmount. | `cb` is not in deps, but the effect re-creates with each deps change so the closure is fresh. StrictMode: the 2nd mount is debounced, not immediate. The cleanup of the first run returns a no-op. | Fake timers: mount → called 1×. Change deps twice within 250 ms → called once after 250 ms with the latest closure. Unmount before 250 ms → not called. StrictMode mount → 1 immediate + 1 delayed. |
| `useSyncUrlParamsWithStore(params)` | `hooks/use-sync-url-params-with-store/index.js` | §3.3 | §3.3 | Mock `next/router` (events emitter, replace, push) and set `window.location` (jsdom `history.replaceState`). Assert: first sync uses `replace` with sorted query and `shallow:true`. Store change → `push` after 250 ms. Identical URL → no call. `routeChangeComplete('/data-providers?q=x&size=20')` → `changeParams({q:'x', size:'20'})` → `size === 20` (number). Unknown key ignored. U1 characterisation. |
| `usePagination({totalCount,pageSize,siblingCount=2,currentPage})` | `hooks/use-pagination.js` | Returns page numbers with `'...'`, capped at 1000 pages, minimum 1 page | Returns **`undefined`** if no branch matches (unreachable for siblingCount ∈ {0,2}, reachable for others). `currentPage` > total gives odd ranges. Mixed numeric and string `currentPage` (`+currentPage` only on the right side). | Table tests: (0,10,2,1) → `[1]`. (95,10,2,1) → `[1,2,3,4,5,6,7,'...',10]`. Compute the remaining outputs **from the current implementation** and snapshot them for (total 10,100,1000,20000) × (page 1,4,5,50,996,1000) × (sibling 0,2). |
| `useWindowSize()` | `hooks/use-window-size.js` | `{width,height}` starts `undefined` (SSR-safe) and is set on mount and resize | No throttle. Listener removed on unmount. | jsdom resize event → updates. Initial render undefined. |
| `useCopyToClipboard(text, timeout=2500)` | `hooks/use-copy-to-clipboard.js` | `copy()` → `'copied'`/`'failed'`, reverts to `'inactive'` after the timeout | `navigator.clipboard` is undefined in insecure contexts and older browsers, giving a **sync TypeError** (not caught). A second copy within 2.5 s does **not** extend the timer (deps unchanged). | Mock clipboard resolve/reject. Fake timers. Double-copy timing pinned. |
| `useOutsideClick(ref, close)` | `hooks/use-outside-click.js` | `mousedown` on `document` outside `ref` → `close()` | Handler and `close` are **captured at mount** (`[]` deps), a stale closure. Callers pass stable setters (`sort.jsx:16`, `bar-item.jsx:25`, `loading-block.jsx:27`). React 17+ delegates events to the root, but this uses a native listener so it is unaffected. | Click inside → no call. Outside → call. Unmount → listener removed. |
| `useInput(element)` | `hooks/use-input.js` | `{value, element, reset, bind:{value,onChange}}`, initial `''` | Different signature from `templates/data-provider/hooks/use-input.js` `(initialValue, initialElem)`, which also has `focus()` touching `document.getElementById(el).firstChild`. | onChange updates. reset. |
| `useAnalytics()` | `hooks/use-analytics.js` | If the cookie allows: prod → `ReactGA.initialize`, dev → `window.ga` logger. Always calls `reportPageview(asPath)` on mount and on each `routeChangeComplete` | **`ReactGA.send` is called even when consent is not given** (before or without `initialize`). Check whether react-ga4 drops or queues it. Title uses `window.location.search`. The cookie change is not reactive (`[]` deps). Leftover `console.log("GA")` at `:22`. | Mock react-ga4 + `useCookie`. Assert init only with consent + prod. Pageview count on route events. |
| `useClaimController()` | `templates/data-providers/hooks/use-claim-controller.js` | Debounces 500 ms on `claim.query`, checks HTML validity, then `claim.retrieve()`. Seeds `claim.query` from `?dataProviderUrl=` | `useCallback` with empty deps captures `claim` (stable singleton). | With a store fixture plus a form ref. |
| `useReportController()` | `templates/output/hooks/use-report-controller.js` | Thin setters over `report` | `useCallback` **without deps array** (`:8,12,20,24,28`) is a no-op memo. | Covered by store tests. |
| `useYearFilterController()` / `useHistogram()` | `modules/filters/year/hooks/*` | Builds `yearsAxis` (1950..currentYear). Selection is normalised (ceil, from<to, swap) | `year/index.jsx:40` reads **`yearsAxis[0].y` and crashes when the axis is empty**. `MAX_YEAR` is evaluated at module load (stale on a long-running server or tab across New Year). | Pure-function tests of the `onHistogramChange` normalisation. |
| `useLoading()` (`pages/_app.jsx:47-68`) | — | Route start/complete/error toggles the loading bar | — | Router events. |
| design `Header.useSearchBar(config,{isHidden})` | design `src/modules/header/search-bar.jsx:14-67` | **Config captured once** at mount and disabled on unmount | Stale `onQueryChanged`/`getSuggestions`/`initQuery` on the same page instance. Updates to `initQuery` after mount are ignored, so after client navigation `/search?q=a` → `?q=b` the header input keeps its own state. | E2E. |

---

## 5. Painful parts, ranked by risk

| # | Risk | Trigger | How it shows up | Mitigation | Tests that must exist **before** the upgrade |
|---|---|---|---|---|---|
| **R1** | Dev "SSR disabled" hack | React 18 `hydrateRoot` + `pages/_app.jsx:148-155` | A "Hydration failed" overlay on every dev page. Real SSR hydration bugs remain invisible in dev. | Delete the hack in the same PR as React 18. Run all checks on `next build && next start`. | E2E smoke on a **prod build** that fails on any `console.error` containing "Hydration" / "did not match" / "Minified React error #418/#423/#425". |
| **R2** | Timezone-dependent dates in SSR'd lists | React 18+ strict hydration. `results.jsx:33-34`, `card-dropdown.jsx:77`, `utils/helpers.js:27-40` | Recoverable error and **whole-page client re-render** for users west of UTC (flash, lost scroll, double image loads, a Sentry flood if `onRecoverableError` is wired). | Format with `timeZone:'UTC'`, or format in gSSP and pass a string. | Unit test `formatDate` with `TZ=America/Los_Angeles` and `TZ=UTC` giving equal output for API samples. E2E with `page.emulateTimezone('America/Los_Angeles')` + console-error check on `/search`, `/data-providers/[id]`, `/outputs/[id]`, `/works/[id]`. |
| **R3** | `defaultProps` dropped on function components in React 19 (design `Histoslider`, `MathMarkdown`) | React 19 | Year-filter histogram renders with `height/sliderHeight/colors = undefined` (broken SVG, NaN attrs). Possible KaTeX option drift. | Pass explicit props from search (`modules/filters/year/index.jsx:43`), or vendor the component with default params (this matches the plan to deprecate design). | Component test: render `YearFilter` with fixture aggregations and assert SVG `height="200"`, bar count = years, no NaN attributes. Visual snapshot of the output title/abstract containing `$x^2$`. |
| **R4** | Render-phase side effects and non-idempotent effects under StrictMode / concurrent rendering | React 18 (concurrent features, StrictMode if enabled) | `claim-card.jsx:104` duplicate `/data-providers/{id}/account` calls on **every render** (plus SSR). `modules/filters/index.jsx:17-24` double `fetchFilters` takes the merge branch, giving **different facet state**. Out-of-order aggregation responses (signal ignored) overwrite newer state. | Move the accounts fetch into `useEffect([id])` (later swr). Make `fetchFilters` honour the AbortSignal and fix the positional signal bug (`store/filters.js:342`). | Store test: two overlapping `fetchFilters` (deferred promises resolved in reverse order) leave state = the **latest** query's. Component test under `<StrictMode>`: facet data after mount equals the non-StrictMode result. Request-count assertion (MSW) for `/account` = 1 per provider page. |
| **R5** | `/data-providers` URL⇄store sync on a client-singleton store | Any change to router events, StrictMode, mlr4 scheduling, or the later zustand rewrite | Back button eaten (U1). Stale query on re-visit (U3). `action=ADD` URL flapping (U4). Possible push loops if the compare ever stops matching (e.g. `size` string vs number). | Pin the current behaviour first, then decide which bugs to fix intentionally. | Hook tests (§4). E2E: type query, URL updates (shallow, no gSSP refetch). Back restores the previous query. Load more → `size=20` in URL and scroll preserved. Navigate away and back with a different `?q=`. No-results query → form shown + `action=ADD`. Assert **≤1 history entry per user change** (`history.length`). |
| R6 | Missing `observer` on `templates/data-provider/index.jsx` | Already broken. More visible with mlr4 (no accidental re-renders) | Empty or blank sort dropdown on `/data-providers/[id]` for non-member providers | Wrap in `observe` or pass `sortOptions` from an observer child. | Component test: after mount, the Sort label shows "relevance"/"recent" for a fixture whose accounts API returns `[]`. |
| R7 | Rules-of-hooks violations (`pages/search/index.jsx:118`, `modules/dropdown/index.jsx:54-111`, `results.jsx:30`) | eslint-plugin-react-hooks 5, React Compiler, or state flips | "Rendered more hooks than during the previous render" crash | Hoist hooks above early returns. Move the logo fetch into a top-level effect. | Component test: rerender `Search` page from `{queryError:{status:500}}` to `{data}` without crashing. Dropdown rerender toggling `checkBillingType`. |
| R8 | Legacy decorators (`store/filters.js`, `utils/invalidatePreviousRequests.js`) | Moving off Babel (SWC / Next ≥12 default compiler / TS stage-3 decorators) | Build error or, worse, silently non-observable fields (no re-render) | Keep `babel.config.js` during the React upgrade. Convert `Filters` to an annotation map and rewrite the invalidate helper as a plain function wrapper. | The Filters store unit tests in §5.1 pass identically before and after conversion. `isObservableProp(filters,'data')` etc. asserted for every field. |
| R9 | JSX element stored in a deep observable (`templates/output/update/index.jsx:55` → `report.error`) | React 19 element shape | Error message not rendered, or a dev error about element validation | Store a string/enum and render the JSX in the component. | Component test: invalid URL submit shows "Links starting with https://core.ac.uk/works…". |
| R10 | `observe()` wrapper and mlr4 `useSyncExternalStore` | mlr 3→4 | Low. Possible extra renders, and "Cannot update a component while rendering a different component" if render-time `extend` gains observers | Optionally replace `observe` with `observer`. Move `extend` out of render (do it in `initStore` or in a `useState` initializer). | Console-warning gate in component tests (fail on `console.error`). |
| R11 | Error boundary without fallback | React 19 error reporting changes | Blank page on any render error (today too). Duplicate Sentry reports if `onCaughtError` is also wired. | Add `getDerivedStateFromError` + a fallback. Choose one reporting path. | Component test: throwing child renders the fallback and calls Sentry once. |
| R12 | `similarWorks` fetched only on mount; client-store singletons carry state across pages | Unchanged by upgrade, but **will change behaviour in a zustand/swr rewrite** | Wrong similar works after output→output client navigation. Report modal state can persist. | Key the components by id, or use swr keyed by id. | E2E: navigate `/outputs/A` → `/outputs/B` (client) and assert similar works belong to B. Document current behaviour. |
| R13 | Leaflet map with empty `locations` | Already broken, more likely under StrictMode | TypeError at `map.jsx:53` | Guard. | Component test with data providers lacking coordinates. |
| R14 | JSX classic runtime | React 19 | Warning. `ref`-as-prop unavailable. | `runtime:'automatic'` | Build passes with no "outdated JSX transform" warning. |

### 5.1 Store unit tests (exact transitions to pin, Jest/Vitest + mocked `api/*` + mocked `next/router`)

**Params** (`store/params.js`) with the `data-providers` schema:
- `new Params({}, schema)` → `{q:'', size:10, action:null}`.
- `new Params({q:5, size:'20', action:'ADD', foo:1})` → `{q:'5', size:20, action:'ADD'}` and **no** `foo`.
- `{size:'abc'}` → `size:10`. `{action:'add'}` → `action:null` (case-sensitive).
- `changeParams({q:'x'})` keeps the other keys. `isObservableProp(p,'q') === true`. An autorun on `p.q` fires exactly once per change.

**DataProviders**: `results` with `params.q='open%20univ'` matches `name` "The Open University" case-insensitively. Also matches aliases, rorId, urlHomepage. Empty q → all. Computed caching: reading twice does not re-filter (spy).

**Search**:
- `setSortOptions('recent')` → `[{value:'recent',checked:true},{value:'relevance',checked:false}]`. `setSortOptions(undefined)` → both false.
- `setActiveSortOption({value:'recent'})` → `Router.push({pathname:'/search', query:{...q, sort:'recent', page:1}})`.
- `setActiveSortOptionData({value:'recent'}, '/data-providers/5')` → push with `sort:'relevance'` and **`id` deleted from `Router.query`**.
- `downloadResults()` → `isLoading` true→false, body `{q, accept:'text/csv', limit: activeLimit}`, then modal false. On reject, loading still false.
- `reset()` → `activeLimit 1000`.

**Filters** (fixture: aggregation JSON with all 6 keys):
- First `fetchFilters('cat','relevance')` → `initialData` = aggs. `data[*].value` order = `aggregationsNames`. Items sorted by count desc with `unknown` first. Language items get `code` + full name. Year values are ints. `groupedYearDates` has 3 entries sorted 2018, 2016, 2014 with summed counts. `isVisibleClearButton` false. `isLoading` false.
- Second fetch with `'cat AND documentType:"thesis"'` → else branch: counts merged from the new response (missing keys → 0), `checked` true for "thesis". If every new year count is 0, the previous year items are kept.
- `toggleCheckboxFilter({value:'thesis'})` with `Router.query.q='cat'` → push `q='cat AND documentType:"thesis"'`, `page:1`. Toggle again with q containing it → removed. Language uses `code`.
- `setActiveYearDate([2015,2020])` → `q` gets ` AND (yearPublished>=2015 AND yearPublished<=2020)` and replaces an existing year clause. `yearWorksCount` = sum of counts 2015..2020 unless a grouped preset matches.
- `reset('machine learning AND x')` → push `q='machine'` (**pin the truncation**). Second arg of the internal `fetchFilters` is an AbortSignal (pin the bug, or fix it with a test change noted in the changelog).
- `routeChanged()` → `activeFilter {}`, `initialData {}`, `yearWorksCount null`.
- `maxYear` throws when no year facet (pin).
- **Aliasing:** after `setActiveFilter(f); setActiveFilterSuggestions(f.items)`, toggling an item updates `data[i].items[j].checked` too.

**Claim**: `retrieve()` success → `created` set, `isLoading` false. 409 → `duplicated` = body. Else → `error`. `reset({query:true})` clears `query`. Abort of the previous request on a second call (signal aborted).

**Report**: `fetchOutput(id)` → `output` without `fullText`, `isModalReportTypeActive` true. Error → `error` message constant. `submit(data)` mutates `data.updateOption/role` and sets success true. `reset()` → all defaults.

**SimilarWorks**: `fetchSimilar` → `reset`, then loading, then outputs enriched with `dataProviders`. Error → `error:true`, `similarOutputs:null`.

**Root/initStore**: server branch (mock `typeof window`) returns a **new instance per call**. Client returns the singleton. `extend` is a one-shot.

### 5.2 Component tests (RTL, StrictMode on, fail on console.error/warn)
`SearchTemplate` (sort dropdown, download modal open/close, copy URL notification 2.5 s), `FiltersBar` (loading block → facets, open facet, search within facet, toggle → router push, clear all), `YearFilter` (histogram, presets, selects), `pages/data-providers` (query typing → URL, no-results → form, claim flow messages: normal/success/duplicate/error), report flow (type → form → success → close pushes when takedown on the same output), `Pagination` (page buttons, first/last labels, next/prev), `UpdateTemplate` (invalid/valid URL).

### 5.3 E2E (Playwright, **prod build**, both `TZ=UTC` and `America/Los_Angeles`, zero hydration errors)
1. `/search?q=cat` loads: count text, results, pagination, sort switch → URL `sort=recent&page=1`.
2. Add a facet, add a year range, Clear all → URL q assertions (current truncation behaviour).
3. Pagination to page 5 and Back.
4. `/data-providers` flows from R5.
5. `/data-providers/[id]`: search, sort, pagination links, claim card (non-member and member fixture).
6. `/outputs/[id]` and `/works/[id]`: similar works, related searches, cite modal, report flow, `?source=oai` modal.
7. Client navigation between two outputs (R12).
8. Header search from output → `/search?q=`.
9. Cookie consent → GA init only after consent (prod build).

---

## 6. Preparing for MobX → zustand + swr (what must be pinned now)

| MobX behaviour today | Why a rewrite will silently change it | Pin with |
|---|---|---|
| Per-request store on the server and a singleton on the client (`store/index.jsx:12-21`) | Dashboard-style `create()` is a **module singleton, which leaks across SSR requests** | Test: two concurrent SSR renders with different `initialState` don't share state. Use `createStore` + Context, or no store reads during SSR. |
| Deep observability: mutating `item.checked` in place re-renders `FilterItem` | zustand needs immutable updates. In-place mutation doesn't notify. | Filters aliasing test (§5.1) + FilterItem component test. |
| `activeFilterSuggestions` **aliases** `data[i].items` | An immutable copy breaks the "facet active" highlight (`bar-item.jsx:47-49`) | Assert the bar item gets the `barItemActive` class after a toggle (before the URL push resolves). |
| Computed `results` cached (`data-providers.js:27-29`) | A selector recomputed per render over thousands of rows is slow | Perf budget test or memoised selector (`useMemo` / `zustand/shallow`). |
| `Params` validation + defaults (`utils/validation.js`) | Must be kept as a pure function | Params tests (§5.1) re-run against the new store. |
| Fetch-in-store with `isLoading`/`error` flags (`similarWorks`, `report.fetchOutput`, `claim.retrieve`, `filters.fetchFilters`, `search.downloadResults`) | swr keys by URL+body. Dedupes, revalidates on focus (**must disable for POST/aggregation**), and keeps previous data | Tests on loading/error/empty state transitions **as rendered UI**, not store internals. Decide `revalidateOnFocus:false`, `keepPreviousData` for facets. |
| Last-response-wins races (signal ignored) | swr ignores stale responses by key, which is a behaviour change (improvement) | The race test (R4) should assert the **desired** behaviour (latest wins) so both implementations pass. |
| Store state survives client navigation (filters, report modals, similarWorks) | Context-per-page or swr cache keys change what persists | E2E navigation tests (§5.3 #6-7). Document expected persistence explicitly. |
| `Router.push` called **from stores** (`search.js:96,108`, `filters.js:177-193,237-246,334-341`) | Move it to components or hooks with `useRouter`. `pathName` is undefined today. | Router-mock assertions of exact push payloads (§5.1). |
| `claim.duplicated` non-observable but rendered | A rewrite will "fix" it, which is fine only if the message order is the same | Claim message component tests for all 4 variants. |
| `search.works`, `search.query`, `search.dataProviders`, `claim.request`, `filters.filterNamesWithoutPublisher`, `use-state-to-url-effect.js` | Dead state and code | Delete rather than port. |

---

## 7. Recommended order (from this audit's viewpoint)

1. Add the test harness (Jest/Vitest + RTL + MSW + Playwright). Write the §5.1 store tests and the §5.3 smoke E2E on the **current** stack and get them green (characterisation).
2. Fix the low-risk prerequisites behind tests:
   - remove the dev SSR hack (R1);
   - UTC date formatting (R2);
   - hooks-order violations (R7);
   - render-time fetch (R4);
   - `observer` on the data-provider template (R6);
   - error-boundary fallback (R11);
   - JSX automatic runtime (R14).
3. React 18 + mlr 4.x (keep MobX + Babel). Enable `reactStrictMode` in dev and fix any divergence (R4, R13).
4. React 19 + mlr ≥4.1. Pass explicit Histoslider props or vendor it (R3). Fix the JSX-in-observable (R9). Run the `react/19/migration-recipe` codemod (forwardRef → ref prop is optional).
5. Later: replace stores one by one with per-request zustand + swr, re-running the same tests (§6).
