#!/usr/bin/env node
// Host-mode stand-in for the nginx proxy (manifest §5.3; never evidence): serves the route table that
// e2e/proxy/generate.mjs emits, with the same semantics as its nginx config: :gateway = gateway-faithful
// (raw request target, element-wise longest prefix, ReplacePrefixMatch, 30 s backend timeout, else 404
// "other service"), :allow = allow-all. Node built-ins only.
//
// Usage: node e2e/proxy/node-proxy.mjs --table <routes.json> --app http://127.0.0.1:<port>
//                                      --gateway-port <port> --allow-port <port> [--log <file>]
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HOP = new Set(['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'te', 'trailer', 'proxy-authorization', 'proxy-authenticate'])

// same algorithm as generate.mjs routeFor (kept dependency-free for host Node)
export function routeFor(table, target) {
  const q = target.indexOf('?')
  const rawPath = q < 0 ? target : target.slice(0, q)
  const query = q < 0 ? '' : target.slice(q)
  for (const e of table.entries) {
    const matches = e.prefix === '/' || rawPath === e.prefix || rawPath.startsWith(`${e.prefix}/`)
    if (!matches) continue
    if (e.replacePrefixMatch == null) return { route: e.prefix, upstream: target, timeout: e.backendRequestTimeout }
    const rest = rawPath.slice(e.prefix.length)
    const R = e.replacePrefixMatch
    const upstreamPath = R.endsWith('/') && rest.startsWith('/') ? R + rest.slice(1) : R + rest
    return { route: e.prefix, upstream: (upstreamPath || '/') + query, timeout: e.backendRequestTimeout }
  }
  return { route: 'other', upstream: null }
}

export function startProxy({ table, app, gatewayPort, allowPort, log = null, host = '127.0.0.1' }) {
  const appUrl = new URL(app)
  const logLine = (s) => log && fs.appendFileSync(log, `${s}\n`)
  const forward = (req, res, upstream, timeoutS, debug) => {
    const headers = {}
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const name = req.rawHeaders[i]
      const lower = name.toLowerCase()
      if (HOP.has(lower) || lower === 'x-p2-debug') continue
      headers[name] = headers[name] === undefined ? req.rawHeaders[i + 1] : `${headers[name]}, ${req.rawHeaders[i + 1]}`
    }
    const started = Date.now()
    const up = http.request({ host: appUrl.hostname, port: appUrl.port, method: req.method, path: upstream, headers, setHost: false })
    up.setTimeout((timeoutS || 30) * 1000, () => up.destroy(new Error('backend timeout')))
    up.on('response', (r) => {
      const out = []
      for (let i = 0; i < r.rawHeaders.length; i += 2) if (!HOP.has(r.rawHeaders[i].toLowerCase())) out.push(r.rawHeaders[i], r.rawHeaders[i + 1])
      if (debug) out.push('X-P2-Route', debug.route, 'X-P2-Upstream', upstream)
      res.writeHead(r.statusCode, r.statusMessage, out)
      r.pipe(res)
      logLine(`${req.method} ${req.url} ${r.statusCode} route=${debug ? debug.route : '*'} upstream="${upstream}" rt=${(Date.now() - started) / 1000}`)
    })
    up.on('error', (e) => {
      const status = /timeout/.test(e.message) ? 504 : 502
      if (!res.headersSent) res.writeHead(status, { 'content-type': 'text/plain' })
      res.end(`${status} ${e.message}\n`)
      logLine(`${req.method} ${req.url} ${status} upstream="${upstream}" error=${e.message}`)
    })
    req.pipe(up)
  }
  const gateway = http.createServer((req, res) => {
    const r = routeFor(table, req.url)
    const debug = req.headers['x-p2-debug'] === '1'
    if (r.route === 'other') {
      const h = { 'content-type': 'text/plain' }
      if (debug) h['X-P2-Route'] = 'other'
      res.writeHead(404, h)
      res.end('other service\n')
      logLine(`${req.method} ${req.url} 404 route=other`)
      req.resume()
      return
    }
    forward(req, res, r.upstream, r.timeout, debug ? { route: r.route } : null)
  })
  const allow = http.createServer((req, res) => forward(req, res, req.url, 30, null))
  for (const s of [gateway, allow]) {
    s.keepAliveTimeout = 5000
    s.maxHeaderSize = 65536
  }
  return Promise.all([new Promise((r) => gateway.listen(gatewayPort, host, r)), new Promise((r) => allow.listen(allowPort, host, r))]).then(() => ({
    close: () => Promise.all([gateway, allow].map((s) => new Promise((r) => s.close(() => r())))),
  }))
}

function main(argv) {
  const opt = (n, d) => {
    const i = argv.indexOf(n)
    return i >= 0 ? argv[i + 1] : d
  }
  const table = JSON.parse(fs.readFileSync(opt('--table'), 'utf8'))
  startProxy({ table, app: opt('--app'), gatewayPort: Number(opt('--gateway-port')), allowPort: Number(opt('--allow-port')), log: opt('--log', null) }).then(() => {
    console.log(`proxy: gateway :${opt('--gateway-port')} allow-all :${opt('--allow-port')} -> ${opt('--app')} (table ${table.sha256.slice(0, 12)})`)
  })
  const stop = () => process.exit(0)
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '')) main(process.argv.slice(2))
