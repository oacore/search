// T-102 (41 B, R-028): api/index.js responses and errors (findings/06 §7.2
// "response/error" with the 41 corrections; Q-017). A loopback HTTP server
// answers with the exact status, headers and body of each case, so the real
// fetch, Response and Blob produce the values the wrapper resolves or throws.
const http = require('http')

const LogRocket = require('logrocket').default

const errors = require('../../../api/errors')
const performRequest = require('../../../api/index').default

const ENV_KEYS = ['Internal_API', 'Internal_API_HOST']

const startServer = () =>
  new Promise((resolve) => {
    const state = { answer: null, requests: [] }
    const server = http.createServer((req, res) => {
      req.resume()
      req.on('end', () => {
        state.requests.push({ method: req.method, url: req.url })
        const { answer } = state
        if (answer.destroy) {
          req.socket.destroy()
          return
        }
        res.writeHead(answer.status, answer.headers || {})
        res.end(answer.body)
      })
    })
    server.listen(0, '127.0.0.1', () => {
      state.origin = `http://127.0.0.1:${server.address().port}`
      state.close = () =>
        new Promise((done) => {
          server.closeAllConnections()
          server.close(done)
        })
      resolve(state)
    })
  })

const isBlob = (value) =>
  Object.prototype.toString.call(value) === '[object Blob]'

describe('T-102 @P0 api/index.js responses and errors', () => {
  const savedEnv = {}
  let srv

  const reply = (status, headers, body) => {
    srv.answer = { status, headers, body }
  }
  const call = (options) => performRequest(`${srv.origin}/case`, options)
  const failure = async (options) => {
    try {
      await call(options)
    } catch (error) {
      return error
    }
    throw new Error('the request resolved, a rejection was expected')
  }

  beforeAll(async () => {
    ENV_KEYS.forEach((key) => {
      savedEnv[key] = process.env[key]
      delete process.env[key]
    })
    srv = await startServer()
  })

  afterAll(async () => {
    await srv.close()
    ENV_KEYS.forEach((key) => {
      if (savedEnv[key] === undefined) delete process.env[key]
      else process.env[key] = savedEnv[key]
    })
  })

  beforeEach(() => {
    srv.requests.length = 0
    LogRocket.captureException.mockClear()
  })

  describe('c1 bodies and errors', () => {
    test('T-102 c1 @P0 a JSON content type resolves { data, type, status, headers } with the parsed body', async () => {
      reply(200, { 'Content-Type': 'application/json' }, '{"a":1,"l":[1,2]}')
      const result = await call()
      expect(Object.keys(result)).toEqual(['data', 'type', 'status', 'headers'])
      expect(result.data).toEqual({ a: 1, l: [1, 2] })
      expect(result.type).toBe('application/json')
      expect(result.status).toBe(200)
      expect(result.headers.get('content-type')).toBe('application/json')
      expect(LogRocket.captureException).not.toHaveBeenCalled()
    })

    test('T-102 c1 @P0 application/json; charset=utf-8 is parsed and keeps the full type string', async () => {
      reply(
        201,
        { 'Content-Type': 'application/json; charset=utf-8' },
        '{"created":true}'
      )
      const result = await call({ method: 'POST', body: { a: 1 } })
      expect(result.data).toEqual({ created: true })
      expect(result.type).toBe('application/json; charset=utf-8')
      expect(result.status).toBe(201)
    })

    // Q-017: the regex has a literal `\+`, so these are never parsed
    const BLOB_TYPES = [
      'application/vnd.api+json',
      'application/problem+json',
      'application/ld+json',
      'text/json',
      'text/plain',
      'text/html; charset=utf-8',
    ]
    BLOB_TYPES.forEach((type) => {
      test(`T-102 c1 @P0 ${type} resolves a Blob, not parsed JSON (Q-017)`, async () => {
        reply(200, { 'Content-Type': type }, '{"a":1}')
        const result = await call()
        expect(isBlob(result.data)).toBe(true)
        expect(await result.data.text()).toBe('{"a":1}')
        expect(result.type).toBe(type)
        expect(result.status).toBe(200)
      })
    })

    test('T-102 c1 @P0 a missing content type resolves a Blob and type null (Q-017)', async () => {
      reply(200, {}, '{"a":1}')
      const result = await call()
      expect(isBlob(result.data)).toBe(true)
      expect(await result.data.text()).toBe('{"a":1}')
      expect(result.type).toBeNull()
    })

    test('T-102 c1 @P0 the literal \\+ means one character before + still matches (application/x+json is parsed)', async () => {
      reply(200, { 'Content-Type': 'application/x+json' }, '{"a":1}')
      const result = await call()
      expect(result.data).toEqual({ a: 1 })
      expect(result.type).toBe('application/x+json')
    })

    test('T-102 c1 @P0 a HEAD request resolves an empty Blob even under application/json', async () => {
      reply(200, { 'Content-Type': 'application/json' }, '')
      const result = await call({ method: 'HEAD' })
      expect(srv.requests).toEqual([{ method: 'HEAD', url: '/case' }])
      expect(isBlob(result.data)).toBe(true)
      expect(result.data.size).toBe(0)
      expect(result.type).toBe('application/json')
    })

    test('T-102 c1 @P0 malformed JSON under application/json rejects with SyntaxError', async () => {
      reply(200, { 'Content-Type': 'application/json' }, '{"a":')
      const error = await failure()
      expect(error.name).toBe('SyntaxError')
      expect(error.status).toBeUndefined()
      expect(error).not.toBeInstanceOf(errors.default)
      // body parsing is outside the rejection handler that reports to LogRocket
      expect(LogRocket.captureException).not.toHaveBeenCalled()
    })

    test('T-102 c1 @P0 an empty 204 under application/json rejects with SyntaxError', async () => {
      reply(204, { 'Content-Type': 'application/json' })
      const error = await failure({ method: 'DELETE' })
      expect(error.name).toBe('SyntaxError')
      expect(error.status).toBeUndefined()
      expect(LogRocket.captureException).not.toHaveBeenCalled()
    })

    const CLASSES = [
      [400, 'BadRequestError'],
      [401, 'UnauthorizedError'],
      [402, 'PaymentRequiredError'],
      [403, 'ForbiddenError'],
      [404, 'NotFoundError'],
      [406, 'NotAcceptableError'],
      [409, 'BadRequestError'],
      [410, 'BadRequestError'],
      [422, 'BadRequestError'],
      [500, 'InternalServerError'],
      [503, 'InternalServerError'],
    ]
    CLASSES.forEach(([status, className]) => {
      test(`T-102 c1 @P0 status ${status} rejects with ${className} carrying status, data, type, headers`, async () => {
        reply(
          status,
          { 'Content-Type': 'application/json' },
          `{"message":"m${status}"}`
        )
        const error = await failure()
        expect(error.name).toBe(className)
        expect(error).toBeInstanceOf(errors[className])
        expect(error).toBeInstanceOf(errors.default)
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toBe(
          `Request for ${srv.origin}/case failed on ${status}`
        )
        expect(error.status).toBe(status)
        expect(error.data).toEqual({ message: `m${status}` })
        expect(error.type).toBe('application/json')
        expect(error.headers.get('content-type')).toBe('application/json')
        expect(error.response.status).toBe(status)
        expect(error.response.url).toBe(`${srv.origin}/case`)
      })
    })

    test('T-102 c1 @P0 a 502 HTML body rejects with InternalServerError and a Blob in data', async () => {
      reply(
        502,
        { 'Content-Type': 'text/html; charset=utf-8' },
        '<html><body>Bad Gateway</body></html>'
      )
      const error = await failure()
      expect(error.name).toBe('InternalServerError')
      expect(error.status).toBe(502)
      expect(error.type).toBe('text/html; charset=utf-8')
      expect(isBlob(error.data)).toBe(true)
      expect(await error.data.text()).toBe(
        '<html><body>Bad Gateway</body></html>'
      )
    })

    test('T-102 c1 @P0 an error without a content type has type null and an empty Blob', async () => {
      reply(500, {}, '')
      const error = await failure()
      expect(error.name).toBe('InternalServerError')
      expect(error.type).toBeNull()
      expect(isBlob(error.data)).toBe(true)
      expect(error.data.size).toBe(0)
    })

    test('T-102 c1 @P0 a failed HEAD keeps data as an empty Blob under application/json', async () => {
      reply(404, { 'Content-Type': 'application/json' }, '')
      const error = await failure({ method: 'HEAD' })
      expect(error.name).toBe('NotFoundError')
      expect(isBlob(error.data)).toBe(true)
      expect(error.data.size).toBe(0)
    })

    test('T-102 c1 @P0 LogRocket.captureException is called once per status failure, with the thrown error', async () => {
      reply(404, { 'Content-Type': 'application/json' }, '{}')
      const error = await failure()
      expect(LogRocket.captureException).toHaveBeenCalledTimes(1)
      expect(LogRocket.captureException.mock.calls[0][0]).toBe(error)
    })

    test('T-102 c1 @P0 a network error is rethrown untouched: TypeError, no status, no data', async () => {
      srv.answer = { destroy: true }
      const error = await failure()
      expect(error.name).toBe('TypeError')
      expect(error.message).toBe('fetch failed')
      // none of the fields processError assigns to a status failure
      const assigned = ['response', 'data', 'type', 'status', 'headers']
      assigned.forEach((key) => {
        expect(error).not.toHaveProperty(key)
      })
      expect(LogRocket.captureException).toHaveBeenCalledTimes(1)
      expect(LogRocket.captureException.mock.calls[0][0]).toBe(error)
    })
  })

  describe('c2 serialised error', () => {
    test('T-102 c2 @P0 JSON.stringify(error) is {name,response:{},data,type,status,headers:{}}', async () => {
      reply(404, { 'Content-Type': 'application/json' }, '{"message":"gone"}')
      const error = await failure()
      expect(JSON.stringify(error)).toBe(
        '{"name":"NotFoundError","response":{},"data":{"message":"gone"},' +
          '"type":"application/json","status":404,"headers":{}}'
      )
      expect(Object.keys(error)).toEqual([
        'name',
        'response',
        'data',
        'type',
        'status',
        'headers',
      ])
    })

    test('T-102 c2 @P0 a Blob data serialises as {} and the type string stays', async () => {
      reply(502, { 'Content-Type': 'text/html' }, '<p>Bad Gateway</p>')
      const error = await failure()
      expect(JSON.stringify(error)).toBe(
        '{"name":"InternalServerError","response":{},"data":{},' +
          '"type":"text/html","status":502,"headers":{}}'
      )
    })

    test('T-102 c2 @P0 a missing content type serialises type as null', async () => {
      reply(500, {}, 'boom')
      const error = await failure()
      expect(JSON.stringify(error)).toBe(
        '{"name":"InternalServerError","response":{},"data":{},' +
          '"type":null,"status":500,"headers":{}}'
      )
    })

    // R-028 / S-2: a transport error that kept its request config would carry
    // the Authorization header into the page props
    test('T-102 c2 @P0 the serialised error holds no request headers and no API key', async () => {
      reply(403, { 'Content-Type': 'application/json' }, '{"message":"no"}')
      const error = await failure({ headers: { 'X-Custom': 'secret-value' } })
      const text = JSON.stringify(error)
      expect(text).not.toContain('test-key')
      expect(text).not.toContain('Bearer')
      expect(text).not.toContain('Authorization')
      expect(text).not.toContain('secret-value')
      expect(Object.keys(error)).not.toContain('config')
      expect(Object.keys(error)).not.toContain('request')
    })

    test('T-102 c2 @P0 message and stack are not serialised; the message names the URL and status', async () => {
      reply(401, { 'Content-Type': 'application/json' }, '{}')
      const error = await failure()
      const serialised = JSON.parse(JSON.stringify(error))
      expect(serialised).not.toHaveProperty('message')
      expect(serialised).not.toHaveProperty('stack')
      expect(error.message).toBe(`Request for ${srv.origin}/case failed on 401`)
      expect(typeof error.stack).toBe('string')
    })
  })
})
