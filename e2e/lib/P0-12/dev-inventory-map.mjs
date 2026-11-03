// T-728 c4: the map from React 17 development warnings to Q rows of 30 (40 §4 item 1). A rule matches on the
// warning kind (`hydration` = the react-dom hydration family, `react` = other React development warnings,
// `mobx` = MobX development checks, `console` = other console warnings and errors the app, a library, Next's
// development overlay or the browser print, `pageerror` = an uncaught page error of the load), its first line,
// the component names of its stack, the resource path of a browser "Failed to load resource" line and the
// route of the load; the first matching rule wins. A warning no rule covers fails T-728 c4 until a rule names
// its Q row, or the open issue (P0-12-<n>) that asks the lead for a new row (30 is never edited here, 01 §9).
// `devOnly` marks messages that the production build cannot print (guarded by NODE_ENV or printed by Next's
// development server); `emptySsr` marks the page errors with which the development server answers an empty
// #__next (the load is then accepted without SSR markup).
export const DEV_WARNING_MAP = [
  // ---------- hydration family (what React 17 production repairs silently, or leaves as the server wrote it) ----------
  {
    id: 'q051-consent-popup',
    q: 'Q-051',
    match: {
      kind: 'hydration',
      text: /^Warning: Expected server HTML to contain a matching <div> in <div>\./,
      component: /^div < CookiesPopup < Cookies\b/,
    },
  },
  {
    // templates/search/results.jsx:33-37, templates/output/card-dropdown.jsx:75-77 (the sites Q-050 lists)
    id: 'q050-dates',
    q: 'Q-050',
    match: {
      kind: 'hydration',
      text: /^Warning: Text content did not match\. Server: "\d\d\/\d\d\/\d{4}" Client: "\d\d\/\d\d\/\d{4}"/,
    },
  },
  {
    // templates/output/metadata.jsx:37 (long date format of the works/outputs metadata): the third site of Q-050
    id: 'q050-dates-metadata',
    q: 'Q-050',
    match: {
      kind: 'hydration',
      text: /^Warning: Text content did not match\. Server: "\d{1,2} [A-Z][a-z]+ \d{4}" Client: "\d{1,2} [A-Z][a-z]+ \d{4}"/,
      component:
        /^dd < div < MetaDataListItem < dl < MetadataList < Metadata\b/,
    },
  },
  {
    id: 'q093-region-name',
    q: 'Q-093',
    match: {
      kind: 'hydration',
      text: /^Warning: Text content did not match\. Server: "(Hong Kong SAR China|Macao SAR China|Falkland Islands|Palestinian Territories)"/,
      component: /^figcaption < figure < Card < MapCard\b/,
    },
  },
  {
    id: 'q075-display-breadcrumb-href',
    q: 'Q-075',
    match: {
      kind: 'hydration',
      text: /^Warning: Prop `href` did not match\. Server: "https:\/\/core\.ac\.uk\/search\/\?/,
      route: /^display-/,
    },
  },
  {
    id: 'q075-display-breadcrumb-tail',
    q: 'Q-075',
    match: {
      kind: 'hydration',
      text: /^Warning: Did not expect server HTML to contain a <(span|a)> in <div>\./,
      route: /^display-/,
    },
  },
  {
    // the HTML parser closes the outer <a> of the FullTextThumbnail card at the first inner <a> and hoists what
    // follows, so the client tree expects children the parsed server DOM lacks (React 17 inserts them)
    id: 'q072-hoisted-card-content',
    q: 'Q-072',
    match: {
      kind: 'hydration',
      text: /^Warning: Expected server HTML to contain a matching <(a|div)> in <(a|span)>\./,
      component: /\b(FullTextThumbnail|CardDropdown)\b/,
    },
  },
  {
    // pages/_app.jsx:101 isSearchPage from router.asPath: on the gateway's /static/search rewrite the server sees
    // `/` and the browser `/static/search`; React 17 keeps the server's class attribute (Q-008 c2)
    id: 'q008-search-header-class',
    q: 'Q-008',
    match: {
      kind: 'hydration',
      text: /^Warning: Prop `className` did not match\. Server: "styles-container-\w+ styles-container-\w+" Client: "styles-container-\w+ styles-container-\w+ styles_header__\w+"/,
      component: /^header < AppBar < Header < SearchAppBar\b/,
      route: /^static-search/,
    },
  },
  // ---------- other development warnings ----------
  {
    id: 'q072-nested-anchor',
    q: 'Q-072',
    match: {
      kind: 'react',
      text: /^Warning: validateDOMNesting\(\.\.\.\): <a> cannot appear as a descendant of <a>\./,
    },
  },
  {
    id: 'unknown-dom-prop-fulltext-thumbnail',
    q: 'Q-102',
    devOnly: true,
    match: {
      kind: 'react',
      text: /^Warning: React does not recognize the `memberType` prop on a DOM element\./,
      component: /FullTextThumbnail/,
    },
  },
  {
    id: 'mobx-strict-mode',
    q: 'Q-103',
    devOnly: true,
    match: {
      kind: 'mobx',
      text: /^\[MobX\] Since strict-mode is enabled, changing \(observed\) observable values without using an action is not allowed\./,
    },
  },
  {
    // utils/helpers.js:27-40 formatDate logs its catch outside production (publishedDate null, works 1002)
    id: 'q029-format-date-log',
    q: 'Q-029',
    devOnly: true,
    match: {
      kind: 'console',
      text: /^Date in invalid format null TypeError: Cannot read properties of null \(reading 'toString'\)$/,
      component: /^formatDate < Metadata\b/,
    },
  },
  // ---------- repeated `t` (Q-016): Next's development props check rejects serverError.code undefined ----------
  // pages/works/[id].jsx:85-97 returns { serverError: { code: error.status } } with status undefined; production
  // JSON drops the key (200 soft 404), next dev throws "Error serializing" and shows its error overlay
  // (Q-016 c3): the overlay's stack-frame requests 404 through the gateway proxy, its focus trap probes
  // an <object> (CSP object-src 'none'), and the ErrorBoundary's Sentry report is blocked by the CSP (Q-096)
  {
    id: 'q016-dev-props-serialization',
    q: 'Q-016',
    devOnly: true,
    emptySsr: true,
    match: {
      kind: 'pageerror',
      text: /^Error serializing `\.serverError\.code` returned from `getServerSideProps` in "\/works\/\[id\]"\./,
      route: /^works-1001-t-repeated$/,
    },
  },
  {
    id: 'q016-dev-overlay-stack-frames',
    q: 'Q-016',
    devOnly: true,
    match: {
      kind: 'console',
      text: /^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/,
      resource: /^\/__nextjs_original-stack-frame$/,
      route: /^works-1001-t-repeated$/,
    },
  },
  {
    id: 'q016-dev-overlay-focus-probe',
    q: 'Q-016',
    devOnly: true,
    match: {
      kind: 'console',
      text: /^Loading plugin data from 'data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+' violates the following Content Security Policy directive: "object-src 'none'"\. The action has been blocked\.$/,
      route: /^works-1001-t-repeated$/,
    },
  },
  {
    id: 'q096-sentry-csp-dev-error',
    q: 'Q-096',
    // the envelope endpoint of Sentry 7 (AD-027; Sentry 5.30: .../api/0/store/?sentry_key=public&sentry_version=7)
    match: {
      kind: 'console',
      text: /^(Connecting to 'https:\/\/o0\.ingest\.sentry\.io\/api\/0\/envelope\/\?sentry_key=public&sentry_version=7&sentry_client=sentry\.javascript\.browser%2F7\.120\.4' violates the following Content Security Policy directive|Fetch API cannot load https:\/\/o0\.ingest\.sentry\.io\/api\/0\/envelope\/\?sentry_key=public&sentry_version=7&sentry_client=sentry\.javascript\.browser%2F7\.120\.4\. Refused to connect because it violates the document's Content Security Policy\.$)/,
      route: /^works-1001-t-repeated$/,
    },
  },
  // ---------- Next 12's development client ----------
  {
    // from Next 12 the development client opens its HMR connection as a WebSocket under the asset prefix
    // (`/static/search/_next/webpack-hmr`); the stack's proxies (the gateway-faithful one and the allow-all
    // listener) forward no WebSocket upgrade, so next dev answers a plain GET with its trailing-slash 308 and
    // Chromium prints the failed handshake on every load. The port is the listener of the stack's slot.
    // next dev only (owner decision of 2026-10-29, W4c; Next 10 used an EventSource and printed nothing)
    id: 'next12-dev-hmr-websocket',
    issue: 'P0-12-10',
    devOnly: true,
    match: {
      kind: 'console',
      text: /^WebSocket connection to 'ws:\/\/127\.0\.0\.1:\d+\/static\/search\/_next\/webpack-hmr' failed: Error during WebSocket handshake: Unexpected response code: 308$/,
    },
  },
  // ---------- printed in every mode (pinned in production by T-741) ----------
  {
    id: 'q071-ga-search',
    q: 'Q-071',
    match: { kind: 'console', text: /^Send command doesn't exist: search$/ },
  },
  {
    id: 'q009-logrocket-blocked',
    q: 'Q-009',
    match: {
      kind: 'console',
      text: /^LogRocket: script could not load\. Check that you have a valid network connection\.$/,
    },
  },
  {
    // React 18.3 development warns once per component type that sets defaultProps on a function component;
    // the T-728 sweep renders design MathMarkdown only (vendor/oacore-design/lib/elements/math-markdown/
    // math-markdown.js:44). Development only: production prints nothing. Histoslider and any other component
    // are not matched, so their warning still fails T-728 c4 (owner, 2026-11-03, jump 3 batch W6a)
    id: 'q104-design-defaultprops',
    q: 'Q-104',
    devOnly: true,
    match: {
      kind: 'react',
      text: /^Warning: MathMarkdown: Support for defaultProps will be removed from function components in a future major release\. Use JavaScript default parameters instead\./,
    },
  },
  {
    id: 'q097-katex',
    q: 'Q-101',
    match: { kind: 'console', text: /^couldn`t convert string / },
  },
]
