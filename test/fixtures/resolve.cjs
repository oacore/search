// Fixture resolver (40 §2): (method, url, body) -> { status, headers, body } for Jest MSW, Playwright
// page.route and the SSR stub. CommonJS so that Jest (CJS) can load it; test/fixtures/resolve.mjs is the
// ESM entry for the stub and Playwright.
//
// Fixture file: test/fixtures/api/<scenario>/<sha12>.json
//   { schema: 1, scenario,
//     request:  { method, url (absolute, raw query incl. `?t=undefined`), bodySha256, bodyText? },
//     response: { status, headers: [[name, value], ...] (recorded order), body: { encoding: utf8|base64|json, data } },
//     source:   { kind: recorded|derived|hand, from, patch, recordedAt } }
// sha12 = keyOf(method, url, body). Match = method + exact URL + body sha256; Authorization is never stored
// nor matched. The directory is scanned (no shared index), so packages never edit a common file.
// Order of answers: magic-query rules (__status500, __neterror, __nodataproviders) > exact fixture >
// static rules (tiles and core.ac.uk/image PNG, empty gtag script) > 502 naming the triple.
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const SCHEMA = 1
const EMPTY_SHA256 = crypto.createHash('sha256').update('').digest('hex')

const toBuffer = (body) => {
  if (body == null) return Buffer.alloc(0)
  if (Buffer.isBuffer(body)) return body
  if (body instanceof Uint8Array) return Buffer.from(body)
  if (body instanceof ArrayBuffer) return Buffer.from(new Uint8Array(body))
  return Buffer.from(String(body), 'utf8')
}
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const bodySha256 = (body) => sha256(toBuffer(body))
const keyOf = (method, url, body) => sha256(`${String(method).toUpperCase()} ${url} ${bodySha256(body)}`).slice(0, 12)

// response headers that describe the transfer, not the payload: recomputed by whoever serves the body
const HOP = new Set(['content-length', 'content-encoding', 'transfer-encoding', 'connection', 'keep-alive', 'authorization'])
const servableHeaders = (headers) => (headers || []).filter(([n]) => !HOP.has(String(n).toLowerCase()))

const decodeBody = (b) => {
  if (!b) return Buffer.alloc(0)
  if (b.encoding === 'base64') return Buffer.from(b.data, 'base64')
  if (b.encoding === 'json') return Buffer.from(JSON.stringify(b.data), 'utf8')
  return Buffer.from(b.data == null ? '' : String(b.data), 'utf8')
}

// ---------- deterministic assets ----------
const crcTable = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc32 = (buf) => {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const pngChunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
// 256 x 256 opaque RGB PNG of one colour (map tiles, core.ac.uk/image)
const solidPng = (size = 256, rgb = [0xe0, 0xe0, 0xe0]) => {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // RGB
  const row = Buffer.alloc(1 + size * 3)
  for (let x = 0; x < size; x++) row.set(rgb, 1 + x * 3)
  const raw = Buffer.concat(Array.from({ length: size }, () => row))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}
const TILE_PNG = solidPng()

// ---------- rules ----------
const MAGIC = ['__status500', '__neterror', '__nodataproviders']
const magicOf = (url, bodyText) => MAGIC.find((m) => url.includes(m) || (bodyText && bodyText.includes(m)))

const STATIC_RULES = [
  {
    name: 'tile',
    test: (u) => /(^|\.)tile\.openstreetmap\.org$/.test(u.hostname),
    answer: () => ({ status: 200, headers: [['content-type', 'image/png'], ['cache-control', 'no-store']], body: TILE_PNG }),
  },
  {
    name: 'core-image',
    test: (u) => u.hostname === 'core.ac.uk' && u.pathname.startsWith('/image/'),
    answer: () => ({ status: 200, headers: [['content-type', 'image/png'], ['cache-control', 'no-store']], body: TILE_PNG }),
  },
  {
    name: 'gtag',
    test: (u) => u.hostname === 'www.googletagmanager.com' && u.pathname.startsWith('/gtag/js'),
    answer: () => ({ status: 200, headers: [['content-type', 'application/javascript; charset=utf-8']], body: Buffer.alloc(0) }),
  },
]

// ---------- loading ----------
const walk = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.json') ? [path.join(dir, e.name)] : []))
    : []

const loadFixtures = (apiDir) => {
  const byKey = new Map()
  const problems = []
  for (const file of walk(apiDir)) {
    let rec
    try {
      rec = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (e) {
      problems.push(`${path.relative(apiDir, file)}: ${e.message}`)
      continue
    }
    if (rec.schema !== SCHEMA || !rec.request || !rec.response) {
      problems.push(`${path.relative(apiDir, file)}: not a schema-${SCHEMA} fixture`)
      continue
    }
    const { method, url, bodySha256: bs = EMPTY_SHA256 } = rec.request
    const key = sha256(`${String(method).toUpperCase()} ${url} ${bs}`).slice(0, 12)
    if (path.basename(file, '.json') !== key) problems.push(`${path.relative(apiDir, file)}: file name is not its key ${key}`)
    const prev = byKey.get(key)
    if (prev && JSON.stringify(prev.rec.response) !== JSON.stringify(rec.response)) problems.push(`${key}: conflicting fixtures ${prev.file} and ${file}`)
    if (!prev) byKey.set(key, { rec, file })
  }
  return { byKey, problems }
}

// rewrite absolute https://core.ac.uk links in links[].url to the proxy origin (40 §2.4)
const rewriteLinks = (value, origin) => {
  if (Array.isArray(value)) return value.map((v) => rewriteLinks(v, origin))
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (k === 'links' && Array.isArray(v))
        out[k] = v.map((l) => (l && typeof l.url === 'string' && l.url.startsWith('https://core.ac.uk') ? { ...l, url: origin + l.url.slice('https://core.ac.uk'.length) } : rewriteLinks(l, origin)))
      else out[k] = rewriteLinks(v, origin)
    }
    return out
  }
  return value
}

const isJson = (headers) => headers.some(([n, v]) => String(n).toLowerCase() === 'content-type' && /json/i.test(String(v)))

const createResolver = (options = {}) => {
  const root = options.root || process.env.FIXTURES_ROOT || path.resolve(process.cwd(), 'test', 'fixtures')
  const apiDir = path.join(root, 'api')
  let state = loadFixtures(apiDir)
  const linkOrigin = options.linkOrigin || null

  const fromRecord = (rec) => {
    let headers = servableHeaders(rec.response.headers)
    let body = decodeBody(rec.response.body)
    if (linkOrigin && body.length && isJson(headers)) {
      try {
        body = Buffer.from(JSON.stringify(rewriteLinks(JSON.parse(body.toString('utf8')), linkOrigin)), 'utf8')
      } catch {
        // not JSON after all: served as recorded
      }
    }
    return { status: rec.response.status, headers, body, fixture: rec }
  }

  const lookup = (method, url, body) => state.byKey.get(keyOf(method, url, body))

  const unmatched = (method, url, body, reason = 'unmatched fixture') => {
    const buf = toBuffer(body)
    const triple = { method: String(method).toUpperCase(), url, bodySha256: sha256(buf), bodyText: buf.length ? buf.toString('utf8').slice(0, 2000) : undefined }
    return { status: 502, headers: [['content-type', 'application/json'], ['x-fixture-unmatched', '1']], body: Buffer.from(JSON.stringify({ error: reason, ...triple })), unmatched: triple }
  }

  const resolve = (method, url, body) => {
    const m = String(method).toUpperCase()
    const buf = toBuffer(body)
    const bodyText = buf.length ? buf.toString('utf8') : ''
    const magic = magicOf(url, bodyText)
    if (magic === '__status500') return { status: 500, headers: [['content-type', 'application/json']], body: Buffer.from('{"message":"Internal Server Error"}'), rule: magic }
    if (magic === '__neterror') return { status: 0, networkError: true, headers: [], body: Buffer.alloc(0), rule: magic }
    if (magic === '__nodataproviders') {
      // a recorded `climate` answer with dataProviders removed from the first result (Q-015)
      const baseUrl = url.split('__nodataproviders').join('climate')
      const baseBody = bodyText.split('__nodataproviders').join('climate')
      const hit = lookup(m, baseUrl, baseBody)
      if (!hit) return unmatched(m, baseUrl, baseBody, 'unmatched base fixture for __nodataproviders')
      const out = fromRecord(hit.rec)
      try {
        const json = JSON.parse(out.body.toString('utf8'))
        if (Array.isArray(json.results) && json.results[0]) delete json.results[0].dataProviders
        out.body = Buffer.from(JSON.stringify(json))
      } catch {
        // aggregation or non-JSON answers stay as recorded
      }
      return { ...out, rule: magic }
    }
    const hit = lookup(m, url, buf)
    if (hit) return fromRecord(hit.rec)
    let u = null
    try {
      u = new URL(url)
    } catch {
      return unmatched(m, url, buf, 'malformed url')
    }
    for (const r of STATIC_RULES) if (r.test(u)) return { ...r.answer(u), rule: r.name }
    return unmatched(m, url, buf)
  }

  return {
    root,
    resolve,
    reload: () => {
      state = loadFixtures(apiDir)
      return state.problems
    },
    problems: () => state.problems,
    size: () => state.byKey.size,
    keys: () => [...state.byKey.keys()],
  }
}

module.exports = { SCHEMA, EMPTY_SHA256, keyOf, bodySha256, sha256, toBuffer, servableHeaders, decodeBody, solidPng, TILE_PNG, MAGIC, rewriteLinks, createResolver }
