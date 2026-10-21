// P0-11 helpers for T-607 (41 G; Q-022, Q-016; R-016, R-028, R-076): the SSR stub's socket records of every
// server-side request a page makes, normalised only where the value is the stack's own address or key:
//   Host of an Internal_API request = the Internal_API authority ('<Internal_API host>': `stub` in the docker
//   topology, 127.0.0.1:<port> in local mode); Host of a request the host-mode redirect preload sent to the
//   stub ('<redirected>', never wire-faithful, harness.md §6); the configured API key inside a header value
//   ('<API_KEY>'). Everything else (names as sent, order, values, body sha256) is kept. Records of one render
//   are sorted by method, URL, body sha256 (40 §1: concurrent order is free), then by headers.
import path from 'node:path'
import { withWireCapture } from '../../fixtures/guard.mjs'
import { rawRequest } from './http.mjs'
import { REPO } from './files.mjs'

export const WIRE_BASELINE = path.join(
  REPO,
  'e2e',
  'lib',
  'P0-11',
  't607-wire.baseline.json'
)

// one page per SSR endpoint family: E1 search POST + members, E5 work and its outputs + E9 doi.org, E5 output +
// its provider + E9, E11/E12/E13/E18 of a provider page, and the _next/data request of a client navigation
export const WIRE_PAGES = [
  '/search/?q=climate',
  '/works/1001/',
  '/outputs/2001/',
  '/data-providers/86/',
  '/search/_next/data/{buildId}/works/1001.json',
]
// the headers 41 T-607 names; the comparison covers every header, these are also asserted one by one
export const NAMED = [
  'host',
  'authorization',
  'accept',
  'content-type',
  'user-agent',
  'accept-encoding',
  'sentry-trace',
  'baggage',
]

export function normaliseRecord(rec, appEnv) {
  const internal = new URL(appEnv.Internal_API).host
  const key = appEnv.API_KEY
  const headers = rec.headers.map(([name, value]) => {
    let v = value
    if (name.toLowerCase() === 'host')
      v = rec.redirected
        ? '<redirected>'
        : value === internal
        ? '<Internal_API host>'
        : value
    else if (key && v.includes(key)) v = v.split(key).join('<API_KEY>')
    return [name, v]
  })
  return {
    method: rec.method,
    url: rec.url,
    listener: rec.listener,
    redirected: rec.redirected,
    bodySha256: rec.bodySha256,
    headers,
  }
}

const sortKey = (r) =>
  `${r.method}\u0000${r.url}\u0000${r.bodySha256}\u0000${JSON.stringify(
    r.headers
  )}`

export async function captureWire(env, target) {
  const { result, records, problems } = await withWireCapture(env, () =>
    rawRequest(env.baseURL, target, { headers: { connection: 'keep-alive' } })
  )
  const normalised = records
    .map((r) => normaliseRecord(r, env.appEnv))
    .sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1))
  return { status: result.status, records: normalised, raw: records, problems }
}

export const headerOf = (rec, name) =>
  rec.headers.filter(([n]) => n.toLowerCase() === name).map(([, v]) => v)
