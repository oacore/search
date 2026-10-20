// T-506 (41 F, R-020): /api/healthz answers 200 {"status":"ok"} without
// touching the upstream API.
const handler = require('../../../pages/api/healthz').default

const mockRes = () => {
  const res = { statusCode: null, body: undefined, headers: {} }
  res.status = jest.fn((code) => {
    res.statusCode = code
    return res
  })
  res.json = jest.fn((body) => {
    res.body = JSON.stringify(body)
    return res
  })
  res.setHeader = jest.fn((k, v) => {
    res.headers[k.toLowerCase()] = v
  })
  return res
}

describe('T-506 @P0 healthz', () => {
  test('T-506 @P0 200 {"status":"ok"} for GET and HEAD, no upstream call', () => {
    const savedFetch = global.fetch
    const fetchSpy = jest.fn()
    global.fetch = fetchSpy
    for (const method of ['GET', 'HEAD']) {
      const res = mockRes()
      handler({ method, url: '/api/healthz/', headers: {} }, res)
      expect(res.statusCode).toBe(200)
      expect(res.body).toBe('{"status":"ok"}')
      expect(res.status).toHaveBeenCalledTimes(1)
      expect(res.json).toHaveBeenCalledTimes(1)
    }
    expect(fetchSpy).not.toHaveBeenCalled()
    global.fetch = savedFetch
  })
})
