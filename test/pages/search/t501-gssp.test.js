// T-501 (41 F, R-028, R-045): getServerSideProps of pages/search/index.jsx
// (findings/06 §2.1). F layer: the context is built by hand, so the inputs the
// framework produces (query parsing and decoding, the 308 itself) are pinned
// by T-601 and the browser tiers, not here (30 §1 rule 6); Next hands this
// function decoded strings, or an array for a repeated key.
//
// MSW answers from the recorded fixtures (scenarios search-climate,
// search-zzzzqqq, search-x-page0, members). What the app sends is read where
// the app hands it over: a spy on the global `fetch` (url, method, body,
// headers, signal). Edge answers are a recorded answer with one change,
// served by an override. The 50 s abort runs against a loopback server that
// never answers, so the real Node fetch rejects.
const nodeHttp = require('http')

const { setupMsw } = require('../../utils/msw')
const { useFakeTimers, restoreClock } = require('../../utils/clock')
const formap = require('../../fixtures/data/.formap.json')
const { getServerSideProps } = require('../../../pages/search')

const { server, resolver, http, HttpResponse, passthrough } = setupMsw()

const E1 = 'https://api.core.ac.uk/v3/search/works'
const MEMBERS = 'https://api.core.ac.uk/internal/members'
const JSON_HEADERS = {
  'Accept': 'application/json',
  'Authorization': 'Bearer test-key',
  'Content-Type': 'application/json',
}
const GET_HEADERS = {
  Accept: 'application/json',
  Authorization: 'Bearer test-key',
}

// the recorded JSON answer of (method, url, body)
const recorded = (method, url, body) => {
  const r = resolver.resolve(method, url, body)
  if (r.status !== 200 || r.unmatched)
    throw new Error(`no recorded answer for ${method} ${url} ${body}`)
  return JSON.parse(r.body.toString('utf8'))
}
// a fresh copy of the recorded page 1 of q=climate
const CLIMATE_P1 = () =>
  recorded(
    'POST',
    `${E1}?t=undefined`,
    '{"q":"climate","offset":0,"limit":10,"exclude":["fullText"],"sort":"relevance"}'
  )
const MEMBER = recorded('GET', MEMBERS)[0]

// a request the fixtures cannot answer is a 502 naming its triple: no test may
// depend on one by accident
let unmatched
let fetchSpy
beforeEach(() => {
  unmatched = []
  const resolve = resolver.resolve.bind(resolver)
  jest.spyOn(resolver, 'resolve').mockImplementation((...args) => {
    const answerOf = resolve(...args)
    if (answerOf.unmatched) unmatched.push(answerOf.unmatched)
    return answerOf
  })
  fetchSpy = jest.spyOn(global, 'fetch')
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'time').mockImplementation(() => {})
  jest.spyOn(console, 'timeEnd').mockImplementation(() => {})
})
afterEach(() => {
  restoreClock()
  jest.restoreAllMocks()
  expect(unmatched).toEqual([])
})

// what the app handed to fetch, in call order
const sent = () => fetchSpy.mock.calls.map(([url, init]) => ({ url, ...init }))
const sentLines = () => sent().map((c) => `${c.method} ${c.url}`)
const e1Calls = () => sent().filter((c) => c.url.startsWith(E1))

const answerE1 = (body = CLIMATE_P1(), init) =>
  server.use(http.post(E1, () => HttpResponse.json(body, init)))
const answerMembers = (body, init) =>
  server.use(http.get(MEMBERS, () => HttpResponse.json(body, init)))

const run = (query) => getServerSideProps({ query })

// independent oracle for one result of the answer: the first link of each type
// becomes a top-level key; every provider is replaced by { url, ...formap row }
const liftLinks = (work) => {
  const lifted = {}
  work.links.forEach(({ type, url }) => {
    if (!(type in lifted)) lifted[type] = url
  })
  return lifted
}
const expectedResults = (raw) =>
  raw.results.map((work) => ({
    ...work,
    ...liftLinks(work),
    dataProviders: work.dataProviders.map(({ url, id }) => ({
      url,
      ...formap.find((row) => row.id === Number(id)),
    })),
  }))

describe('T-501 @P0 /search getServerSideProps', () => {
  describe('T-501 c1 @P0 findings/06 §2.1, one row at a time', () => {
    test('T-501 c1 @P0 /search without any parameter is a permanent redirect to / and sends no request', async () => {
      const result = await run({})
      expect(result).toStrictEqual({
        redirect: { permanent: true, destination: '/' },
        props: {},
      })
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    test('T-501 c1 @P0 ?q=climate: E1 then E15, the exact request, and the exact props from the recorded answer', async () => {
      const raw = CLIMATE_P1()
      const result = await run({ q: 'climate' })

      expect(sentLines()).toEqual([`POST ${E1}?t=undefined`, `GET ${MEMBERS}`])
      const [e1, members] = sent()
      expect(e1.body).toBe(
        '{"q":"climate","offset":0,"limit":10,"exclude":["fullText"],"sort":"relevance"}'
      )
      expect(e1.headers).toEqual(JSON_HEADERS)
      expect(e1.credentials).toBe('include')
      expect(e1.signal).toBeInstanceOf(AbortSignal)
      expect(members.headers).toEqual(GET_HEADERS)
      expect(members.body).toBeUndefined()
      expect(members.credentials).toBe('include')

      expect(Object.keys(result)).toEqual(['props'])
      expect(Object.keys(result.props)).toEqual(['data', 'members'])
      const { data } = result.props
      expect(Object.keys(data)).toEqual([
        'currentPage',
        'query',
        'sort',
        'totalHits',
        'limit',
        'offset',
        'results',
        'searchId',
      ])
      expect(data).toEqual({
        currentPage: 1,
        query: 'climate',
        sort: 'relevance',
        ...raw,
        results: expectedResults(raw),
      })
      expect(data.totalHits).toBe(1956781)
      expect(data.results).toHaveLength(10)
      // links are lifted to top-level keys, the API provider fields are
      // replaced: id 713 is not in the provider map, so only the url remains
      expect(data.results[0].download).toBe(
        'https://core.ac.uk/download/30671329.pdf'
      )
      expect(data.results[0].reader).toBe('https://core.ac.uk/reader/30671329')
      expect(data.results[0].dataProviders).toEqual([
        { url: 'https://api.core.ac.uk/v3/data-providers/713' },
      ])
      expect(result.props.members).toEqual([MEMBER])
    })

    test('T-501 c1 @P0 a provider of the map is replaced by { url, ...map row }; the string id is coerced; an unknown id keeps only the url', async () => {
      const raw = CLIMATE_P1()
      raw.results[0].dataProviders = [
        { id: 86, name: 'api name', url: 'https://x.test/86', logo: 'l' },
        { id: '4835', url: 'https://x.test/4835' },
        { id: 999999999, url: 'https://x.test/unknown' },
      ]
      answerE1(raw)
      const { props } = await run({ q: 'climate' })
      const row = (id) => formap.find((r) => r.id === id)
      expect(props.data.results[0].dataProviders).toEqual([
        { url: 'https://x.test/86', ...row(86) },
        { url: 'https://x.test/4835', ...row(4835) },
        { url: 'https://x.test/unknown' },
      ])
      expect(props.data.results[0].dataProviders[0].name).toBe(
        'Open Research Online (Open University)'
      )
      expect(props.data.results[0].dataProviders[0].logo).toBeUndefined()
    })

    test('T-501 c1 @P0 the first link of a type is the one lifted to the top level; the links array is kept', async () => {
      const raw = CLIMATE_P1()
      const { links } = raw.results[0]
      const first = links.find((l) => l.type === 'download').url
      links.push({ type: 'download', url: 'https://x.test/later.pdf' })
      links.unshift({ type: 'extra', url: 'https://x.test/extra' })
      answerE1(raw)
      const { props } = await run({ q: 'climate' })
      expect(props.data.results[0].download).toBe(first)
      expect(props.data.results[0].extra).toBe('https://x.test/extra')
      expect(props.data.results[0].links).toEqual(links)
    })

    test('T-501 c1 @P0 ?page=2 without q: q and t are dropped from the JSON body, the URL still has ?t=undefined, offset 10', async () => {
      answerE1()
      const { props } = await run({ page: '2' })
      const [e1] = e1Calls()
      expect(e1.url).toBe(`${E1}?t=undefined`)
      expect(e1.body).toBe(
        '{"offset":10,"limit":10,"exclude":["fullText"],"sort":"relevance"}'
      )
      expect(props.data.currentPage).toBe(2)
      expect(props.data.query).toBeUndefined()
      expect(Object.keys(props.data).slice(0, 3)).toEqual([
        'currentPage',
        'query',
        'sort',
      ])
    })

    test('T-501 c1 @P0 ?q=cancer: body { q, offset 0, limit 10 }', async () => {
      answerE1()
      await run({ q: 'cancer' })
      expect(e1Calls()[0].body).toBe(
        '{"q":"cancer","offset":0,"limit":10,"exclude":["fullText"],"sort":"relevance"}'
      )
    })

    test('T-501 c1 @P0 ?q=x&page=0: currentPage 0 and a negative offset -1 is sent; the recorded live answer is 500, so ErrorCard', async () => {
      const result = await run({ q: 'x', page: '0' })
      expect(e1Calls()[0].body).toBe(
        '{"q":"x","offset":-1,"limit":10,"exclude":["fullText"],"sort":"relevance"}'
      )
      expect(result).toEqual({
        props: { queryError: { query: 'x', status: 500 } },
      })
      expect(sentLines()).toEqual([`POST ${E1}?t=undefined`])
    })

    test('T-501 c1 @P0 ?q=x&page=0 with a 200 answer: data.currentPage is 0', async () => {
      answerE1()
      const { props } = await run({ q: 'x', page: '0' })
      expect(props.data.currentPage).toBe(0)
      expect(props.data.results).toHaveLength(10)
    })

    test.each([
      ['-5', -5, -6],
      ['1.5', 1.5, 5],
    ])(
      'T-501 c1 @P0 ?q=x&page=%s: currentPage %d, offset %d',
      async (page, currentPage, offset) => {
        answerE1()
        const { props } = await run({ q: 'x', page })
        expect(e1Calls()[0].body).toBe(
          `{"q":"x","offset":${offset},"limit":10,"exclude":["fullText"],"sort":"relevance"}`
        )
        expect(props.data.currentPage).toBe(currentPage)
      }
    )

    test('T-501 c1 @P0 ?q=x&page=abc: currentPage NaN, no E1 request, results [] and only E15', async () => {
      const result = await run({ q: 'x', page: 'abc' })
      expect(sentLines()).toEqual([`GET ${MEMBERS}`])
      expect(result.props.data).toEqual({
        currentPage: NaN,
        query: 'x',
        sort: 'relevance',
        results: [],
      })
      expect(Object.keys(result.props.data)).toEqual([
        'currentPage',
        'query',
        'sort',
        'results',
      ])
      expect(result.props.members).toEqual([MEMBER])
    })

    test('T-501 c1 @P0 ?q=climate&page=1000: offset 9990 is sent; the recorded live answer is 400 (offset too large), so ErrorCard', async () => {
      const result = await run({ q: 'climate', page: '1000' })
      expect(e1Calls()[0].body).toBe(
        '{"q":"climate","offset":9990,"limit":10,"exclude":["fullText"],"sort":"relevance"}'
      )
      expect(result).toEqual({
        props: { queryError: { query: 'climate', status: 400 } },
      })
      expect(sentLines()).toEqual([`POST ${E1}?t=undefined`])
    })

    test('T-501 c1 @P0 ?q=climate&page=1000 with a 200 answer: data.currentPage is 1000', async () => {
      answerE1()
      const { props } = await run({ q: 'climate', page: '1000' })
      expect(props.data.currentPage).toBe(1000)
      expect(props.data.results).toHaveLength(10)
    })

    test('T-501 c1 @P0 ?q=x&page=1001: no E1 request, results []', async () => {
      const { props } = await run({ q: 'x', page: '1001' })
      expect(sentLines()).toEqual([`GET ${MEMBERS}`])
      expect(props.data).toEqual({
        currentPage: 1001,
        query: 'x',
        sort: 'relevance',
        results: [],
      })
    })

    test('T-501 c1 @P0 ?q=x&limit=50&page=2: limit is the string "50", the offset ignores it', async () => {
      answerE1()
      await run({ q: 'x', limit: '50', page: '2' })
      expect(e1Calls()[0].body).toBe(
        '{"q":"x","offset":10,"limit":"50","exclude":["fullText"],"sort":"relevance"}'
      )
    })

    test('T-501 c1 @P0 ?q=climate&sort=recent (recorded answer): the body says recency, data.sort keeps recent', async () => {
      const { props } = await run({ q: 'climate', sort: 'recent' })
      expect(e1Calls()[0].body).toBe(
        '{"q":"climate","offset":0,"limit":10,"exclude":["fullText"],"sort":"recency"}'
      )
      expect(props.data.sort).toBe('recent')
    })

    test('T-501 c1 @P0 ?q=x&sort=foo: an unknown sort is passed through', async () => {
      answerE1()
      const { props } = await run({ q: 'x', sort: 'foo' })
      expect(e1Calls()[0].body).toBe(
        '{"q":"x","offset":0,"limit":10,"exclude":["fullText"],"sort":"foo"}'
      )
      expect(props.data.sort).toBe('foo')
    })

    test('T-501 c1 @P0 ?q=a&q=b: q is the array, in the body and in data.query', async () => {
      answerE1()
      const { props } = await run({ q: ['a', 'b'] })
      expect(e1Calls()[0].body).toBe(
        '{"q":["a","b"],"offset":0,"limit":10,"exclude":["fullText"],"sort":"relevance"}'
      )
      expect(props.data.query).toEqual(['a', 'b'])
    })

    test('T-501 c1 @P0 ?q=x&t=123-456: t is in the URL and in the body', async () => {
      answerE1()
      await run({ q: 'x', t: '123-456' })
      const [e1] = e1Calls()
      expect(e1.url).toBe(`${E1}?t=123-456`)
      expect(e1.body).toBe(
        '{"q":"x","offset":0,"limit":10,"t":"123-456","exclude":["fullText"],"sort":"relevance"}'
      )
    })

    test('T-501 c1 @P0 a decoded q with special characters is sent as JSON, unchanged', async () => {
      answerE1()
      await run({ q: '#C++' })
      expect(e1Calls()[0].body).toBe(
        '{"q":"#C++","offset":0,"limit":10,"exclude":["fullText"],"sort":"relevance"}'
      )
      expect(e1Calls()[0].url).toBe(`${E1}?t=undefined`)
    })

    test('T-501 c1 @P0 a 10 kB q is sent as it is, no length guard', async () => {
      answerE1()
      const q = 'ab cd'.repeat(2048)
      expect(q.length).toBe(10240)
      const { props } = await run({ q })
      expect(JSON.parse(e1Calls()[0].body).q).toBe(q)
      expect(props.data.query).toBe(q)
    })

    test('T-501 c1 @P0 a query with no hit (recorded zzzzqqq answer): the answer is spread, results [], members still fetched', async () => {
      const { props } = await run({ q: 'zzzzqqq' })
      const raw = recorded(
        'POST',
        `${E1}?t=undefined`,
        '{"q":"zzzzqqq","offset":0,"limit":10,"exclude":["fullText"],"sort":"relevance"}'
      )
      expect(raw.results).toEqual([])
      expect(props.data).toEqual({
        currentPage: 1,
        query: 'zzzzqqq',
        sort: 'relevance',
        ...raw,
      })
      expect(sentLines()).toEqual([`POST ${E1}?t=undefined`, `GET ${MEMBERS}`])
    })

    test('T-501 c1 @P0 E1 answers 500 (__status500): props are { queryError: { query, status: 500 } } and E15 is not requested', async () => {
      const result = await run({ q: '__status500' })
      expect(result).toEqual({
        props: { queryError: { query: '__status500', status: 500 } },
      })
      expect(Object.keys(result.props)).toEqual(['queryError'])
      expect(sentLines()).toEqual([`POST ${E1}?t=undefined`])
    })

    test.each([401, 404, 410, 429, 502, 503])(
      'T-501 c1 @P0 E1 answers %d: queryError.status is that status',
      async (status) => {
        answerE1({ message: 'x' }, { status })
        const result = await run({ q: 'x' })
        expect(result).toEqual({
          props: { queryError: { query: 'x', status } },
        })
      }
    )

    test('T-501 c1 @P0 E1 network error (__neterror): queryError.status is null, no data in the props, E15 is not requested', async () => {
      const result = await run({ q: '__neterror' })
      expect(result).toEqual({
        props: { queryError: { query: '__neterror', status: null } },
      })
      expect(result.props.queryError.status).toBeNull()
      expect(result.props.data).toBeUndefined()
      expect(sentLines()).toEqual([`POST ${E1}?t=undefined`])
    })

    test('T-501 c1 @P0 E1 resolves without results: data.results [], the answer is not spread, E15 is requested', async () => {
      answerE1({ totalHits: 5, limit: 10, offset: 0 })
      const { props } = await run({ q: 'x' })
      expect(props.data).toEqual({
        currentPage: 1,
        query: 'x',
        sort: 'relevance',
        results: [],
      })
      expect(props.data.totalHits).toBeUndefined()
      expect(sentLines()).toEqual([`POST ${E1}?t=undefined`, `GET ${MEMBERS}`])
    })

    test('T-501 c1 @P0 E1 resolves with a non-JSON body: data.results []', async () => {
      server.use(
        http.post(
          E1,
          () =>
            new HttpResponse('plain text', {
              headers: { 'content-type': 'text/plain' },
            })
        )
      )
      const { props } = await run({ q: 'x' })
      expect(props.data).toEqual({
        currentPage: 1,
        query: 'x',
        sort: 'relevance',
        results: [],
      })
    })

    test('T-501 c1 @P0 an empty results array is truthy: it is spread like any answer', async () => {
      answerE1({ totalHits: 0, limit: 10, offset: 0, results: [] })
      const { props } = await run({ q: 'x' })
      expect(props.data).toEqual({
        currentPage: 1,
        query: 'x',
        sort: 'relevance',
        totalHits: 0,
        limit: 10,
        offset: 0,
        results: [],
      })
    })

    describe('T-501 c1 @P0 members (E15)', () => {
      const lone = async (member) => {
        answerE1()
        answerMembers([member])
        const { props } = await run({ q: 'climate' })
        return props.members
      }

      test('T-501 c1 @P0 an eligible member is featured as the only member', async () => {
        expect(await lone(MEMBER)).toEqual([MEMBER])
      })

      test.each([
        ['billing_type starting', { billing_type: 'starting' }],
        ['a name with test', { organisation_name: 'University Test Site' }],
        [
          'a name with TEST inside a word',
          { organisation_name: 'Contest College' },
        ],
        ['a name with demo', { organisation_name: 'Demo Library' }],
        [
          'a name with DEMO inside a word',
          { organisation_name: 'The DEMOnstration Hub' },
        ],
        ['an empty name', { organisation_name: '' }],
        ['a null name', { organisation_name: null }],
        ['no name', { organisation_name: undefined }],
      ])('T-501 c1 @P0 excluded: %s', async (_label, change) => {
        expect(await lone({ ...MEMBER, ...change })).toEqual([])
      })

      test.each([
        ['no billing_type', { billing_type: undefined }],
        ['billing_type free', { billing_type: 'free' }],
        ['not activated', { activated: 0 }],
        ['a name with tes only', { organisation_name: 'Tes University' }],
      ])('T-501 c1 @P0 kept and featured: %s', async (_label, change) => {
        const member = { ...MEMBER, ...change }
        expect(await lone(member)).toEqual([JSON.parse(JSON.stringify(member))])
      })

      test('T-501 c1 @P0 the filter runs before the pick: a starting member next to an eligible one is never featured', async () => {
        answerE1()
        answerMembers([
          { ...MEMBER, organisation_id: 1, billing_type: 'starting' },
          { ...MEMBER, organisation_id: 2, organisation_name: 'demo' },
          MEMBER,
        ])
        // random 0 picks the first eligible member: that would be the demo
        // member if the filter ran after the pick
        jest.spyOn(Math, 'random').mockReturnValue(0)
        const { props } = await run({ q: 'climate' })
        expect(props.members).toEqual([MEMBER])
      })

      test('T-501 c1 @P0 of several eligible members one is featured at random: members has exactly that one', async () => {
        const first = {
          ...MEMBER,
          organisation_id: 1,
          organisation_name: 'First',
        }
        const second = {
          ...MEMBER,
          organisation_id: 2,
          organisation_name: 'Second',
        }
        answerE1()
        answerMembers([first, second])
        const random = jest.spyOn(Math, 'random')
        random.mockReturnValue(0)
        expect((await run({ q: 'climate' })).props.members).toEqual([first])
        random.mockReturnValue(0.99)
        expect((await run({ q: 'climate' })).props.members).toEqual([second])
      })

      test.each([
        ['an object', { message: 'no list' }],
        ['null', null],
        ['a string', 'members'],
      ])(
        'T-501 c1 @P0 an answer that is %s gives members []',
        async (_l, body) => {
          answerE1()
          answerMembers(body)
          const { props } = await run({ q: 'climate' })
          expect(props.members).toEqual([])
          expect(props.data.results).toHaveLength(10)
        }
      )

      test.each([500, 401, 404])(
        'T-501 c1 @P0 E15 answers %d: the error is swallowed, members [] and the data are kept',
        async (status) => {
          answerE1()
          answerMembers({ message: 'x' }, { status })
          const { props } = await run({ q: 'climate' })
          expect(props.members).toEqual([])
          expect(props.data.results).toHaveLength(10)
          expect(Object.keys(props)).toEqual(['data', 'members'])
        }
      )

      test('T-501 c1 @P0 an E15 network error is swallowed too', async () => {
        answerE1()
        server.use(http.get(MEMBERS, () => HttpResponse.error()))
        const { props } = await run({ q: 'climate' })
        expect(props.members).toEqual([])
        expect(props.data.results).toHaveLength(10)
      })

      test('T-501 c1 @P0 no eligible member and an empty list give members []', async () => {
        answerE1()
        answerMembers([])
        const { props } = await run({ q: 'climate' })
        expect(props.members).toEqual([])
      })
    })

    describe('T-501 c1 @P0 the 50 s abort', () => {
      let upstream
      let port
      let firstRequest
      beforeEach(async () => {
        upstream = nodeHttp.createServer(() => {})
        firstRequest = new Promise((resolve) =>
          upstream.once('request', (req) => resolve(req))
        )
        await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))
        ;({ port } = upstream.address())
        // the server-side route to the in-cluster service sends E1 to the
        // loopback server instead of the fixtures
        process.env.Internal_API = `http://127.0.0.1:${port}`
        process.env.Internal_API_HOST = 'api.core.ac.uk'
        server.use(http.all(`http://127.0.0.1:${port}/*`, () => passthrough()))
      })
      afterEach(async () => {
        delete process.env.Internal_API
        delete process.env.Internal_API_HOST
        upstream.closeAllConnections()
        await new Promise((resolve) => upstream.close(resolve))
      })

      test('T-501 c1 @P0 an E1 that never answers is aborted at 50 000 ms: AbortError, queryError.status null, E15 not requested', async () => {
        useFakeTimers()
        const pending = run({ q: 'x' })
        const req = await firstRequest
        expect(`${req.method} ${req.url}`).toBe(
          'POST /v3/search/works?t=undefined'
        )
        const { signal } = sent()[0]
        await jest.advanceTimersByTimeAsync(49999)
        expect(signal.aborted).toBe(false)
        await jest.advanceTimersByTimeAsync(1)
        expect(signal.aborted).toBe(true)
        expect(signal.reason.name).toBe('AbortError')

        expect(await pending).toEqual({
          props: { queryError: { query: 'x', status: null } },
        })
        expect(sent()).toHaveLength(1)
        expect(jest.getTimerCount()).toBe(0)
      }, 30000)

      test('T-501 c1 @P0 an answered E1 clears its 50 000 ms timer: the signal is never aborted', async () => {
        useFakeTimers()
        // served by the fixtures, not by the loopback server
        delete process.env.Internal_API
        const setSpy = jest.spyOn(global, 'setTimeout')
        const clearSpy = jest.spyOn(global, 'clearTimeout')
        const { props } = await run({ q: 'climate' })
        expect(props.data.results).toHaveLength(10)

        const abortTimers = setSpy.mock.calls
          .map(([, delay], i) => ({ delay, id: setSpy.mock.results[i].value }))
          .filter(({ delay }) => delay === 50000)
        expect(abortTimers).toHaveLength(1)
        expect(clearSpy).toHaveBeenCalledWith(abortTimers[0].id)
        await jest.advanceTimersByTimeAsync(120000)
        expect(e1Calls()[0].signal.aborted).toBe(false)
      }, 30000)
    })
  })

  describe('T-501 c2 @P0 quirks: Q-002, Q-013, Q-015 and the t parameter (Q-016)', () => {
    test('T-501 c2 @P0 Q-002 only a query without any key redirects; a key the page does not know is a search', async () => {
      expect(await run({})).toStrictEqual({
        redirect: { permanent: true, destination: '/' },
        props: {},
      })
      expect(fetchSpy).not.toHaveBeenCalled()

      answerE1()
      const { props } = await run({ utm_source: 'x' })
      expect(props.data.currentPage).toBe(1)
      expect(props.data.query).toBeUndefined()
      expect(e1Calls()[0].body).toBe(
        '{"offset":0,"limit":10,"exclude":["fullText"],"sort":"relevance"}'
      )
    })

    // [page, limit, currentPage, offset sent | null for no request]
    test.each([
      [undefined, undefined, 1, 0],
      ['1', undefined, 1, 0],
      ['2', undefined, 2, 10],
      ['5', undefined, 5, 40],
      ['3', '50', 3, 20],
      ['2', '5', 2, 10],
      ['0', undefined, 0, -1],
      ['-5', undefined, -5, -6],
      ['1.5', undefined, 1.5, 5],
      ['2.5', undefined, 2.5, 15],
      ['', undefined, 0, -1],
      [' 7 ', undefined, 7, 60],
      ['1e3', undefined, 1000, 9990],
      ['0x10', undefined, 16, 150],
      ['1000', undefined, 1000, 9990],
      ['1001', undefined, 1001, null],
      ['1000.5', undefined, 1000.5, null],
      ['abc', undefined, NaN, null],
      ['Infinity', undefined, Infinity, null],
      [['1', '2'], undefined, NaN, null],
    ])(
      'T-501 c2 @P0 Q-013 page %p limit %p: currentPage %p, offset %p',
      async (page, limit, currentPage, offset) => {
        answerE1()
        const { props } = await run({ q: 'x', page, limit })
        expect(props.data.currentPage).toEqual(currentPage)
        if (offset === null) {
          expect(e1Calls()).toHaveLength(0)
          expect(props.data.results).toEqual([])
        } else {
          expect(e1Calls()).toHaveLength(1)
          const body = JSON.parse(e1Calls()[0].body)
          expect(body.offset).toBe(offset)
          // the offset never follows the limit
          expect(body.limit).toBe(limit === undefined ? 10 : limit)
        }
      }
    )

    test('T-501 c2 @P0 Q-015 a work without dataProviders makes the provider transform throw: queryError with status null, no members request', async () => {
      const result = await run({ q: '__nodataproviders' })
      expect(result).toEqual({
        props: { queryError: { query: '__nodataproviders', status: null } },
      })
      expect(result.props.data).toBeUndefined()
      expect(sentLines()).toEqual([`POST ${E1}?t=undefined`])
    })

    test('T-501 c2 @P0 Q-015 it is the first failing work of any position, null counts too; an empty list does not fail', async () => {
      const raw = CLIMATE_P1()
      raw.results[7].dataProviders = null
      answerE1(raw)
      expect(await run({ q: 'x' })).toEqual({
        props: { queryError: { query: 'x', status: null } },
      })

      const ok = CLIMATE_P1()
      ok.results[0].dataProviders = []
      answerE1(ok)
      const { props } = await run({ q: 'x' })
      expect(props.data.results[0].dataProviders).toEqual([])
      expect(props.data.results).toHaveLength(10)
    })

    test('T-501 c2 @P0 Q-016 without t the URL carries ?t=undefined and the body has no t', async () => {
      answerE1()
      await run({ q: 'x' })
      const [e1] = e1Calls()
      expect(e1.url).toBe(`${E1}?t=undefined`)
      expect(JSON.parse(e1.body)).not.toHaveProperty('t')
    })

    test.each([
      ['a&b=c d', `${E1}?t=a&b=c+d`],
      ['1&limit=5', `${E1}?t=1&limit=5`],
      ['1#frag', `${E1}?t=1#frag`],
      ['50%', `${E1}?t=50%25`],
      ['a+b', `${E1}?t=a+b`],
      ['', `${E1}?t=`],
    ])(
      'T-501 c2 @P0 Q-016 t %p is not encoded: the URL handed to fetch is %s, the body keeps the whole value',
      async (t, url) => {
        answerE1()
        await run({ q: 'x', t })
        const [e1] = e1Calls()
        expect(e1.url).toBe(url)
        expect(JSON.parse(e1.body).t).toBe(t)
        expect(e1.body).toBe(
          `{"q":"x","offset":0,"limit":10,"t":${JSON.stringify(
            t
          )},"exclude":["fullText"],"sort":"relevance"}`
        )
      }
    )

    test('T-501 c2 @P0 Q-016 a repeated t throws before any request: queryError with status null, nothing is sent', async () => {
      const result = await run({ q: 'x', t: ['a', 'b'] })
      expect(result).toEqual({
        props: { queryError: { query: 'x', status: null } },
      })
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })
})
