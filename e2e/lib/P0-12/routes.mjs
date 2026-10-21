// P0-12 route tables. `T601_200` = the T-601 routes that answer 200 with an HTML page (41 T-601 c1, c2, c4:
// gateway-faithful proxy, `/display/<id>/` through it; the local-only pages through the allow-all proxy,
// Q-005), as listed by the T-601 table of today (e2e/lib/P0-09/routes.mjs, 2026-10-20; issue P0-12-3).
// `fixture` names the recorded scenario that answers the page's SSR calls (test/fixtures/scenarios.json;
// `req-P0-09` = test/fixtures/requests/P0-09.json; `-` = no upstream call or only the members/provider map
// loaders), the `fixture` member of the 55 C7 (1) tuple.
// `T728_EXTRA` = the other page fixtures of 41 §2.6 that load cleanly (routes x fixtures, 41 T-728 c3), plus
// the Q-093 provider page (test/fixtures/requests/P0-12.json). Left out on purpose: works 1004 (S-4 payload,
// opened only in T-602's sandboxed context), works 1007 / outputs 2006 (recommender 404, V12, P0-18), the
// Q-074 blank pages (T-730) and every non-200 route.
export const SEARCH_ID = 'fafad9968b7cd268c5fd64342bf88a26' // searchId of the recorded climate page 1

const r = (id, path, fixture, origin = 'gateway') => ({
  id,
  path,
  fixture,
  origin,
})

export const T601_200 = [
  r('search-climate', '/search/?q=climate', 'search-climate'),
  r(
    'search-climate-p2-all-params',
    `/search/?q=climate&page=2&limit=10&sort=recent&t=${SEARCH_ID}`,
    'req-P0-09'
  ),
  r('search-zzzzqqq', '/search/?q=zzzzqqq', 'search-zzzzqqq'),
  r('search-status500', '/search/?q=__status500', 'magic:__status500'),
  r('works-1001', '/works/1001/', 'works-1001'),
  r('works-1001-t', `/works/1001/?t=${SEARCH_ID}-1001`, 'req-P0-09'),
  r('works-4040', '/works/4040/', 'works-4040'),
  r('works-5000', '/works/5000/', 'works-5000'),
  r('outputs-2001', '/outputs/2001/', 'outputs-2001'),
  r('outputs-2001-oai', '/outputs/2001/?source=oai', 'outputs-2001'),
  r('outputs-2001-search', '/outputs/2001/?search=q%3Dclimate', 'outputs-2001'),
  r('outputs-4100', '/outputs/4100/', 'outputs-4100'),
  r('outputs-4040', '/outputs/4040/', 'outputs-4040'),
  r('outputs-5000', '/outputs/5000/', 'outputs-5000'),
  r('display-2001', '/display/2001/', 'outputs-2001'),
  r('display-2001-oai', '/display/2001/?source=oai', 'outputs-2001'),
  r('outputs-update', '/outputs/update/', '-'),
  r('data-providers', '/data-providers/', '-'),
  r(
    'data-providers-add',
    '/data-providers/?q=aberystwyth&size=10&action=ADD&dataProviderUrl=https%3A%2F%2Fcreated.example.org%2F',
    '-'
  ),
  r('provider-86', '/data-providers/86/', 'provider-86'),
  r(
    'provider-86-query',
    `/data-providers/86/?q=&offset=0&limit=10&sort=recency&t=${SEARCH_ID}-86`,
    'req-P0-09'
  ),
  r('static-search', '/static/search', '-'),
  r('static-search-slash', '/static/search/', '-'),
  r('search-x-page0', '/search/?q=x&page=0', 'search-x-page0'),
  r('search-x-page-abc', '/search/?q=x&page=abc', 'members'),
  r('search-x-page1001', '/search/?q=x&page=1001', 'members'),
  r('works-1001-t-odd', '/works/1001/?t=a%26b%3Dc%20d', 'req-P0-09'),
  r('works-1001-t-repeated', '/works/1001/?t=a&t=b', '-'),
  r('local-index', '/', '-', 'allow'),
  r('local-error-card', '/error-card/', '-', 'allow'),
]

export const T728_EXTRA = [
  r('search-x', '/search/?q=x', 'search-x'),
  r('works-1002', '/works/1002/', 'works-1002'),
  r('works-1003', '/works/1003/', 'works-1003'),
  r('works-1005', '/works/1005/', 'works-1005'),
  r('outputs-2002', '/outputs/2002/', 'outputs-2002'),
  r('outputs-2003', '/outputs/2003/', 'outputs-2003'),
  r('outputs-2004', '/outputs/2004/', 'outputs-2004'),
  r('outputs-2101', '/outputs/2101/', 'outputs-2101'),
  r('provider-4835', '/data-providers/4835/', 'provider-4835'),
  r('provider-8', '/data-providers/8/', 'provider-8'),
  r('provider-3354', '/data-providers/3354/', 'provider-3354'),
  r('data-providers-eylul', '/data-providers/?q=eylul', '-'),
  r('data-providers-birkbeck', '/data-providers/?q=birkbeck', '-'),
  r('provider-86-hk', '/data-providers/86/?t=q093-hk', 'req-P0-12'),
]

export const T728_ROUTES = [...T601_200, ...T728_EXTRA]

export const routeById = (id) => {
  const hit = T728_ROUTES.find((x) => x.id === id)
  if (!hit) throw new Error(`unknown P0-12 route ${id}`)
  return hit
}

// T-741: one client route change per route. /outputs/update/ (no gSSP: the client App.getInitialProps, Q-011)
// is reached from every T-601 page without a hooks-order crash; from itself the change goes to provider 86.
// The crashing pairs (works/outputs -> search: React #300; search or the directory -> outputs: #310; Q-047,
// R-033) are T-716's (41).
export const changeTargetOf = (route) =>
  route.path === '/outputs/update/' ? '/data-providers/86/' : '/outputs/update/'

// T-730: the Q-074 blank-page fixtures (41 §2.6; scenarios q074a-e)
export const Q074 = [
  {
    id: 'q074a',
    clause: 'Q-074 c1 (a)',
    path: '/works/7401/',
    fixture: 'q074a',
    what: 'output with doi null',
    ssrMarker: 'Mandatory due diligence laws and climate change litigation',
    signature:
      "TypeError: Cannot read properties of null (reading 'toLowerCase')",
  },
  {
    id: 'q074b',
    clause: 'Q-074 c2 (b)',
    path: '/works/7402/',
    fixture: 'q074b',
    what: 'work DOI + 4 distinct output DOIs (React #310)',
    ssrMarker: 'Mandatory due diligence laws and climate change litigation',
    signature:
      'Error: Minified React error #310; visit https://reactjs.org/docs/error-decoder.html?invariant=310 for the full message or use the non-minified dev environment for full errors and additional helpful warnings.',
  },
  {
    id: 'q074c',
    clause: 'Q-074 c3 (c), Q-058 c2',
    path: '/outputs/7403/',
    fixture: 'q074c',
    what: 'provider without location (Invalid LatLng)',
    ssrMarker:
      'Novel approach for deriving genome wide SNP analysis data from archived blood spots',
    signature: 'Error: Invalid LatLng object: (undefined, undefined)',
  },
  {
    id: 'q074d',
    clause: 'Q-074 c4 (d), Q-064',
    path: '/works/7404/',
    fixture: 'q074d',
    what: 'similar result with dataProviders []',
    ssrMarker: 'Mandatory due diligence laws and climate change litigation',
    signature: "TypeError: Cannot read properties of undefined (reading 'id')",
  },
  {
    id: 'q074e',
    clause: 'Q-074 c5 (e)',
    path: '/search/?q=q074e',
    fixture: 'q074e',
    what: 'year facet opened on an empty year aggregation',
    ssrMarker: 'research outputs found',
    openYearFacet: true,
    signature: "TypeError: Cannot read properties of undefined (reading 'y')",
  },
]
