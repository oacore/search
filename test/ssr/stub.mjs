#!/usr/bin/env node
// SSR HTTP stub (40 §2.2), Node built-ins only. Answers every server-side request of the app from the fixture
// resolver and records it at the socket: method, raw URL, wire Host, all headers in order, body bytes + sha256.
//   HTTP  listener: Internal_API (`Internal_API=http://stub`); absolute URL = https://<internal host><raw target>.
//         Host mode only: a request carrying x-p2-forwarded-host (test/ssr/host-redirect.cjs) is taken as a
//         request to that host (never evidence, manifest §5.3).
//   HTTPS listener: every name in test/ssr/hosts.json with a leaf certificate minted at start from a test CA
//         (the app trusts it through NODE_EXTRA_CA_CERTS=<run dir>/ca.pem). Unlisted names fail the run.
//   Control API: GET /health, POST /reset, POST /rules, DELETE /rules, POST /mark, GET /collect?since=<seq>,
//         GET /records, GET /problems, POST /reload.
// Records: <run dir>/ssr-wire.ndjson (one JSON line per request); problems (unmatched triples, unknown hosts)
// are kept in memory and in <run dir>/ssr-problems.ndjson.
//
// Usage: node test/ssr/stub.mjs [--run-dir <dir>] [--http-port 80] [--https-port 443] [--control-port 8090]
//                               [--host 0.0.0.0] [--internal-host api.core.ac.uk] [--link-origin <proxy origin>]
//        node test/ssr/stub.mjs --self-check
import http from 'node:http'
import https from 'node:https'
import tls from 'node:tls'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createResolver } from '../fixtures/resolve.mjs'
import { mintCa, mintLeaf } from './x509.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const HOSTS_FILE = path.join(HERE, 'hosts.json')
const SENTRY = /(^|\.)sentry\.io$/

export const loadHosts = () => JSON.parse(fs.readFileSync(HOSTS_FILE, 'utf8')).hosts

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })

const isUtf8 = (buf) => {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf)
    return true
  } catch {
    return false
  }
}

export async function startStub(options = {}) {
  const {
    runDir = null,
    httpPort = 0,
    httpsPort = 0,
    controlPort = 0,
    host = '127.0.0.1',
    internalHost = 'api.core.ac.uk',
    linkOrigin = null,
    hosts = loadHosts(),
    extraHosts = [],
  } = options
  const names = [...new Set([...hosts, ...extraHosts])]
  const resolver = createResolver({ linkOrigin })
  const ca = mintCa()
  const leaves = new Map(names.map((n) => [n, mintLeaf(ca, [n])]))
  const contexts = new Map([...leaves].map(([n, l]) => [n, tls.createSecureContext({ key: l.keyPem, cert: l.pem })]))
  if (runDir) {
    fs.mkdirSync(runDir, { recursive: true })
    fs.writeFileSync(path.join(runDir, 'ca.pem'), ca.pem)
  }
  const wireFile = runDir ? path.join(runDir, 'ssr-wire.ndjson') : null
  const problemFile = runDir ? path.join(runDir, 'ssr-problems.ndjson') : null

  let seq = 0
  let records = []
  let problems = []
  let rules = []
  const marks = new Map()

  const problem = (p) => {
    const entry = { seq: ++seq, ts: new Date().toISOString(), ...p }
    problems.push(entry)
    if (problemFile) fs.appendFileSync(problemFile, `${JSON.stringify(entry)}\n`)
  }

  const handle = (listener) => async (req, res) => {
    const body = await readBody(req)
    const forwardedHost = listener === 'http' ? req.headers['x-p2-forwarded-host'] : undefined
    const sni = listener === 'https' ? req.socket.servername || null : null
    let absoluteUrl
    if (listener === 'http' && forwardedHost) absoluteUrl = `${req.headers['x-p2-forwarded-proto'] || 'https'}://${forwardedHost}${req.url}`
    else if (listener === 'http') absoluteUrl = `https://${internalHost}${req.url}`
    else absoluteUrl = `https://${sni || req.headers.host}${req.url}`
    const urlHost = new URL(absoluteUrl).hostname
    const headers = []
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      if (/^x-p2-forwarded-/i.test(req.rawHeaders[i])) continue
      headers.push([req.rawHeaders[i], req.rawHeaders[i + 1]])
    }
    const rec = {
      seq: ++seq,
      ts: new Date().toISOString(),
      listener,
      redirected: Boolean(forwardedHost),
      method: req.method,
      rawUrl: req.url,
      url: absoluteUrl,
      wireHost: req.headers.host ?? null,
      sni,
      httpVersion: req.httpVersion,
      headers,
      bodySha256: crypto.createHash('sha256').update(body).digest('hex'),
      bodyLength: body.length,
      ...(body.length ? (isUtf8(body) ? { bodyText: body.toString('utf8') } : { bodyBase64: body.toString('base64') }) : {}),
    }

    let answer
    if (forwardedHost && !names.includes(urlHost) && urlHost !== internalHost) {
      problem({ kind: 'unknown-host', host: urlHost, url: absoluteUrl })
      answer = { status: 502, headers: [['content-type', 'text/plain']], body: Buffer.from(`unknown host ${urlHost}\n`), rule: 'unknown-host' }
    } else if (SENTRY.test(urlHost)) {
      answer = { status: 200, headers: [['content-type', 'application/json']], body: Buffer.from('{}'), rule: 'sentry' }
    } else {
      answer = resolver.resolve(req.method, absoluteUrl, body)
      if (answer.unmatched) problem({ kind: 'unmatched', ...answer.unmatched })
    }
    const rule = rules.find((r) => (!r.method || r.method === req.method) && (!r.urlPrefix || absoluteUrl.startsWith(r.urlPrefix)) && (!r.urlRegex || new RegExp(r.urlRegex).test(absoluteUrl)))
    if (rule && rule.fail === 'neterror') answer = { networkError: true, rule: `rule:${rule.id}` }
    else if (rule && rule.fail) answer = { status: rule.fail.status || 500, headers: [['content-type', rule.fail.contentType || 'application/json']], body: Buffer.from(rule.fail.body ?? '{"message":"Internal Server Error"}'), rule: `rule:${rule.id}` }
    rec.status = answer.networkError ? 0 : answer.status
    rec.rule = answer.rule || (answer.fixture ? 'fixture' : null)
    rec.fixture = answer.fixture ? answer.fixture.scenario : null
    records.push(rec)
    if (wireFile) fs.appendFileSync(wireFile, `${JSON.stringify(rec)}\n`)

    const send = () => {
      if (answer.networkError) {
        req.socket.destroy()
        return
      }
      const out = []
      for (const [n, v] of answer.headers) out.push(n, v)
      out.push('Content-Length', String(answer.body.length))
      res.writeHead(answer.status, out)
      res.end(req.method === 'HEAD' ? undefined : answer.body)
    }
    const latency = rule && rule.latencyMs ? Number(rule.latencyMs) : 0
    if (latency > 0) setTimeout(send, latency)
    else send()
  }

  const httpServer = http.createServer(handle('http'))
  const httpsServer = https.createServer(
    {
      SNICallback: (servername, cb) => {
        const ctx = contexts.get(servername)
        if (ctx) return cb(null, ctx)
        problem({ kind: 'unknown-host', host: servername })
        return cb(new Error(`unknown host ${servername}`))
      },
    },
    handle('https')
  )
  httpsServer.on('tlsClientError', () => {})

  const json = (res, status, obj) => {
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(obj))
  }
  const control = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://control')
    const body = await readBody(req)
    const payload = body.length ? JSON.parse(body.toString('utf8')) : {}
    if (u.pathname === '/health') return json(res, 200, { ok: true, seq, names, records: records.length, problems: problems.length })
    if (u.pathname === '/reset' && req.method === 'POST') {
      records = []
      problems = []
      rules = []
      marks.clear()
      resolver.reload()
      return json(res, 200, { ok: true, seq })
    }
    if (u.pathname === '/reload' && req.method === 'POST') return json(res, 200, { problems: resolver.reload(), size: resolver.size() })
    if (u.pathname === '/rules' && req.method === 'POST') {
      const r = { id: `r${rules.length + 1}`, ...payload }
      rules.push(r)
      return json(res, 200, r)
    }
    if (u.pathname === '/rules' && req.method === 'DELETE') {
      rules = []
      return json(res, 200, { ok: true })
    }
    if (u.pathname === '/mark' && req.method === 'POST') {
      const m = { name: payload.name || `m${marks.size + 1}`, seq }
      marks.set(m.name, m.seq)
      return json(res, 200, m)
    }
    if (u.pathname === '/collect') {
      const since = Number(u.searchParams.get('since') ?? (marks.get(u.searchParams.get('mark')) || 0))
      const until = u.searchParams.has('until') ? Number(u.searchParams.get('until')) : Infinity
      return json(res, 200, { seq, records: records.filter((r) => r.seq > since && r.seq <= until), problems: problems.filter((p) => p.seq > since && p.seq <= until) })
    }
    if (u.pathname === '/records') return json(res, 200, records)
    if (u.pathname === '/problems') return json(res, 200, problems)
    return json(res, 404, { error: 'unknown control endpoint' })
  })

  const listen = (server, port) => new Promise((resolve, reject) => server.once('error', reject).listen(port, host, () => resolve(server.address().port)))
  const ports = { http: await listen(httpServer, httpPort), https: await listen(httpsServer, httpsPort), control: await listen(control, controlPort) }
  return {
    ports,
    ca,
    names,
    records: () => records,
    problems: () => problems,
    close: () => Promise.all([httpServer, httpsServer, control].map((s) => new Promise((r) => s.close(() => r())))),
  }
}

// ---------- self-check (40 §2.2) ----------
const request = (mod, opts, body) =>
  new Promise((resolve, reject) => {
    const req = mod.request(opts, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })

export async function selfCheck() {
  const results = []
  const ok = (name, cond, detail) => results.push({ name, ok: !!cond, detail })
  const SELF = 'selfcheck.p2.test'
  const stub = await startStub({ extraHosts: [SELF, 'o0.ingest.sentry.io'] })
  try {
    const { ports, ca } = stub
    // Internal_API path: wire Host as sent (the app's Host override is dropped by native fetch, Q-022)
    const r1 = await request(http, { host: '127.0.0.1', port: ports.http, path: '/internal/harness-probe?t=undefined', headers: { Host: 'api.core.ac.uk', Authorization: 'Bearer test-key' } })
    const rec1 = stub.records().at(-1)
    ok('internal request recorded with wire Host and raw URL', rec1 && rec1.wireHost === 'api.core.ac.uk' && rec1.rawUrl === '/internal/harness-probe?t=undefined' && rec1.url === 'https://api.core.ac.uk/internal/harness-probe?t=undefined', rec1)
    ok('headers recorded in order', rec1 && rec1.headers[0][0] === 'Host' && rec1.headers[1][0] === 'Authorization', rec1 && rec1.headers)
    ok('unmatched request answered 502 naming the triple', r1.status === 502 && JSON.parse(r1.body).url === 'https://api.core.ac.uk/internal/harness-probe?t=undefined' && stub.problems().some((p) => p.kind === 'unmatched'), r1.body)
    const body = '{"q":"__status500"}'
    const r2 = await request(http, { host: '127.0.0.1', port: ports.http, method: 'POST', path: '/v3/search/works?t=undefined', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, body)
    const rec2 = stub.records().at(-1)
    ok('body bytes and sha256 recorded; rules answer', r2.status === 500 && rec2.bodyText === body && rec2.bodySha256 === crypto.createHash('sha256').update(body).digest('hex'), rec2)
    // every listed name over TLS with a certificate the test CA signed
    for (const name of stub.names) {
      const r = await request(https, { host: '127.0.0.1', port: ports.https, servername: name, ca: ca.pem, path: '/probe', headers: { Host: name } })
      const rec = stub.records().at(-1)
      ok(`TLS name ${name} reaches the stub with wire Host ${name}`, rec && rec.sni === name && rec.wireHost === name && [200, 502].includes(r.status), { status: r.status, sni: rec && rec.sni })
    }
    // a Sentry envelope is counted and answered 200
    const env = '{"event_id":"0"}\n{"type":"event"}\n{}'
    const rs = await request(https, { host: '127.0.0.1', port: ports.https, servername: 'o0.ingest.sentry.io', ca: ca.pem, method: 'POST', path: '/api/0/envelope/', headers: { Host: 'o0.ingest.sentry.io', 'Content-Length': Buffer.byteLength(env) } }, env)
    ok('Sentry ingest counted and answered 200', rs.status === 200 && stub.records().filter((r) => r.url === 'https://o0.ingest.sentry.io/api/0/envelope/' && r.method === 'POST').length === 1, rs.status)
    // an unknown host fails (TLS handshake refused, problem recorded)
    let failed = false
    try {
      await request(https, { host: '127.0.0.1', port: ports.https, servername: 'unlisted.p2.test', ca: ca.pem, path: '/' })
    } catch {
      failed = true
    }
    ok('unknown TLS host fails and is recorded', failed && stub.problems().some((p) => p.kind === 'unknown-host' && p.host === 'unlisted.p2.test'), stub.problems())
    // host-mode forwarding of an unlisted host is a problem too
    const rf = await request(http, { host: '127.0.0.1', port: ports.http, path: '/x', headers: { 'x-p2-forwarded-host': 'unlisted2.p2.test' } })
    ok('unknown forwarded host fails and is recorded', rf.status === 502 && stub.problems().some((p) => p.host === 'unlisted2.p2.test'), rf.status)
    // control API: latency and failure rules, mark/collect
    const ctl = (method, p, payload) => request(http, { host: '127.0.0.1', port: ports.control, method, path: p, headers: { 'content-type': 'application/json' } }, payload ? JSON.stringify(payload) : undefined).then((r) => JSON.parse(r.body))
    const mark = await ctl('POST', '/mark', { name: 'w1' })
    await ctl('POST', '/rules', { urlPrefix: 'https://api.core.ac.uk/slow', latencyMs: 300 })
    const t0 = Date.now()
    await request(http, { host: '127.0.0.1', port: ports.http, path: '/slow' })
    ok('per-route latency', Date.now() - t0 >= 290, Date.now() - t0)
    await ctl('POST', '/rules', { urlPrefix: 'https://api.core.ac.uk/broken', fail: { status: 503, body: '{"message":"x"}' } })
    const rb = await request(http, { host: '127.0.0.1', port: ports.http, path: '/broken' })
    ok('per-route failure', rb.status === 503, rb.status)
    await ctl('POST', '/rules', { urlPrefix: 'https://api.core.ac.uk/dead', fail: 'neterror' })
    let dead = false
    try {
      await request(http, { host: '127.0.0.1', port: ports.http, path: '/dead' })
    } catch {
      dead = true
    }
    ok('per-route network error', dead, null)
    const win = await ctl('GET', `/collect?since=${mark.seq}`)
    ok('mark/collect window', win.records.length === 3 && win.records.every((r) => r.seq > mark.seq), win.records.map((r) => r.rawUrl))
    const reset = await ctl('POST', '/reset')
    ok('reset clears records, problems and rules', reset.ok && stub.records().length === 0 && stub.problems().length === 0, null)
  } finally {
    await stub.close()
  }
  return results
}

async function main(argv) {
  const opt = (n, d) => {
    const i = argv.indexOf(n)
    return i >= 0 ? argv[i + 1] : d
  }
  if (argv.includes('--self-check')) {
    const rows = await selfCheck()
    const bad = rows.filter((r) => !r.ok)
    for (const r of bad) console.log(`FAIL ${r.name} ${JSON.stringify(r.detail)}`)
    console.log(`ssr stub self-check: ${rows.length - bad.length}/${rows.length} ok`)
    process.exit(bad.length ? 1 : 0)
  }
  const stub = await startStub({
    runDir: opt('--run-dir', null),
    httpPort: Number(opt('--http-port', 80)),
    httpsPort: Number(opt('--https-port', 443)),
    controlPort: Number(opt('--control-port', 8090)),
    host: opt('--host', '0.0.0.0'),
    internalHost: opt('--internal-host', 'api.core.ac.uk'),
    linkOrigin: opt('--link-origin', null),
  })
  console.log(`stub: http :${stub.ports.http} https :${stub.ports.https} control :${stub.ports.control}; ${stub.names.length} TLS names`)
  const stop = () => stub.close().then(() => process.exit(0))
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '')) main(process.argv.slice(2))
