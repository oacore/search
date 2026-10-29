// Opt-in MSW for Jest (40 §2.1): `const { server } = setupMsw()` at the top of
// a test file starts a node interceptor whose only handler is the fixture
// resolver; anything it cannot answer is a 502 naming the (method, url, body)
// triple, and requests that bypass the handler fail (onUnhandledRequest:
// 'error'). T-104 never loads this file.
const path = require('path')

const { setupServer } = require('msw/node')
const { http, HttpResponse, passthrough } = require('msw')

const { createResolver } = require('../fixtures/resolve.cjs')

const toHeaders = (pairs) => {
  const h = new Headers()
  for (const [n, v] of pairs) h.append(n, v)
  return h
}

const resolverHandler = (resolver) =>
  http.all('*', async ({ request }) => {
    const body = ['GET', 'HEAD'].includes(request.method)
      ? undefined
      : Buffer.from(await request.arrayBuffer())
    const r = resolver.resolve(request.method, request.url, body)
    if (r.networkError) return HttpResponse.error()
    return new HttpResponse(r.body.length ? r.body : null, {
      status: r.status,
      headers: toHeaders(r.headers),
    })
  })

// The url of a mocked response as Node's own fetch has it: msw puts the request
// url into undici's internal state where it can reach it (Node 18), and else
// (Node 24, whose undici keeps that state in private fields) defines an own
// enumerable `url`, which `JSON.stringify` then writes ({"url": ...}) where a
// real Response gives {} (T-504 c5, T-102 c2). Same value, not enumerable.
const realUrl = (response) => {
  const own = response && Object.getOwnPropertyDescriptor(response, 'url')
  if (own && own.enumerable)
    Object.defineProperty(response, 'url', { ...own, enumerable: false })
  return response
}

const setupMsw = ({
  root = path.join(__dirname, '..', 'fixtures'),
  handlers = [],
  linkOrigin,
} = {}) => {
  const resolver = createResolver({ root, linkOrigin })
  const server = setupServer(...handlers, resolverHandler(resolver))
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
    const intercepted = global.fetch
    global.fetch = async (...args) => realUrl(await intercepted(...args))
  })
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())
  return { server, resolver, http, HttpResponse, passthrough }
}

module.exports = { setupMsw, resolverHandler }
