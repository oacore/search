// T-502 (41 F, R-028, R-045): getServerSideProps of pages/works/[id].jsx
// (findings/06 §5.4 and §7.2). F layer: the context ({ params, query, req })
// is built by hand; the route and query parsing of Next are pinned by T-601
// and the browser tiers (30 §1 rule 6).
//
// MSW answers from the recorded fixtures (works 1001/1002/4040/4100-4102/
// 4200/5000/6948813, their outputs, the doi.org citations, q090 logo
// answers). What the app sends is read where it hands it over: a spy on the
// global `fetch`. Edge answers are a recorded answer with one change, served
// by an override.
const { setupMsw } = require('../../utils/msw')
const { getServerSideProps } = require('../../../pages/works/[id]')

const { server, resolver, http, HttpResponse } = setupMsw()

const API = 'https://api.core.ac.uk'
const E4 = (id, search = '?t=undefined') => `${API}/v3/works/${id}${search}`
const E5 = (id) => `${API}/v3/works/${id}/outputs`
const DOI = (doi) => `https://doi.org/${doi}`
const GET_HEADERS = {
  Accept: 'application/json',
  Authorization: 'Bearer test-key',
}
const CITATION_HEADERS = (style) => ({
  Accept: `text/x-bibliography; style=${style}; locale=en-GB`,
  Authorization: 'Bearer test-key',
})
const NOT_FOUND = 'The page you were looking for could not be found'

const recorded = (url) => {
  const r = resolver.resolve('GET', url)
  if (r.status !== 200 || r.unmatched)
    throw new Error(`no 200 recorded answer for GET ${url}`)
  return JSON.parse(r.body.toString('utf8'))
}
const recordedText = (url) => resolver.resolve('GET', url).body.toString('utf8')

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
})
afterEach(() => {
  jest.restoreAllMocks()
  expect(unmatched).toEqual([])
})

const sent = () => fetchSpy.mock.calls.map(([url, init]) => ({ url, ...init }))
const sentLines = () => sent().map((c) => `${c.method} ${c.url}`)

// MSW matches a path; the query of the URL is not part of a handler
const path = (url) => url.split('?')[0]
const answer = (url, body, init) =>
  server.use(http.get(path(url), () => HttpResponse.json(body, init)))
const answerText = (url, text, init) =>
  server.use(http.get(path(url), () => new HttpResponse(text, init)))

const run = (id, { query = {}, referer } = {}) =>
  getServerSideProps({
    params: { id: String(id) },
    query,
    req: { headers: referer ? { referer } : {} },
  })

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

// the whole expected data of a work whose providers are not members
const expectedData = (work, outputs, citations) => {
  const { fullText: _, ...rest } = work
  return {
    ...rest,
    ...liftLinks(work),
    // `identifiers` is an array in the API answer: its indexes are spread
    identifiers: { ...work.identifiers, doi: work.doi },
    publishedDate: work.publishedDate ? work.publishedDate : work.yearPublished,
    sourceFulltextUrls: (work.sourceFulltextUrls || [])[0] || null,
    outputs: outputs.map((o) => ({
      ...o,
      ...liftLinks(o),
      dataProvider: { ...o.dataProvider, logo: null },
    })),
    dataProvider: work.dataProviders[0],
    mainDataProviderLink: null,
    citations,
  }
}

describe('T-502 @P0 /works/[id] getServerSideProps', () => {
  describe('T-502 c1 @P0 findings/06 §7.2: props, Q-031, Q-001, Q-024, W-410, W-emptydate, W-nodp', () => {
    test('T-502 c1 @P0 work 1001: E4, E5, then the two citations; the exact props from the recorded answers', async () => {
      const work = recorded(E4(1001))
      const outputs = recorded(E5(1001))
      const result = await run(1001)

      expect(sentLines()).toEqual([
        `GET ${E4(1001)}`,
        `GET ${E5(1001)}`,
        `GET ${DOI('10.1111/rego.12518')}`,
        `GET ${DOI('10.1111/rego.12518')}`,
      ])
      const [e4, e5] = sent()
      expect(e4.headers).toEqual(GET_HEADERS)
      expect(e5.headers).toEqual(GET_HEADERS)
      expect(e4.body).toBeUndefined()
      expect(e4.credentials).toBe('include')

      expect(Object.keys(result)).toEqual(['props'])
      expect(Object.keys(result.props)).toEqual(['data'])
      expect(result.props.data).toEqual(
        expectedData(work, outputs, citationsOf('10.1111/rego.12518'))
      )
      const { data } = result.props
      // fullText is stripped, the links are lifted
      expect(data).not.toHaveProperty('fullText')
      expect(data.download).toBe('https://core.ac.uk/download/566708785.pdf')
      expect(data.reader).toBe('https://core.ac.uk/reader/566708785')
      // identifiers: the array of the answer is spread into index keys
      expect(Array.isArray(data.identifiers)).toBe(false)
      expect(data.identifiers[0]).toEqual({
        identifier: '566708785',
        type: 'core_id',
      })
      expect(data.identifiers.doi).toBe('10.1111/rego.12518')
      expect(data.publishedDate).toBe('2023-03-14T00:00:00+00:00')
      expect(data.sourceFulltextUrls).toBe(
        'https://core.ac.uk/download/566708785.pdf'
      )
      expect(data.dataProvider).toEqual({
        id: 4786,
        name: 'Crossref',
        url: 'https://api.core.ac.uk/v3/data-providers/4786',
        logo: 'https://api.core.ac.uk/data-providers/4786/logo',
      })
      expect(data.outputs).toHaveLength(3)
      expect(data.mainDataProviderLink).toBeNull()
    })

    test('T-502 c1 @P0 the first link of a type is the one lifted to the top level, for the work and for its outputs', async () => {
      const work = recorded(E4(1001))
      const outputs = recorded(E5(1001))
      const first = work.links.find((l) => l.type === 'download').url
      const firstOutput = outputs[0].links.find(
        (l) => l.type === 'download'
      ).url
      work.links.push({ type: 'download', url: 'https://x.test/later.pdf' })
      outputs[0].links.push({
        type: 'download',
        url: 'https://x.test/later.pdf',
      })
      answer(E4(1001), work)
      answer(E5(1001), outputs)
      const { props } = await run(1001)
      expect(props.data.download).toBe(first)
      expect(props.data.outputs[0].download).toBe(firstOutput)
    })

    test('T-502 c1 @P0 work 1002 (minimal): an empty publishedDate and a null year give null, no source url gives null', async () => {
      const { props } = await run(1002)
      expect(props.data.publishedDate).toBeNull()
      expect(props.data.sourceFulltextUrls).toBeNull()
      expect(props.data.id).toBe(1002)
    })

    test('T-502 c1 @P0 a publishedDate wins over the year; an empty one falls back to yearPublished', async () => {
      const work = recorded(E4(1001))
      work.publishedDate = '2020-05-01T00:00:00+00:00'
      work.yearPublished = 1999
      answer(E4(1001), work)
      expect((await run(1001)).props.data.publishedDate).toBe(
        '2020-05-01T00:00:00+00:00'
      )

      work.publishedDate = ''
      expect((await run(1001)).props.data.publishedDate).toBe(1999)
      work.publishedDate = null
      expect((await run(1001)).props.data.publishedDate).toBe(1999)
    })

    test('T-502 c1 @P0 W-emptydate (work 6948813): publishedDate "" gives the numeric yearPublished 2001, no DOI so no citation request', async () => {
      const { props } = await run(6948813)
      expect(sentLines()).toEqual([`GET ${E4(6948813)}`, `GET ${E5(6948813)}`])
      expect(props.data.publishedDate).toBe(2001)
      expect(typeof props.data.publishedDate).toBe('number')
      expect(props.data.doi).toBeNull()
      expect(props.data.citations).toEqual([])
    })

    test('T-502 c1 @P0 W-nodp (work 4200, dataProviders []): no error, dataProvider is an own property set to undefined', async () => {
      const result = await run(4200)
      expect(result.props.serverError).toBeUndefined()
      const { data } = result.props
      expect(data.dataProviders).toEqual([])
      expect(Object.keys(data)).toContain('dataProvider')
      expect(data.dataProvider).toBeUndefined()
      expect(data.outputs).toHaveLength(1)
      // the DOI is set, so the citations are requested and returned
      expect(data.citations).toEqual(citationsOf('10.7910/dvn/hcydpq'))
    })

    test('T-502 c1 @P0 an answer without the dataProviders key throws inside the gSSP: soft 404 with code undefined', async () => {
      const work = recorded(E4(1001))
      delete work.dataProviders
      answer(E4(1001), work)
      expect(await run(1001)).toEqual({
        props: {
          serverError: {
            code: undefined,
            message: NOT_FOUND,
            prevHistoryUrl: null,
          },
        },
      })
      // E4 and E5 were requested, the citations were not
      expect(sentLines()).toEqual([`GET ${E4(1001)}`, `GET ${E5(1001)}`])
    })

    describe('T-502 c1 @P0 Q-031 mainDataProviderLink', () => {
      const withIds = async (ids) => {
        const work = recorded(E4(1001))
        delete work.arxivId
        delete work.pubmedId
        Object.assign(work, ids)
        answer(E4(1001), work)
        return (await run(1001)).props.data.mainDataProviderLink
      }

      test('T-502 c1 @P0 an arXiv id: the link uses arxiv.com, not arxiv.org', async () => {
        expect(await withIds({ arxivId: '2101.00001' })).toEqual({
          id: '2101.00001',
          link: 'https://arxiv.com/abs/2101.00001',
          name: 'arXiv',
        })
      })

      test('T-502 c1 @P0 a PubMed id: PMC is prefixed to the id', async () => {
        expect(await withIds({ pubmedId: 1234567 })).toEqual({
          id: 1234567,
          link: 'https://pubmed.ncbi.nlm.nih.gov/PMC1234567',
          name: 'PubMed',
        })
        expect(await withIds({ arxivId: null, pubmedId: '7654321' })).toEqual({
          id: '7654321',
          link: 'https://pubmed.ncbi.nlm.nih.gov/PMC7654321',
          name: 'PubMed',
        })
      })

      test('T-502 c1 @P0 both ids: arXiv wins in every field; an empty arxivId counts as absent', async () => {
        expect(
          await withIds({ arxivId: '2101.00001', pubmedId: 1234567 })
        ).toEqual({
          id: '2101.00001',
          link: 'https://arxiv.com/abs/2101.00001',
          name: 'arXiv',
        })
        expect(await withIds({ arxivId: '', pubmedId: 1234567 })).toEqual({
          id: 1234567,
          link: 'https://pubmed.ncbi.nlm.nih.gov/PMC1234567',
          name: 'PubMed',
        })
      })

      test('T-502 c1 @P0 neither id: the object is never null while a key is absent (undefined !== null); both null (the recorded API shape) give null', async () => {
        const unset = { id: undefined, link: undefined, name: undefined }
        expect(await withIds({})).toStrictEqual(unset)
        // `null || undefined` is undefined, `undefined || null` is null: the
        // result depends on which key is absent
        expect(await withIds({ arxivId: null })).toStrictEqual(unset)
        expect(await withIds({ pubmedId: null })).toBeNull()
        expect(await withIds({ arxivId: null, pubmedId: null })).toBeNull()
      })
    })

    describe('T-502 c1 @P0 errors of E4 and E5: serverError { code, message, prevHistoryUrl }', () => {
      test('T-502 c1 @P0 work 4040: the API answers 404, message is the fixed text, no referer gives prevHistoryUrl null, only E4 is requested', async () => {
        const result = await run(4040)
        expect(result).toStrictEqual({
          props: {
            serverError: {
              code: 404,
              message: NOT_FOUND,
              prevHistoryUrl: null,
            },
          },
        })
        expect(sentLines()).toEqual([`GET ${E4(4040)}`])
      })

      test('T-502 c1 @P0 the referer of the request becomes prevHistoryUrl', async () => {
        const { props } = await run(4040, {
          referer: 'https://core.ac.uk/search?q=climate',
        })
        expect(props.serverError.prevHistoryUrl).toBe(
          'https://core.ac.uk/search?q=climate'
        )
        // an empty referer is kept (?? only replaces null and undefined)
        const empty = await getServerSideProps({
          params: { id: '4040' },
          query: {},
          req: { headers: { referer: '' } },
        })
        expect(empty.props.serverError.prevHistoryUrl).toBe('')
      })

      test('T-502 c1 @P0 Q-001 W-410-json (work 4101): message is the parsed JSON body, an object', async () => {
        const { props } = await run(4101)
        expect(props.serverError.code).toBe(410)
        expect(props.serverError.message).toEqual({
          message: 'Work with identifier 4101 has been disabled.',
        })
        expect(typeof props.serverError.message).toBe('object')
        expect(Object.keys(props.serverError)).toEqual([
          'code',
          'message',
          'prevHistoryUrl',
        ])
      })

      test.each([
        [4102, 'W-410-text', /^text\/plain/],
        [4100, 'text/html answer', /^text\/html/],
      ])(
        'T-502 c1 @P0 Q-001 work %d (%s): message is a Blob of the body, not a string',
        async (id, _label, type) => {
          const { props } = await run(id)
          const { message } = props.serverError
          expect(props.serverError.code).toBe(410)
          expect(typeof message).toBe('object')
          expect(Object.prototype.toString.call(message)).toBe('[object Blob]')
          expect(message.type).toMatch(type)
          const text = await message.text()
          expect(text).toContain(`${id} has been disabled`)
        }
      )

      test.each([
        [5000, 500],
        ['__status500', 500],
      ])(
        'T-502 c1 @P0 E4 answers 500 (work %s): code 500 with the fixed message',
        async (id, code) => {
          const { props } = await run(id)
          expect(props.serverError).toStrictEqual({
            code,
            message: NOT_FOUND,
            prevHistoryUrl: null,
          })
        }
      )

      test.each([400, 401, 403, 429, 502, 503])(
        'T-502 c1 @P0 E4 answers %d: that code and the fixed message',
        async (status) => {
          answer(E4(1001), { message: 'x' }, { status })
          const { props } = await run(1001)
          expect(props.serverError).toStrictEqual({
            code: status,
            message: NOT_FOUND,
            prevHistoryUrl: null,
          })
        }
      )

      test('T-502 c1 @P0 a network error: no status, code undefined, the fixed message', async () => {
        const { props } = await run('__neterror')
        expect(props.serverError).toStrictEqual({
          code: undefined,
          message: NOT_FOUND,
          prevHistoryUrl: null,
        })
      })

      test('T-502 c1 @P0 E5 answers 500 after E4: code 500, soft 404, no citation is requested', async () => {
        answer(E5(1001), { message: 'x' }, { status: 500 })
        const { props } = await run(1001)
        expect(props.serverError).toStrictEqual({
          code: 500,
          message: NOT_FOUND,
          prevHistoryUrl: null,
        })
        expect(sentLines()).toEqual([`GET ${E4(1001)}`, `GET ${E5(1001)}`])
      })

      test('T-502 c1 @P0 E5 answers 410: the message is its body here too', async () => {
        answer(E5(1001), { message: 'outputs gone' }, { status: 410 })
        const { props } = await run(1001)
        expect(props.serverError.code).toBe(410)
        expect(props.serverError.message).toEqual({ message: 'outputs gone' })
      })
    })

    describe('T-502 c1 @P0 Q-024 the output provider logos', () => {
      const withOutputProvider = async (change) => {
        const outputs = recorded(E5(1001))
        outputs[0].dataProvider = { ...outputs[0].dataProvider, ...change }
        answer(E5(1001), outputs)
        return (await run(1001)).props.data.outputs
      }

      test('T-502 c1 @P0 the logo of every output provider is null, member or not, and no logo request is made', async () => {
        const { outputs } = (await run(1001)).props.data
        expect(outputs.map((o) => o.dataProvider.logo)).toEqual([
          null,
          null,
          null,
        ])
        expect(sentLines().filter((l) => l.includes('/logo'))).toEqual([])

        // 86 is a supporting member of the harness members, 4835 a starting
        // one (still a member: the billing check reads a key that does not
        // exist, Q-024/Q-035); both keep their logo URL in the answer
        fetchSpy.mockClear()
        for (const id of [86, 4835]) {
          // eslint-disable-next-line no-await-in-loop
          const list = await withOutputProvider({ id })
          expect(list[0].dataProvider.id).toBe(id)
          expect(list[0].dataProvider.logo).toBeNull()
          expect(list[0].dataProvider.name).toBe(
            'Stirling Online Research Repository (RIOXX)'
          )
        }
        expect(sentLines().filter((l) => l.includes('/logo'))).toEqual([])
      })

      test('T-502 c1 @P0 the rest of the output provider is passed through', async () => {
        const list = await withOutputProvider({ id: 86 })
        expect(list[0].dataProvider).toEqual({
          id: 86,
          name: 'Stirling Online Research Repository (RIOXX)',
          url: 'https://api.core.ac.uk/v3/data-providers/10883',
          logo: null,
        })
      })
    })
  })

  describe('T-502 c2 @P0 Q-016 the t parameter', () => {
    test('T-502 c2 @P0 Q-016 without t the E4 URL has ?t=undefined and E5 has no t', async () => {
      await run(1001)
      expect(sentLines().slice(0, 2)).toEqual([
        `GET ${API}/v3/works/1001?t=undefined`,
        `GET ${API}/v3/works/1001/outputs`,
      ])
    })

    test.each([
      ['123-456', '?t=123-456'],
      ['abc', '?t=abc'],
      ['a&b=c d', '?t=a&b=c+d'],
      ['1&x=2', '?t=1&x=2'],
      ['50%', '?t=50%25'],
      ['a+b', '?t=a+b'],
      ['', '?t='],
    ])(
      'T-502 c2 @P0 Q-016 t %p reaches upstream as %s (no encoding layer)',
      async (t, search) => {
        answer(E4(1001, ''), recorded(E4(1001)))
        const { props } = await run(1001, { query: { t } })
        expect(props.data.id).toBe(1001)
        expect(sentLines()[0]).toBe(`GET ${E4(1001, search)}`)
        // E5 never carries t
        expect(sentLines()[1]).toBe(`GET ${E5(1001)}`)
      }
    )

    test('T-502 c2 @P0 Q-016 a repeated t throws in fetchWork before any request: 200 soft 404, code undefined, 0 upstream calls', async () => {
      const result = await run(1001, { query: { t: ['a', 'b'] } })
      expect(result).toStrictEqual({
        props: {
          serverError: {
            code: undefined,
            message: NOT_FOUND,
            prevHistoryUrl: null,
          },
        },
      })
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  describe('T-502 c3 @P0 Q-090 logo requests of the works page', () => {
    // 86 is a harness member; a null or empty logo is the id given to
    // checkMembership, which then matches the member row without repo_id
    // (+null === +'' === 0), so checkLogo asks for {API_URL}undefined
    const withLogo = async (logo, id = 86) => {
      const outputs = recorded(E5(1001))
      outputs[0].dataProvider = { ...outputs[0].dataProvider, id }
      if (logo === 'absent') delete outputs[0].dataProvider.logo
      else outputs[0].dataProvider.logo = logo
      answer(E5(1001), outputs)
      const result = await run(1001)
      return result.props.data.outputs
    }
    const logoRequests = () =>
      sentLines().filter(
        (l) => l.includes('/logo') || /internal(null|undefined)$/.test(l)
      )

    test('T-502 c3 @P0 Q-090 a member provider with logo null makes GET {API_URL}undefined (the 404 is swallowed), the logo is null', async () => {
      const outputs = await withLogo(null)
      expect(logoRequests()).toEqual([`GET ${API}/internalundefined`])
      expect(outputs[0].dataProvider.logo).toBeNull()
      const logoCall = sent().find((c) => c.url === `${API}/internalundefined`)
      expect(logoCall.headers).toEqual(GET_HEADERS)
    })

    test('T-502 c3 @P0 Q-090 the request is made after E5, before the citations, and never reads {API_URL}null', async () => {
      await withLogo(null)
      expect(sentLines().slice(0, 3)).toEqual([
        `GET ${E4(1001)}`,
        `GET ${E5(1001)}`,
        `GET ${API}/internalundefined`,
      ])
      expect(sentLines().some((l) => l.endsWith('internalnull'))).toBe(false)
    })

    test('T-502 c3 @P0 Q-090 an empty logo string asks for the same URL', async () => {
      const outputs = await withLogo('')
      expect(logoRequests()).toEqual([`GET ${API}/internalundefined`])
      expect(outputs[0].dataProvider.logo).toBeNull()
    })

    test('T-502 c3 @P0 Q-090 an absent logo key, a logo URL, or a non-member provider make no logo request', async () => {
      for (const logo of [
        'absent',
        'https://api.core.ac.uk/data-providers/86/logo',
      ]) {
        fetchSpy.mockClear()
        // eslint-disable-next-line no-await-in-loop
        const outputs = await withLogo(logo)
        expect(logoRequests()).toEqual([])
        expect(outputs[0].dataProvider.logo).toBeNull()
      }
      fetchSpy.mockClear()
      const outputs = await withLogo(null, 107)
      expect(logoRequests()).toEqual([])
      expect(outputs[0].dataProvider.logo).toBeNull()
    })

    test('T-502 c3 @P0 Q-090 one request per member output with a null logo', async () => {
      const outputs = recorded(E5(1001))
      outputs.forEach((o) => {
        o.dataProvider = { ...o.dataProvider, id: 86, logo: null }
      })
      answer(E5(1001), outputs)
      const { props } = await run(1001)
      expect(logoRequests()).toEqual([
        `GET ${API}/internalundefined`,
        `GET ${API}/internalundefined`,
        `GET ${API}/internalundefined`,
      ])
      expect(props.data.outputs.map((o) => o.dataProvider.logo)).toEqual([
        null,
        null,
        null,
      ])
    })
  })

  describe('T-502 c4 @P0 citations in props', () => {
    const citationCalls = () =>
      sent().filter((c) => c.url.startsWith('https://doi.org/'))

    test('T-502 c4 @P0 a DOI gives two requests in parallel, apa first, with the style in Accept and the Bearer header', async () => {
      const { props } = await run(1001)
      const calls = citationCalls()
      expect(calls.map((c) => c.url)).toEqual([
        DOI('10.1111/rego.12518'),
        DOI('10.1111/rego.12518'),
      ])
      expect(calls.map((c) => c.method)).toEqual(['GET', 'GET'])
      expect(calls[0].headers).toEqual(CITATION_HEADERS('apa'))
      expect(calls[1].headers).toEqual(CITATION_HEADERS('bibtex'))
      // both are started before either answer is read: they follow E5 directly
      expect(sentLines().slice(0, 4)).toEqual([
        `GET ${E4(1001)}`,
        `GET ${E5(1001)}`,
        `GET ${DOI('10.1111/rego.12518')}`,
        `GET ${DOI('10.1111/rego.12518')}`,
      ])
      // the answers are [{ id, style, value }] in the order apa, bibtex; the
      // resolver keys on method and URL, so both get the recorded text
      expect(props.data.citations).toEqual(citationsOf('10.1111/rego.12518'))
      expect(props.data.citations.map((c) => c.id)).toEqual(['apa', 'bibtex'])
      expect(props.data.citations[0].value).toMatch(/^Rajavuori, M\./)
    })

    test('T-502 c4 @P0 the citation text is the body as text; the value is a string', async () => {
      answerText(DOI('10.1111/rego.12518'), 'APA text', {
        headers: { 'content-type': 'text/x-bibliography' },
      })
      const { props } = await run(1001)
      expect(props.data.citations).toEqual([
        { id: 'apa', style: 'apa', value: 'APA text' },
        { id: 'bibtex', style: 'bibtex', value: 'APA text' },
      ])
    })

    test('T-502 c4 @P0 a work without a DOI gets citations [] and no doi.org request', async () => {
      const work = recorded(E4(1001))
      work.doi = null
      answer(E4(1001), work)
      const { props } = await run(1001)
      expect(props.data.citations).toEqual([])
      expect(citationCalls()).toEqual([])

      work.doi = ''
      expect((await run(1001)).props.data.citations).toEqual([])
      expect(citationCalls()).toEqual([])
    })

    test('T-502 c4 @P0 the DOI is read from the work, not from identifiers', async () => {
      const work = recorded(E4(1001))
      work.doi = null
      work.identifiers = [{ identifier: '10.1111/rego.12518', type: 'doi' }]
      answer(E4(1001), work)
      const { props } = await run(1001)
      expect(props.data.citations).toEqual([])
      expect(citationCalls()).toEqual([])
    })

    test.each([500, 404, 429])(
      'T-502 c4 @P0 doi.org answers %d: citations [] and the work is still served',
      async (status) => {
        answerText(DOI('10.1111/rego.12518'), 'nope', { status })
        const { props } = await run(1001)
        expect(props.serverError).toBeUndefined()
        expect(props.data.citations).toEqual([])
        expect(props.data.title).toBeTruthy()
        expect(citationCalls()).toHaveLength(2)
      }
    )

    test('T-502 c4 @P0 one failing style empties both: citations []', async () => {
      server.use(
        http.get(DOI('10.1111/rego.12518'), ({ request }) =>
          request.headers.get('accept').includes('style=bibtex')
            ? new HttpResponse('boom', { status: 500 })
            : new HttpResponse('APA text', {
                headers: { 'content-type': 'text/x-bibliography' },
              })
        )
      )
      const { props } = await run(1001)
      expect(props.data.citations).toEqual([])
    })

    test('T-502 c4 @P0 a doi.org network error gives citations []', async () => {
      server.use(
        http.get(DOI('10.1111/rego.12518'), () => HttpResponse.error())
      )
      const { props } = await run(1001)
      expect(props.data.citations).toEqual([])
      expect(props.serverError).toBeUndefined()
    })

    test('T-502 c4 @P0 citations is the last key of data, after every other field', async () => {
      const { props } = await run(1001)
      const keys = Object.keys(props.data)
      expect(keys[keys.length - 1]).toBe('citations')
      expect(keys).toEqual(
        expect.arrayContaining([
          'identifiers',
          'publishedDate',
          'sourceFulltextUrls',
          'outputs',
          'dataProvider',
          'mainDataProviderLink',
        ])
      )
    })
  })
})
