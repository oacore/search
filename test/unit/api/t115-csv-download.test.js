// T-115 (41 B, R-028): downloadResultsInCSV (api/search.js), the E3 call of the
// CSV modal (findings/06 §7.2 "Search CSV download"). The body is the object
// `{q, accept, limit}` that api/index.js stringifies, the answer is a
// `text/csv` body, which the response processor hands over as a Blob (only a
// JSON content type is parsed), and the Blob goes to js-file-download under
// the name `results.csv`. js-file-download is the harness factory spy
// (callable: api/search.js reads it with require() and calls it); MSW answers
// from the recorded fixtures of scenario search-csv; what the app sends is read
// where it leaves the process (the MSW request) and where the wrapper hands it
// to fetch (the spy on the global fetch).
const FileDownload = require('js-file-download')

const { setupMsw } = require('../../utils/msw')
const { downloadResultsInCSV } = require('../../../api/search')

const { server, resolver, http, HttpResponse } = setupMsw()

const E3 = 'https://api.core.ac.uk/v3/search/works'

// the recorded answer body of the E3 request with this limit
const recorded = (limit) => {
  const r = resolver.resolve(
    'POST',
    E3,
    JSON.stringify({ q: 'climate', accept: 'text/csv', limit })
  )
  if (r.status !== 200 || r.unmatched)
    throw new Error(`no recorded E3 answer for limit=${limit}`)
  return r.body.toString('utf8')
}

// a request the fixtures cannot answer is a 502 naming its triple: no test may
// depend on one by accident
let unmatched
beforeEach(() => {
  unmatched = []
  const resolve = resolver.resolve.bind(resolver)
  jest.spyOn(resolver, 'resolve').mockImplementation((...args) => {
    const answerOf = resolve(...args)
    if (answerOf.unmatched) unmatched.push(answerOf.unmatched)
    return answerOf
  })
})

// logs every E3 request that reaches the network layer; the answers come
// from the recorded fixtures unless a test overrides them
let requests
let fetchSpy
beforeEach(() => {
  requests = []
  FileDownload.mockClear()
  fetchSpy = jest.spyOn(global, 'fetch')
  server.use(
    http.post(E3, async ({ request }) => {
      requests.push({
        url: request.url,
        method: request.method,
        body: await request.clone().text(),
        headers: Object.fromEntries(request.headers.entries()),
      })
      return undefined
    })
  )
})
afterEach(() => {
  jest.restoreAllMocks()
  expect(unmatched).toEqual([])
})

describe('T-115 @P1 CSV download', () => {
  test('T-115 c1 @P1 a text/csv answer becomes FileDownload(Blob, "results.csv")', async () => {
    const csv = recorded(10)

    // the call resolves to nothing: the Blob goes to the download helper only
    await expect(
      downloadResultsInCSV({ q: 'climate', accept: 'text/csv', limit: 10 })
    ).resolves.toBeUndefined()

    expect(FileDownload).toHaveBeenCalledTimes(1)
    const [blob, name, ...rest] = FileDownload.mock.calls[0]
    expect(name).toBe('results.csv')
    expect(rest).toEqual([])
    expect(blob).toBeInstanceOf(Blob)
    // the type is the answer's (the runtime lower-cases it and drops the space)
    expect(blob.type).toMatch(/^text\/csv;\s?charset=utf-8$/)
    // the bytes are the answer's, unchanged
    expect(await blob.text()).toBe(csv)
    expect(csv.startsWith('"workID","oaiID","doi","title"')).toBe(true)
    expect(blob.size).toBe(Buffer.byteLength(csv))

    // a larger limit is another request with the same handling
    await downloadResultsInCSV({ q: 'climate', accept: 'text/csv', limit: 100 })
    expect(FileDownload).toHaveBeenCalledTimes(2)
    const [second, secondName] = FileDownload.mock.calls[1]
    expect(secondName).toBe('results.csv')
    expect(await second.text()).toBe(recorded(100))
    expect(await second.text()).not.toBe(csv)
  })

  test('T-115 c1 @P1 only a JSON content type is parsed: a JSON answer reaches FileDownload as an object, not a Blob', async () => {
    server.use(
      http.post(E3, () => HttpResponse.json({ results: [], totalHits: 0 }), {
        once: true,
      })
    )

    await downloadResultsInCSV({ q: 'climate', accept: 'text/csv', limit: 10 })

    expect(FileDownload).toHaveBeenCalledTimes(1)
    const [data, name] = FileDownload.mock.calls[0]
    expect(name).toBe('results.csv')
    expect(data).not.toBeInstanceOf(Blob)
    expect(data).toEqual({ results: [], totalHits: 0 })
  })

  test('T-115 c1 @P1 an API refusal rejects with the status error and nothing is downloaded', async () => {
    const error = await downloadResultsInCSV({
      q: 'climate',
      accept: 'text/csv',
      limit: 1000,
    }).catch((e) => e)

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('BadRequestError')
    expect(error.status).toBe(400)
    expect(error.message).toBe(`Request for ${E3} failed on 400`)
    expect(FileDownload).not.toHaveBeenCalled()
  })

  test('T-115 c2 @P1 the request is a POST of the JSON body {q, accept, limit} to /v3/search/works, in that key order', async () => {
    await downloadResultsInCSV({ q: 'climate', accept: 'text/csv', limit: 10 })

    // what leaves the process: one request, no `?t=`, the body bytes
    expect(requests).toHaveLength(1)
    const [wire] = requests
    expect(wire.method).toBe('POST')
    expect(wire.url).toBe(E3)
    expect(wire.body).toBe('{"q":"climate","accept":"text/csv","limit":10}')
    expect(JSON.parse(wire.body)).toEqual({
      q: 'climate',
      accept: 'text/csv',
      limit: 10,
    })
    expect(wire.headers['content-type']).toBe('application/json')
    // the answer is asked for as JSON although the body asks for CSV
    expect(wire.headers.accept).toBe('application/json')
    expect(wire.headers.authorization).toBe('Bearer test-key')

    // what the wrapper hands to fetch
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe(E3)
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"q":"climate","accept":"text/csv","limit":10}')
    expect(init.credentials).toBe('include')
    expect(init.headers).toEqual({
      'Accept': 'application/json',
      'Authorization': 'Bearer test-key',
      'Content-Type': 'application/json',
    })
  })

  test('T-115 c2 @P1 the limit chosen in the modal goes into the body as a number, nothing else is added', async () => {
    await downloadResultsInCSV({ q: 'climate', accept: 'text/csv', limit: 100 })
    await downloadResultsInCSV({
      q: 'climate',
      accept: 'text/csv',
      limit: 1000,
    }).catch(() => {})

    expect(requests.map((r) => r.body)).toEqual([
      '{"q":"climate","accept":"text/csv","limit":100}',
      '{"q":"climate","accept":"text/csv","limit":1000}',
    ])
    // the body is not edited: no `t`, no offset, no sort (those are E1 fields)
    expect(requests.every((r) => r.url === E3)).toBe(true)
  })
})
