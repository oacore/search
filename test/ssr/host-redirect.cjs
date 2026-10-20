// Host mode only (manifest §5.3; never evidence): `--require` preload that sends every server-side request
// for a host other than the stub, the app itself or localhost to the SSR stub's HTTP listener, carrying the
// original host and scheme in x-p2-forwarded-host / x-p2-forwarded-proto (the docker topology does this with
// an egress-denied network, a catch-all resolver and TLS names, 40 §2.2). Env: P2_STUB_HTTP=http://127.0.0.1:<port>.
const http = require('http')
const https = require('https')

const stub = new URL(process.env.P2_STUB_HTTP || 'http://127.0.0.1:1')
const LOCAL = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
const isLocal = (hostname) => LOCAL.has(String(hostname || '').toLowerCase())

// ---------- fetch ----------
if (typeof globalThis.fetch === 'function') {
  const realFetch = globalThis.fetch
  globalThis.fetch = function redirectedFetch(input, init) {
    const url = new URL(
      typeof input === 'string' || input instanceof URL
        ? String(input)
        : input.url
    )
    if (isLocal(url.hostname)) return realFetch(input, init)
    const target = `${stub.origin}${url.pathname}${url.search}`
    const headers = new Headers(
      init && init.headers
        ? init.headers
        : typeof input === 'object' && input.headers
        ? input.headers
        : undefined
    )
    headers.set('x-p2-forwarded-host', url.host)
    headers.set('x-p2-forwarded-proto', url.protocol.replace(':', ''))
    if (typeof input === 'object' && !(input instanceof URL))
      return realFetch(
        new Request(target, {
          method: input.method,
          headers,
          body: input.body,
          signal: input.signal,
          duplex: 'half',
        }),
        init && { ...init, headers }
      )
    return realFetch(target, { ...(init || {}), headers })
  }
}

// ---------- http(s).request / get ----------
const toOptions = (args) => {
  let [a, b, c] = args
  let opts = {}
  let cb
  if (typeof a === 'string' || a instanceof URL) {
    const u = new URL(String(a))
    opts = {
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port,
      path: `${u.pathname}${u.search}`,
    }
    if (typeof b === 'function') cb = b
    else {
      opts = { ...opts, ...(b || {}) }
      cb = c
    }
  } else {
    opts = { ...(a || {}) }
    cb = b
  }
  return { opts, cb }
}
const patch = (mod, defaultProtocol) => {
  const realRequest = mod.request
  const wrapped = function redirectedRequest(...args) {
    const { opts, cb } = toOptions(args)
    const hostname =
      opts.hostname ||
      (opts.host ? String(opts.host).split(':')[0] : 'localhost')
    if (isLocal(hostname)) return realRequest.apply(mod, args)
    const protocol = (opts.protocol || defaultProtocol).replace(':', '')
    const port = opts.port ? `:${opts.port}` : ''
    const headers = {
      ...(opts.headers || {}),
      'x-p2-forwarded-host': `${hostname}${port}`,
      'x-p2-forwarded-proto': protocol,
    }
    // only the request itself is carried over (no TLS or connection-pool options of the original)
    const next = {
      protocol: 'http:',
      hostname: stub.hostname,
      port: stub.port,
      method: opts.method || 'GET',
      path: opts.path || '/',
      headers,
      timeout: opts.timeout,
      signal: opts.signal,
    }
    return http.request(next, cb)
  }
  mod.request = wrapped
  mod.get = function redirectedGet(...args) {
    const req = wrapped(...args)
    req.end()
    return req
  }
}
patch(https, 'https:')
patch(http, 'http:')
