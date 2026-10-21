// P0-15 route table: the pages the T-720 sweep loads. It is the T-601 table of 200 HTML answers (41 T-601 c1,
// c2, c4: gateway-faithful proxy, `/display/<id>/` through it; the local-only pages through the allow-all
// proxy, Q-005) plus the other page fixtures of 41 §2.6 that load cleanly, as the P0-09 and P0-12 tables list
// them today (e2e/lib/P0-09/routes.mjs, e2e/lib/P0-12/routes.mjs, 2026-10-20). Left out on purpose: the
// Q-074 blank pages, works 1004 (S-4 payload, T-602's sandboxed context), works 1007 / outputs 2006 (recommender
// 404) and every non-200 route. A client error on any of them reports to Sentry, whose test-DSN host the CSP
// blocks (Q-096): T-730 and the T-720 control own that violation, the sweep must stay at zero.
export const SEARCH_ID = 'fafad9968b7cd268c5fd64342bf88a26' // searchId of the recorded climate page 1

const r = (id, path, origin = 'gateway') => ({ id, path, origin })

// the T-601 table: every page that answers 200 (swept in both cookie states)
export const SWEEP_ROUTES = [
  r('search-climate', '/search/?q=climate'),
  r(
    'search-climate-p2-all-params',
    `/search/?q=climate&page=2&limit=10&sort=recent&t=${SEARCH_ID}`
  ),
  r('search-zzzzqqq', '/search/?q=zzzzqqq'),
  r('search-status500', '/search/?q=__status500'),
  r('works-1001', '/works/1001/'),
  r('works-1001-t', `/works/1001/?t=${SEARCH_ID}-1001`),
  r('works-4040', '/works/4040/'),
  r('works-5000', '/works/5000/'),
  r('outputs-2001', '/outputs/2001/'),
  r('outputs-2001-oai', '/outputs/2001/?source=oai'),
  r('outputs-4100', '/outputs/4100/'),
  r('outputs-4040', '/outputs/4040/'),
  r('outputs-5000', '/outputs/5000/'),
  r('display-2001', '/display/2001/'),
  r('display-2001-oai', '/display/2001/?source=oai'),
  r('outputs-update', '/outputs/update/'),
  r('data-providers', '/data-providers/'),
  r(
    'data-providers-add',
    '/data-providers/?q=aberystwyth&size=10&action=ADD&dataProviderUrl=https%3A%2F%2Fcreated.example.org%2F'
  ),
  r('provider-86', '/data-providers/86/'),
  r(
    'provider-86-query',
    `/data-providers/86/?q=&offset=0&limit=10&sort=recency&t=${SEARCH_ID}-86`
  ),
  r('static-search', '/static/search'),
  r('static-search-slash', '/static/search/'),
  r('search-x-page0', '/search/?q=x&page=0'),
  r('search-x-page-abc', '/search/?q=x&page=abc'),
  r('search-x-page1001', '/search/?q=x&page=1001'),
  r('works-1001-t-odd', '/works/1001/?t=a%26b%3Dc%20d'),
  r('works-1001-t-repeated', '/works/1001/?t=a&t=b'),
  r('local-index', '/', 'allow'),
  r('local-error-card', '/error-card/', 'allow'),
]

// the other page fixtures of 41 §2.6 that load cleanly (T-728 table): swept in the consented state
export const EXTRA_ROUTES = [
  r('search-x', '/search/?q=x'),
  r('works-1002', '/works/1002/'),
  r('works-1003', '/works/1003/'),
  r('works-1005', '/works/1005/'),
  r('outputs-2002', '/outputs/2002/'),
  r('outputs-2003', '/outputs/2003/'),
  r('outputs-2004', '/outputs/2004/'),
  r('outputs-2101', '/outputs/2101/'),
  r('data-providers-eylul', '/data-providers/?q=eylul'),
  r('data-providers-birkbeck', '/data-providers/?q=birkbeck'),
  r('provider-86-hk', '/data-providers/86/?t=q093-hk'),
  r('provider-4835', '/data-providers/4835/'),
  r('provider-8', '/data-providers/8/'),
  r('provider-3354', '/data-providers/3354/'),
]

export const urlOf = (p2Env, route) =>
  `${route.origin === 'allow' ? p2Env.allowURL : p2Env.baseURL}${route.path}`

// the one route whose hard load prints console errors today: page 2 of the climate search renders KaTeX-rejected
// math in two abstracts (the design MathMarkdown, `console.error("couldn`t convert string", s)`; T-741 pin
// katex-convert, Q-097); every other sweep route prints none
export const KATEX_ROUTE = 'search-climate-p2-all-params'
export const KATEX_ERROR = /^couldn`t convert string/
