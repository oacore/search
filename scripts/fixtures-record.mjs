#!/usr/bin/env node
// fixtures-record.mjs - the fixture recorder (40 §6, 41 §2.6, 50 step 2.2). Manual, never CI.
//
//   npm run fixtures:record -- --out "$ARTIFACT_DIR/fixtures" [--plan [file]] [--requests <glob>]...
//                              [--derive <spec.json | inline json>] [--force] [--dry-run] [--only <ids|scenarios>]
//                              [--raw-only] [--write-only] [--index] [--verify] [--budget 600] [--lock-wait <seconds>]
//
//   --plan [file]   run the base plan (default test/fixtures/record-plan.json)
//   --requests g    request lists of the test packages (test/fixtures/requests/<pkg-id>.json; `*` globs allowed)
//   --derive spec   copy a recorded object and change fields: one entry or an array of entries of kind "derive"
//   --force         record again although a raw answer exists (cache key = method, URL, body, Accept, Origin)
//   --raw-only      record to <out>/raw only, write no resolver files (probes)
//   --write-only    no network: rebuild the resolver files from <out>/raw (after a scrub rule change)
//   --index         write test/fixtures/scenarios.json from the plan and the fixture files that exist
//   --verify        every plan entry resolves through the harness resolver to its fixture bytes (no network)
//   --dry-run       print what would be requested
//
// Request file / plan entry (JSON):
//   { id, scenario, endpoint, kind: "live" | "derive" | "hand",
//     request: { method, url, body? (object = JSON.stringify'd as the app does, or string), headers? },
//     browser?: true            marks a browser-facing endpoint (E2, E3, E8, E19, E21, E22); no request difference:
//                               the browser guard adds the CORS headers for the page origin (I-26), so a recorded
//                               `access-control-allow-origin: https://core.ac.uk` would be wrong in the tests
//     origin?: true             send `Origin: https://core.ac.uk` anyway (the CORS headers are then dropped on write)
//     anon?: true               send no Authorization (browser calls without credentials: E21, E22 logos)
//     accept?: [200] | "any"    statuses that count as recorded answers (default [200])
//     serve?: { url?, body?, status? }   answer a different request triple than the one recorded (a scenario id
//                                        in place of the real id); the file is then source.kind "derived"
//     patch?: [ops]             JSON patch applied to the scrubbed body: add, replace, remove, copy, test,
//                               select { path, where | indexes } (keep matching array elements) and
//                               reject { path, where } (drop matching array elements)
//     write?: false             record raw only (E9 bibtex shares the key of the apa answer)
//     response?: { status?, headers?, body? }  for kind "hand" (full answer) or kind "derive" (overrides) }
//   kind "derive": { from: <entry id | sha12 key | {method,url,body?} | {attempt, url}>, serve: {method?, url, body?},
//                    patch, response?: { status?, headers?, setHeaders?: {name: value}, body? } }
//                    from.attempt = a real 5xx kept in raw/<attempt>.json by an earlier request
//
// Rules (binding):
//   - the only reader of .env.fixtures besides the corpus recorder; the key is never printed, logged or written;
//     Authorization is never stored (raw files and fixtures); the key goes only to https://api.core.ac.uk;
//     doi.org and logo hosts are requested without it; redirects are followed only on hosts that get no key.
//   - read-only calls: GET, the search/aggregation POSTs (/v3/search/works, /v3/search/works/aggregate,
//     /v3/search/outputs) and /v3/recommend; never E10, E16, E17 (hand fixtures).
//   - at most one request per 1.1 s, one at a time, a global lock <out>/.lock (concurrent callers wait), a cache
//     (a recorded key is never requested again without --force), a budget of 600 live requests in <out>/ledger.ndjson.
//   - 429: stop, wait at least 10 minutes, at most 2 retries, then abort (exit 4); 401/403: abort at once (exit 5).
//   - raw answers (status, ordered headers, body bytes) go to <out>/raw/ and are never committed; resolver files
//     (test/fixtures/{api,hand}/<scenario>/<sha12>.json) are scrubbed by scripts/fixtures-scrub.mjs.
// Exit codes: 0 ok, 1 entries failed, 2 usage, 3 lock timeout, 4 rate limited, 5 not authorised, 6 budget, 7 safety.

import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import https from 'node:https'
import zlib from 'node:zlib'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import {
  REPO,
  FIXTURES_DIR,
  readApiKey,
  redact,
  scrubJson,
  scrubText,
  scrubHeaders,
  addStats,
  newStats,
} from './fixtures-scrub.mjs'

const require = createRequire(import.meta.url)
const core = require('../test/fixtures/resolve.cjs')

const API_HOST = 'api.core.ac.uk'
const ORIGIN_HEADER = 'https://core.ac.uk'
const MIN_INTERVAL_MS = 1100
const RATE_WAIT_MS = 10 * 60 * 1000 + 5000
const BUDGET = 600
// waits after "network unreachable" (DNS, no route): 30 s, 1, 2, 4, 5, 5, 5, 5, 5, 5 min
const NET_BACKOFF_MS = [30, 60, 120, 240, 300, 300, 300, 300, 300, 300].map(
  (s) => s * 1000
)
const READ_ONLY_POSTS = [
  /^\/v3\/search\/works$/,
  /^\/v3\/search\/works\/aggregate$/,
  /^\/v3\/search\/outputs$/,
  /^\/v3\/recommend$/,
]

class Abort extends Error {
  constructor(code, message) {
    super(message)
    this.exitCode = code
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex')
const log = (...a) => console.log(...a)

// ---------- small utils ----------
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const mkdirp = (d) => fs.mkdirSync(d, { recursive: true })

const globFiles = (pattern) => {
  const abs = path.resolve(pattern)
  if (!pattern.includes('*')) return fs.existsSync(abs) ? [abs] : []
  const dir = path.dirname(abs)
  const re = new RegExp(
    `^${path
      .basename(abs)
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')}$`
  )
  return fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => re.test(f))
        .sort()
        .map((f) => path.join(dir, f))
    : []
}

// ---------- JSON patch (subset) ----------
const unesc = (s) => s.replace(/~1/g, '/').replace(/~0/g, '~')
const tokens = (p) => (p === '' ? [] : p.split('/').slice(1).map(unesc))
const getAt = (doc, p) => tokens(p).reduce((v, t) => v[t], doc)
const clone = (v) => JSON.parse(JSON.stringify(v))
const matches = (el, where) =>
  Object.entries(where).every(
    ([k, v]) => JSON.stringify(el[k]) === JSON.stringify(v)
  )

export function applyPatch(input, ops) {
  let doc = clone(input)
  for (const op of ops || []) {
    const t = tokens(op.path || '')
    const parent = t.length ? t.slice(0, -1).reduce((v, k) => v[k], doc) : null
    const last = t[t.length - 1]
    if (op.op === 'select') {
      const target = getAt(doc, op.path)
      const kept = target.filter((el, i) =>
        op.indexes ? op.indexes.includes(i) : matches(el, op.where)
      )
      if (!kept.length) throw new Error(`select ${op.path}: nothing matches`)
      if (t.length) parent[last] = kept
      else doc = kept
    } else if (op.op === 'reject') {
      const target = getAt(doc, op.path)
      const kept = target.filter((el) => !matches(el, op.where))
      if (t.length) parent[last] = kept
      else doc = kept
    } else if (op.op === 'test') {
      if (JSON.stringify(getAt(doc, op.path)) !== JSON.stringify(op.value))
        throw new Error(`test ${op.path} failed`)
    } else if (op.op === 'remove') {
      if (Array.isArray(parent)) parent.splice(Number(last), 1)
      else delete parent[last]
    } else if (op.op === 'add' || op.op === 'replace' || op.op === 'copy') {
      const value =
        op.op === 'copy' ? clone(getAt(doc, op.from)) : clone(op.value)
      if (!t.length) doc = value
      else if (Array.isArray(parent) && op.op === 'add')
        parent.splice(last === '-' ? parent.length : Number(last), 0, value)
      else {
        if (op.op === 'replace' && !(last in parent))
          throw new Error(`replace ${op.path}: no such member`)
        parent[last] = value
      }
    } else throw new Error(`unsupported patch op ${op.op}`)
  }
  return doc
}

// ---------- request model ----------
const bodyBuffer = (body) => {
  if (body == null) return Buffer.alloc(0)
  if (typeof body === 'string') return Buffer.from(body, 'utf8')
  return Buffer.from(JSON.stringify(body), 'utf8')
}

const recKeyOf = ({ method, url, body, accept, origin, anon }) =>
  sha256(
    [method, url, core.bodySha256(body), accept || '', origin ? 'o' : '']
      .concat(anon ? ['anon'] : [])
      .join('\n')
  ).slice(0, 16)

const hostOf = (url) => new URL(url).hostname

const normaliseEntry = (e, defaults = {}) => {
  const o = { kind: 'live', ...defaults, ...e }
  if (o.kind === 'live' || (o.kind === 'derive' && o.serve)) {
    const r = o.request || {}
    if (o.kind === 'live') {
      if (!r.method || !r.url)
        throw new Error(`entry ${o.id}: request needs method and url`)
      r.method = r.method.toUpperCase()
      if (new URL(r.url).href !== r.url && !o.rawUrl)
        throw new Error(
          `entry ${o.id}: url is not in href form (${
            new URL(r.url).href
          }); the app sends href strings`
        )
      o.request = r
    }
  }
  if (!o.id) {
    o.id = `${o.request.method.toLowerCase()}-${core
      .keyOf(o.request.method, o.request.url, bodyBuffer(o.request.body))
      .slice(0, 8)}`
  }
  if (!o.scenario) throw new Error(`entry ${o.id}: scenario is required`)
  if (o.accept == null) o.accept = [200]
  return o
}

function checkReadOnly(entry) {
  const { method, url } = entry.request
  const u = new URL(url)
  if (method === 'GET' || method === 'HEAD') return
  if (
    method === 'POST' &&
    u.hostname === API_HOST &&
    READ_ONLY_POSTS.some((re) => re.test(u.pathname))
  )
    return
  throw new Abort(
    7,
    `entry ${entry.id}: ${method} ${u.pathname} is not a read-only call (E10, E16, E17 are hand fixtures)`
  )
}

// ---------- lock, throttle, ledger ----------
async function acquireLock(out, waitMs) {
  const dir = path.join(out, '.lock')
  const started = Date.now()
  mkdirp(out)
  for (;;) {
    try {
      fs.mkdirSync(dir)
      fs.writeFileSync(
        path.join(dir, 'owner.json'),
        JSON.stringify({ pid: process.pid, at: new Date().toISOString() })
      )
      return () => {
        try {
          fs.rmSync(dir, { recursive: true, force: true })
        } catch {
          /* nothing to release */
        }
      }
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
      let alive = true
      try {
        const o = readJson(path.join(dir, 'owner.json'))
        process.kill(o.pid, 0)
      } catch (err) {
        alive = err && err.code === 'EPERM'
        // owner file not yet written: wait a moment before calling the lock stale
        if (
          !fs.existsSync(path.join(dir, 'owner.json')) &&
          Date.now() - fs.statSync(dir).mtimeMs < 5000
        )
          alive = true
      }
      if (!alive) {
        fs.rmSync(dir, { recursive: true, force: true })
        continue
      }
      if (Date.now() - started > waitMs)
        throw new Abort(3, 'lock timeout: another recorder run holds the lock')
      await sleep(2000)
    }
  }
}

const ledgerFile = (out) => path.join(out, 'ledger.ndjson')
// requests that never left the machine (DNS or connect failures) are logged but do not use the budget
const ledgerCount = (out) =>
  fs.existsSync(ledgerFile(out))
    ? fs
        .readFileSync(ledgerFile(out), 'utf8')
        .split('\n')
        .filter(Boolean)
        .filter((l) => !l.includes('"uncounted":true')).length
    : 0

async function throttle(out, minInterval) {
  const f = path.join(out, '.last-request')
  let last = 0
  try {
    last = Number(fs.readFileSync(f, 'utf8')) || 0
  } catch {
    /* first request */
  }
  const wait = last + minInterval - Date.now()
  if (wait > 0) await sleep(wait)
}
const touchThrottle = (out) =>
  fs.writeFileSync(path.join(out, '.last-request'), String(Date.now()))

// ---------- HTTP ----------
function decode(buf, enc) {
  const e = String(enc || '').toLowerCase()
  if (e === 'gzip' || e === 'x-gzip') return zlib.gunzipSync(buf)
  if (e === 'deflate') return zlib.inflateSync(buf)
  if (e === 'br') return zlib.brotliDecompressSync(buf)
  return buf
}

function rawRequest(urlStr, { method, headers, body, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr)
    const lib = u.protocol === 'http:' ? http : https
    const req = lib.request(
      u,
      {
        method,
        headers: { Connection: 'close', ...headers },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const raw = Buffer.concat(chunks)
          const pairs = []
          for (let i = 0; i < res.rawHeaders.length; i += 2)
            pairs.push([res.rawHeaders[i], res.rawHeaders[i + 1]])
          let decoded
          try {
            decoded = decode(raw, res.headers['content-encoding'])
          } catch (e) {
            return reject(new Error(`body decode failed: ${e.message}`))
          }
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: pairs,
            body: decoded,
          })
        })
        res.on('error', reject)
      }
    )
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
    if (body && body.length) req.write(body)
    req.end()
  })
}

// ---------- the recorder ----------
export async function run(opts) {
  const {
    out,
    entries,
    force = false,
    dryRun = false,
    rawOnly = false,
    writeOnly = false,
    budget = BUDGET,
    lockWaitMs = 4 * 3600 * 1000,
    fixturesRoot = FIXTURES_DIR,
    selfTest = null,
    envFile = path.join(REPO, '.env.fixtures'),
    only = null,
    quiet = false,
  } = opts
  const say = quiet ? () => {} : log
  const minInterval = selfTest ? selfTest.minInterval : MIN_INTERVAL_MS
  const rateWaitMs = selfTest ? selfTest.rateWaitMs : RATE_WAIT_MS
  const apiMap = (u) =>
    selfTest && u.startsWith(`https://${API_HOST}`)
      ? selfTest.base + u.slice(`https://${API_HOST}`.length)
      : u

  const key = selfTest
    ? selfTest.key
    : writeOnly || dryRun
    ? null
    : readApiKey(envFile)
  const needsKey = !writeOnly && !dryRun
  if (needsKey && !key) throw new Abort(7, 'no API key (.env.fixtures API_KEY)')
  const keyFor = (url) => {
    const h = hostOf(url)
    return key && h === API_HOST ? key : null
  }

  mkdirp(path.join(out, 'raw'))
  const release =
    dryRun || writeOnly ? () => {} : await acquireLock(out, lockWaitMs)
  const summary = {
    requests: 0,
    cached: 0,
    failed: [],
    statuses: {},
    written: [],
    skipped: [],
    n4xx: 0,
    n429: 0,
  }
  const results = new Map() // entry id -> { rawKey, status }
  const onInt = () => {
    release()
    process.exit(130)
  }
  const onTerm = () => {
    release()
    process.exit(143)
  }
  process.on('SIGINT', onInt)
  process.on('SIGTERM', onTerm)

  const loadRaw = (rk) => {
    const f = path.join(out, 'raw', `${rk}.json`)
    return fs.existsSync(f) ? readJson(f) : null
  }

  async function liveFetch(entry, rk, attemptCap = 3) {
    const r = entry.request
    const target = apiMap(r.url)
    const bodyBuf = bodyBuffer(r.body)
    // `anon`: the browser sends no credentials to this endpoint (E21, E22 logos): no key, no Authorization
    const k = entry.anon ? null : keyFor(r.url)
    const headers = {
      'User-Agent': 'node',
      'Accept-Encoding': 'gzip, deflate',
      'Accept': 'application/json',
      ...(r.headers || {}),
    }
    if (bodyBuf.length && typeof r.body === 'object')
      headers['Content-Type'] = 'application/json'
    if (bodyBuf.length) headers['Content-Length'] = String(bodyBuf.length)
    if (entry.origin) {
      headers.Origin = ORIGIN_HEADER
      headers.Referer = `${ORIGIN_HEADER}/`
    }
    if (k) headers.Authorization = `Bearer ${k}`
    let retries429 = 0
    let retries5xx = 0
    let netRetries = 0
    for (;;) {
      if (ledgerCount(out) >= budget)
        throw new Abort(6, `budget of ${budget} live requests reached`)
      await throttle(out, minInterval)
      const t0 = Date.now()
      let res
      let chain = []
      try {
        let cur = target
        for (let hop = 0; ; hop++) {
          res = await rawRequest(cur, {
            method: r.method,
            headers,
            body: bodyBuf,
            timeoutMs: 70000,
          })
          const redirect =
            res.status >= 300 &&
            res.status < 400 &&
            res.headers.find(([n]) => n.toLowerCase() === 'location')
          // never follow where the key travels; elsewhere follow like the app's fetch does
          if (redirect && !k && hop < 5) {
            chain.push({ status: res.status, location: redirect[1] })
            cur = new URL(redirect[1], cur).href
            continue
          }
          break
        }
      } catch (e) {
        touchThrottle(out)
        // the network can drop on this machine: a request that never connected (DNS, unreachable) is waited out
        // with a growing back-off and does not use the budget; timeouts and resets get a few short retries
        const noConnect =
          /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|ENETDOWN/.test(
            `${e.code || ''} ${e.message}`
          )
        fs.appendFileSync(
          ledgerFile(out),
          `${JSON.stringify({
            t: new Date().toISOString(),
            id: entry.id,
            method: r.method,
            url: r.url,
            error: redact(e.message, key),
            ...(noConnect ? { uncounted: true } : {}),
          })}\n`
        )
        if (noConnect) {
          if (netRetries++ < NET_BACKOFF_MS.length) {
            const wait = selfTest ? 50 : NET_BACKOFF_MS[netRetries - 1]
            say(
              `network unreachable on ${entry.id}; waiting ${Math.round(
                wait / 1000
              )} s (try ${netRetries}/${NET_BACKOFF_MS.length})`
            )
            await sleep(wait)
            continue
          }
        } else if (retries5xx++ < 3) {
          await sleep(selfTest ? 50 : 10000 * retries5xx)
          continue
        }
        throw new Error(
          `network error for ${entry.id}: ${redact(e.message, key)}`
        )
      }
      touchThrottle(out)
      summary.requests++
      summary.statuses[res.status] = (summary.statuses[res.status] || 0) + 1
      fs.appendFileSync(
        ledgerFile(out),
        `${JSON.stringify({
          t: new Date().toISOString(),
          id: entry.id,
          method: r.method,
          url: r.url,
          status: res.status,
          ms: Date.now() - t0,
        })}\n`
      )
      if (res.status === 429) {
        summary.n429++
        if (retries429++ >= 2)
          throw new Abort(4, `429 on ${entry.id}: aborting after 2 retries`)
        log(
          `429 on ${entry.id}: waiting ${Math.round(
            rateWaitMs / 60000
          )} min before retry ${retries429}/2`
        )
        await sleep(rateWaitMs)
        continue
      }
      if (res.status === 401 || res.status === 403) {
        summary.n4xx++
        throw new Abort(
          5,
          `${res.status} on ${entry.id}: the key is not accepted for this call; aborting`
        )
      }
      if (
        res.status >= 500 &&
        !(
          entry.accept === 'any' || [].concat(entry.accept).includes(res.status)
        )
      ) {
        // keep what the API said: a real 5xx body is a source for the 500 fixtures
        fs.writeFileSync(
          path.join(out, 'raw', `${rk}.attempt${summary.requests}.json`),
          JSON.stringify({
            entry: entry.id,
            status: res.status,
            headers: res.headers,
            bodyBase64: res.body.toString('base64'),
            at: new Date().toISOString(),
          })
        )
        if (retries5xx++ < 2) {
          await sleep(5000 * retries5xx)
          continue
        }
      }
      if (res.status >= 400) summary.n4xx++
      // a response must never carry the key back
      const headerText = JSON.stringify(res.headers)
      if (k && (res.body.includes(Buffer.from(k)) || headerText.includes(k)))
        throw new Abort(
          7,
          `answer to ${entry.id} contains the API key; not stored`
        )
      const rec = {
        schema: 1,
        recKey: rk,
        entry: entry.id,
        request: {
          method: r.method,
          url: r.url,
          bodySha256: core.bodySha256(bodyBuf),
          bodyText: bodyBuf.length ? bodyBuf.toString('utf8') : undefined,
          accept: headers.Accept,
          origin: Boolean(entry.origin),
        },
        response: {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
          bodyBase64: res.body.toString('base64'),
          redirects: chain.length ? chain : undefined,
        },
        recordedAt: new Date().toISOString(),
      }
      if (attemptCap) mkdirp(path.join(out, 'raw'))
      fs.writeFileSync(path.join(out, 'raw', `${rk}.json`), JSON.stringify(rec))
      return rec
    }
  }

  const statusOk = (entry, status) =>
    entry.accept === 'any' || [].concat(entry.accept).includes(status)

  // build the resolver-format record from a raw answer
  function buildFixture(entry, rawRec, { serve, patch }) {
    const resp = rawRec.response
    const bodyBuf = Buffer.from(resp.bodyBase64, 'base64')
    const ctype = (resp.headers.find(
      ([n]) => n.toLowerCase() === 'content-type'
    ) || ['', ''])[1]
    const stats = newStats()
    const hs = scrubHeaders(resp.headers, key)
    addStats(stats, hs.stats)
    let body
    const asText = /json|text|xml|csv|javascript/i.test(ctype) || !ctype
    if (asText && bodyBuf.length) {
      const text = bodyBuf.toString('utf8')
      let parsed
      let isJson = false
      try {
        parsed = JSON.parse(text)
        isJson = true
      } catch {
        /* text */
      }
      if (isJson) {
        const s = scrubJson(parsed)
        addStats(stats, s.stats)
        let value = s.value
        if (patch && patch.length) value = applyPatch(value, patch)
        const compact = JSON.stringify(value)
        const unchanged =
          Object.values(s.stats).every((n) => n === 0) &&
          !(patch && patch.length)
        body =
          unchanged && compact !== text
            ? { encoding: 'utf8', data: text }
            : { encoding: 'json', data: value }
      } else {
        const s = scrubText(text)
        addStats(stats, s.stats)
        body = { encoding: 'utf8', data: s.text }
      }
    } else {
      body = bodyBuf.length
        ? { encoding: 'base64', data: bodyBuf.toString('base64') }
        : { encoding: 'utf8', data: '' }
    }
    const reqTriple = serve || {
      method: rawRec.request.method,
      url: rawRec.request.url,
      body: rawRec.request.bodyText,
    }
    const reqBody = bodyBuffer(reqTriple.body)
    const kind = serve || (patch && patch.length) ? 'derived' : 'recorded'
    const nonZero = Object.fromEntries(
      Object.entries(stats).filter(([, n]) => n)
    )
    return {
      key: core.keyOf(reqTriple.method, reqTriple.url, reqBody),
      fixture: {
        schema: 1,
        scenario: entry.scenario,
        request: {
          method: reqTriple.method,
          url: reqTriple.url,
          bodySha256: core.bodySha256(reqBody),
          ...(reqBody.length ? { bodyText: reqBody.toString('utf8') } : {}),
        },
        response: { status: resp.status, headers: hs.headers, body },
        source: {
          kind,
          from:
            kind === 'recorded'
              ? null
              : `${rawRec.request.method} ${rawRec.request.url}`,
          patch: patch && patch.length ? patch : null,
          recordedAt: rawRec.recordedAt,
          ...(Object.keys(nonZero).length ? { scrubbed: nonZero } : {}),
          ...(entry.note ? { note: entry.note } : {}),
        },
      },
    }
  }

  const prettier = await loadPrettier()
  const format = (obj) => prettier(JSON.stringify(obj))

  function writeFixture(dirName, built, entry) {
    const dir = path.join(fixturesRoot, dirName, entry.scenario)
    mkdirp(dir)
    const file = path.join(dir, `${built.key}.json`)
    const text = format(built.fixture)
    // safety net: nothing that looks like the key or a credential may reach a committed file
    if (key && text.includes(key))
      throw new Abort(
        7,
        `fixture for ${entry.id} contains the API key; not written`
      )
    if (/Bearer\s/.test(text))
      throw new Abort(
        7,
        `fixture for ${entry.id} contains a Bearer token; not written`
      )
    // one key, one answer: a second scenario with the same triple must carry the same answer
    for (const other of ['api', 'hand']) {
      const root = path.join(fixturesRoot, other)
      if (!fs.existsSync(root)) continue
      for (const sc of fs.readdirSync(root)) {
        const f = path.join(root, sc, `${built.key}.json`)
        if (sc !== entry.scenario && fs.existsSync(f)) {
          const prev = readJson(f)
          // calibration fixtures of the harness (hand/harness-*) are superseded by recordings (I-29): the api/
          // directory is read first by the resolver, the older file stays until its owner removes it
          if (other === 'hand' && sc.startsWith('harness-')) {
            summary.skipped.push(
              `${entry.id}: supersedes hand/${sc}/${built.key}.json (harness calibration)`
            )
            continue
          }
          if (
            JSON.stringify(prev.response) !==
            JSON.stringify(built.fixture.response)
          )
            throw new Abort(
              7,
              `${entry.id}: key ${built.key} already holds a different answer in ${other}/${sc}`
            )
          summary.skipped.push(
            `${entry.id}: same answer already in ${other}/${sc}`
          )
          return null
        }
      }
    }
    fs.writeFileSync(file, text)
    summary.written.push({
      id: entry.id,
      scenario: entry.scenario,
      key: built.key,
      file: path.relative(REPO, file),
    })
    return built.key
  }

  const fixtureByKey = (k) => {
    for (const d of ['api', 'hand']) {
      const root = path.join(fixturesRoot, d)
      if (!fs.existsSync(root)) continue
      for (const sc of fs.readdirSync(root)) {
        const f = path.join(root, sc, `${k}.json`)
        if (fs.existsSync(f)) return readJson(f)
      }
    }
    return null
  }

  const written = new Map() // entry id -> { key, fixture }

  try {
    const wanted = (e) =>
      !only ||
      only.some(
        (o) => e.id === o || e.scenario === o || e.id.startsWith(`${o}.`)
      )
    for (const raw of entries) {
      const entry = normaliseEntry(raw)
      if (!wanted(entry)) continue
      if (entry.kind === 'live') {
        checkReadOnly(entry)
        const r = entry.request
        const rk = recKeyOf({
          method: r.method,
          url: r.url,
          body: bodyBuffer(r.body),
          accept:
            (r.headers && (r.headers.Accept || r.headers.accept)) ||
            'application/json',
          origin: entry.origin,
          anon: entry.anon,
        })
        let rec = loadRaw(rk)
        if (dryRun) {
          say(
            `${rec && !force ? 'cached ' : 'request'} ${entry.id} ${r.method} ${
              r.url
            }`
          )
          continue
        }
        if (writeOnly && !rec) {
          summary.failed.push(`${entry.id}: no raw answer to write from`)
          continue
        }
        if (!rec || (force && !writeOnly)) {
          rec = await liveFetch(entry, rk)
          say(
            `${String(summary.requests).padStart(3)} ${entry.id} ${r.method} ${
              new URL(r.url).pathname
            }${new URL(r.url).search.slice(0, 40)} -> ${
              rec.response.status
            } (${Math.round(
              (Buffer.byteLength(rec.response.bodyBase64) * 0.75) / 1024
            )} KB)`
          )
        } else summary.cached++
        results.set(entry.id, { rk, status: rec.response.status })
        if (!statusOk(entry, rec.response.status)) {
          summary.failed.push(
            `${entry.id}: status ${rec.response.status} not in ${JSON.stringify(
              entry.accept
            )}`
          )
          continue
        }
        if (rawOnly || entry.write === false) continue
        const serve = entry.serve
          ? {
              method: entry.serve.method || r.method,
              url: entry.serve.url || r.url,
              body: entry.serve.body !== undefined ? entry.serve.body : r.body,
            }
          : null
        const built = buildFixture(entry, rec, { serve, patch: entry.patch })
        if (entry.serve && entry.serve.status)
          built.fixture.response.status = entry.serve.status
        const k = writeFixture('api', built, entry)
        written.set(entry.id, { key: k || built.key, fixture: built.fixture })
      } else if (entry.kind === 'derive') {
        if (dryRun || rawOnly) continue
        const from = entry.from
        let srcFixture = null
        if (from && from.attempt) {
          // a real 5xx answer kept from an earlier request (raw/<name>.json): the source of the 500 fixtures
          const a = readJson(path.join(out, 'raw', `${from.attempt}.json`))
          const rawRec = {
            request: {
              method: (from.method || 'GET').toUpperCase(),
              url: from.url,
            },
            response: {
              status: a.status,
              headers: a.headers,
              bodyBase64: a.bodyBase64,
            },
            recordedAt: a.at,
          }
          const s = entry.serve || {}
          const serve = {
            method: (s.method || rawRec.request.method).toUpperCase(),
            url: s.url || from.url,
            body: s.body,
          }
          const built = buildFixture(entry, rawRec, {
            serve,
            patch: entry.patch,
          })
          if (entry.note) built.fixture.source.note = entry.note
          const k = writeFixture('api', built, entry)
          written.set(entry.id, { key: k || built.key, fixture: built.fixture })
          continue
        }
        if (typeof from === 'string' && written.has(from))
          srcFixture = written.get(from).fixture
        else if (typeof from === 'string' && /^[0-9a-f]{12}$/.test(from))
          srcFixture = fixtureByKey(from)
        else if (typeof from === 'string') {
          // entry id of an earlier run: find its key through the plan index
          const idx = fs.existsSync(path.join(out, 'index.json'))
            ? readJson(path.join(out, 'index.json'))
            : {}
          if (idx[from]) srcFixture = fixtureByKey(idx[from].key)
        } else if (from && from.url)
          srcFixture = fixtureByKey(
            core.keyOf(
              (from.method || 'GET').toUpperCase(),
              from.url,
              bodyBuffer(from.body)
            )
          )
        if (!srcFixture) {
          summary.failed.push(
            `${entry.id}: derive source ${JSON.stringify(from)} not found`
          )
          continue
        }
        const f = clone(srcFixture)
        const ov = entry.response || {}
        if (ov.status != null) f.response.status = ov.status
        if (ov.headers) f.response.headers = ov.headers
        if (ov.setHeaders) {
          for (const [n, v] of Object.entries(ov.setHeaders)) {
            const i = f.response.headers.findIndex(
              ([h]) => h.toLowerCase() === n.toLowerCase()
            )
            if (i >= 0) f.response.headers[i] = [f.response.headers[i][0], v]
            else f.response.headers.push([n, v])
          }
        }
        if (ov.body) f.response.body = ov.body
        if (entry.patch && entry.patch.length) {
          // exact-byte JSON text (PHP-escaped slashes) is parsed for the patch; the patched copy is stored parsed
          if (f.response.body.encoding === 'utf8')
            f.response.body = {
              encoding: 'json',
              data: JSON.parse(f.response.body.data),
            }
          if (f.response.body.encoding !== 'json')
            throw new Error(`${entry.id}: patch needs a JSON body`)
          f.response.body.data = applyPatch(f.response.body.data, entry.patch)
          // the patched copy goes through the scrub again
          f.response.body.data = scrubJson(f.response.body.data).value
        }
        const s = entry.serve || {}
        const srv = {
          method: (s.method || f.request.method).toUpperCase(),
          url: s.url || f.request.url,
          body: s.body !== undefined ? s.body : f.request.bodyText,
        }
        const rb = bodyBuffer(srv.body)
        f.scenario = entry.scenario
        f.request = {
          method: srv.method,
          url: srv.url,
          bodySha256: core.bodySha256(rb),
          ...(rb.length ? { bodyText: rb.toString('utf8') } : {}),
        }
        f.source = {
          kind: 'derived',
          from: `${srcFixture.request.method} ${srcFixture.request.url}`,
          patch: entry.patch && entry.patch.length ? entry.patch : null,
          recordedAt: srcFixture.source.recordedAt,
          ...(Object.keys(ov).length ? { overrides: Object.keys(ov) } : {}),
          ...(entry.note ? { note: entry.note } : {}),
        }
        const built = { key: core.keyOf(srv.method, srv.url, rb), fixture: f }
        const k = writeFixture('api', built, entry)
        written.set(entry.id, { key: k || built.key, fixture: f })
      } else if (entry.kind === 'hand') {
        if (dryRun || rawOnly) continue
        const rq = entry.request
        const rb = bodyBuffer(rq.body)
        const ov = entry.response
        const f = {
          schema: 1,
          scenario: entry.scenario,
          request: {
            method: rq.method.toUpperCase(),
            url: rq.url,
            bodySha256: core.bodySha256(rb),
            ...(rb.length ? { bodyText: rb.toString('utf8') } : {}),
          },
          response: {
            status: ov.status,
            headers: ov.headers || [],
            body: ov.body,
          },
          source: {
            kind: 'hand',
            from: null,
            patch: null,
            recordedAt: null,
            ...(entry.note ? { note: entry.note } : {}),
          },
        }
        const built = {
          key: core.keyOf(f.request.method, f.request.url, rb),
          fixture: f,
        }
        const k = writeFixture('hand', built, entry)
        written.set(entry.id, { key: k || built.key, fixture: f })
      } else throw new Error(`entry ${entry.id}: unknown kind ${entry.kind}`)
    }
    // index of what exists, for derive sources of later runs
    if (!dryRun && written.size) {
      const idxFile = path.join(out, 'index.json')
      const idx = fs.existsSync(idxFile) ? readJson(idxFile) : {}
      for (const [id, v] of written)
        idx[id] = { key: v.key, scenario: v.fixture.scenario }
      fs.writeFileSync(idxFile, JSON.stringify(idx, null, 1))
    }
  } finally {
    process.off('SIGINT', onInt)
    process.off('SIGTERM', onTerm)
    release()
  }
  summary.ledger = ledgerCount(out)
  return summary
}

async function loadPrettier() {
  try {
    // the repository's Prettier format, synchronously (Prettier 3 has no sync API)
    const { formatSync } = await import('./prettier-sync.mjs')
    require.resolve('prettier')
    const file = path.join(REPO, 'test', 'fixtures', 'api', 'fixture.json')
    return (text) => formatSync(text, file, 'json')
  } catch {
    return (text) => `${JSON.stringify(JSON.parse(text), null, 2)}\n`
  }
}

// ---------- scenarios.json from the plan ----------
// every fixture file by key (a key can live in another scenario's folder: one key, one answer)
const filesByKey = (fixturesRoot) => {
  const m = new Map()
  for (const d of ['api', 'hand']) {
    const root = path.join(fixturesRoot, d)
    if (!fs.existsSync(root)) continue
    for (const sc of fs.readdirSync(root))
      for (const f of fs.readdirSync(path.join(root, sc)))
        if (f.endsWith('.json') && !m.has(path.basename(f, '.json')))
          m.set(path.basename(f, '.json'), {
            dir: d,
            scenario: sc,
            file: `${d}/${sc}/${f}`,
          })
  }
  return m
}

export function buildIndex(plan, fixturesRoot = FIXTURES_DIR) {
  const byKey = filesByKey(fixturesRoot)
  const scenarios = {}
  for (const [name, meta] of Object.entries(plan.scenarios || {}))
    scenarios[name] = { ...meta, fixtures: [] }
  const entryById = new Map(
    (plan.entries || []).map((raw) => [raw.id, normaliseEntry(raw)])
  )
  // the request triple an entry answers (a derived copy inherits what it does not serve differently)
  const tripleOf = (e) => {
    if (e.kind === 'live')
      return {
        method: ((e.serve && e.serve.method) || e.request.method).toUpperCase(),
        url: (e.serve && e.serve.url) || e.request.url,
        body:
          e.serve && e.serve.body !== undefined ? e.serve.body : e.request.body,
      }
    if (e.kind === 'hand')
      return {
        method: e.request.method.toUpperCase(),
        url: e.request.url,
        body: e.request.body,
      }
    // derive
    const src =
      typeof e.from === 'string' && entryById.has(e.from)
        ? tripleOf(entryById.get(e.from))
        : {
            method: (e.from && e.from.method) || 'GET',
            url: e.from && e.from.url,
            body: e.from && e.from.body,
          }
    const s = e.serve || {}
    return {
      method: (s.method || src.method).toUpperCase(),
      url: s.url || src.url,
      body: s.body !== undefined ? s.body : src.body,
    }
  }
  for (const raw of plan.entries || []) {
    const e = entryById.get(raw.id)
    const triple = tripleOf(e)
    const k = core.keyOf(
      triple.method.toUpperCase(),
      triple.url,
      bodyBuffer(triple.body)
    )
    const found = byKey.get(k)
    let kind = 'missing'
    if (found) {
      const j = readJson(path.join(fixturesRoot, found.file))
      kind = e.write === false ? 'same-key' : j.source.kind
    }
    if (!scenarios[e.scenario]) scenarios[e.scenario] = { fixtures: [] }
    scenarios[e.scenario].fixtures.push({
      id: e.id,
      endpoint: e.endpoint || null,
      kind,
      method: triple.method.toUpperCase(),
      url: triple.url,
      ...(triple.body != null
        ? {
            bodySha256: core.bodySha256(bodyBuffer(triple.body)),
            bodyText: bodyBuffer(triple.body).toString('utf8'),
          }
        : {}),
      key: k,
      file: found ? found.file : null,
      ...(found && found.scenario !== e.scenario
        ? { sharedWith: found.scenario }
        : {}),
    })
  }
  return {
    schema: 1,
    generatedFrom: 'test/fixtures/record-plan.json',
    note: 'Resolver key = sha256("METHOD url bodySha256")[0..12]; Authorization is never stored or matched. Routes are the page paths that request the fixtures.',
    names: plan.names || {},
    picks: plan.picks || {},
    notes: plan.notes || [],
    scenarios,
  }
}

// ---------- verify ----------
// Every plan entry resolves through the harness resolver to the bytes of its fixture file; recorded fixtures that
// the scrub did not touch equal the raw answer byte for byte; no orphan files; no unexpected resolver problem.
export function verify(plan, { out = null, fixturesRoot = FIXTURES_DIR } = {}) {
  const problems = []
  const r = core.createResolver({ root: fixturesRoot })
  for (const p of r.problems())
    if (!/hand\/harness-/.test(p)) problems.push(`resolver: ${p}`)
  const idx = buildIndex(plan, fixturesRoot)
  const seen = new Set()
  let checked = 0
  let exact = 0
  for (const [name, sc] of Object.entries(idx.scenarios)) {
    for (const f of sc.fixtures) {
      checked++
      if (!f.file) {
        problems.push(`${f.id}: no fixture file for ${f.method} ${f.url}`)
        continue
      }
      seen.add(f.file)
      const res = r.resolve(f.method, f.url, f.bodyText || '')
      if (res.unmatched || res.rule) {
        problems.push(
          `${f.id}: the resolver does not answer ${f.method} ${f.url}`
        )
        continue
      }
      const rec = readJson(path.join(fixturesRoot, f.file))
      const want = core.decodeBody(rec.response.body)
      if (res.status !== rec.response.status || !res.body.equals(want))
        problems.push(`${f.id}: resolver answer differs from ${f.file}`)
      if (path.basename(f.file, '.json') !== f.key)
        problems.push(`${f.id}: ${f.file} is not named by its key ${f.key}`)
      // recorded: the served body is the raw body unless the scrub changed it
      const content = Object.entries(rec.source.scrubbed || {}).filter(
        ([k]) => k !== 'headersDropped'
      )
      if (out && rec.source.kind === 'recorded' && f.kind !== 'same-key') {
        const rawDir = path.join(out, 'raw')
        const entry = (plan.entries || []).find((e) => e.id === f.id)
        if (entry && entry.kind === undefined && fs.existsSync(rawDir)) {
          const rr = entry.request
          const rk = recKeyOf({
            method: rr.method.toUpperCase(),
            url: rr.url,
            body: bodyBuffer(rr.body),
            accept:
              (rr.headers && (rr.headers.Accept || rr.headers.accept)) ||
              'application/json',
            origin: entry.origin,
            anon: entry.anon,
          })
          const rf = path.join(rawDir, `${rk}.json`)
          if (fs.existsSync(rf)) {
            const raw = Buffer.from(readJson(rf).response.bodyBase64, 'base64')
            let same = false
            if (rec.response.body.encoding !== 'json') same = raw.equals(want)
            else if (!content.length && !(entry.patch && entry.patch.length))
              same =
                JSON.stringify(JSON.parse(raw.toString('utf8'))) ===
                JSON.stringify(rec.response.body.data)
            else same = null // scrubbed or patched: not comparable byte for byte
            if (same === false)
              problems.push(
                `${f.id}: recorded body differs from the raw answer`
              )
            else if (same) exact++
          }
        }
      }
    }
    void name
  }
  for (const d of ['api', 'hand']) {
    const root = path.join(fixturesRoot, d)
    if (!fs.existsSync(root)) continue
    for (const sc of fs.readdirSync(root)) {
      if (sc.startsWith('harness-')) continue
      for (const file of fs.readdirSync(path.join(root, sc)))
        if (file.endsWith('.json') && !seen.has(`${d}/${sc}/${file}`))
          problems.push(`orphan fixture ${d}/${sc}/${file}`)
    }
  }
  return { checked, exactBytes: exact, files: seen.size, problems }
}

// ---------- self test ----------
async function selfTest() {
  const os = await import('node:os')
  const assert = (await import('node:assert')).default
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fixrec-'))
  const out = path.join(tmp, 'out')
  const root = path.join(tmp, 'fixtures')
  const fakeKey = 'sKm3Qw8ZxT0pLr5Nv2HbYc9GdFa7JeUi'
  const seen = []
  let n429 = 0
  const server = http.createServer((req, res) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      seen.push({
        method: req.method,
        url: req.url,
        auth: req.headers.authorization || null,
        origin: req.headers.origin || null,
      })
      const body = Buffer.concat(chunks).toString('utf8')
      const send = (status, headers, data) => {
        res.writeHead(status, headers)
        res.end(data)
      }
      if (req.url.startsWith('/v3/works/1')) {
        const json = JSON.stringify({
          id: 1,
          title: 'Climate',
          email: 'someone@example.org',
          fullText: 'x'.repeat(50),
          abstract: 'mail me: a.b@uni.example.com now',
          authors: [{ name: 'A. Author' }],
        })
        return send(
          200,
          {
            'content-type': 'application/json',
            'x-b': '2',
            'x-a': '1',
            'set-cookie': 'sid=abc',
          },
          json
        )
      }
      if (req.url.startsWith('/v3/works/gz'))
        return send(
          200,
          { 'content-type': 'application/json', 'content-encoding': 'gzip' },
          zlib.gzipSync('{"ok":true}')
        )
      if (req.url.startsWith('/v3/works/404'))
        return send(
          404,
          { 'content-type': 'application/json' },
          '{"message":"Not found"}'
        )
      if (req.url.startsWith('/v3/works/429')) {
        n429++
        return n429 <= 1
          ? send(429, { 'retry-after': '1' }, '')
          : send(200, { 'content-type': 'application/json' }, '{"ok":1}')
      }
      if (req.url.startsWith('/v3/works/401')) return send(401, {}, '')
      if (req.url.startsWith('/v3/works/leak'))
        return send(
          200,
          { 'content-type': 'application/json' },
          `{"k":"${fakeKey}"}`
        )
      if (req.url.startsWith('/v3/search/works'))
        return send(
          200,
          { 'content-type': 'application/json' },
          JSON.stringify({ echo: body })
        )
      return send(404, {}, '')
    })
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port
  const st = {
    base: `http://127.0.0.1:${port}`,
    port,
    key: fakeKey,
    minInterval: 150,
    rateWaitMs: 300,
  }
  const mk = (id, p, extra = {}) => ({
    id,
    scenario: 'st',
    endpoint: 'E4',
    request: { method: 'GET', url: `https://${API_HOST}${p}` },
    ...extra,
  })
  const base = {
    out,
    fixturesRoot: root,
    selfTest: st,
    quiet: true,
    envFile: '/nonexistent',
  }
  const checks = []
  const ok = (name, cond) => {
    checks.push([name, Boolean(cond)])
    assert(cond, name)
  }
  try {
    // 1. record, scrub, ordered headers, key only as Authorization, nothing stored with the key
    const t0 = Date.now()
    let s = await run({
      ...base,
      entries: [mk('a', '/v3/works/1?t=undefined'), mk('b', '/v3/works/1?t=x')],
    })
    ok('two live requests', s.requests === 2 && seen.length === 2)
    ok('throttle spaced the requests', Date.now() - t0 >= 150)
    ok(
      'key sent as Bearer',
      seen.every((x) => x.auth === `Bearer ${fakeKey}`)
    )
    const files = fs.readdirSync(path.join(root, 'api', 'st'))
    ok('resolver files written', files.length === 2)
    const fx = readJson(path.join(root, 'api', 'st', files[0]))
    ok(
      'e-mails blanked',
      fx.response.body.data.email === '' && !JSON.stringify(fx).includes('@')
    )
    ok('full text blanked', fx.response.body.data.fullText === '')
    ok(
      'set-cookie dropped',
      !JSON.stringify(fx.response.headers).includes('set-cookie')
    )
    ok(
      'header order kept',
      fx.response.headers
        .map(([n]) => n)
        .join(',')
        .includes('x-b,x-a')
    )
    const rawAll = fs
      .readdirSync(path.join(out, 'raw'))
      .map((f) => fs.readFileSync(path.join(out, 'raw', f), 'utf8'))
      .join('')
    ok('key not in raw', !rawAll.includes(fakeKey))
    ok(
      'key not in fixtures',
      !JSON.stringify(
        files.map((f) => readJson(path.join(root, 'api', 'st', f)))
      ).includes(fakeKey)
    )
    // 2. cache
    s = await run({ ...base, entries: [mk('a', '/v3/works/1?t=undefined')] })
    ok('cache hit, no request', s.requests === 0 && s.cached === 1)
    // 3. gzip, 404 with accept
    s = await run({
      ...base,
      entries: [
        mk('g', '/v3/works/gz'),
        mk('n', '/v3/works/404', { accept: [404] }),
      ],
    })
    ok(
      'gzip decoded and 404 accepted',
      s.requests === 2 && s.failed.length === 0
    )
    s = await run({ ...base, entries: [mk('n2', '/v3/works/404?x=1')] })
    ok('unexpected status reported', s.failed.length === 1)
    // 4. 429: wait and retry once
    s = await run({ ...base, entries: [mk('r', '/v3/works/429')] })
    ok('429 retried', s.n429 === 1 && s.failed.length === 0)
    // 5. 401 aborts
    let code = 0
    try {
      await run({ ...base, entries: [mk('u', '/v3/works/401')] })
    } catch (e) {
      code = e.exitCode
    }
    ok('401 aborts with exit 5', code === 5)
    // 6. a key echoed by the server is not stored
    code = 0
    try {
      await run({ ...base, entries: [mk('l', '/v3/works/leak')] })
    } catch (e) {
      code = e.exitCode
    }
    ok('key echo aborts with exit 7', code === 7)
    // 7. mutating calls refused
    code = 0
    try {
      await run({
        ...base,
        entries: [
          {
            id: 'p',
            scenario: 'st',
            request: {
              method: 'POST',
              url: `https://${API_HOST}/internal/data-providers`,
              body: '{}',
            },
          },
        ],
      })
    } catch (e) {
      code = e.exitCode
    }
    ok('E16-like POST refused', code === 7)
    // 8. budget
    code = 0
    try {
      await run({ ...base, budget: 3, entries: [mk('z', '/v3/works/1?t=z')] })
    } catch (e) {
      code = e.exitCode
    }
    ok('budget stops', code === 6)
    // 9. lock excludes a second run
    const lockDir = path.join(out, '.lock')
    mkdirp(lockDir)
    fs.writeFileSync(
      path.join(lockDir, 'owner.json'),
      JSON.stringify({ pid: process.pid, at: 'x' })
    )
    code = 0
    try {
      await run({
        ...base,
        lockWaitMs: 100,
        entries: [mk('k', '/v3/works/1?t=k')],
      })
    } catch (e) {
      code = e.exitCode
    }
    ok('lock held -> exit 3', code === 3)
    fs.rmSync(lockDir, { recursive: true })
    // 10. POST body hashed as sent, search POST allowed
    s = await run({
      ...base,
      entries: [
        {
          id: 'q',
          scenario: 'st',
          endpoint: 'E1',
          request: {
            method: 'POST',
            url: `https://${API_HOST}/v3/search/works?t=undefined`,
            body: {
              q: 'climate',
              offset: 0,
              limit: 10,
              exclude: ['fullText'],
              sort: 'relevance',
            },
          },
        },
      ],
    })
    const key = core.keyOf(
      'POST',
      `https://${API_HOST}/v3/search/works?t=undefined`,
      JSON.stringify({
        q: 'climate',
        offset: 0,
        limit: 10,
        exclude: ['fullText'],
        sort: 'relevance',
      })
    )
    ok(
      'POST fixture keyed by the sent body',
      fs.existsSync(path.join(root, 'api', 'st', `${key}.json`))
    )
    // 11. derive and hand
    s = await run({
      ...base,
      entries: [
        {
          id: 'd',
          kind: 'derive',
          scenario: 'st',
          from: 'a',
          serve: { url: `https://${API_HOST}/v3/works/1001?t=undefined` },
          patch: [{ op: 'replace', path: '/id', value: 1001 }],
        },
        {
          id: 'h',
          kind: 'hand',
          scenario: 'st',
          request: { method: 'GET', url: `https://${API_HOST}/internal/hand` },
          response: {
            status: 200,
            headers: [['content-type', 'application/json']],
            body: { encoding: 'json', data: { hand: true } },
          },
        },
      ],
    })
    const dk = core.keyOf(
      'GET',
      `https://${API_HOST}/v3/works/1001?t=undefined`,
      ''
    )
    const df = readJson(path.join(root, 'api', 'st', `${dk}.json`))
    ok(
      'derived copy patched',
      df.response.body.data.id === 1001 && df.source.kind === 'derived'
    )
    ok('hand fixture written', fs.existsSync(path.join(root, 'hand', 'st')))
    // 12. resolver finds them
    const resolver = core.createResolver({ root })
    const hit = resolver.resolve(
      'GET',
      `https://${API_HOST}/v3/works/1001?t=undefined`,
      undefined
    )
    ok(
      'resolver serves the derived fixture',
      hit.status === 200 &&
        JSON.parse(hit.body.toString()).id === 1001 &&
        resolver.problems().length === 0
    )
    // 13. write-only rebuilds from raw
    fs.rmSync(path.join(root, 'api'), { recursive: true })
    s = await run({
      ...base,
      writeOnly: true,
      entries: [mk('a', '/v3/works/1?t=undefined')],
    })
    ok(
      'write-only rebuilds without network',
      s.requests === 0 && s.written.length === 1
    )
    // 13b. an unreachable host is waited out and does not use the budget
    const before = ledgerCount(out)
    let netErr = ''
    try {
      await run({
        ...base,
        selfTest: { ...st, base: 'http://nonexistent.invalid' },
        entries: [mk('nx', '/v3/works/1?t=nx')],
      })
    } catch (e) {
      netErr = e.message
    }
    ok(
      'unreachable host: retried, reported, budget untouched',
      /network error/.test(netErr) && ledgerCount(out) === before
    )
    // 14. patch ops
    const doc = { a: [{ k: 1 }, { k: 2 }, { k: 3 }], b: { c: 1 } }
    const p = applyPatch(doc, [
      { op: 'select', path: '/a', where: { k: 2 } },
      { op: 'add', path: '/b/d', value: 5 },
      { op: 'remove', path: '/b/c' },
    ])
    ok('patch ops', JSON.stringify(p) === '{"a":[{"k":2}],"b":{"d":5}}')
  } finally {
    server.close()
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  log(
    `fixtures-record self-test: ${checks.filter(([, c]) => c).length}/${
      checks.length
    } checks passed`
  )
}

// ---------- CLI ----------
async function main() {
  const args = process.argv.slice(2)
  const opt = (n, d) => {
    const i = args.indexOf(n)
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--')
      ? args[i + 1]
      : d
  }
  const all = (n) =>
    args.flatMap((a, i) => (a === n && args[i + 1] ? [args[i + 1]] : []))
  const has = (n) => args.includes(n)
  if (has('--self-test')) return selfTest()
  const out = path.resolve(
    opt(
      '--out',
      process.env.ARTIFACT_DIR
        ? path.join(process.env.ARTIFACT_DIR, 'fixtures')
        : ''
    )
  )
  if (!opt('--out') && !process.env.ARTIFACT_DIR) {
    console.error(
      'usage: fixtures-record --out <dir> [--plan [file]] [--requests <glob>] [--derive <spec>] [--force] [--dry-run] [--raw-only] [--write-only] [--index]'
    )
    process.exit(2)
  }
  const planFile = path.resolve(
    has('--plan')
      ? opt('--plan', path.join(FIXTURES_DIR, 'record-plan.json'))
      : path.join(FIXTURES_DIR, 'record-plan.json')
  )
  if (has('--verify')) {
    const v = verify(readJson(planFile), { out })
    for (const p of v.problems) console.error(`FAIL ${p}`)
    log(
      `verify: ${v.checked} plan entries resolve, ${v.files} fixture files, ${v.exactBytes} recorded bodies equal their raw answer, ${v.problems.length} problem(s)`
    )
    process.exit(v.problems.length ? 1 : 0)
  }
  if (has('--index')) {
    const plan = readJson(planFile)
    const idx = buildIndex(plan)
    const missing =
      idx.scenarios &&
      Object.values(idx.scenarios).flatMap((s) =>
        s.fixtures.filter((f) => f.kind === 'missing').map((f) => f.id)
      )
    const fmt = await loadPrettier()
    fs.writeFileSync(
      path.join(FIXTURES_DIR, 'scenarios.json'),
      fmt(JSON.stringify(idx))
    )
    log(
      `scenarios.json written: ${
        Object.keys(idx.scenarios).length
      } scenarios, ${missing.length} fixture(s) missing`
    )
    if (missing.length) log(`missing: ${missing.join(', ')}`)
    return
  }
  const entries = []
  if (has('--plan')) entries.push(...readJson(planFile).entries)
  for (const g of all('--requests')) {
    const files = globFiles(g)
    if (!files.length) {
      console.error(`no request file matches ${g}`)
      process.exit(2)
    }
    for (const f of files) {
      const j = readJson(f)
      const pkg = path.basename(f, '.json')
      for (const e of j.requests || j.entries || [])
        entries.push({ scenario: `req-${pkg}`, ...e })
    }
  }
  const d = opt('--derive')
  if (d) {
    const spec =
      d.trim().startsWith('{') || d.trim().startsWith('[')
        ? JSON.parse(d)
        : readJson(path.resolve(d))
    entries.push(...[].concat(spec).map((e) => ({ kind: 'derive', ...e })))
  }
  if (!entries.length) {
    console.error('nothing to do: pass --plan, --requests or --derive')
    process.exit(2)
  }
  try {
    const only = opt('--only') ? opt('--only').split(',') : null
    const s = await run({
      out,
      entries,
      only,
      force: has('--force'),
      dryRun: has('--dry-run'),
      rawOnly: has('--raw-only'),
      writeOnly: has('--write-only'),
      budget: Number(opt('--budget', BUDGET)),
      lockWaitMs: Number(opt('--lock-wait', 4 * 3600)) * 1000,
    })
    log(
      `done: ${s.requests} live request(s), ${s.cached} cached, ${s.written.length} file(s) written, ledger ${s.ledger}/${BUDGET}`
    )
    log(
      `statuses: ${JSON.stringify(s.statuses)}${
        s.n429 ? `, 429: ${s.n429}` : ''
      }`
    )
    for (const f of s.failed) console.error(`FAILED ${f}`)
    process.exit(s.failed.length ? 1 : 0)
  } catch (e) {
    if (e instanceof Abort) {
      console.error(`ABORT (${e.exitCode}): ${e.message}`)
      process.exit(e.exitCode)
    }
    throw e
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((e) => {
    console.error(
      e && e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : String(e)
    )
    process.exit(1)
  })
}
