// T-104 (41 B, R-016, R-028; Q-022): what api/index.js puts on the wire for an
// in-cluster call. A real in-process HTTP server on an ephemeral loopback port
// stands in for the API service; MSW is not loaded and fetch is the runtime's
// own. Internal_API points at the server, Internal_API_HOST is the public API
// host: the wrapper sends a Host override that native fetch drops, so the
// service sees its own host. Run on the Node of the runtime image (c2).
const fs = require('fs')
const http = require('http')
const path = require('path')

const PUBLIC_HOST = 'api.core.ac.uk'
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
          rawHeaders: req.rawHeaders,
          headers: req.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('{"echo":true}')
      })
    })
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({
        port,
        origin: `http://127.0.0.1:${port}`,
        host: `127.0.0.1:${port}`,
        requests,
        close: () =>
          new Promise((done) => {
            server.closeAllConnections()
            server.close(done)
          }),
      })
    })
  })

// [name, value] pairs of the headers as they arrived
const pairsOf = (rawHeaders) => {
  const pairs = []
  for (let i = 0; i < rawHeaders.length; i += 2)
    pairs.push([rawHeaders[i].toLowerCase(), rawHeaders[i + 1]])
  return pairs
}

describe('T-104 @P0 wire headers of an in-cluster call', () => {
  const savedEnv = {}
  let echo
  let performRequest

  beforeAll(async () => {
    echo = await startEcho()
    ENV_KEYS.forEach((key) => {
      savedEnv[key] = process.env[key]
    })
    process.env.Internal_API = echo.origin
    process.env.Internal_API_HOST = PUBLIC_HOST
    // a fresh copy: isServer is decided when internalize loads
    jest.isolateModules(() => {
      performRequest = require('../../../api/index').default
    })
  })

  afterAll(async () => {
    await echo.close()
    ENV_KEYS.forEach((key) => {
      if (savedEnv[key] === undefined) delete process.env[key]
      else process.env[key] = savedEnv[key]
    })
  })

  beforeEach(() => {
    echo.requests.length = 0
  })

  describe('c1 headers received by the service', () => {
    test('T-104 c1 @P0 Host is the service host; the Internal_API_HOST override is dropped by native fetch (Q-022)', async () => {
      const { data, status } = await performRequest(
        `https://${PUBLIC_HOST}/v3/works/1?t=x`
      )
      expect(status).toBe(200)
      expect(data).toEqual({ echo: true })

      expect(echo.requests).toHaveLength(1)
      const [wire] = echo.requests
      // the call was rewritten to the service: path and query kept
      expect(wire.method).toBe('GET')
      expect(wire.url).toBe('/v3/works/1?t=x')

      const hosts = pairsOf(wire.rawHeaders).filter(([name]) => name === 'host')
      expect(hosts).toEqual([['host', echo.host]])
      pairsOf(wire.rawHeaders).forEach(([, value]) => {
        expect(value).not.toContain(PUBLIC_HOST)
      })
    })

    test('T-104 c1 @P0 user-agent is node and accept-encoding is gzip, deflate', async () => {
      await performRequest(`https://${PUBLIC_HOST}/v3/works/1`)
      const [wire] = echo.requests
      expect(wire.headers['user-agent']).toBe('node')
      expect(wire.headers['accept-encoding']).toBe('gzip, deflate')
    })

    test('T-104 c1 @P0 the app headers ride along: Accept, Authorization, and no Content-Type on a GET', async () => {
      await performRequest(`https://${PUBLIC_HOST}/v3/works/1`)
      const [wire] = echo.requests
      expect(wire.headers.accept).toBe('application/json')
      expect(wire.headers.authorization).toBe('Bearer test-key')
      expect(wire.headers['content-type']).toBeUndefined()
      expect(wire.headers['content-length']).toBeUndefined()
    })

    test('T-104 c1 @P0 a relative path goes to API_URL on the service: /internal/<path>, same Host rule', async () => {
      await performRequest('/members', { searchParams: { limit: 5 } })
      const [wire] = echo.requests
      expect(wire.url).toBe('/internal/members?limit=5')
      expect(wire.headers.host).toBe(echo.host)
      expect(wire.headers['user-agent']).toBe('node')
      expect(wire.headers['accept-encoding']).toBe('gzip, deflate')
    })

    test('T-104 c1 @P0 a POST with a string body keeps the same headers and the fetch default text/plain', async () => {
      const body = '{"uri":"https://example.org"}'
      await performRequest(`https://${PUBLIC_HOST}/internal/data-providers`, {
        method: 'POST',
        body,
      })
      const [wire] = echo.requests
      expect(wire.method).toBe('POST')
      expect(wire.headers.host).toBe(echo.host)
      expect(wire.headers['content-type']).toBe('text/plain;charset=UTF-8')
      expect(wire.headers['content-length']).toBe(String(body.length))
      expect(wire.body).toBe(body)
      expect(wire.headers.authorization).toBe('Bearer test-key')
    })
  })

  describe('c2 runtime Node', () => {
    // 40 §2.1: Jest runs on the runtime image's Node so these wire headers are
    // the production ones; the image declares its major in the Dockerfile
    test("T-104 c2 @P0 Jest runs on the Node major of the step's runtime image", () => {
      const dockerfile = fs.readFileSync(
        path.join(__dirname, '..', '..', '..', 'Dockerfile'),
        'utf8'
      )
      const declared =
        dockerfile.match(/^ARG NODE_VERSION=(\d+)/m) ||
        dockerfile.match(/^FROM node:(\d+)/m)
      expect(declared).not.toBeNull()
      expect(process.versions.node.split('.')[0]).toBe(declared[1])
    })

    test("T-104 c2 @P0 the wire values above come from the runtime's own fetch, not a polyfill", async () => {
      await performRequest(`https://${PUBLIC_HOST}/v3/works/1`)
      const [wire] = echo.requests
      // node-fetch would send "node-fetch/1.0 (+https://github.com/bitinn/node-fetch)"
      expect(wire.headers['user-agent']).toBe('node')
      expect(typeof process.versions.undici).toBe('string')
    })
  })
})
