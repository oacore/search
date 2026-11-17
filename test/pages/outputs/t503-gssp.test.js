// T-503 (41 F, R-028, R-045): getServerSideProps of pages/outputs/[id].jsx
// (findings/06 §5.4). F layer: the context is built by hand ({ params } is all
// the function reads); the route handling of Next is pinned by T-601 and the
// browser tiers (30 §1 rule 6).
//
// MSW answers from the recorded fixtures (outputs 2001-2004, 2101-2103, 4040,
// 4100, 5000, the provider answers of 86, 4786 and 999999999, the doi.org
// citations, q090 logo answers). What the app sends is read where it hands it
// over: a spy on the global `fetch`. Edge answers are a recorded answer with
// one change, served by an override.
const { setupMsw } = require('../../utils/msw')
const { getServerSideProps } = require('../../../pages/outputs/[id]')

const { server, resolver, http, HttpResponse } = setupMsw()

const API = 'https://api.core.ac.uk'
const E6 = (id) => `${API}/v3/outputs/${id}`
const E7 = (id) => `${API}/v3/data-providers/${id}`
const DOI = (doi) => `https://doi.org/${doi}`
const GET_HEADERS = {
  Accept: 'application/json',
  Authorization: 'Bearer test-key',
}
const NOT_FOUND = 'The page you were looking for could not be found'
const DP_DISABLED = 'Data provider has been disabled'
const DOI_2001 = '10.1186/1756-0500-5-503'

const recorded = (url) => {
  const r = resolver.resolve('GET', url)
  if (r.status !== 200 || r.unmatched)
    throw new Error(`no 200 recorded answer for GET ${url}`)
  return JSON.parse(r.body.toString('utf8'))
}
const recordedText = (url) => resolver.resolve('GET', url).body.toString('utf8')

// Node's fetch parses JSON in the realm of the Node process, while this file
// and the page run in the Jest sandbox realm: an array of the answer is then
// not `instanceof Array` of the page (pages/outputs/[id].jsx:57), unlike in
// the server process, where Next and fetch share one realm. Response bodies
// are parsed again here, in the realm of the page, so the check sees what it
// sees in production (on Response.prototype: the transport of api/http.ts
// hands the app its own Response, not the one fetch returned).
const sameRealmJson = async function sameRealmJson() {
  return JSON.parse(await this.text())
}

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
  const mswFetch = global.fetch
  fetchSpy = jest
    .spyOn(global, 'fetch')
    .mockImplementation((...args) => mswFetch(...args))
  jest.spyOn(Response.prototype, 'json').mockImplementation(sameRealmJson)
  jest.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => {
  jest.restoreAllMocks()
  expect(unmatched).toEqual([])
})

const sent = () => fetchSpy.mock.calls.map(([url, init]) => ({ url, ...init }))
const sentLines = () => sent().map((c) => `${c.method} ${c.url}`)

// MSW matches a path; the query of the URL is not part of a handler
const answer = (url, body, init) =>
  server.use(http.get(url.split('?')[0], () => HttpResponse.json(body, init)))

const run = (id, query = {}) =>
  getServerSideProps({ params: { id: String(id) }, query })

// independent oracle: the first link of each type becomes a top-level key
const liftLinks = (item) => {
  const lifted = {}
  item.links.forEach(({ type, url }) => {
    if (!(type in lifted)) lifted[type] = url
  })
  return lifted
}
const citationsOf = (doi) => [
  { id: 'apa', style: 'apa', value: recordedText(DOI(doi)) },
  { id: 'bibtex', style: 'bibtex', value: recordedText(DOI(doi)) },
]

describe('T-503 @P0 /outputs/[id] getServerSideProps', () => {
  describe('T-503 c1 @P0 Q-030 sourceFulltextUrls is wrapped once more', () => {
    test('T-503 c1 @P0 output 2001: E6, E7, then the two citations; the exact props from the recorded answers', async () => {
      const output = recorded(E6(2001))
      const provider = recorded(E7(86))
      const result = await run(2001)

      expect(sentLines()).toEqual([
        `GET ${E6(2001)}`,
        `GET ${E7(86)}`,
        `GET ${DOI(DOI_2001)}`,
        `GET ${DOI(DOI_2001)}`,
      ])
      expect(sent()[0].headers).toEqual(GET_HEADERS)
      expect(sent()[1].headers).toEqual(GET_HEADERS)

      expect(Object.keys(result)).toEqual(['props'])
      expect(Object.keys(result.props)).toEqual(['data'])
      const { fullText: _, ...rest } = output
      expect(result.props.data).toEqual({
        ...rest,
        // the whole array becomes the only element of a new array
        sourceFulltextUrls: [output.sourceFulltextUrls],
        ...liftLinks(output),
        publishedDate: output.publishedDate,
        // E7 answer; its logo is replaced by null (Q-024)
        dataProvider: { ...provider, logo: null },
        citations: citationsOf(DOI_2001),
      })
      const { data } = result.props
      expect(data).not.toHaveProperty('fullText')
      expect(data.sourceFulltextUrls).toEqual([
        [
          'http://dx.doi.org/10.1186/1756-0500-5-503',
          'https://oro.open.ac.uk/90496/1/1756-0500-5-503.pdf',
        ],
      ])
      expect(data.download).toBe('https://core.ac.uk/download/571618880.pdf')
      expect(data.dataProvider.id).toBe(86)
      expect(data.dataProvider.logo).toBeNull()
    })

    test('T-503 c1 @P0 Q-030 a one-element array is wrapped too; only a non-empty array with a truthy first element is', async () => {
      const wrapped = async (sourceFulltextUrls) => {
        const output = recorded(E6(2001))
        output.sourceFulltextUrls = sourceFulltextUrls
        answer(E6(2001), output)
        return (await run(2001)).props.data.sourceFulltextUrls
      }
      expect(await wrapped(['https://x.test/a.pdf'])).toEqual([
        ['https://x.test/a.pdf'],
      ])
      expect(await wrapped([])).toEqual([])
      expect(await wrapped([''])).toEqual([''])
      expect(await wrapped([null, 'https://x.test/a.pdf'])).toEqual([
        null,
        'https://x.test/a.pdf',
      ])
      expect(await wrapped('https://x.test/a.pdf')).toBe('https://x.test/a.pdf')
      expect(await wrapped(null)).toBeNull()
    })

    test('T-503 c1 @P0 Q-024 the provider logo is null for a member and a non-member alike, and a member with a logo URL makes no logo request', async () => {
      // 86 is a harness member (supporting): its E7 logo is dropped
      const member = (await run(2001)).props.data.dataProvider
      expect(member.id).toBe(86)
      expect(member.logo).toBeNull()
      expect(sentLines().filter((l) => l.includes('/logo'))).toEqual([])

      // 4786 (output 2003) is not a member
      fetchSpy.mockClear()
      const other = (await run(2003)).props.data.dataProvider
      expect(other.id).toBe(4786)
      expect(other.logo).toBeNull()
      expect(sentLines().filter((l) => l.includes('/logo'))).toEqual([])
    })

    test('T-503 c1 @P0 Q-024 a non-member provider with a logo URL gets null, and no logo request', async () => {
      const provider = recorded(E7(4786))
      provider.logo = 'https://api.core.ac.uk/data-providers/4786/logo'
      answer(E7(4786), provider)
      const { props } = await run(2003)
      expect(props.data.dataProvider.id).toBe(4786)
      expect(props.data.dataProvider.logo).toBeNull()
      expect(sentLines().filter((l) => l.includes('/logo'))).toEqual([])
    })

    test('T-503 c1 @P0 Q-090 a member provider with logo null makes GET {API_URL}undefined (the 404 is swallowed), the logo stays null', async () => {
      const provider = recorded(E7(86))
      provider.logo = null
      answer(E7(86), provider)
      const { props } = await run(2001)
      expect(sentLines()).toEqual([
        `GET ${E6(2001)}`,
        `GET ${E7(86)}`,
        `GET ${API}/internalundefined`,
        `GET ${DOI(DOI_2001)}`,
        `GET ${DOI(DOI_2001)}`,
      ])
      expect(props.data.dataProvider.logo).toBeNull()
    })

    test('T-503 c1 @P0 the E7 URL is the url the API gives for the provider, whatever host', async () => {
      const output = recorded(E6(2001))
      output.dataProvider.url = 'https://other.example.org/v3/data-providers/86'
      answer(E6(2001), output)
      answer('https://other.example.org/v3/data-providers/86', recorded(E7(86)))
      const { props } = await run(2001)
      expect(props.data.dataProvider.id).toBe(86)
      expect(sentLines()[1]).toBe(
        'GET https://other.example.org/v3/data-providers/86'
      )
    })

    test('T-503 c1 @P0 the t parameter is not read: neither ?t=undefined nor a value reaches the API, and a repeated t does no harm', async () => {
      await run(2001, { t: ['a', 'b'] })
      await run(2001, { t: 'abc' })
      expect(sentLines().filter((l) => l.includes('/v3/outputs/'))).toEqual([
        `GET ${E6(2001)}`,
        `GET ${E6(2001)}`,
      ])
    })
  })

  describe('T-503 c2 @P0 the error messages: 410, disabled provider, 500', () => {
    test('T-503 c2 @P0 output 4100: the API answers 410, "The article with ID 4100 has been disabled", code 410, no prevHistoryUrl', async () => {
      const result = await run(4100)
      expect(result).toStrictEqual({
        props: {
          serverError: {
            code: 410,
            message: 'The article with ID 4100 has been disabled',
          },
        },
      })
      expect(Object.keys(result.props.serverError)).toEqual(['code', 'message'])
      expect(sentLines()).toEqual([`GET ${E6(4100)}`])
    })

    test('T-503 c2 @P0 output 2002: the provider GET (E7) answers 404, "Data provider has been disabled", code 404, no citation is requested', async () => {
      const result = await run(2002)
      expect(result).toStrictEqual({
        props: { serverError: { code: 404, message: DP_DISABLED } },
      })
      expect(sentLines()).toEqual([`GET ${E6(2002)}`, `GET ${E7(999999999)}`])
    })

    test('T-503 c2 @P0 output 5000: the API answers 500, the fixed "could not be found" text with code 500', async () => {
      expect(await run(5000)).toStrictEqual({
        props: { serverError: { code: 500, message: NOT_FOUND } },
      })
      expect(sentLines()).toEqual([`GET ${E6(5000)}`])
    })

    test('T-503 c2 @P0 output 4040: the API answers 404, the fixed text with code 404', async () => {
      expect(await run(4040)).toStrictEqual({
        props: { serverError: { code: 404, message: NOT_FOUND } },
      })
    })

    test.each([400, 401, 403, 429, 502, 503])(
      'T-503 c2 @P0 E6 answers %d: that code and the fixed text',
      async (status) => {
        answer(E6(2001), { message: 'x' }, { status })
        expect(await run(2001)).toStrictEqual({
          props: { serverError: { code: status, message: NOT_FOUND } },
        })
      }
    )

    test('T-503 c2 @P0 E7 answers 410: the article text is chosen by the status, although it is the provider that is gone', async () => {
      answer(E7(86), { message: 'gone' }, { status: 410 })
      expect(await run(2001)).toStrictEqual({
        props: {
          serverError: {
            code: 410,
            message: 'The article with ID 2001 has been disabled',
          },
        },
      })
    })

    test.each([401, 500, 503])(
      'T-503 c2 @P0 E7 answers %d: any status other than 410 means "Data provider has been disabled" (the URL is in the error message)',
      async (status) => {
        answer(E7(86), { message: 'x' }, { status })
        expect(await run(2001)).toStrictEqual({
          props: { serverError: { code: status, message: DP_DISABLED } },
        })
      }
    )

    test('T-503 c2 @P0 an id that contains data-providers in the E6 URL gets the provider message', async () => {
      answer(E6('data-providers'), { message: 'x' }, { status: 404 })
      expect(await run('data-providers')).toStrictEqual({
        props: { serverError: { code: 404, message: DP_DISABLED } },
      })
    })

    test('T-503 c2 @P0 a network error on E6 has no status: code undefined, the fixed text', async () => {
      expect(await run('__neterror')).toStrictEqual({
        props: { serverError: { code: undefined, message: NOT_FOUND } },
      })
    })

    test('T-503 c2 @P0 a network error on E7 has no status and no data-providers in its message: code undefined, the fixed text', async () => {
      server.use(http.get(E7(86), () => HttpResponse.error()))
      expect(await run(2001)).toStrictEqual({
        props: { serverError: { code: undefined, message: NOT_FOUND } },
      })
    })

    test('T-503 c2 @P0 an E6 answer without dataProvider throws a TypeError: code undefined, the fixed text, E7 not requested', async () => {
      const output = recorded(E6(2001))
      delete output.dataProvider
      answer(E6(2001), output)
      expect(await run(2001)).toStrictEqual({
        props: { serverError: { code: undefined, message: NOT_FOUND } },
      })
      expect(sentLines()).toEqual([`GET ${E6(2001)}`])
    })
  })

  describe('T-503 c3 @P0 O-yearstring and O-nofulltext', () => {
    test('T-503 c3 @P0 O-yearstring (2101): publishedDate null gives the string yearPublished "2001"', async () => {
      const result = await run(2101)
      expect(result.props.serverError).toBeUndefined()
      const { data } = result.props
      expect(data.publishedDate).toBe('2001')
      expect(typeof data.publishedDate).toBe('string')
      expect(data.yearPublished).toBe('2001')
      expect(data.citations).toEqual(citationsOf(DOI_2001))
    })

    test('T-503 c3 @P0 a publishedDate wins over the year; an empty one falls back to yearPublished', async () => {
      const output = recorded(E6(2001))
      output.publishedDate = ''
      output.yearPublished = '1999'
      answer(E6(2001), output)
      expect((await run(2001)).props.data.publishedDate).toBe('1999')
      output.publishedDate = '2020-05-01T00:00:00+00:00'
      expect((await run(2001)).props.data.publishedDate).toBe(
        '2020-05-01T00:00:00+00:00'
      )
    })

    test('T-503 c3 @P0 O-nofulltext (2102): sourceFulltextUrls null stays null, there is no download link; the gSSP does not fail', async () => {
      const result = await run(2102)
      expect(result.props.serverError).toBeUndefined()
      const { data } = result.props
      expect(data.sourceFulltextUrls).toBeNull()
      expect(Object.keys(data)).toContain('sourceFulltextUrls')
      expect(data).not.toHaveProperty('download')
      expect(data.reader).toBe('https://core.ac.uk/reader/571618880')
      // downloadUrl of the answer is a different field and stays
      expect(data.downloadUrl).toBe('https://core.ac.uk/download/571618880.pdf')
    })

    test('T-503 c3 @P0 O-nofulltext (2103): an absent sourceFulltextUrls stays absent (no key), no download link; the gSSP does not fail', async () => {
      const result = await run(2103)
      expect(result.props.serverError).toBeUndefined()
      const { data } = result.props
      expect(data).not.toHaveProperty('sourceFulltextUrls')
      expect(data).not.toHaveProperty('download')
      expect(data.id).toBe(2103)
    })

    test('T-503 c3 @P0 output 2003 (fulltextStatus disabled, only a display link): an empty sourceFulltextUrls is not wrapped', async () => {
      const { props } = await run(2003)
      expect(props.data.fulltextStatus).toBe('disabled')
      expect(props.data.sourceFulltextUrls).toEqual([])
      expect(props.data.publishedDate).toBe('2023')
      expect(props.data.display).toBe(
        recorded(E6(2003)).links.find((l) => l.type === 'display').url
      )
      expect(props.data).not.toHaveProperty('download')
      expect(props.data).not.toHaveProperty('reader')
      expect(props.data.dataProvider.id).toBe(4786)
    })

    test('T-503 c3 @P0 output 2004 (no reader link): the reader key is absent, the rest of the props are as for 2001', async () => {
      const { props } = await run(2004)
      expect(props.data).not.toHaveProperty('reader')
      expect(props.data.download).toBe(
        'https://core.ac.uk/download/571618880.pdf'
      )
      expect(props.data.sourceFulltextUrls).toHaveLength(1)
      expect(props.data.sourceFulltextUrls[0]).toHaveLength(2)
    })

    test('T-503 c3 @P0 an output without a DOI gets citations [] and no doi.org request; the DOI is read from identifiers', async () => {
      const output = recorded(E6(2001))
      output.identifiers = { oai: 'oai:x' }
      answer(E6(2001), output)
      const { props } = await run(2001)
      expect(props.data.citations).toEqual([])
      expect(sentLines().some((l) => l.includes('doi.org'))).toBe(false)

      // the top-level doi field is not used
      const other = recorded(E6(2001))
      other.identifiers = {}
      answer(E6(2001), other)
      expect((await run(2001)).props.data.citations).toEqual([])
    })

    test.each([500, 404])(
      'T-503 c3 @P0 doi.org answers %d: citations [] and the output is still served',
      async (status) => {
        server.use(
          http.get(DOI(DOI_2001), () => new HttpResponse('x', { status }))
        )
        const { props } = await run(2001)
        expect(props.serverError).toBeUndefined()
        expect(props.data.citations).toEqual([])
      }
    )
  })
})
