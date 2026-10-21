// T-504 (41 F, R-028, R-045, R-067): getServerSideProps of
// pages/data-providers/[id].jsx (findings/06 §2.4). F layer: the context
// ({ params, query }) is built by hand; the route and the query decoding of
// Next are pinned by T-601 and the browser tiers (30 §1 rule 6).
//
// The provider map and the members are the harness copies in
// test/fixtures/data (86 supporting member, 4835 starting member, 8 and 3354
// map providers that are not members, 503 and 999999999 not in the map). MSW
// answers from the recorded fixtures (providers 86, 4835, 8, 3354, 503,
// 999999999, 0x56, q090 logo answers); what the app sends is read where it
// hands it over: a spy on the global `fetch`. Edge answers are a recorded
// answer with one change, served by an override.
const { setupMsw } = require('../../utils/msw')
const { getServerSideProps } = require('../../../pages/data-providers/[id]')

const { server, resolver, http, HttpResponse } = setupMsw()

const API = 'https://api.core.ac.uk'
const V3 = `${API}/v3`
const E11 = (id, search = '?t=undefined') =>
  `${V3}/data-providers/${id}${search}`
const E12 = (id) => `${V3}/data-providers/${id}/stats`
const E13 = (id, search = '?q=&offset=0&limit=10&sort=recency') =>
  `${V3}/data-providers/${id}/outputs${search}`
const E18 = (id) => `${API}/internal/data-providers/${id}/account`
const GET_HEADERS = {
  Accept: 'application/json',
  Authorization: 'Bearer test-key',
}

const recorded = (url) => {
  const r = resolver.resolve('GET', url)
  if (r.status !== 200 || r.unmatched)
    throw new Error(`no 200 recorded answer for GET ${url}`)
  return JSON.parse(r.body.toString('utf8'))
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
const answer = (url, body, init) =>
  server.use(http.get(url.split('?')[0], () => HttpResponse.json(body, init)))

const run = (id, query = {}) =>
  getServerSideProps({ params: { id: String(id) }, query })

// the E11 answer of `id` with the given fields replaced
const provider = (id, change = {}) => ({ ...recorded(E11(id)), ...change })

// the answers of provider 86, served for any raw id that coerces to 86
const serveAs86 = () =>
  server.use(
    http.get(
      /^https:\/\/api\.core\.ac\.uk\/v3\/data-providers\/.+/,
      ({ request }) => {
        const { pathname } = new URL(request.url)
        if (pathname.endsWith('/stats'))
          return HttpResponse.json(recorded(E12(86)))
        if (pathname.endsWith('/outputs'))
          return HttpResponse.json(recorded(E13(86)))
        return HttpResponse.json(recorded(E11(86)))
      }
    )
  )

const flush = async () => {
  for (let i = 0; i < 5; i++)
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setImmediate(resolve))
}

describe('T-504 @P0 /data-providers/[id] getServerSideProps', () => {
  describe('T-504 c1 @P0 notFound', () => {
    test('T-504 c1 @P0 provider 86: E11, E12 then E13; the exact props from the recorded answers', async () => {
      const e11 = recorded(E11(86))
      const e12 = recorded(E12(86))
      const e13 = recorded(E13(86))
      const result = await run(86)

      expect(sentLines()).toEqual([
        `GET ${E11(86)}`,
        `GET ${E12(86)}`,
        `GET ${E13(86)}`,
      ])
      sent().forEach((call) => {
        expect(call.headers).toEqual(GET_HEADERS)
        expect(call.credentials).toBe('include')
      })

      expect(Object.keys(result)).toEqual(['props'])
      expect(Object.keys(result.props)).toEqual(['data'])
      expect(result.props.data).toEqual({
        ...e11,
        billingType: 'supporting',
        metadata: { ...e12 },
        logo: e11.logo,
        outputs: {
          offset: 0,
          limit: 10,
          query: '',
          sort: 'recency',
          total: e13.totalHits,
          data: e13.results,
          ...e13,
        },
      })
      const { data } = result.props
      expect(data.outputs.total).toBe(66686)
      expect(data.outputs.data).toHaveLength(10)
      expect(data.outputs.results).toEqual(data.outputs.data)
      expect(data.metadata.countMetadata).toBe(66689)
      expect(data.id).toBe(86)
      // no notFound key on success
      expect(result).not.toHaveProperty('notFound')
    })

    test.each(['999999999', '503', 'abc', '86abc', '', ' ', '-86', '0', 'NaN'])(
      'T-504 c1 @P0 id %p is not a provider of the map: { notFound: true } and no request at all',
      async (id) => {
        const result = await run(id)
        expect(result).toStrictEqual({ notFound: true })
        expect(fetchSpy).not.toHaveBeenCalled()
      }
    )

    test.each([
      [404, 'NotFoundError'],
      [500, 'InternalServerError'],
      [400, 'BadRequestError'],
    ])(
      'T-504 c1 @P0 E11 answers %d for a provider of the map: { props: { error }, notFound: true }, E12 and E13 are not requested',
      async (status, name) => {
        answer(E11(8), { message: 'x' }, { status })
        const result = await run(8)
        expect(Object.keys(result)).toEqual(['props', 'notFound'])
        expect(result.notFound).toBe(true)
        expect(Object.keys(result.props)).toEqual(['error'])
        const { error } = result.props
        expect(error).toBeInstanceOf(Error)
        expect(error.name).toBe(name)
        expect(error.status).toBe(status)
        expect(error.message).toBe(`Request for ${E11(8)} failed on ${status}`)
        expect(error.data).toEqual({ message: 'x' })
        expect(sentLines()).toEqual([`GET ${E11(8)}`])
      }
    )

    test('T-504 c1 @P0 E11 network error: the error has no status; notFound again', async () => {
      server.use(http.get(E11(8).split('?')[0], () => HttpResponse.error()))
      const result = await run(8)
      expect(result.notFound).toBe(true)
      expect(result.props.error).toBeInstanceOf(TypeError)
      expect(result.props.error.status).toBeUndefined()
      expect(sentLines()).toEqual([`GET ${E11(8)}`])
    })

    test('T-504 c1 @P0 E12 fails after a good E11: the same { props: { error }, notFound: true }, E13 is not requested', async () => {
      answer(E12(8), { message: 'x' }, { status: 503 })
      const result = await run(8)
      expect(result.notFound).toBe(true)
      expect(result.props.error.status).toBe(503)
      expect(sentLines()).toEqual([`GET ${E11(8)}`, `GET ${E12(8)}`])
    })

    test('T-504 c1 @P0 E11 and E12 are sequential, E12 starts only after E11 answered', async () => {
      let release
      const gate = new Promise((resolve) => {
        release = resolve
      })
      server.use(
        http.get(E11(86).split('?')[0], async () => {
          await gate
          return HttpResponse.json(recorded(E11(86)))
        })
      )
      const pending = run(86)
      await flush()
      expect(sentLines()).toEqual([`GET ${E11(86)}`])
      release()
      await pending
      expect(sentLines()).toEqual([
        `GET ${E11(86)}`,
        `GET ${E12(86)}`,
        `GET ${E13(86)}`,
      ])
    })
  })

  describe('T-504 c2 @P0 Q-035 the route id is coerced against the map, but sent raw', () => {
    test('T-504 c2 @P0 /data-providers/0x56: +"0x56" is 86, so the page asks the API for the raw id; the recorded answer is 404, so notFound', async () => {
      const result = await run('0x56')
      expect(sentLines()).toEqual([`GET ${E11('0x56')}`])
      expect(E11('0x56')).toBe(`${V3}/data-providers/0x56?t=undefined`)
      expect(result.notFound).toBe(true)
      expect(result.props.error.status).toBe(404)
      // the live answer is a JSON text under text/html, so the body is a Blob
      expect(await result.props.error.data.text()).toBe(
        '{"message":"Data-provider with identifier 0x56 not found."}'
      )
    })

    test.each([
      ['0x56', '0x56'],
      ['8.6e1', '8.6e1'],
      ['086', '086'],
      [' 86 ', '%2086%20'],
      ['0b1010110', '0b1010110'],
      ['86.0', '86.0'],
    ])(
      'T-504 c2 @P0 Q-035 id %p resolves provider 86; E11, E12 and E13 carry the raw id (%s)',
      async (id, raw) => {
        serveAs86()
        const { props } = await run(id)
        expect(sentLines()).toEqual([
          `GET ${E11(raw)}`,
          `GET ${E12(raw)}`,
          `GET ${E13(raw)}`,
        ])
        // everything else comes from the API answer, whose id is 86
        expect(props.data.id).toBe(86)
        expect(props.data.billingType).toBe('supporting')
      }
    )

    test('T-504 c2 @P0 Q-035 the billing type follows the id of the API answer, not the id of the route', async () => {
      answer(E11(86), provider(4835))
      const { props } = await run(86)
      expect(props.data.id).toBe(4835)
      expect(props.data.billingType).toBe('starting')
    })
  })

  describe('T-504 c3 @P0 base64 logos', () => {
    const recordedLogo = recorded(E11(86)).logo
    const payload = recordedLogo.split(',')[1]
    const withSignature = (sig) => sig + payload.slice(sig.length)

    const logoOf = async (id, logo) => {
      answer(E11(id), provider(id, { logo }))
      const result = await run(id)
      return result.props.data.logo
    }
    const logoRequests = () => sentLines().filter((l) => l.includes('/logo'))

    test('T-504 c3 @P0 the recorded logos are a data: URI of a base64 payload whose length is a multiple of 4', () => {
      expect(recordedLogo.startsWith('data:image/jpg;base64,')).toBe(true)
      expect(payload.length % 4).toBe(0)
      expect(payload).toMatch(/^[A-Za-z0-9+/]+={0,2}$/)
    })

    test('T-504 c3 @P0 a data:image/ value is returned as it is: no check of the payload, no logo request', async () => {
      const { props } = await run(86)
      expect(props.data.logo).toBe(recordedLogo)
      expect(logoRequests()).toEqual([])

      fetchSpy.mockClear()
      expect(await logoOf(86, 'data:image/png;base64,!!!not base64')).toBe(
        'data:image/png;base64,!!!not base64'
      )
      expect(logoRequests()).toEqual([])
    })

    test('T-504 c3 @P0 a data:image/ value is trimmed, nothing else is changed', async () => {
      expect(await logoOf(86, '  data:image/gif;base64,AAAA  \n')).toBe(
        'data:image/gif;base64,AAAA'
      )
    })

    test.each([
      ['/9j/', 'image/jpeg'],
      ['iVBOR', 'image/png'],
      ['R0lG', 'image/gif'],
      ['PHN2', 'image/svg+xml'],
      ['UklG', 'image/webp'],
      ['AAAA', 'image/png'],
    ])(
      'T-504 c3 @P0 a base64 payload starting %s is labelled %s',
      async (signature, mime) => {
        const raw = withSignature(signature)
        expect(raw.length % 4).toBe(0)
        expect(await logoOf(8, raw)).toBe(`data:${mime};base64,${raw}`)
        expect(logoRequests()).toEqual([])
      }
    )

    test('T-504 c3 @P0 whitespace inside the payload is removed first', async () => {
      const raw = withSignature('/9j/')
      const spaced = `${raw.slice(0, 8)} \n\t${raw.slice(8, 40)}\r\n${raw.slice(
        40
      )}`
      expect(await logoOf(8, `  ${spaced} `)).toBe(
        `data:image/jpeg;base64,${raw}`
      )
    })

    test.each([
      ['AAA=', 'image/png'],
      ['AA==', 'image/png'],
      ['/9j/AAA=', 'image/jpeg'],
    ])('T-504 c3 @P0 padding: %s is valid', async (value, mime) => {
      expect(await logoOf(8, value)).toBe(`data:${mime};base64,${value}`)
    })

    test.each([
      ['a length that is not a multiple of 4', 'AAAAA'],
      ['three characters', 'AAA'],
      ['three padding characters', 'A==='],
      ['padding before the end', 'AA=A'],
      ['the URL-safe alphabet', 'AA-_AAAA'],
      ['an http URL', 'https://example.org/logo.png'],
      ['a non-image data URI', 'data:text/plain;base64,AAAA'],
      ['an empty string', ''],
    ])(
      'T-504 c3 @P0 not a logo for a non-member (%s): null, no logo request',
      async (_label, value) => {
        expect(await logoOf(8, value)).toBeNull()
        expect(logoRequests()).toEqual([])
      }
    )

    test('T-504 c3 @P0 an http URL for a member goes to checkLogo (E14, after E12, before E13): the URL when it answers 2xx', async () => {
      const url = 'https://api.core.ac.uk/data-providers/86/logo'
      expect(await logoOf(86, url)).toBe(url)
      expect(sentLines()).toEqual([
        `GET ${E11(86)}`,
        `GET ${E12(86)}`,
        `GET ${url}`,
        `GET ${E13(86)}`,
      ])
      expect(sent()[2].headers).toEqual(GET_HEADERS)
    })

    test('T-504 c3 @P0 an http URL for a member that does not answer 2xx gives null', async () => {
      expect(
        await logoOf(86, 'https://api.core.ac.uk/data-providers/undefined/logo')
      ).toBeNull()
      expect(logoRequests()).toEqual([
        'GET https://api.core.ac.uk/data-providers/undefined/logo',
      ])
    })

    test('T-504 c3 @P0 an http URL for a provider that is not a member gives null without a request', async () => {
      expect(
        await logoOf(8, 'https://api.core.ac.uk/data-providers/86/logo')
      ).toBeNull()
      expect(logoRequests()).toEqual([])
    })

    test('T-504 c3 @P0 a starting member is a member too: its http logo URL is requested', async () => {
      const url = 'https://api.core.ac.uk/data-providers/86/logo'
      expect(await logoOf(4835, url)).toBe(url)
      expect(logoRequests()).toEqual([`GET ${url}`])
    })

    test('T-504 c3 @P0 the recorded base64 logos of 4835 and 8 are passed through', async () => {
      for (const id of [4835, 8]) {
        // eslint-disable-next-line no-await-in-loop
        const { props } = await run(id)
        expect(props.data.logo).toBe(recorded(E11(id)).logo)
        expect(props.data.logo.startsWith('data:image/')).toBe(true)
      }
    })
  })

  describe('T-504 c4 @P0 billingType', () => {
    test.each([
      [86, 'supporting'],
      [4835, 'starting'],
      [8, null],
      [3354, null],
    ])(
      'T-504 c4 @P0 provider %d: billingType %p (a starting member is not excluded, the check reads a key that does not exist)',
      async (id, billingType) => {
        const { props } = await run(id)
        expect(props.data.billingType).toBe(billingType)
      }
    )

    test('T-504 c4 @P0 billingType is set after the API fields, so the answer cannot change it', async () => {
      answer(E11(8), provider(8, { billingType: 'sustaining' }))
      const { props } = await run(8)
      expect(props.data.billingType).toBeNull()
    })

    test('T-504 c4 @P0 the member row is found by the API id: scalar repo_id by number, array repo_id by strict equality', async () => {
      // 4835 is a scalar repo_id, 86 is in an array; a string id from the
      // API would not be found in the array
      answer(E11(86), provider(86, { id: '86' }))
      const { props } = await run(86)
      expect(props.data.id).toBe('86')
      expect(props.data.billingType).toBeNull()
    })
  })

  describe('T-504 c5 @P0 E13 error serialised', () => {
    test('T-504 c5 @P0 E13 answers 500: the page is served with outputs.error set to the Error instance, no total and no data', async () => {
      const result = await run(86, { q: '__status500' })
      expect(Object.keys(result)).toEqual(['props'])
      const { outputs } = result.props.data
      expect(Object.keys(outputs)).toEqual([
        'offset',
        'limit',
        'query',
        'sort',
        'error',
      ])
      expect(outputs).toMatchObject({
        offset: 0,
        limit: 10,
        query: '__status500',
        sort: 'recency',
      })
      expect(outputs.error).toBeInstanceOf(Error)
      expect(outputs.error.name).toBe('InternalServerError')
      expect(outputs.error.status).toBe(500)
      expect(outputs.error.data).toEqual({ message: 'Internal Server Error' })
      expect(sentLines()[2]).toBe(
        `GET ${E13(86, '?q=__status500&offset=0&limit=10&sort=recency')}`
      )
      // the rest of the page data is complete
      expect(result.props.data.id).toBe(86)
      expect(result.props.data.metadata.countMetadata).toBe(66689)
    })

    // Node 18 is the runtime of the gate (and of prod): its Response serialises
    // to {}; the undici of Node 24 adds the url (same as T-102 c2)
    test('T-504 c5 @P0 as the response is serialised in production, the error is { name, response: {}, data, type, status, headers: {} }', async () => {
      const result = await run(86, { q: '__status500' })
      const serialised = JSON.parse(JSON.stringify(result.props))
      expect(serialised.data.outputs.error).toEqual({
        name: 'InternalServerError',
        response: {},
        data: { message: 'Internal Server Error' },
        type: 'application/json',
        status: 500,
        headers: {},
      })
      expect(Object.keys(serialised.data.outputs.error)).toEqual([
        'name',
        'response',
        'data',
        'type',
        'status',
        'headers',
      ])
      // message and stack are not serialised
      expect(serialised.data.outputs.error).not.toHaveProperty('message')
    })

    test('T-504 c5 @P0 a non-JSON error body is a Blob, which serialises to {}', async () => {
      server.use(
        http.get(
          E13(86).split('?')[0],
          () =>
            new HttpResponse('<html>bad gateway</html>', {
              status: 502,
              headers: { 'content-type': 'text/html' },
            })
        )
      )
      const result = await run(86)
      const { error } = result.props.data.outputs
      expect(error.name).toBe('InternalServerError')
      expect(error.status).toBe(502)
      expect(Object.prototype.toString.call(error.data)).toBe('[object Blob]')
      const serialised = JSON.parse(JSON.stringify(result.props))
      expect(serialised.data.outputs.error.data).toEqual({})
      expect(serialised.data.outputs.error.type).toBe('text/html')
    })

    test('T-504 c5 @P0 an E13 network error is a plain TypeError without status, data or type', async () => {
      const result = await run(86, { q: '__neterror' })
      const { error } = result.props.data.outputs
      expect(error).toBeInstanceOf(TypeError)
      expect(error.status).toBeUndefined()
      const serialised = JSON.parse(JSON.stringify(result.props))
      expect(serialised.data.outputs.error).not.toHaveProperty('status')
      expect(serialised.data.outputs.error).not.toHaveProperty('data')
      expect(serialised.data.outputs.error).not.toHaveProperty('name')
    })

    test('T-504 c5 @P0 the query values are raw strings in the URL; the answer limit and offset replace the requested ones', async () => {
      const outputs = recorded(E13(86))
      outputs.limit = 5
      outputs.offset = 20
      const url = E13(86, '?q=climate&offset=20&limit=5&sort=relevance')
      answer(url, outputs)
      const { props } = await run(86, {
        q: 'climate',
        offset: '20',
        limit: '5',
        sort: 'relevance',
      })
      expect(sentLines()[2]).toBe(`GET ${url}`)
      expect(props.data.outputs).toEqual({
        offset: 20,
        limit: 5,
        query: 'climate',
        sort: 'relevance',
        total: outputs.totalHits,
        data: outputs.results,
        ...outputs,
      })
      expect(typeof props.data.outputs.offset).toBe('number')
    })

    test('T-504 c5 @P0 special characters in q are encoded by the URL search params', async () => {
      answer(E13(86), recorded(E13(86)))
      await run(86, { q: 'a b&c=d' })
      expect(sentLines()[2]).toBe(
        `GET ${E13(86, '?q=a+b%26c%3Dd&offset=0&limit=10&sort=recency')}`
      )
    })
  })

  describe('T-504 c6 @P0 E18 is un-awaited: the gSSP never asks for the accounts', () => {
    test('T-504 c6 @P0 no /account request is made, not even after the event loop has drained; the props carry no accounts', async () => {
      const { props } = await run(86)
      await flush()
      expect(sentLines().filter((l) => l.includes('/account'))).toEqual([])
      expect(sentLines()).toEqual([
        `GET ${E11(86)}`,
        `GET ${E12(86)}`,
        `GET ${E13(86)}`,
      ])
      expect(JSON.stringify(props)).not.toContain('"accounts"')
      expect(E18(86)).toBe(`${API}/internal/data-providers/86/account`)
    })

    test('T-504 c6 @P0 an /account handler that would fail is never reached: the page does not depend on it', async () => {
      let reached = 0
      server.use(
        http.get(E18(86), () => {
          reached += 1
          return HttpResponse.error()
        })
      )
      const result = await run(86)
      await flush()
      expect(reached).toBe(0)
      expect(result.props.data.id).toBe(86)
    })
  })

  describe('T-504 c7 @P0 Q-016 the t parameter reaches E11 only', () => {
    test('T-504 c7 @P0 Q-016 without t: ?t=undefined on E11, E12 and E13 carry no t', async () => {
      await run(86)
      expect(sentLines()[0]).toBe(`GET ${V3}/data-providers/86?t=undefined`)
      expect(sentLines()[1]).toBe(`GET ${V3}/data-providers/86/stats`)
      expect(new URL(sent()[2].url).searchParams.has('t')).toBe(false)
    })

    test.each([
      ['abc', '?t=abc'],
      ['123-456', '?t=123-456'],
      ['a&b=c d', '?t=a&b=c+d'],
      ['1&x=2', '?t=1&x=2'],
      ['50%', '?t=50%25'],
      ['', '?t='],
    ])(
      'T-504 c7 @P0 Q-016 t %p reaches E11 as %s (no encoding layer)',
      async (t, search) => {
        answer(E11(86), provider(86))
        const { props } = await run(86, { t })
        expect(props.data.id).toBe(86)
        expect(sentLines()[0]).toBe(`GET ${E11(86, search)}`)
        expect(sentLines()[1]).toBe(`GET ${E12(86)}`)
        expect(sentLines()[2]).toBe(`GET ${E13(86)}`)
      }
    )

    test('T-504 c7 @P0 Q-016 a repeated t throws in fetchMetadata before any request: { props: { error: TypeError }, notFound: true }, 0 upstream calls', async () => {
      const result = await run(86, { t: ['a', 'b'] })
      expect(result.notFound).toBe(true)
      expect(result.props.error).toBeInstanceOf(TypeError)
      expect(result.props.error.status).toBeUndefined()
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  describe('T-504 c8 @P0 Q-090 logo requests of the provider page', () => {
    test('T-504 c8 @P0 Q-090 a member with logo null makes GET {API_URL}null (E14, after E12, before E13); the recorded 404 is swallowed, the logo is null', async () => {
      answer(E11(86), provider(86, { logo: null }))
      const { props } = await run(86)
      expect(sentLines()).toEqual([
        `GET ${E11(86)}`,
        `GET ${E12(86)}`,
        `GET ${API}/internalnull`,
        `GET ${E13(86)}`,
      ])
      expect(sent()[2].headers).toEqual(GET_HEADERS)
      expect(props.data.logo).toBeNull()
      expect(props.serverError).toBeUndefined()
    })

    test('T-504 c8 @P0 Q-090 a member whose answer has no logo key makes GET {API_URL}undefined', async () => {
      const e11 = recorded(E11(86))
      delete e11.logo
      answer(E11(86), e11)
      const { props } = await run(86)
      expect(sentLines()[2]).toBe(`GET ${API}/internalundefined`)
      expect(sentLines()).toHaveLength(4)
      expect(props.data.logo).toBeNull()
    })

    test('T-504 c8 @P0 Q-090 a starting member behaves like any member', async () => {
      answer(E11(4835), provider(4835, { logo: null }))
      const { props } = await run(4835)
      expect(sentLines()[2]).toBe(`GET ${API}/internalnull`)
      expect(props.data.logo).toBeNull()
    })

    test('T-504 c8 @P0 Q-090 a provider that is not a member makes no logo request, whatever its logo', async () => {
      for (const id of [8, 3354]) {
        fetchSpy.mockClear()
        // eslint-disable-next-line no-await-in-loop
        const { props } = await run(id)
        expect(sentLines().filter((l) => l.includes('internal'))).toEqual([])
        expect(props.data.id).toBe(id)
      }
      fetchSpy.mockClear()
      answer(E11(8), provider(8, { logo: null }))
      const { props } = await run(8)
      expect(sentLines()).toEqual([
        `GET ${E11(8)}`,
        `GET ${E12(8)}`,
        `GET ${E13(8)}`,
      ])
      expect(props.data.logo).toBeNull()
    })

    test('T-504 c8 @P0 Q-090 a member with a base64 logo needs no logo request', async () => {
      await run(86)
      expect(sentLines().some((l) => l.endsWith('/logo'))).toBe(false)
      expect(sentLines().some((l) => /internal(null|undefined)$/.test(l))).toBe(
        false
      )
    })
  })
})
