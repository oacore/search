// --require preload of the T-117 child process (data/data-loader.js, 40 §3 layer
// F). The loader fetches three production URLs, through `require('node-fetch')`
// before CS-N12-1 and through the global `fetch` of Node (undici) after it. This
// preload wraps both: the three URLs go to the local stub ($T117_STUB, the same
// path, the original URL in x-original-url); any other URL fails at once, so
// nothing can leave the machine whichever of the two the loader uses. The fetch
// underneath (status handling, res.json(), connection errors) is the real one.
const Module = require('module')

const STUB = process.env.T117_STUB
const URLS = [
  'https://api.core.ac.uk/internal/statistics',
  'https://api.core.ac.uk/internal/repositories/formap',
  'https://api.core.ac.uk/internal/members',
]

if (!STUB) throw new Error('T117_STUB is not set')

// a fetch function that sends the three URLs to the stub with the real `fetch`
const toStub = (realFetch) =>
  function fetch(url, options = {}) {
    const original = String(url)
    if (!URLS.includes(original))
      return Promise.reject(
        new Error(`T-117 preload: unexpected URL ${original}`)
      )
    const { pathname } = new URL(original)
    return realFetch(`${STUB}${pathname}`, {
      ...options,
      headers: { ...options.headers, 'x-original-url': original },
    })
  }

if (typeof globalThis.fetch === 'function' && !globalThis.fetch.__t117) {
  const wrapped = toStub(globalThis.fetch.bind(globalThis))
  wrapped.__t117 = true
  globalThis.fetch = wrapped
}

const load = Module._load
Module._load = function patchedLoad(request, ...rest) {
  const loaded = load.call(this, request, ...rest)
  if (request !== 'node-fetch' || loaded.__t117) return loaded

  const wrapped = toStub(loaded)
  Object.assign(wrapped, loaded)
  wrapped.default = wrapped
  wrapped.__t117 = true
  return wrapped
}
