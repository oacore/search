// Triage only (40 §2.2): `--require` preload that logs what app code hands to fetch (URL, method, the headers
// the app set, body sha256) to $P2_FETCHLOG as NDJSON, so app-set headers can be told from runtime-added ones.
const crypto = require('crypto')
const fs = require('fs')

const file = process.env.P2_FETCHLOG
if (file && typeof globalThis.fetch === 'function') {
  const realFetch = globalThis.fetch
  globalThis.fetch = function loggedFetch(input, init = {}) {
    const url =
      typeof input === 'string' || input instanceof URL
        ? String(input)
        : input.url
    const headers = []
    new Headers(
      init.headers || (typeof input === 'object' && input.headers) || undefined
    ).forEach((v, k) => headers.push([k, v]))
    const body =
      typeof init.body === 'string'
        ? init.body
        : init.body
          ? '[non-string body]'
          : ''
    fs.appendFileSync(
      file,
      `${JSON.stringify({
        ts: new Date().toISOString(),
        method: (
          init.method ||
          (typeof input === 'object' && input.method) ||
          'GET'
        ).toUpperCase(),
        url,
        headers,
        bodySha256: crypto.createHash('sha256').update(body).digest('hex'),
      })}\n`
    )
    return realFetch(input, init)
  }
}
