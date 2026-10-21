// P0-12 stand-in for the open harness gap P0-10-11 / P0-11-1 (app -> SSR stub keep-alive race): host mode
// only, loaded into the app of the P0-12 stack with
//   npm run e2e:up -- --run P0-12 --mount e2e/lib/P0-12/no-keepalive.cjs:/p012-no-keepalive.cjs \
//     --app-env NODE_OPTIONS=--require=/p012-no-keepalive.cjs
// The stub's Node HTTP server closes idle sockets after 5 s; the app's fetch (Node 18 undici) reuses an idle
// socket for the `Keep-Alive: timeout=5` hint minus 1 s, a margin that timer lag under heavy machine load
// eats, so a request is written on a socket the stub is closing, the fetch rejects (ECONNRESET) and the page
// renders its API-error state (soft 404). That is a harness artefact, not app behaviour (real upstreams keep
// idle sockets far longer). This preload gives Node's fetch a dispatcher without connection reuse
// (undici `pipelining: 0`: one request per connection, `connection: close`), so no request can meet a
// closing socket. It changes nothing else: same requests, same bodies, same answers; the app code is
// untouched. It switches itself off when the stub keeps idle sockets for 60 s or more (the requested fix).
const fs = require('fs')
const path = require('path')

const KEY = Symbol.for('undici.globalDispatcher.1')
// the requested harness fix: the stub's listeners keep idle sockets for 60 s or more
const stubFixed = () => {
  try {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'test', 'ssr', 'stub.mjs'),
      'utf8'
    )
    return /keepAliveTimeout\s*=\s*[6-9]\d{4}/.test(src)
  } catch {
    return false
  }
}

if (typeof globalThis.fetch === 'function' && !stubFixed()) {
  const realFetch = globalThis.fetch
  let ready = null
  // the first fetch creates Node's global undici dispatcher: its class makes the replacement
  const setup = () => {
    if (!ready)
      ready = (async () => {
        if (!globalThis[KEY])
          await realFetch('http://127.0.0.1:9/').catch(() => null)
        const current = globalThis[KEY]
        if (current && typeof current.constructor === 'function')
          globalThis[KEY] = new current.constructor({ pipelining: 0 })
      })().catch(() => null)
    return ready
  }
  globalThis.fetch = function fetchWithoutReuse(input, init) {
    return setup().then(() => realFetch(input, init))
  }
}
