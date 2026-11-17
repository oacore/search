// T-122 (41 B, R-016, R-028): transport differential. Every case runs once
// through the runtime's own fetch (the reference) and once through each
// implementation under test, against a loopback HTTP server, and the two
// observations must be deep-equal: the request as it arrives (method, URL,
// ordered raw headers, body), the response the caller sees (status,
// statusText, ok, url and its enumerability, headers, body as text / JSON /
// Blob type) and the rejection (class, name, message, cause, own keys,
// JSON form). `fetch` vs `fetch` is the harness check (old vs old);
// `transport` is api/http.ts (CS-AX-1).
const http = require('http')

const { transport } = require('../../../api/http')

const startServer = () =>
  new Promise((resolve) => {
    const requests = []
    const server = http.createServer((req, res) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        requests.push({
          method: req.method,
          url: req.url,
          rawHeaders: req.rawHeaders,
          body: Buffer.concat(chunks).toString('utf8'),
        })
        const { pathname } = new URL(req.url, 'http://x')
        const [, kind, arg] = pathname.split('/')
        const send = (status, headers, body) => {
          res.writeHead(status, {
            Date: 'Thu, 15 Jan 2026 12:00:00 GMT',
            ...headers,
          })
          res.end(body)
        }
        if (kind === 'json')
          send(200, { 'Content-Type': 'application/json' }, '{"a":[1,"x"]}')
        else if (kind === 'text')
          send(200, { 'Content-Type': 'text/csv' }, 'a,b\n1,2\n')
        else if (kind === 'none') send(200, {}, 'plain body')
        else if (kind === 'status') {
          send(
            Number(arg),
            { 'Content-Type': 'application/json' },
            Number(arg) >= 400 ? '{"message":"no"}' : ''
          )
        } else if (kind === 'html')
          send(502, { 'Content-Type': 'text/html' }, '<html>bad gateway</html>')
        else if (kind === 'redirect') send(302, { Location: '/json/after' }, '')
        else if (kind === 'slow') setTimeout(() => send(200, {}, 'late'), 300)
        else if (kind === 'multi') {
          send(
            200,
            {
              'Content-Type': 'application/json',
              'X-Multi': ['a', 'b'],
              'Set-Cookie': ['c=1', 'd=2'],
            },
            '{}'
          )
        } else {
          send(
            404,
            { 'Content-Type': 'application/json' },
            '{"message":"not found"}'
          )
        }
      })
    })
    server.listen(0, '127.0.0.1', () => {
      resolve({
        origin: `http://127.0.0.1:${server.address().port}`,
        requests,
        close: () =>
          new Promise((done) => {
            server.closeAllConnections()
            server.close(done)
          }),
      })
    })
  })

// a port nobody listens on
const closedPort = () =>
  new Promise((resolve) => {
    const server = http.createServer()
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })

const pairsOf = (raw) => {
  const pairs = []
  for (let i = 0; i < raw.length; i += 2)
    pairs.push([raw[i].toLowerCase(), raw[i + 1]])
  return pairs
}

const describeError = (error) => {
  if (error == null || typeof error !== 'object') return { value: error }
  const { cause } = error
  return {
    constructor: error.constructor && error.constructor.name,
    name: error.name,
    message: error.message,
    code: error.code,
    keys: Object.keys(error),
    json: JSON.stringify(error),
    isAxiosError: Boolean(error.isAxiosError),
    hasConfig: 'config' in error,
    cause:
      cause && typeof cause === 'object'
        ? {
            constructor: cause.constructor && cause.constructor.name,
            name: cause.name,
            code: cause.code,
            syscall: cause.syscall,
            message: cause.message,
          }
        : cause,
  }
}

const describeResponse = async (response, read) => {
  const urlDescriptor = Object.getOwnPropertyDescriptor(response, 'url')
  const seen = {
    isResponse: response instanceof Response,
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    url: response.url,
    urlEnumerable: urlDescriptor ? urlDescriptor.enumerable : false,
    keys: Object.keys(response),
    json: JSON.stringify(response),
    headers: Array.from(response.headers.entries()),
    hasBody: response.body != null,
  }
  try {
    if (read === 'json') seen.body = await response.json()
    else if (read === 'blob') {
      const blob = await response.blob()
      seen.body = { type: blob.type, size: blob.size, text: await blob.text() }
    } else seen.body = await response.text()
  } catch (error) {
    seen.bodyError = describeError(error)
  }
  return seen
}

describe('T-122 @P0 transport differential', () => {
  let server
  let deadPort
  const impls = { fetch: (url, init) => fetch(url, init), transport }

  beforeAll(async () => {
    server = await startServer()
    deadPort = await closedPort()
  })

  afterAll(async () => {
    await server.close()
  })

  // observe one call: what the server received and what the caller got
  const observe = async (
    impl,
    { path, init = () => ({}), read = 'text', url }
  ) => {
    server.requests.length = 0
    const target = url ? url({ deadPort }) : `${server.origin}${path}`
    const seen = {}
    try {
      const response = await impl(target, init())
      seen.response = await describeResponse(response, read)
    } catch (error) {
      seen.error = describeError(error)
    }
    seen.wire = server.requests.map((request) => ({
      ...request,
      rawHeaders: pairsOf(request.rawHeaders),
    }))
    return seen
  }

  const APP_HEADERS = {
    Accept: 'application/json',
    Authorization: 'Bearer test-key',
  }

  const CASES = {
    'GET with the app headers, JSON body': {
      path: '/json/1?q=a%20b&x=1&x=2',
      init: () => ({
        method: 'GET',
        headers: APP_HEADERS,
        credentials: 'include',
      }),
      read: 'json',
    },
    'the Host override is dropped (Q-022)': {
      path: '/json/1',
      init: () => ({
        headers: { ...APP_HEADERS, Host: 'api.core.ac.uk' },
        credentials: 'include',
      }),
      read: 'json',
    },
    'POST JSON string body with application/json': {
      path: '/json/post',
      init: () => ({
        method: 'POST',
        headers: { ...APP_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: 'x', limit: 10 }),
        credentials: 'include',
      }),
      read: 'json',
    },
    'POST string body without Content-Type is text/plain;charset=UTF-8 (Q-019)':
      {
        path: '/json/post',
        init: () => ({
          method: 'POST',
          headers: APP_HEADERS,
          body: 'q=climate&x=1',
          credentials: 'include',
        }),
        read: 'json',
      },
    'POST string body with a custom Content-Type': {
      path: '/text/post',
      init: () => ({
        method: 'POST',
        headers: { ...APP_HEADERS, 'Content-Type': 'text/csv' },
        body: 'a,b',
        credentials: 'include',
      }),
      read: 'blob',
    },
    'HEAD under application/json': {
      path: '/json/head',
      init: () => ({ method: 'HEAD', headers: APP_HEADERS }),
      read: 'blob',
    },
    'text/csv body read as Blob': {
      path: '/text/1',
      init: () => ({ headers: APP_HEADERS }),
      read: 'blob',
    },
    'text/csv body read as text': {
      path: '/text/1',
      init: () => ({ headers: APP_HEADERS }),
      read: 'text',
    },
    'no Content-Type read as Blob': { path: '/none/1', read: 'blob' },
    'status 204 (null body)': { path: '/status/204', read: 'json' },
    'status 205 (null body)': { path: '/status/205', read: 'blob' },
    'status 304 (null body)': { path: '/status/304', read: 'blob' },
    'status 404 JSON': { path: '/status/404', read: 'json' },
    'status 500 JSON': { path: '/status/500', read: 'json' },
    'status 502 HTML read as Blob': { path: '/html/1', read: 'blob' },
    'repeated response headers': { path: '/multi/1', read: 'json' },
    'redirect: final url': { path: '/redirect/1', read: 'json' },
    'malformed JSON read as JSON rejects with SyntaxError': {
      path: '/text/1',
      read: 'json',
    },
    'an aborted signal rejects with its reason (AbortError)': {
      path: '/json/abort',
      init: () => {
        const controller = new AbortController()
        controller.abort()
        return { signal: controller.signal }
      },
    },
    'an abort with a custom reason rejects with that reason': {
      path: '/json/abort',
      init: () => {
        const controller = new AbortController()
        controller.abort(new Error('custom reason'))
        return { signal: controller.signal }
      },
    },
    'an abort while waiting for the response (Q-091)': {
      path: '/slow/1',
      init: () => {
        const controller = new AbortController()
        setTimeout(() => controller.abort(), 50)
        return { signal: controller.signal }
      },
    },
    'a network error is the native TypeError with its cause': {
      url: ({ deadPort: port }) => `http://127.0.0.1:${port}/x`,
      init: () => ({ headers: APP_HEADERS }),
    },
    'a GET with an object body rejects before anything is sent': {
      path: '/json/get-body',
      init: () => ({ method: 'GET', headers: APP_HEADERS, body: { a: 1 } }),
    },
  }

  Object.entries(CASES).forEach(([name, spec]) => {
    test(`T-122 c1 @P0 ${name}: every implementation equals native fetch`, async () => {
      const reference = await observe((url, init) => fetch(url, init), spec)
      for (const [implName, impl] of Object.entries(impls)) {
        // eslint-disable-next-line no-await-in-loop
        const seen = await observe(impl, spec)
        expect({ impl: implName, ...seen }).toEqual({
          impl: implName,
          ...reference,
        })
      }
    })
  })
})
