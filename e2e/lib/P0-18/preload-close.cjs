// P0-18 stack-only workaround for the open harness issue P0-11-1 (the SSR stub closes idle keep-alive sockets
// after Node's default 5 s, while the app's native fetch (undici) reuses an idle socket for about as long). On a
// saturated machine the app's event loop is late enough to write a request to a socket the stub has already
// closed; the request fails with `read ECONNRESET`, getServerSideProps takes its error branch and a provider
// page answers 404 for a provider that exists. Real upstreams keep idle connections far longer, so this is a
// test-stack artefact and not app behaviour.
//
// This preload makes the app's fetches to the local stub use a fresh connection each (`Connection: close`), so
// no idle socket is ever reused. It only touches requests to http://127.0.0.1:<port>/ (the stub, `Internal_API`
// in the run's env); nothing else changes. It is not needed once test/ssr/stub.mjs sets keepAliveTimeout above
// the client's idle time (the harness fix requested in P0-11-1); the P0-18 tests read the stub's request
// records only for method, path and status, which the header does not change.
//
// Use: npm run e2e:up -- --run P0-18 --mount e2e/lib/P0-18/preload-close.cjs:/preload-close.cjs \
//        --app-env NODE_OPTIONS=--require=/preload-close.cjs
'use strict'

const real = globalThis.fetch

if (typeof real === 'function' && !real.p18Close) {
  const wrapped = function fetch(input, init) {
    const url = typeof input === 'string' ? input : input && input.url
    if (typeof url === 'string' && /^http:\/\/127\.0\.0\.1:\d+\//.test(url)) {
      const headers = new Headers(
        (init && init.headers) || (input && input.headers) || undefined
      )
      headers.set('connection', 'close')
      return real.call(this, input, { ...(init || {}), headers })
    }
    return real.call(this, input, init)
  }
  wrapped.p18Close = true
  globalThis.fetch = wrapped
}
