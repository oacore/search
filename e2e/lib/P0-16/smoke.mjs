// P0-16 checks of T-907 (41 J; R-003, R-068, R-088): the post-deploy smoke list. One implementation for both
// uses: c2 runs it against the compose-equivalent app of the harness (recorded fixtures, exact values), c1 runs
// it against a deployed base URL (`P2_OPS_BASE`) with a live profile (data-dependent values are checked by
// rule, ids come from the environment). Pure functions here; the specs drive the browser.
//
//   STATUS_ROWS / LOCAL_ROWS   the statuses of the T-601 table (gateway-faithful proxy; allow-all proxy)
//   headSignature(html)        the SEO head of a works page in document order: citation_*, DC.*, DCTERMS.* and
//                              the JSON-LD blocks (their @graph nodes and key order); next-head-count and the
//                              viewport tag are Next-owned and left out (R-003)
//   orderViolations(tokens)    the rule the live profile checks: known tokens in the order of HEAD_ORDER
//   SENTINELS                  three computed styles that exist only when the CSS bundle loaded and applied
//   providerCount(html)        the number of providers a /data-providers/ answer shows
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { REPO } from './substack.mjs'

export const SEARCH_ID = 'fafad9968b7cd268c5fd64342bf88a26' // searchId of the recorded climate page 1
const T = SEARCH_ID

// [path, status, location?] - T-601 c1 rows (Q-001, Q-002, Q-005, Q-013, Q-016, Q-028), copied from the T-601
// table of 2026-10-20 (package-private helpers are copied, not imported across packages, manifest §4.3).
// A change of that table needs the same change here.
export const STATUS_ROWS = [
  ['/search', 308, '/search/'],
  ['/search/', 308, '/'],
  ['/search?q=climate', 308, '/search/?q=climate'],
  ['/search/?q=climate', 200],
  [
    `/search?q=climate&page=2&limit=10&sort=recent&t=${T}`,
    308,
    `/search/?q=climate&page=2&limit=10&sort=recent&t=${T}`,
  ],
  [`/search/?q=climate&page=2&limit=10&sort=recent&t=${T}`, 200],
  ['/search/?q=zzzzqqq', 200],
  ['/search/?q=__status500', 200],
  ['/search/foo/', 404],
  ['/works/1001', 308, '/works/1001/'],
  ['/works/1001/', 200],
  [`/works/1001?t=${T}-1001`, 308, `/works/1001/?t=${T}-1001`],
  [`/works/1001/?t=${T}-1001`, 200],
  ['/works/4040/', 200],
  ['/works/4100/', 500],
  ['/works/5000/', 200],
  ['/works/', 404],
  ['/outputs/2001', 308, '/outputs/2001/'],
  ['/outputs/2001/', 200],
  ['/outputs/2001?source=oai', 308, '/outputs/2001/?source=oai'],
  ['/outputs/2001/?source=oai', 200],
  ['/outputs/2001/?search=q%3Dclimate', 200],
  ['/outputs/4100/', 200],
  ['/outputs/4040/', 200],
  ['/outputs/5000/', 200],
  ['/outputs/', 404],
  ['/display/2001/', 200],
  ['/display/2001', 308, '/outputs/2001/'],
  ['/display/2001/?source=oai', 200],
  ['/display/2001?source=oai', 308, '/outputs/2001/?source=oai'],
  ['/display/', 404],
  ['/outputs/update', 308, '/outputs/update/'],
  ['/outputs/update/', 200],
  ['/data-providers', 308, '/data-providers/'],
  ['/data-providers/', 200],
  [
    '/data-providers?q=aberystwyth&size=10&action=ADD&dataProviderUrl=https%3A%2F%2Fcreated.example.org%2F',
    308,
    '/data-providers/?q=aberystwyth&size=10&action=ADD&dataProviderUrl=https%3A%2F%2Fcreated.example.org%2F',
  ],
  [
    '/data-providers/?q=aberystwyth&size=10&action=ADD&dataProviderUrl=https%3A%2F%2Fcreated.example.org%2F',
    200,
  ],
  ['/data-providers/86', 308, '/data-providers/86/'],
  ['/data-providers/86/', 200],
  [
    `/data-providers/86?q=&offset=0&limit=10&sort=recency&t=${T}-86`,
    308,
    `/data-providers/86/?q=&offset=0&limit=10&sort=recency&t=${T}-86`,
  ],
  [`/data-providers/86/?q=&offset=0&limit=10&sort=recency&t=${T}-86`, 200],
  ['/data-providers/999999999/', 404],
  ['/data-providers/86/?t=a&t=b', 404],
  ['/static/search', 200],
  ['/static/search/', 200],
  // routed only in-cluster or not at all (Q-005): another service answers
  ['/', 404],
  ['/404', 404],
  ['/404/', 404],
  ['/error-card/', 404],
  ['/error-card', 404],
  ['/api/healthz/', 404],
  ['/api/healthz', 404],
  ['/searchx/', 404],
  ['/robots.txt', 404],
  // the static assets under the asset prefix
  ['/static/search/icons.svg', 200],
  ['/static/search/images/oai.svg', 200],
  ['/static/search/images/errorCard.svg', 200],
]

// T-601 c4: the local-only pages, through the allow-all proxy (Q-005)
export const LOCAL_ROWS = [
  ['/', 200],
  ['/404', 308, '/404/'],
  ['/404/', 404],
  ['/error-card', 308, '/error-card/'],
  ['/error-card/', 200],
  ['/api/healthz', 308, '/api/healthz/'],
  ['/api/healthz/', 200],
]

// The rows that hold on any deployment whatever its data: routing decisions of the search app (redirects, the
// unknown paths under a routed prefix) and its assets. Everything else needs a record id (liveRows), and the
// paths another service answers on a public host (`/`, `/robots.txt`, the in-cluster probe path, Q-005) are the
// gateway's business, not the app's: they are not asked of a deployment.
const FIXED_PATHS = new Set([
  '/search',
  '/search/',
  '/search?q=climate',
  '/search/foo/',
  '/works/',
  '/outputs/',
  '/display/',
  '/outputs/update',
  '/outputs/update/',
  '/data-providers',
  '/data-providers/',
  '/static/search',
  '/static/search/',
  '/static/search/icons.svg',
  '/static/search/images/oai.svg',
  '/static/search/images/errorCard.svg',
])
export const FIXED_ROWS = STATUS_ROWS.filter(([p]) => FIXED_PATHS.has(p))

// the rows of a deployment with real data: ids from the probe list (01 §4 step 8)
export function liveRows({ work, output, provider }) {
  return [
    ['/search/?q=climate', 200],
    [`/works/${work}`, 308, `/works/${work}/`],
    [`/works/${work}/`, 200],
    [`/outputs/${output}`, 308, `/outputs/${output}/`],
    [`/outputs/${output}/`, 200],
    [`/display/${output}`, 308, `/outputs/${output}/`],
    [`/display/${output}/`, 200],
    [`/data-providers/${provider}`, 308, `/data-providers/${provider}/`],
    [`/data-providers/${provider}/`, 200],
    ['/data-providers/999999999/', 404],
  ]
}

// asks every row; returns the mismatches as strings (empty = all hold). Redirects are not followed.
export async function checkStatuses(request, origin, rows) {
  const bad = []
  for (const [p, status, location] of rows) {
    const res = await request.get(`${origin}${p}`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    })
    const got = res.status()
    const loc = res.headers().location ?? null
    if (got !== status) bad.push(`${p}: ${got}, want ${status}`)
    else if (location !== undefined && loc !== location)
      bad.push(`${p}: Location ${loc}, want ${location}`)
    else if (location === undefined && status !== 308 && loc)
      bad.push(`${p}: unexpected Location ${loc}`)
  }
  return bad
}

// ---------- SEO head order (R-003) ----------
// the order the head writes its tags in; a work without a date or a DOI misses some of them
export const HEAD_ORDER = [
  'citation_title',
  'citation_author',
  'citation_publication_date',
  'DC.creator',
  'DC.title',
  'DCTERMS.abstract',
  'DC.identifier',
  'ld+json',
]

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i'))
  return m ? m[1] : null
}

// The SEO tags of the <head> in document order: { name, content } for citation_*, DC.* and DCTERMS.* metas,
// { name: 'ld+json', graph } for each JSON-LD block (graph = the nodes as `@type{key,key,...}`)
export function headTags(html) {
  const start = html.indexOf('<head')
  const end = html.indexOf('</head>')
  const head = html.slice(start, end < 0 ? undefined : end)
  const tags = []
  for (const m of head.matchAll(/<meta\b[^>]*>|<script\b[^>]*>/gi)) {
    if (m[0].startsWith('<meta')) {
      const name = attr(m[0], 'name') || attr(m[0], 'property')
      if (name && /^(citation_|DC\.|DCTERMS\.)/.test(name))
        tags.push({ name, content: attr(m[0], 'content') })
    } else if (/application\/ld\+json/.test(m[0])) {
      const body = head.slice(
        m.index + m[0].length,
        head.indexOf('</script>', m.index)
      )
      let graph = ['!unparsable']
      try {
        const json = JSON.parse(body)
        graph = [
          Object.keys(json).join(','),
          ...(json['@graph'] || [json]).map(
            (n) => `${n['@type']}{${Object.keys(n).join(',')}}`
          ),
        ]
      } catch {
        // stays unparsable
      }
      tags.push({ name: 'ld+json', graph, content: body })
    }
  }
  return tags
}

// runs of one tag name collapsed (`citation_author*6`), the JSON-LD with its graph
export function headSignature(html) {
  const tags = headTags(html)
  const out = []
  for (const t of tags) {
    const token =
      t.name === 'ld+json' ? `ld+json[${t.graph.join('|')}]` : t.name
    const last = out[out.length - 1]
    if (last && last.token === token) last.n += 1
    else out.push({ token, n: 1 })
  }
  const sha = crypto
    .createHash('sha256')
    .update(JSON.stringify(tags.map((t) => [t.name, t.content])))
    .digest('hex')
    .slice(0, 12)
  return {
    sequence: out
      .map((o) => (o.n > 1 ? `${o.token}*${o.n}` : o.token))
      .join(' '),
    values: sha,
  }
}

// the live rule: the tags HEAD_ORDER knows appear in its order, citation_title first and the JSON-LD last
export function orderViolations(html) {
  const tags = headTags(html)
  const names = tags.map((t) => t.name)
  const bad = []
  if (!names.includes('citation_title')) bad.push('no citation_title')
  if (!names.includes('ld+json')) bad.push('no JSON-LD block')
  let rank = -1
  for (const n of names) {
    const r = HEAD_ORDER.indexOf(n)
    if (r < 0) continue
    if (r < rank) bad.push(`${n} comes after ${HEAD_ORDER[rank]}`)
    rank = Math.max(rank, r)
  }
  if (names.length && names[names.length - 1] !== 'ld+json')
    bad.push(`the last tag is ${names[names.length - 1]}, not the JSON-LD`)
  return bad
}

// ---------- sentinel styles ----------
// three facts that only hold with the CSS bundle applied (T-721 c2: header#header is `static` without it)
export const SENTINELS = [
  {
    id: 'header',
    page: 'search',
    selector: 'header#header',
    property: 'position',
    value: 'sticky',
  },
  {
    id: 'footer',
    page: 'search',
    selector: 'footer#footer',
    property: 'background-color',
    value: 'rgb(245, 245, 245)',
  },
  {
    id: 'title',
    page: 'work',
    selector: 'h1',
    property: 'font-size',
    value: '24px',
  },
]

export async function sentinelValue(page, s) {
  return page.evaluate(({ selector, property }) => {
    const el = document.querySelector(selector)
    return el ? getComputedStyle(el).getPropertyValue(property) : null
  }, s)
}

// ---------- providers ----------
// "15672 repositories and journals around the world" in the directory's intro
export function providerCount(html) {
  const m = html
    .replace(/<!-- -->/g, '')
    .match(/(\d[\d,]*)\s+repositories and journals/)
  return m ? Number(m[1].replace(/,/g, '')) : null
}

// the frozen snapshot's provider map (42 §1, kept local by owner decision, I-11)
export function snapshotProviders() {
  const file = path.join(
    REPO,
    'test',
    'fixtures',
    'data-snapshot',
    '.formap.json'
  )
  if (!fs.existsSync(file))
    throw new Error(
      'test/fixtures/data-snapshot/.formap.json is missing (the data snapshot is kept local)'
    )
  return JSON.parse(fs.readFileSync(file, 'utf8')).length
}

// ---------- third-party hosts ----------
export const isTelemetryHost = (host) =>
  /(^|\.)sentry\.io$|(^|\.)logrocket\.com$|(^|\.)lgrckt-in\.com$|(^|\.)logr-in\.com$/.test(
    host
  )
export const isGaCollect = (url) =>
  /^https:\/\/([\w-]+\.)*(google-analytics|analytics\.google)\.com\/g\/collect\b/.test(
    url
  ) || /^https:\/\/www\.google-analytics\.com\/(g\/)?collect\b/.test(url)
