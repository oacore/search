// P0-11 helpers for T-603 (41 G; R-026, R-083; S-6): the header contract per route class, at the origin (the
// app's own listener) and through the proxy, in the 42 §8 format of e2e/http/contract.baseline.json:
//   {link, reference, rules, routes:[{id, route, class, via, listener, case, method, request-headers, url,
//    expect:{status, headers, inlineScripts?}}]}
// Cases per route (42 §8): GET, HEAD, conditional GET with the returned ETag (If-None-Match), and
// Accept-Encoding: br, gzip. `expect.headers` = every response header, lower-case name -> ordered values;
// `date` is ignored; `etag`, `content-length` and `last-modified` are kept as presence only ('<present>';
// 42 §8 names the first two, the third is the same kind: a build artefact); everything else is
// exact, and an added or removed header is a diff. Deltas pass only through rows of
// test/baseline/ACCEPTED-DIFFS.yml (default deny, exact test/key/from/to; never a status or a Location).
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { rawRequest, headerMap } from './http.mjs'
import { REPO } from './files.mjs'

const requireE2e = createRequire(path.join(REPO, 'e2e', 'package.json'))

export const BASELINE_FILE = path.join(
  REPO,
  'e2e',
  'http',
  'contract.baseline.json'
)
export const LEDGER_FILE = path.join(
  REPO,
  'test',
  'baseline',
  'ACCEPTED-DIFFS.yml'
)
export const IGNORED = ['date']
// last-modified of a static file is the mtime of the build tree (public/, .next/static, .map, icons.svg), so it
// changes with every build of one tree like the etag built from it (P0-11-5): presence only
export const PRESENCE_ONLY = ['etag', 'content-length', 'last-modified']
// keys a delta row may never cover (42 §8: no status code, no Location; 30 §1 rule 3)
export const NEVER_COVERED = [':status', 'location']

// route classes of 41 T-603 / 42 §8 / 40 §1. `proxy` is the public URL at the gateway-faithful proxy, `origin`
// the URL the gateway sends upstream (kube/prod/httproute.yaml), i.e. the same request without the gateway.
// healthz is not routed by the gateway (k8s probes call the container), so its proxy row uses the allow-all
// listener (40 §2.3). Placeholders: {buildId} (from __NEXT_DATA__), {framework} (the framework chunk file
// named by the page's script tags).
export const ROUTES = [
  {
    route: 'html-gssp',
    class: 'HTML',
    proxy: '/search/?q=climate',
    origin: '/search/?q=climate',
  },
  {
    route: 'html-gip',
    class: 'HTML',
    proxy: '/outputs/update/',
    origin: '/outputs/update/',
  },
  {
    route: 'next-data',
    class: '_next/data',
    // the client asks under /static/search from Next 15 (CS-N15-3); the gateway strips the prefix
    proxy: '/static/search/_next/data/{buildId}/search.json?q=climate',
    origin: '/_next/data/{buildId}/search.json?q=climate',
  },
  {
    route: 'public',
    class: 'public/',
    proxy: '/static/search/static/images/oai.svg',
    origin: '/static/images/oai.svg',
  },
  {
    route: 'next-static',
    class: '_next/static',
    proxy: '/static/search/_next/static/chunks/{framework}',
    origin: '/_next/static/chunks/{framework}',
  },
  {
    route: 'map',
    class: '.map',
    proxy: '/static/search/_next/static/chunks/{framework}.map',
    origin: '/_next/static/chunks/{framework}.map',
  },
  {
    route: 'icons-svg',
    class: 'icons.svg',
    proxy: '/static/search/icons.svg',
    origin: '/icons.svg',
  },
  {
    route: '308-slash',
    class: '308',
    proxy: '/search?q=x',
    origin: '/search?q=x',
  },
  {
    route: '308-gssp',
    class: '308',
    proxy: '/search/',
    origin: '/search/',
  },
  {
    route: '404-page',
    class: '404',
    proxy: '/search/nope/',
    origin: '/search/nope/',
  },
  {
    route: '404-notfound',
    class: '404',
    proxy: '/data-providers/999999999/',
    origin: '/data-providers/999999999/',
  },
  {
    route: '500',
    class: '500',
    proxy: '/works/6948813/',
    origin: '/works/6948813/',
  },
  {
    route: 'healthz',
    class: 'healthz',
    proxy: '/api/healthz/',
    origin: '/api/healthz/',
    proxyListener: 'allow-all',
  },
]
export const CLASSES = [
  'HTML',
  '_next/data',
  'public/',
  '_next/static',
  '.map',
  'icons.svg',
  '308',
  '404',
  '500',
  'healthz',
]
export const CASES = ['GET', 'HEAD', 'conditional', 'br-gzip']
const BASE_HEADERS = { connection: 'keep-alive' }

const caseRequest = (kase, etag) => {
  if (kase === 'HEAD') return { method: 'HEAD', headers: { ...BASE_HEADERS } }
  if (kase === 'conditional')
    return {
      method: 'GET',
      headers: { ...BASE_HEADERS, 'if-none-match': etag },
    }
  if (kase === 'br-gzip')
    return {
      method: 'GET',
      headers: { ...BASE_HEADERS, 'accept-encoding': 'br, gzip' },
    }
  return { method: 'GET', headers: { ...BASE_HEADERS } }
}

export function normaliseHeaders(rawHeaders) {
  const map = headerMap(rawHeaders)
  const out = {}
  for (const [name, values] of Object.entries(map)) {
    if (IGNORED.includes(name)) continue
    out[name] = PRESENCE_ONLY.includes(name)
      ? values.map(() => '<present>')
      : values
  }
  return out
}

// executable inline scripts (S-6): <script> without src whose type is absent or a JavaScript type
const JS_TYPES = new Set([
  '',
  'text/javascript',
  'application/javascript',
  'module',
  'text/ecmascript',
  'application/ecmascript',
])
export function inlineScripts(html) {
  let executable = 0
  for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
    const attrs = m[1]
    if (/\ssrc\s*=/i.test(` ${attrs}`)) continue
    const t = /\stype\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(` ${attrs}`)
    const type = t ? (t[2] ?? t[3] ?? t[4] ?? '').trim().toLowerCase() : ''
    if (JS_TYPES.has(type)) executable++
  }
  return executable
}

// placeholder values of this build, read black-box from the origin's HTML
export async function placeholders(env) {
  const r = await rawRequest(env.appURL, '/search/?q=climate', {
    headers: { ...BASE_HEADERS },
  })
  const html = r.body.toString('utf8')
  const data =
    /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s.exec(
      html
    )
  // webpack 4 names the chunk framework.<hash>.js, webpack 5 framework-<hash>.js
  const fw = /\/_next\/static\/chunks\/(framework[.-][0-9a-f]+\.js)"/.exec(html)
  if (!data || !fw)
    throw new Error(
      'contract: /search/?q=climate has no __NEXT_DATA__ or framework chunk'
    )
  return { buildId: JSON.parse(data[1]).buildId, framework: fw[1] }
}

export const fill = (template, values) =>
  template.replace(/\{(buildId|framework)\}/g, (_, k) => values[k])

export const listenerOrigin = (env, listener) =>
  ({ 'app': env.appURL, 'gateway': env.baseURL, 'allow-all': env.allowURL })[
    listener
  ]

// every (route, via, case) row of the contract, in a fixed order; the conditional case exists only when the
// GET of that route and via returned an ETag
export async function capture(env, routes = ROUTES) {
  const values = await placeholders(env)
  const rows = []
  for (const r of routes)
    for (const via of ['origin', 'proxy']) {
      const listener = via === 'origin' ? 'app' : r.proxyListener || 'gateway'
      const url = via === 'origin' ? r.origin : r.proxy
      const origin = listenerOrigin(env, listener)
      let etag = null
      for (const kase of CASES) {
        if (kase === 'conditional' && !etag) continue
        const req = caseRequest(kase, etag)
        const res = await rawRequest(origin, fill(url, values), req)
        const map = headerMap(res.rawHeaders)
        if (kase === 'GET') etag = map.etag ? map.etag[0] : null
        const expect = {
          status: res.status,
          headers: normaliseHeaders(res.rawHeaders),
        }
        const html =
          kase === 'GET' &&
          map['content-type'] &&
          /^text\/html/.test(map['content-type'][0])
        if (html)
          expect.inlineScripts = inlineScripts(res.body.toString('utf8'))
        rows.push({
          'id': `${r.route}@${via}.${kase}`,
          'route': r.route,
          'class': r.class,
          via,
          listener,
          'case': kase,
          'method': req.method,
          'request-headers':
            kase === 'conditional'
              ? { ...req.headers, 'if-none-match': '<etag of the GET>' }
              : req.headers,
          url,
          expect,
          // run-only facts, not written to the baseline
          '_raw': { headers: map, status: res.status },
        })
      }
    }
  return { rows, values }
}

export const baselineRows = (rows) => rows.map(({ _raw, ...row }) => row)

const join = (values) => (values ? values.join(', ') : '<absent>')

// diffs of one capture against the baseline: missing or extra rows, status, every header but `date`
export function diffRows(baseline, actual) {
  const diffs = []
  const byId = new Map(actual.map((r) => [r.id, r]))
  const seen = new Set()
  for (const b of baseline) {
    const a = byId.get(b.id)
    seen.add(b.id)
    if (!a) {
      diffs.push({
        id: b.id,
        route: b.route,
        via: b.via,
        case: b.case,
        header: ':row',
        from: 'present',
        to: '<absent>',
      })
      continue
    }
    const at = { id: b.id, route: b.route, via: b.via, case: b.case }
    if (a.expect.status !== b.expect.status)
      diffs.push({
        ...at,
        header: ':status',
        from: String(b.expect.status),
        to: String(a.expect.status),
      })
    const names = [
      ...new Set([
        ...Object.keys(b.expect.headers),
        ...Object.keys(a.expect.headers),
      ]),
    ]
    for (const name of names) {
      if (IGNORED.includes(name)) continue
      const from = join(b.expect.headers[name])
      const to = join(a.expect.headers[name])
      if (from !== to) diffs.push({ ...at, header: name, from, to })
    }
  }
  for (const a of actual)
    if (!seen.has(a.id))
      diffs.push({
        id: a.id,
        route: a.route,
        via: a.via,
        case: a.case,
        header: ':row',
        from: '<absent>',
        to: 'present',
      })
  return diffs
}

// ---------- the AD ledger (42 §8) ----------
export function readLedger(file = LEDGER_FILE) {
  if (!fs.existsSync(file)) return { file, present: false, rows: [] }
  const YAML = requireE2e('yaml')
  const doc = YAML.parse(fs.readFileSync(file, 'utf8'))
  if (doc != null && !Array.isArray(doc))
    throw new Error(`${file}: the ledger is a YAML list`)
  return { file, present: true, rows: doc || [] }
}

// a ledger row covers a diff when test, key, from and to match exactly and the row is not withdrawn; key =
// <route>@<via>/<header> (every case) or <route>@<via>.<case>/<header> (that case only); a composite key lists
// several such keys, separated by `, `, for one from/to pair (e.g. one header value on many route classes)
export const diffKeys = (d) => [
  `${d.route}@${d.via}/${d.header}`,
  `${d.route}@${d.via}.${d.case}/${d.header}`,
]
export const rowKeys = (r) => String(r.key).split(', ')
export function applyLedger(diffs, ledgerRows, test = 'T-603') {
  const inForce = ledgerRows.filter((r) => r && r.test === test && !r.withdrawn)
  const used = new Map()
  const remaining = []
  for (const d of diffs) {
    const row = NEVER_COVERED.includes(d.header)
      ? null
      : inForce.find(
          (r) =>
            diffKeys(d).some((k) => rowKeys(r).includes(k)) &&
            String(r.from) === d.from &&
            String(r.to) === d.to
        )
    if (row) used.set(row.id, (used.get(row.id) || 0) + 1)
    else remaining.push(d)
  }
  return {
    remaining,
    used: Object.fromEntries(used),
    unused: inForce.filter((r) => !used.has(r.id)).map((r) => r.id),
  }
}

// the production policy the app is configured with (csp.config.js of the served tree, NODE_ENV=production)
export function productionCsp(appDir) {
  const dir =
    appDir && fs.existsSync(path.join(appDir, 'csp.config.js')) ? appDir : REPO
  const r = spawnSync(
    process.execPath,
    ['-e', "process.stdout.write(require('./csp.config.js'))"],
    {
      cwd: dir,
      encoding: 'utf8',
      env: { PATH: process.env.PATH, NODE_ENV: 'production' },
    }
  )
  if (r.status !== 0) throw new Error(`csp.config.js: ${r.stderr}`)
  return { policy: r.stdout, from: path.join(dir, 'csp.config.js') }
}
