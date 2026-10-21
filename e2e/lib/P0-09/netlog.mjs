// P0-09 browser request log per action (41 §2.2 browser column, 40 §1 "Network (browser)").
// Logged: main-frame document navigations of the stack, every `_next/data` request, every request to the API
// hosts (api.core.ac.uk, doi.org) with method, URL, body and the app-set headers (Accept, Authorization,
// Content-Type), and a per-host count of the third-party hosts the guard serves or aborts (GA, LogRocket,
// Sentry). Not logged: static assets (chunks, CSS, images, icons.svg, tiles), whose names are build hashes.
// Normalised (40 §1): OPTIONS preflights dropped; the stack origin -> <origin>, the build ID -> <buildId>;
// requests of one action are sorted by (kind, method, URL, body), since concurrent requests have no stable
// order (timing is normalised).
import crypto from 'node:crypto'

const API_HOSTS = new Set(['api.core.ac.uk', 'doi.org'])
const THIRD_PARTY = [
  /(^|\.)googletagmanager\.com$/,
  /(^|\.)google-analytics\.com$/,
  /(^|\.)lgrckt-in\.com$/,
  /(^|\.)logrocket\.com$/,
  /(^|\.)logr-in\.com$/,
  /(^|\.)sentry\.io$/,
]
const APP_HEADERS = ['accept', 'authorization', 'content-type']

export function netLog(page, env) {
  const stack = new Set(
    [env.baseURL, env.allowURL, env.appURL]
      .filter(Boolean)
      .map((u) => new URL(u).origin)
  )
  const entries = []
  let seq = 0
  page.on('request', (r) => {
    if (r.method() === 'OPTIONS') return
    let u
    try {
      u = new URL(r.url())
    } catch {
      return
    }
    let kind = null
    if (
      stack.has(u.origin) &&
      r.isNavigationRequest() &&
      r.frame() === page.mainFrame()
    )
      kind = 'document'
    else if (stack.has(u.origin) && u.pathname.includes('/_next/data/'))
      kind = 'next-data'
    else if (API_HOSTS.has(u.hostname)) kind = 'api'
    else if (THIRD_PARTY.some((re) => re.test(u.hostname))) kind = 'third-party'
    if (!kind) return
    const h = r.headers()
    const body = r.postDataBuffer()
    const e = {
      seq: (seq += 1),
      kind,
      method: r.method(),
      url: r.url(),
      host: u.hostname,
      resourceType: r.resourceType(),
      headers: Object.fromEntries(
        APP_HEADERS.filter((n) => h[n] !== undefined).map((n) => [n, h[n]])
      ),
      bodyText: body ? body.toString('utf8') : null,
      bodySha256: body
        ? crypto.createHash('sha256').update(body).digest('hex')
        : null,
      status: null,
      failed: null,
    }
    entries.push(e)
    r.response()
      .then((res) => {
        if (res) e.status = res.status()
      })
      .catch(() => {})
  })
  page.on('requestfailed', (r) => {
    const e = [...entries].reverse().find((x) => x.url === r.url())
    if (e && e.status === null)
      e.failed = (r.failure() || {}).errorText || 'failed'
  })
  return {
    entries,
    mark: () => entries.length,
    since: (m) => entries.slice(m),
  }
}

// normalised, order-free view of the entries of one action
export function normalise(list, { baseURL, buildId }) {
  const origin = new URL(baseURL).origin
  const norm = (s) =>
    s == null
      ? s
      : String(s)
          .split(origin)
          .join('<origin>')
          .split(buildId)
          .join('<buildId>')
  const out = []
  const counts = {}
  for (const e of list) {
    if (e.kind === 'third-party') {
      counts[e.host] = (counts[e.host] || 0) + 1
      continue
    }
    out.push({
      kind: e.kind,
      method: e.method,
      url: norm(e.url),
      resourceType: e.resourceType,
      headers: e.headers,
      body: norm(e.bodyText),
      status: e.status,
      ...(e.failed ? { failed: e.failed } : {}),
    })
  }
  const key = (x) =>
    `${x.kind} ${x.method} ${x.url} ${x.body || ''} ${x.resourceType}`
  out.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))
  return { requests: out, thirdParty: counts }
}

// compact counters used by the explicit 41 §2.2 assertions
export const count = (list, pred) => list.filter(pred).length
export const isE2 = (e) =>
  e.method === 'POST' &&
  e.url === 'https://api.core.ac.uk/v3/search/works/aggregate'
export const isNextData = (e) => e.kind === 'next-data'
export const isDocument = (e) => e.kind === 'document'

// stable JSON text for snapshots (2-space indent, trailing newline)
export const stableJson = (v) => `${JSON.stringify(v, null, 2)}\n`
