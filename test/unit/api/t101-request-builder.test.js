// T-101 (41 B, R-028): api/index.js request builder (findings/06 §7.2
// "request builder" with the 41 corrections). Bytes are read where they leave
// the process: a loopback HTTP server records what reaches it, and a spy on the
// global fetch records the options the wrapper hands over (credentials and
// signal have no wire form). The spy passes loopback requests through to the
// real fetch and answers every other host itself, so nothing leaves the
// machine.
const http = require('http')

const ENV_KEYS = ['Internal_API', 'Internal_API_HOST']

const startEcho = () =>
  new Promise((resolve) => {
    const requests = []
    const server = http.createServer((req, res) => {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        requests.push({
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('{"ok":true}')
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

const API = 'https://api.core.ac.uk/internal'

describe('T-101 @P0 api/index.js request builder', () => {
  const realFetch = global.fetch
  const savedEnv = {}
  let performRequest
  let echo
  let fetchCalls

  beforeAll(async () => {
    // no in-cluster rewrite in this file (T-103, T-104 own it)
    ENV_KEYS.forEach((key) => {
      savedEnv[key] = process.env[key]
      delete process.env[key]
    })
    jest.isolateModules(() => {
      performRequest = require('../../../api/index').default
    })
    echo = await startEcho()
  })

  afterAll(async () => {
    await echo.close()
    ENV_KEYS.forEach((key) => {
      if (savedEnv[key] === undefined) delete process.env[key]
      else process.env[key] = savedEnv[key]
    })
  })

  beforeEach(() => {
    fetchCalls = []
    echo.requests.length = 0
    jest.spyOn(global, 'fetch').mockImplementation((url, init) => {
      fetchCalls.push({ url, init })
      if (String(url).startsWith(echo.origin)) return realFetch(url, init)
      return Promise.resolve(
        new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('c1 url, method, headers, body', () => {
    test('T-101 c1 @P0 a relative path becomes API_URL + path, no slash normalisation', async () => {
      await performRequest('/members')
      await performRequest('members')
      await performRequest('/members/')
      expect(fetchCalls.map((call) => call.url)).toEqual([
        `${API}/members`,
        `${API}members`,
        `${API}/members/`,
      ])
    })

    test('T-101 c1 @P0 an absolute URL and a URL object are passed through', async () => {
      await performRequest('https://doi.org/10.1000/xyz?a=1')
      await performRequest(new URL('https://example.org/a/b?c=d'))
      expect(fetchCalls.map((call) => call.url)).toEqual([
        'https://doi.org/10.1000/xyz?a=1',
        'https://example.org/a/b?c=d',
      ])
    })

    test('T-101 c1 @P0 searchParams are appended to the URL params (duplicates kept, params re-serialised)', async () => {
      await performRequest('/works?a=1&b=2', { searchParams: { c: 3 } })
      await performRequest('/works?a=1', { searchParams: { a: 2 } })
      await performRequest('/works?q=a%20b', { searchParams: 'z=1&z=2' })
      expect(fetchCalls.map((call) => call.url)).toEqual([
        `${API}/works?a=1&b=2&c=3`,
        `${API}/works?a=1&a=2`,
        `${API}/works?q=a+b&z=1&z=2`,
      ])
    })

    test('T-101 c1 @P0 the method defaults to GET and is upper-cased', async () => {
      await performRequest('/a')
      await performRequest('/b', { method: 'post', body: 'x' })
      await performRequest('/c', { method: 'Head' })
      expect(fetchCalls.map((call) => call.init.method)).toEqual([
        'GET',
        'POST',
        'HEAD',
      ])
    })

    test('T-101 c1 @P0 an object body is JSON with Content-Type: application/json', async () => {
      await performRequest(`${echo.origin}/claim`, {
        method: 'POST',
        body: { name: 'A', n: 1, list: [1, 2] },
      })
      const { init } = fetchCalls[0]
      expect(init.body).toBe('{"name":"A","n":1,"list":[1,2]}')
      expect(init.headers).toEqual({
        'Accept': 'application/json',
        'Authorization': 'Bearer test-key',
        'Content-Type': 'application/json',
      })
      const [wire] = echo.requests
      expect(wire.method).toBe('POST')
      expect(wire.headers['content-type']).toBe('application/json')
      expect(wire.body).toBe('{"name":"A","n":1,"list":[1,2]}')
    })

    test('T-101 c1 @P0 a string body is sent as is, with the fetch default text/plain;charset=UTF-8 (Q-019)', async () => {
      const body = JSON.stringify({ uri: 'https://example.org/repo' })
      await performRequest(`${echo.origin}/data-providers`, {
        method: 'POST',
        body,
      })
      const { init } = fetchCalls[0]
      // the wrapper adds no Content-Type of its own to a string body ...
      expect(init.body).toBe(body)
      expect(Object.keys(init.headers)).toEqual(['Accept', 'Authorization'])
      // ... so the one that goes out is the fetch default, not JSON
      const [wire] = echo.requests
      expect(wire.method).toBe('POST')
      expect(wire.headers['content-type']).toBe('text/plain;charset=UTF-8')
      expect(wire.body).toBe(body)
    })

    test('T-101 c1 @P0 Accept and Authorization are always sent, custom headers override them', async () => {
      await performRequest('/a')
      await performRequest('/b', {
        headers: {
          'Accept': 'text/csv',
          'Authorization': 'Bearer other',
          'X-Custom': '1',
        },
      })
      await performRequest('/c', {
        method: 'POST',
        body: { a: 1 },
        headers: { 'Content-Type': 'text/csv' },
      })
      expect(fetchCalls[0].init.headers).toEqual({
        Accept: 'application/json',
        Authorization: 'Bearer test-key',
      })
      expect(fetchCalls[1].init.headers).toEqual({
        'Accept': 'text/csv',
        'Authorization': 'Bearer other',
        'X-Custom': '1',
      })
      expect(fetchCalls[2].init.headers['Content-Type']).toBe('text/csv')
    })

    test('T-101 c1 @P0 credentials are always include and the signal passes through', async () => {
      const controller = new AbortController()
      await performRequest('/a', { signal: controller.signal })
      await performRequest('/b')
      expect(fetchCalls[0].init.credentials).toBe('include')
      expect(fetchCalls[1].init.credentials).toBe('include')
      expect(fetchCalls[0].init.signal).toBe(controller.signal)
      expect(fetchCalls[1].init.signal).toBeUndefined()
    })

    test('T-101 c1 @P0 an aborted signal rejects the request with AbortError', async () => {
      const controller = new AbortController()
      controller.abort()
      await expect(
        performRequest(`${echo.origin}/a`, { signal: controller.signal })
      ).rejects.toMatchObject({ name: 'AbortError' })
      expect(echo.requests).toHaveLength(0)
    })
  })

  describe('c2 query and body literals', () => {
    test('T-101 c2 @P0 an array search param is one comma-joined value (a%2Cb)', async () => {
      await performRequest('/works', {
        searchParams: { ids: ['a', 'b'], nums: [1, 2, 3], one: ['x'] },
      })
      expect(fetchCalls[0].url).toBe(
        `${API}/works?ids=a%2Cb&nums=1%2C2%2C3&one=x`
      )
    })

    test('T-101 c2 @P0 undefined and null search params are sent as the literal strings', async () => {
      await performRequest('/works', {
        searchParams: { a: undefined, b: null, c: false, d: 0 },
      })
      expect(fetchCalls[0].url).toBe(
        `${API}/works?a=undefined&b=null&c=false&d=0`
      )
    })

    test('T-101 c2 @P0 body null sends the string null with no app Content-Type (Q-018)', async () => {
      await performRequest(`${echo.origin}/post`, {
        method: 'POST',
        body: null,
      })
      const { init } = fetchCalls[0]
      expect(init.body).toBe('null')
      expect(Object.keys(init.headers)).toEqual(['Accept', 'Authorization'])
      const [wire] = echo.requests
      expect(wire.body).toBe('null')
      // the fetch default for a string, not JSON
      expect(wire.headers['content-type']).toBe('text/plain;charset=UTF-8')
    })

    test('T-101 c2 @P0 body undefined sends no body and no Content-Type', async () => {
      await performRequest(`${echo.origin}/post`, { method: 'POST' })
      const { init } = fetchCalls[0]
      expect(init.body).toBeUndefined()
      expect(Object.keys(init.headers)).toEqual(['Accept', 'Authorization'])
      const [wire] = echo.requests
      expect(wire.body).toBe('')
      expect(wire.headers['content-type']).toBeUndefined()
    })
  })

  describe('c3 GET and HEAD', () => {
    test('T-101 c3 @P0 a GET without a body carries no Content-Type and no body', async () => {
      await performRequest(`${echo.origin}/works/1?t=x`)
      const { init } = fetchCalls[0]
      expect(Object.keys(init.headers)).toEqual(['Accept', 'Authorization'])
      expect(init.body).toBeUndefined()
      const [wire] = echo.requests
      expect(wire.method).toBe('GET')
      expect(wire.url).toBe('/works/1?t=x')
      expect(wire.headers['content-type']).toBeUndefined()
      expect(wire.headers['content-length']).toBeUndefined()
      expect(wire.body).toBe('')
    })

    test('T-101 c3 @P0 a HEAD without a body carries no Content-Type and no body', async () => {
      await performRequest(`${echo.origin}/works/1`, { method: 'HEAD' })
      const { init } = fetchCalls[0]
      expect(Object.keys(init.headers)).toEqual(['Accept', 'Authorization'])
      expect(init.body).toBeUndefined()
      const [wire] = echo.requests
      expect(wire.method).toBe('HEAD')
      expect(wire.headers['content-type']).toBeUndefined()
      expect(wire.headers['content-length']).toBeUndefined()
    })

    // findings/06 §7.2 expects "GET with body -> no body"; the wrapper does
    // not do that (P0-03 issue): the Content-Type is set from the body
    // regardless of the method and the `body` option leaks through the final
    // spread un-serialised, so real fetch rejects before any byte is sent.
    test('T-101 c3 @P0 a GET with an object body leaks the raw option and fails in fetch', async () => {
      const body = { a: 1 }
      await expect(
        performRequest(`${echo.origin}/works`, { body })
      ).rejects.toMatchObject({ name: 'TypeError' })
      const { init } = fetchCalls[0]
      expect(init.method).toBe('GET')
      expect(init.body).toBe(body)
      expect(init.headers['Content-Type']).toBe('application/json')
      expect(echo.requests).toHaveLength(0)
    })
  })

  describe('c4 Authorization to every host (S-2)', () => {
    const HOSTS = [
      'https://api.core.ac.uk/v3/works/1',
      'https://api-dev.core.ac.uk/internal/members',
      'https://doi.org/10.1000/xyz123',
      'https://core.ac.uk/data-providers/86/logo',
      'https://logo.example.org/assets/logo.png',
      'http://core-frontend-api.core-frontend.svc.cluster.local/v3/works/1',
    ]

    HOSTS.forEach((url) => {
      test(`T-101 c4 @P0 Authorization and credentials go to ${url}`, async () => {
        await performRequest(url)
        const [{ init }] = fetchCalls
        expect(fetchCalls[0].url).toBe(url)
        expect(init.headers.Authorization).toBe('Bearer test-key')
        expect(init.headers.Accept).toBe('application/json')
        expect(init.credentials).toBe('include')
      })
    })

    test('T-101 c4 @P0 the bearer reaches a non-API host on the wire', async () => {
      // 127.0.0.1 stands for doi.org or a logo host: any URL gets the key
      await performRequest(`${echo.origin}/10.1000/xyz123`)
      const [wire] = echo.requests
      expect(wire.headers.authorization).toBe('Bearer test-key')
      expect(wire.headers.accept).toBe('application/json')
    })
  })
})
