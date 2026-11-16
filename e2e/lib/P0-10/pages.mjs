// P0-10 page catalogues (41 §2.6 fixtures; scenario ids in test/fixtures/scenarios.json) and the raw fetch
// through the gateway-faithful proxy.
const API = 'https://api.core.ac.uk/v3'

export const DEFAULT_TITLE =
  'CORE – Aggregating the world’s open access research papers'
export const NEXT_ERROR_TITLE = ': An unexpected error has occurred'

// T-602 (findings/07 §7.1 on works 1001-1005, outputs 2001-2004, O-yearstring, search, providers, errors).
// type: works | outputs (title + Meta), search, providers, default (main/head.jsx title, no app tags),
// next-error (Next's built-in _error page in the layout, Q-098), redirect.
export const T602_PAGES = [
  ...['1001', '1002', '1003', '1004', '1005'].map((id) => ({
    id: `works-${id}`,
    path: `/works/${id}/`,
    type: 'works',
    status: 200,
    api: `${API}/works/${id}?t=undefined`,
  })),
  {
    id: 'outputs-2001',
    path: '/outputs/2001/',
    type: 'outputs',
    status: 200,
    api: `${API}/outputs/2001`,
  },
  // the provider GET fails (E7 404): "Data provider has been disabled" (Error404, default title)
  { id: 'outputs-2002', path: '/outputs/2002/', type: 'default', status: 200 },
  {
    id: 'outputs-2003',
    path: '/outputs/2003/',
    type: 'outputs',
    status: 200,
    api: `${API}/outputs/2003`,
  },
  {
    id: 'outputs-2004',
    path: '/outputs/2004/',
    type: 'outputs',
    status: 200,
    api: `${API}/outputs/2004`,
  },
  {
    id: 'outputs-2101',
    path: '/outputs/2101/',
    type: 'outputs',
    status: 200,
    api: `${API}/outputs/2101`,
  },
  // outputs 2001 with five subjects / one subject (derived, test/fixtures/requests/P0-10.json): DC.subject tags
  {
    id: 'outputs-2105',
    path: '/outputs/2105/',
    type: 'outputs',
    status: 200,
    api: `${API}/outputs/2105`,
  },
  {
    id: 'outputs-2106',
    path: '/outputs/2106/',
    type: 'outputs',
    status: 200,
    api: `${API}/outputs/2106`,
  },
  {
    id: 'search-climate',
    path: '/search/?q=climate',
    type: 'search',
    status: 200,
  },
  // QueryError (0 results) renders no <Head> of its own
  {
    id: 'search-zzzzqqq',
    path: '/search/?q=zzzzqqq',
    type: 'default',
    status: 200,
  },
  {
    id: 'search-empty',
    path: '/search/',
    type: 'redirect',
    status: 308,
    location: '/',
  },
  { id: 'providers', path: '/data-providers/', type: 'providers', status: 200 },
  // the query is never shown in the title (Q-080)
  {
    id: 'providers-q-open',
    path: '/data-providers/?q=open',
    type: 'providers',
    status: 200,
  },
  {
    id: 'provider-86',
    path: '/data-providers/86/',
    type: 'default',
    status: 200,
  },
  {
    id: 'provider-999999999',
    path: '/data-providers/999999999/',
    type: 'default',
    status: 404,
  },
  {
    id: 'outputs-update',
    path: '/outputs/update/',
    type: 'default',
    status: 200,
  },
  // errors: soft 404 (Q-001), 410 variants and SSR 500 triggers (Q-001, Q-073, Q-098)
  { id: 'works-4040', path: '/works/4040/', type: 'default', status: 200 },
  { id: 'works-5000', path: '/works/5000/', type: 'default', status: 200 },
  { id: 'outputs-4100', path: '/outputs/4100/', type: 'default', status: 200 },
  { id: 'works-4100', path: '/works/4100/', type: 'next-error', status: 500 },
  { id: 'works-4101', path: '/works/4101/', type: 'next-error', status: 500 },
  { id: 'works-4102', path: '/works/4102/', type: 'next-error', status: 500 },
  {
    id: 'works-6948813',
    path: '/works/6948813/',
    type: 'next-error',
    status: 500,
  },
  { id: 'works-4200', path: '/works/4200/', type: 'next-error', status: 500 },
  {
    id: 'outputs-2102',
    path: '/outputs/2102/',
    type: 'next-error',
    status: 500,
  },
  {
    id: 'outputs-2103',
    path: '/outputs/2103/',
    type: 'next-error',
    status: 500,
  },
]

// citation_publication_date as formatCitationDate prints it (Q-053): month de-padded, day not; a bare year
// string gives `YYYY/NaN/undefined`; no publishedDate and no year: no tag
export const CITATION_DATE = {
  'works-1001': '2023/3/14',
  'works-1002': null,
  'works-1003': '2015/1/01',
  'works-1004': '2023/3/14',
  'works-1005': '2023/3/14',
  'outputs-2001': '2012/1/01',
  'outputs-2003': '2023/NaN/undefined',
  'outputs-2004': '2012/1/01',
  'outputs-2101': '2001/NaN/undefined',
  'outputs-2105': '2012/1/01',
  'outputs-2106': '2012/1/01',
}

export const FAVICONS = [
  ...['64', '128', '256', '512'].map((s) => ({
    tag: 'link',
    attrs: {
      href: `https://core.ac.uk/favicon/favicon-${s}px.png`,
      rel: 'icon',
      sizes: `${s}x${s}`,
      type: 'image/png',
    },
  })),
  {
    tag: 'link',
    attrs: {
      href: 'https://core.ac.uk/favicon/favicon.svg',
      rel: 'icon',
      sizes: 'any',
      type: 'image/svg+xml',
    },
  },
]
export const FRAME = [
  { tag: 'meta', attrs: { charset: 'utf-8' } },
  { tag: 'meta', attrs: { content: 'width=device-width', name: 'viewport' } },
]

// T-601 200-routes (findings/02 §4.1 and T-601 c1/c2/c4 on the 2.2 fixtures, plus the 41 §2.6 page fixtures) for
// the class census (T-605) and server output (T-610). via: gateway (baseURL) or allow (the allow-all proxy, for
// paths the gateway does not route, Q-005). hydrate: false = SSR view only: work 1004 runs page scripts from its
// payload (S-4, sandboxed context only); through the allow-all proxy the page's own assets (/static/search/_next)
// are not routed, so those pages never hydrate in the harness (prod: another service answers them, Q-005).
// gssp: the page of the _next/data JSON the client requests for it (T-610 c1), null without getServerSideProps.
export const T = 'fafad9968b7cd268c5fd64342bf88a26' // searchId of the recorded climate page 1
export const ROUTES_200 = [
  { id: 'search-climate', path: '/search/?q=climate', gssp: 'search' },
  // SSR view only: a result of page 2 holds a `\sb2` fragment KaTeX rejects, and the design MathMarkdown
  // (lib/elements/math-markdown/utils/latexify.js) logs console.error('couldn`t convert string', ...) for it in
  // the browser (and on the server, T-610 c3): an app console.error outside the empty allow-list fails the guard
  // (issue P0-10-4; positive console pins are T-741's)
  {
    id: 'search-climate-p2',
    path: `/search/?q=climate&page=2&limit=10&sort=recent&t=${T}`,
    gssp: 'search',
    hydrate: false,
  },
  { id: 'search-zzzzqqq', path: '/search/?q=zzzzqqq', gssp: 'search' },
  { id: 'search-status500', path: '/search/?q=__status500', gssp: 'search' },
  { id: 'search-x-page-abc', path: '/search/?q=x&page=abc', gssp: 'search' },
  ...['1001', '1002', '1003', '1005'].map((id) => ({
    id: `works-${id}`,
    path: `/works/${id}/`,
    gssp: `works/${id}`,
  })),
  {
    id: 'works-1004',
    path: '/works/1004/',
    gssp: 'works/1004',
    hydrate: false,
  },
  { id: 'works-4040', path: '/works/4040/', gssp: 'works/4040' },
  { id: 'works-5000', path: '/works/5000/', gssp: 'works/5000' },
  ...['2001', '2002', '2003', '2004', '2101', '2105', '2106', '4100'].map(
    (id) => ({
      id: `outputs-${id}`,
      path: `/outputs/${id}/`,
      gssp: `outputs/${id}`,
    })
  ),
  {
    id: 'outputs-2001-oai',
    path: '/outputs/2001/?source=oai',
    gssp: 'outputs/2001',
  },
  { id: 'display-2001', path: '/display/2001/', gssp: 'outputs/2001' },
  { id: 'outputs-update', path: '/outputs/update/', gssp: null },
  { id: 'providers', path: '/data-providers/', gssp: 'data-providers' },
  {
    id: 'providers-q-aberystwyth',
    path: '/data-providers/?q=aberystwyth',
    gssp: 'data-providers',
  },
  ...['86', '4835', '8', '3354'].map((id) => ({
    id: `provider-${id}`,
    path: `/data-providers/${id}/`,
    gssp: `data-providers/${id}`,
  })),
  { id: 'static-search', path: '/static/search/', gssp: null },
  { id: 'root', path: '/', via: 'allow', gssp: null, hydrate: false },
  {
    id: 'error-card',
    path: '/error-card/',
    via: 'allow',
    gssp: null,
    hydrate: false,
  },
]

// a provider page whose E13 outputs request fails (stub rule on a URL no other test sends): the error object
// is serialised into the props (`data.outputs.error`, T-504 c5), the place where a wrapper that leaked request
// headers or the in-cluster URL would show them (R-028)
export const E13_FAILURE = {
  id: 'provider-86-e13-500',
  path: '/data-providers/86/?q=p2t610',
  gssp: 'data-providers/86',
  rule: {
    method: 'GET',
    urlRegex:
      '^https://api\\.core\\.ac\\.uk/v3/data-providers/86/outputs\\?q=p2t610&',
    fail: {
      status: 500,
      body: '{"message":"Internal Server Error"}',
      contentType: 'application/json',
    },
  },
}

// every route of T-610 c2/c3/c4: the 200-routes plus the redirect, 404 and 500 answers (gssp: the _next/data
// JSON stays 200 where the direct URL is 500, Q-073)
export const ROUTES_ALL = [
  ...ROUTES_200,
  { id: 'search-empty', path: '/search/' },
  { id: 'provider-999999999', path: '/data-providers/999999999/' },
  { id: 'unknown-under-search', path: '/search/unknown/' },
  { id: 'works-4100', path: '/works/4100/', gssp: 'works/4100' },
  { id: 'works-4101', path: '/works/4101/', gssp: 'works/4101' },
  { id: 'works-4102', path: '/works/4102/', gssp: 'works/4102' },
  { id: 'works-4200', path: '/works/4200/', gssp: 'works/4200' },
  { id: 'works-6948813', path: '/works/6948813/', gssp: 'works/6948813' },
  { id: 'outputs-2102', path: '/outputs/2102/', gssp: 'outputs/2102' },
  { id: 'outputs-2103', path: '/outputs/2103/', gssp: 'outputs/2103' },
  {
    id: 'providers-q-100pct',
    path: '/data-providers/?q=100%25',
    gssp: 'data-providers',
  },
  E13_FAILURE,
]

// the _next/data URL the client router requests for a page (Next 10 getDataHref: /_next/data/<buildId>/<page>.json
// with the dynamic id and the page's query, behind the /search data rewrite of next.config.js; e.g. T-702 c9
// /search/_next/data/<buildId>/outputs/2004.json?id=2004)
export function dataPathOf(route, buildId) {
  const u = new URL(route.path, 'http://unused.host')
  const q = new URLSearchParams()
  const dyn = /^(works|outputs|data-providers)\/(.+)$/.exec(route.gssp)
  if (dyn) q.set('id', decodeURIComponent(dyn[2]))
  for (const [k, v] of u.searchParams) q.append(k, v)
  const search = q.toString()
  return `/static/search/_next/data/${buildId}/${route.gssp}.json${
    search ? `?${search}` : ''
  }`
}

export const urlOf = (env, route) =>
  `${route.via === 'allow' ? env.allowURL : env.baseURL}${route.path}`

// raw answer through the proxy: status, headers, the body bytes and their UTF-8 text; redirects not followed
export async function fetchRaw(request, url) {
  const res = await request.get(url, { maxRedirects: 0 })
  const body = await res.body()
  return {
    status: res.status(),
    headers: res.headers(),
    body,
    text: body.toString('utf8'),
  }
}

// the recorded API object a page renders (resolver answer, links rewritten as served)
export function apiObject(resolver, url) {
  const r = resolver.resolve('GET', url)
  if (r.unmatched || r.status !== 200)
    throw new Error(`no 200 fixture for GET ${url}`)
  return JSON.parse(r.body.toString('utf8'))
}

// React 17 server text escaping (escapeTextForBrowser): " & ' < >
export const escapeText = (s) =>
  String(s).replace(
    /["&'<>]/g,
    (c) =>
      ({
        '"': '&quot;',
        '&': '&amp;',
        "'": '&#x27;',
        '<': '&lt;',
        '>': '&gt;',
      })[c]
  )

// the raw bytes between the first <title> (attributes allowed: Next 15 adds data-next-head) and its </title> in
// the HTTP body (null without a title)
export function rawTitleBytes(body) {
  const re = /<title(?: [^>]*)?>/.exec(body.toString('latin1'))
  if (!re) return null
  const open = re.index + re[0].length
  const close = body.indexOf(Buffer.from('</title>'), open)
  return body.subarray(open, close)
}
