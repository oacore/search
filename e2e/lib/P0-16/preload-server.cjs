// T-901 preload (c3, c8, c9; 41 J): mounted into the app of a short-lived stack and loaded through NODE_OPTIONS
// (--require, appended to the runtime value, 42 §2). It only observes. It writes JSON lines to stderr (the app
// log): when the HTTP server listens, its timeouts (`keepAliveTimeout`, `headersTimeout`, `requestTimeout`,
// `timeout`) and the V8 heap limit that NODE_OPTIONS=--max-old-space-size produced; and when the first
// /api/healthz/ request arrives, the process uptime (time to ready).
'use strict'

const http = require('http')
const v8 = require('v8')

const line = (o) =>
  process.stderr.write(
    `${JSON.stringify({ p016: 'T-901', pid: process.pid, ...o })}\n`
  )
const uptimeMs = () => Math.round(process.uptime() * 1000)

line({ event: 'preload', uptimeMs: uptimeMs() })

const listen = http.Server.prototype.listen
http.Server.prototype.listen = function patchedListen(...args) {
  this.once('listening', () =>
    line({
      event: 'listening',
      uptimeMs: uptimeMs(),
      keepAliveTimeout: this.keepAliveTimeout,
      headersTimeout: this.headersTimeout,
      requestTimeout: this.requestTimeout,
      timeout: this.timeout,
      heapLimit: v8.getHeapStatistics().heap_size_limit,
      node: process.version,
    })
  )
  return listen.apply(this, args)
}

let healthz = false
const emit = http.Server.prototype.emit
http.Server.prototype.emit = function patchedEmit(name, req) {
  if (!healthz && name === 'request' && req && req.url === '/api/healthz/') {
    healthz = true
    line({ event: 'first-healthz', uptimeMs: uptimeMs() })
  }
  return emit.apply(this, arguments)
}
