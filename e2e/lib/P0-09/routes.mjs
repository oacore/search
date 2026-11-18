// P0-09 route tables (T-601, T-731) and the HTTP probe. Every expected value is today's behaviour of the
// unchanged app through the gateway-faithful proxy (findings/02 §4.1, corrected by review:ui-flows §1 and the
// quirks Q-001, Q-002, Q-005, Q-013, Q-016, Q-028, Q-035, Q-073, Q-098). `marker` is a substring the body
// must contain (the page actually rendered), matched on the body without React 17's `<!-- -->` text-node
// separators; `title` is the raw first <title> text of an HTML answer.

export const DEFAULT_TITLE =
  'CORE – Aggregating the world’s open access research papers'
export const ERROR_TITLE = ': An unexpected error has occurred'
export const T = 'fafad9968b7cd268c5fd64342bf88a26' // searchId of the recorded climate page 1
export const WORK_1001_TITLE =
  'Mandatory due diligence laws and climate change litigation: Bridging the corporate climate accountability gap? - CORE'
export const OUTPUT_2001_TITLE =
  'Novel approach for deriving genome wide SNP analysis data from archived blood spots - CORE'

export const M = {
  results: '1,956,781 research outputs found',
  queryError: 'Sorry, we couldn’t find any results for',
  errorCard: 'This page is not available now',
  uhoh: 'The page you were looking for could not be found',
  error500: 'An unexpected error has occurred.',
  other: 'other service',
  citation: 'name="citation_title"',
  takedown: 'Article Takedown Request',
  // the <title> tag carries data-next-head from Next 15: match from its >
  providers: '>Data providers search</title>',
  addForm: 'Suggest a new data provider',
  provider86: 'Open Research Online (The Open University)',
  footer: 'CORE (COnnecting REpositories) is a not-for-profit service',
  svg: '<svg',
  nextData: '"__N_SSP":true',
  healthz: '{"status":"ok"}',
}

const redirect = (path, location, note) => ({
  path,
  status: 308,
  location,
  title: null,
  marker: null,
  note,
})
const page = (path, status, title, marker, note) => ({
  path,
  status,
  location: null,
  title,
  marker,
  note,
})
const other = (path, note) => ({
  path,
  status: 404,
  location: null,
  title: null,
  marker: M.other,
  note,
})

// T-601 c1: findings/02 §4.1 URLs with and without the trailing slash, with their query parameters
export const C1_ROWS = [
  // /search
  redirect('/search', '/search/', 'trailingSlash 308 (R-020)'),
  redirect('/search/', '/', 'empty /search/ redirects permanently (Q-002)'),
  redirect(
    '/search?q=climate',
    '/search/?q=climate',
    'trailingSlash keeps the query'
  ),
  page('/search/?q=climate', 200, 'Search CORE', M.results, 'SSR results'),
  redirect(
    `/search?q=climate&page=2&limit=10&sort=recent&t=${T}`,
    `/search/?q=climate&page=2&limit=10&sort=recent&t=${T}`,
    'all §4.1 query parameters'
  ),
  page(
    `/search/?q=climate&page=2&limit=10&sort=recent&t=${T}`,
    200,
    'Search CORE',
    M.results,
    'page, limit (kept as the query string), sort recent -> recency, t (Q-013)'
  ),
  page(
    '/search/?q=zzzzqqq',
    200,
    DEFAULT_TITLE,
    M.queryError,
    'empty -> 200 QueryError'
  ),
  page(
    '/search/?q=__status500',
    200,
    DEFAULT_TITLE,
    M.errorCard,
    'upstream error -> 200 ErrorCard'
  ),
  page(
    '/search/foo/',
    404,
    DEFAULT_TITLE,
    M.uhoh,
    'unknown path under a routed prefix (Q-005)'
  ),
  // /works/:id
  redirect('/works/1001', '/works/1001/', 'trailingSlash'),
  page('/works/1001/', 200, WORK_1001_TITLE, M.citation, 'citation_* meta'),
  redirect(
    `/works/1001?t=${T}-1001`,
    `/works/1001/?t=${T}-1001`,
    'trailingSlash keeps t'
  ),
  page(
    `/works/1001/?t=${T}-1001`,
    200,
    WORK_1001_TITLE,
    M.citation,
    't of the result links'
  ),
  page(
    '/works/4040/',
    200,
    DEFAULT_TITLE,
    M.uhoh,
    'API 404 -> soft 404 (Q-001)'
  ),
  page(
    '/works/4100/',
    200,
    DEFAULT_TITLE,
    'The work with ID 4100 has been disabled',
    'works 410 = string, 200 (Q-001; owner fix 978c6e4, was React #31 -> 500)'
  ),
  page(
    '/works/5000/',
    200,
    DEFAULT_TITLE,
    M.uhoh,
    'API 500 -> soft 404 (Q-001)'
  ),
  page('/works/', 404, DEFAULT_TITLE, M.uhoh, 'prefix without id (Q-005)'),
  // /outputs/:id
  redirect('/outputs/2001', '/outputs/2001/', 'trailingSlash'),
  page('/outputs/2001/', 200, OUTPUT_2001_TITLE, M.citation, 'citation_* meta'),
  redirect(
    '/outputs/2001?source=oai',
    '/outputs/2001/?source=oai',
    'trailingSlash keeps the query'
  ),
  page(
    '/outputs/2001/?source=oai',
    200,
    OUTPUT_2001_TITLE,
    M.citation,
    'client reads source=oai'
  ),
  page(
    '/outputs/2001/?search=q%3Dclimate',
    200,
    OUTPUT_2001_TITLE,
    M.citation,
    'client reads search= from asPath (templates/output/index.jsx:83-86)'
  ),
  page(
    '/outputs/4100/',
    200,
    DEFAULT_TITLE,
    'The article with ID 4100 has been disabled',
    'outputs 410 = string, 200 (Q-001)'
  ),
  page(
    '/outputs/4040/',
    200,
    DEFAULT_TITLE,
    M.uhoh,
    'API 404 -> soft 404 (Q-001)'
  ),
  page(
    '/outputs/5000/',
    200,
    DEFAULT_TITLE,
    M.uhoh,
    'API 500 -> soft 404 (Q-001)'
  ),
  page('/outputs/', 404, DEFAULT_TITLE, M.uhoh, 'prefix without id (Q-005)'),
  // /display/:id (URLRewrite -> /outputs/:id)
  page(
    '/display/2001/',
    200,
    OUTPUT_2001_TITLE,
    M.citation,
    'served in place (URL stays /display/)'
  ),
  redirect(
    '/display/2001',
    '/outputs/2001/',
    'no slash: the app 308s to /outputs/ (Q-005)'
  ),
  page(
    '/display/2001/?source=oai',
    200,
    OUTPUT_2001_TITLE,
    M.citation,
    'in place with the query'
  ),
  redirect(
    '/display/2001?source=oai',
    '/outputs/2001/?source=oai',
    'no slash, query kept'
  ),
  page('/display/', 404, DEFAULT_TITLE, M.uhoh, '/display/ 404 (Q-005)'),
  // /outputs/update/
  redirect(
    '/outputs/update',
    '/outputs/update/',
    'static route wins over [id]'
  ),
  page('/outputs/update/', 200, DEFAULT_TITLE, M.takedown, 'no gSSP'),
  // /data-providers/
  redirect('/data-providers', '/data-providers/', 'trailingSlash'),
  page(
    '/data-providers/',
    200,
    'Data providers search',
    M.providers,
    'directory'
  ),
  redirect(
    '/data-providers?q=aberystwyth&size=10&action=ADD&dataProviderUrl=https%3A%2F%2Fcreated.example.org%2F',
    '/data-providers/?q=aberystwyth&size=10&action=ADD&dataProviderUrl=https%3A%2F%2Fcreated.example.org%2F',
    'query kept encoded'
  ),
  page(
    '/data-providers/?q=aberystwyth&size=10&action=ADD&dataProviderUrl=https%3A%2F%2Fcreated.example.org%2F',
    200,
    'Data providers search',
    M.addForm,
    'q, size, action=ADD, dataProviderUrl'
  ),
  // /data-providers/:id
  redirect('/data-providers/86', '/data-providers/86/', 'trailingSlash'),
  page(
    '/data-providers/86/',
    200,
    DEFAULT_TITLE,
    M.provider86,
    'provider page'
  ),
  redirect(
    `/data-providers/86?q=&offset=0&limit=10&sort=recency&t=${T}-86`,
    `/data-providers/86/?q=&offset=0&limit=10&sort=recency&t=${T}-86`,
    'query kept'
  ),
  page(
    `/data-providers/86/?q=&offset=0&limit=10&sort=recency&t=${T}-86`,
    200,
    DEFAULT_TITLE,
    M.provider86,
    'q, offset, limit, sort, t'
  ),
  page(
    '/data-providers/999999999/',
    404,
    DEFAULT_TITLE,
    M.uhoh,
    'id not in the provider map -> real 404'
  ),
  page(
    '/data-providers/86/?t=a&t=b',
    404,
    DEFAULT_TITLE,
    M.uhoh,
    'metadata error -> 404 (repeated t throws, Q-016)'
  ),
  // /static/search/* (URLRewrite -> /*)
  page('/static/search', 200, DEFAULT_TITLE, M.footer, 'empty shell (Q-005)'),
  page('/static/search/', 200, DEFAULT_TITLE, M.footer, 'empty shell'),
  // routed only in-cluster or not at all (Q-005): another service answers
  other('/', 'CORE homepage, another service'),
  other('/404', 'not routed'),
  other('/404/', 'not routed'),
  other(
    '/error-card/',
    'not routed (accidental route, findings/02 §2.6 item 6)'
  ),
  other('/error-card', 'not routed'),
  other('/api/healthz/', 'probe path, in-cluster only'),
  other('/api/healthz', 'probe path, in-cluster only'),
  other('/searchx/', 'element-wise prefix match'),
  other('/robots.txt', 'not routed'),
]

// T-601 c1 asset rows: fixed public paths; the build-hashed chunk, CSS and next-images URLs are taken from
// the HTML of /search/?q=climate (their names are build hashes)
export const C1_ASSETS = [
  {
    path: '/static/search/icons.svg',
    status: 200,
    contentType: 'image/svg+xml',
    marker: M.svg,
  },
  {
    path: '/static/search/images/oai.svg',
    status: 200,
    contentType: 'image/svg+xml',
    marker: M.svg,
  },
  {
    path: '/static/search/images/errorCard.svg',
    status: 200,
    contentType: 'image/svg+xml',
    marker: M.svg,
  },
]

// T-601 c2: the extra list with the upstream calls the stub records (T-607 URL, method, body)
const E1 = 'https://api.core.ac.uk/v3/search/works?t=undefined'
const E15 = 'https://api.core.ac.uk/internal/members'
export const C2_ROWS = [
  {
    path: '/search/?q=x&page=0',
    status: 200,
    marker: M.errorCard,
    upstream: [
      [
        'POST',
        E1,
        '{"q":"x","offset":-1,"limit":10,"exclude":["fullText"],"sort":"relevance"}',
      ],
    ],
    note: 'page=0 -> offset -1; the recorded API answer is 500, so no E15 and the ErrorCard (Q-013)',
  },
  {
    path: '/search/?q=x&page=abc',
    status: 200,
    marker: M.queryError,
    upstream: [['GET', E15, null]],
    note: 'NaN page -> no E1, E15 only, results [] (Q-013)',
  },
  {
    path: '/search/?q=x&page=1001',
    status: 200,
    marker: M.queryError,
    upstream: [['GET', E15, null]],
    note: 'page > 1000 -> no E1, E15 only (Q-013)',
  },
  {
    path: '/works/1001/?t=a%26b%3Dc%20d',
    status: 200,
    marker: M.citation,
    upstream: [
      ['GET', 'https://api.core.ac.uk/v3/works/1001/outputs', null],
      ['GET', 'https://api.core.ac.uk/v3/works/1001?t=a&b=c+d', null],
      ['GET', 'https://doi.org/10.1111/rego.12518', null],
      ['GET', 'https://doi.org/10.1111/rego.12518', null],
    ],
    note: 't=a&b=c d reaches upstream as ?t=a&b=c+d (Q-016)',
  },
  {
    path: '/works/1001/?t=a&t=b',
    status: 200,
    marker: M.uhoh,
    upstream: [],
    note: 'repeated t throws before any call: soft 404, 0 upstream calls (Q-016)',
  },
  {
    path: '/data-providers/0x56/',
    status: 404,
    marker: M.uhoh,
    upstream: [
      [
        'GET',
        'https://api.core.ac.uk/v3/data-providers/0x56?t=undefined',
        null,
      ],
    ],
    note: '+"0x56" = 86 is in the provider map, the API gets the raw id (Q-035); the recorded API answer is 404 -> notFound',
  },
  {
    path: '/data-providers/?q=100%25',
    status: 500,
    marker: M.error500,
    upstream: [],
    note: 'decodeURI on the decoded q throws URIError -> SSR 500 (Q-028, Q-073 (d))',
  },
]

// T-601 c3 / T-731: the SSR 500 fixtures (41 §2.6; Q-001, Q-073, Q-098). The owner fix 978c6e4 (intended) made
// W-410-* and W-emptydate render: a 410 message is always a string and a numeric publishedDate is formatted, so
// they answer 200 with the page they show; `status`, `title` and `marker` are what each one answers now
const SSR_500 = { status: 500, title: ERROR_TITLE, marker: M.error500 }
export const W_EMPTYDATE_TITLE =
  'Review of \\u3ci\\u3eThe American West: A New Interpretive History\\u3c/i\\u3e By Robert V. Hine and John Mack\nFaragher - CORE'
export const C3_ROWS = [
  {
    path: '/works/4101/',
    fixture: 'W-410-json',
    note: '410 with a JSON object body: its message string, 200 (Q-001, 978c6e4)',
    status: 200,
    title: DEFAULT_TITLE,
    marker: 'Work with identifier 4101 has been disabled.',
  },
  {
    path: '/works/4102/',
    fixture: 'W-410-text',
    note: '410 with a text body: the fixed disabled text, 200 (Q-001, 978c6e4)',
    status: 200,
    title: DEFAULT_TITLE,
    marker: 'The work with ID 4102 has been disabled',
  },
  {
    path: '/works/6948813/',
    fixture: 'W-emptydate',
    note: 'publishedDate "" + numeric yearPublished: the work page, 200 (Q-073 (a), 978c6e4)',
    status: 200,
    title: W_EMPTYDATE_TITLE,
    marker: M.citation,
  },
  {
    path: '/works/4200/',
    fixture: 'W-nodp',
    note: 'dataProviders [] (Q-073 (b))',
    ...SSR_500,
  },
  {
    path: '/outputs/2102/',
    fixture: 'O-nofulltext (null)',
    note: 'no download link, sourceFulltextUrls null (Q-073 (c))',
    ...SSR_500,
  },
  {
    path: '/outputs/2103/',
    fixture: 'O-nofulltext (absent)',
    note: 'no download link, sourceFulltextUrls absent (Q-073 (c))',
    ...SSR_500,
  },
]

// T-601 c4: local-only pages through the allow-all proxy (Q-005)
export const C4_ROWS = [
  page('/', 200, DEFAULT_TITLE, M.footer, 'pages/index.js, an empty page'),
  redirect('/404', '/404/', 'trailingSlash'),
  page('/404/', 404, DEFAULT_TITLE, M.uhoh, 'pages/404.jsx'),
  redirect('/error-card', '/error-card/', 'trailingSlash'),
  page(
    '/error-card/',
    200,
    DEFAULT_TITLE,
    M.errorCard,
    'pages/error-card/index.jsx'
  ),
  redirect('/api/healthz', '/api/healthz/', 'trailingSlash'),
  {
    path: '/api/healthz/',
    status: 200,
    location: null,
    title: null,
    marker: M.healthz,
    contentType: 'application/json; charset=utf-8',
    note: 'probe path stays 200, never 308 (R-020)',
  },
]

// ---------- probe ----------
export const titleOf = (body) => {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/.exec(body)
  return m ? m[1] : null
}

export async function probe(request, origin, path, { headers = {} } = {}) {
  const res = await request.fetch(`${origin}${path}`, {
    method: 'GET',
    headers,
    maxRedirects: 0,
  })
  const h = res.headers()
  const body = (await res.body()).toString('utf8')
  return {
    status: res.status(),
    location: h.location ?? null,
    contentType: h['content-type'] ?? null,
    title: /html/.test(h['content-type'] || '') ? titleOf(body) : null,
    body,
    // the body without the `<!-- -->` separators React 17 writes between adjacent SSR text nodes
    text: body.split('<!-- -->').join(''),
    // gateway decision of the proxy (only with the request header X-P2-Debug: 1)
    route: h['x-p2-route'] ?? null,
    upstream: h['x-p2-upstream'] ?? null,
  }
}

// the comparable view of a probe against an expected row
export const view = (row, p) => ({
  path: row.path,
  status: p.status,
  location: p.location,
  title: row.title === undefined ? undefined : p.title,
  marker: row.marker ? (p.text.includes(row.marker) ? row.marker : null) : null,
  ...(row.contentType ? { contentType: p.contentType } : {}),
})
export const expected = (row) => ({
  path: row.path,
  status: row.status,
  location: row.location ?? null,
  title: row.title === undefined ? undefined : row.title,
  marker: row.marker ?? null,
  ...(row.contentType ? { contentType: row.contentType } : {}),
})
