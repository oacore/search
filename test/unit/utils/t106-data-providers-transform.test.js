// T-106 (41 B, R-067): utils/data-providers-transform.js, findings/06 §3.7.
// Pins today's behaviour, quirks included: Q-023 (the code reads `billingType`,
// the data has `billing_type`, so a `starting` member is never excluded),
// Q-035 (provider id coercion), Q-090 (a member without a logo makes the
// request `GET {API_URL}null`, `{API_URL}undefined` for the one-argument call
// of the works and outputs pages).
//
// The data files are the synthetic copies of test/fixtures/data (3 members, 9
// providers: the Jest moduleNameMapper); one case loads the committed
// data/.members.json by explicit path for the Q-023 counts.
const fs = require('fs')
const path = require('path')

const LogRocket = require('logrocket').default

const { setupMsw } = require('../../utils/msw')
const {
  checkMembership,
  checkDataProvider,
  checkType,
  checkUniversity,
  findDataProvider,
  transformDataProviders,
  checkLogo,
} = require('../../../utils/data-providers-transform')

const { server, http, HttpResponse } = setupMsw()

const { API_URL } = process.env

// the synthetic rows of test/fixtures/data/.members.json (billing_type,
// repo_id)
//   9001 supporting  [86]
//   9002 starting    4835
//   9003 sustaining  null
const MEMBER_ARRAY = 9001
const MEMBER_STARTING = 9002
const MEMBER_NULL = 9003

const orgOf = (member) => member && member.organisation_id

describe('T-106 @P0 data-providers-transform (findings/06 §3.7)', () => {
  let requests

  beforeEach(() => {
    requests = []
    LogRocket.captureException.mockClear()
    server.events.on('request:start', ({ request }) => {
      requests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.get('authorization'),
      })
    })
  })

  afterEach(() => {
    server.events.removeAllListeners()
  })

  describe('c1 members, types, providers', () => {
    test('T-106 c1 @P0 Q-023 checkMembership: a `starting` member is a member (the code reads billingType, the data billing_type)', () => {
      const member = checkMembership(4835)
      expect(member).toBeTruthy()
      expect(orgOf(member)).toBe(MEMBER_STARTING)
      expect(member.billing_type).toBe('starting')
      expect(member.billingType).toBeUndefined()
      // so every billing type counts
      expect(orgOf(checkMembership(86))).toBe(MEMBER_ARRAY)
      expect(checkMembership(86).billing_type).toBe('supporting')
    })

    test('T-106 c1 @P0 checkMembership: array repo_id is a strict include, scalar repo_id is compared as numbers', () => {
      expect(checkMembership(86)).toBeTruthy()
      expect(checkMembership('86')).toBeFalsy()
      expect(checkMembership(4835)).toBeTruthy()
      expect(checkMembership('4835')).toBeTruthy()
      expect(checkMembership(999999999)).toBeUndefined()
      expect(checkMembership(undefined)).toBeUndefined()
    })

    test('T-106 c1 @P0 checkMembership(null) and (0) match the member whose repo_id is null (+null === +null)', () => {
      expect(orgOf(checkMembership(null))).toBe(MEMBER_NULL)
      expect(orgOf(checkMembership(0))).toBe(MEMBER_NULL)
    })

    test('T-106 c1 @P0 checkDataProvider: the same lookup without the billing test', () => {
      expect(orgOf(checkDataProvider(86))).toBe(MEMBER_ARRAY)
      expect(checkDataProvider('86')).toBeFalsy()
      expect(orgOf(checkDataProvider('4835'))).toBe(MEMBER_STARTING)
      expect(orgOf(checkDataProvider(null))).toBe(MEMBER_NULL)
      expect(checkDataProvider(999999999)).toBeUndefined()
    })

    test('T-106 c1 @P0 Q-023 checkType compares a number array with a string: it never matches array members', () => {
      expect(checkType(86)).toBeFalsy()
      expect(checkType('86')).toBeFalsy()
      // scalar repo_id still matches, as numbers
      expect(orgOf(checkType(4835))).toBe(MEMBER_STARTING)
      expect(orgOf(checkType('4835'))).toBe(MEMBER_STARTING)
      // null and 0 match the member without a repo_id
      expect(orgOf(checkType(0))).toBe(MEMBER_NULL)
      expect(orgOf(checkType(null))).toBe(MEMBER_NULL)
      expect(checkType(undefined)).toBeFalsy()
    })

    test('T-106 c1 @P0 transformDataProviders: {url, ...provider}; an unknown id keeps only the url', async () => {
      const out = await transformDataProviders([
        { url: 'https://oro.open.ac.uk/', id: 86 },
        { url: 'https://nowhere.example/', id: 999999999 },
        { url: 'https://eprints.bbk.ac.uk', id: '8' },
      ])
      expect(out).toHaveLength(3)
      expect(out[0].url).toBe('https://oro.open.ac.uk/')
      // the input url comes first, then the provider's own keys
      expect(Object.keys(out[0]).slice(0, 2)).toEqual(['url', 'id'])
      expect(out[0].id).toBe(86)
      expect(out[0].name).toBe('Open Research Online (Open University)')
      // the provider map has its own `urlHomepage`, the input url is a
      // separate key
      expect(out[0]).toHaveProperty('urlHomepage')
      expect(out[1]).toEqual({ url: 'https://nowhere.example/' })
      expect(out[2]).toMatchObject({
        url: 'https://eprints.bbk.ac.uk',
        id: 8,
        name: 'Birkbeck Institutional Research Online',
      })
    })

    test('T-106 c1 @P0 transformDataProviders(undefined) rejects with a TypeError', async () => {
      await expect(transformDataProviders(undefined)).rejects.toThrow(TypeError)
      await expect(transformDataProviders([])).resolves.toEqual([])
    })

    test('T-106 c1 @P0 Q-035 findDataProvider coerces the id with unary plus: "0x56", " 86 " and "8.6e1" are provider 86', () => {
      for (const id of [86, '86', ' 86 ', '0x56', '8.6e1'])
        expect(findDataProvider(id)).toMatchObject({ id: 86 })
      expect(findDataProvider('86abc')).toBeUndefined()
      expect(findDataProvider('abc')).toBeUndefined()
      expect(findDataProvider(999999999)).toBeUndefined()
    })

    test('T-106 c1 @P0 checkUniversity: the member name is read from the wrong key, so the provider institutionName (or "") is used', () => {
      // 4835 is found as a member with an organisation_name, but the code
      // reads `organisationName`
      expect(orgOf(checkDataProvider(4835))).toBe(MEMBER_STARTING)
      expect(checkUniversity(4835)).toBe('Aberystwyth University')
      // array member: strict string include never matches a number array
      expect(checkUniversity(86)).toBe('The Open University')
      expect(checkUniversity(8)).toBe('Birkbeck, University of London')
      // provider without an institutionName, and an unknown provider
      expect(checkUniversity(3354)).toBe('')
      expect(checkUniversity(999999999)).toBe('')
      expect(checkUniversity('4835')).toBe('Aberystwyth University')
    })

    test('T-106 c1 @P0 checkUniversity(undefined) throws a TypeError', () => {
      expect(() => checkUniversity(undefined)).toThrow(TypeError)
    })
  })

  describe('c1 the committed members file', () => {
    // data/.members.json by explicit path (not the synthetic copy): Q-023 says
    // all of its rows count as members, the 426 `starting` ones included
    const REAL_MEMBERS = path.join(__dirname, '../../../data/.members.json')

    test('T-106 c1 @P0 Q-023 on data/.members.json every row with a repo_id counts as a member, `starting` included', () => {
      const members = JSON.parse(fs.readFileSync(REAL_MEMBERS, 'utf8'))
      const syntheticPath = require.resolve('data/.members.json')
      let real
      jest.isolateModules(() => {
        jest.doMock(syntheticPath, () => members)
        real = require('../../../utils/data-providers-transform')
      })
      jest.dontMock(syntheticPath)

      const ids = (m) => {
        if (Array.isArray(m.repo_id)) return m.repo_id
        return m.repo_id == null ? [] : [m.repo_id]
      }
      const withId = members.filter((m) => ids(m).length > 0)
      const starting = members.filter((m) => m.billing_type === 'starting')
      expect(starting.length).toBeGreaterThan(0)
      // the key the code reads does not exist in the data
      expect(members.some((m) => 'billingType' in m)).toBe(false)
      expect(members.every((m) => 'billing_type' in m)).toBe(true)

      const startingIds = starting.flatMap(ids)
      expect(startingIds.length).toBeGreaterThan(0)
      for (const id of startingIds)
        expect(real.checkMembership(id)).toBeTruthy()
      for (const m of withId)
        for (const id of ids(m)) expect(real.checkMembership(id)).toBeTruthy()

      // §3.7: 4835 is a starting member, [8, 503] an array member
      expect(real.checkMembership(4835).billing_type).toBe('starting')
      expect(real.checkMembership(503)).toBeTruthy()
      expect(real.checkMembership('503')).toBeFalsy()
      expect(real.checkType(503)).toBeFalsy()
    })
  })

  describe('c2 logo requests (Q-090)', () => {
    test('T-106 c2 @P0 a provider that is not a member makes no request and gets null', async () => {
      await expect(
        checkLogo(999999999, 'https://logo.example.test/x.png')
      ).resolves.toBeNull()
      expect(requests).toEqual([])
    })

    test('T-106 c2 @P0 Q-090 a member with a null logo: GET {API_URL}null (no slash), answer 404, result null', async () => {
      await expect(checkLogo(4835, null)).resolves.toBeNull()
      expect(requests).toEqual([
        {
          method: 'GET',
          url: `${API_URL}null`,
          authorization: 'Bearer test-key',
        },
      ])
      expect(requests[0].url).toBe('https://api.core.ac.uk/internalnull')
      // the 404 goes through LogRocket and is swallowed by checkLogo
      expect(LogRocket.captureException).toHaveBeenCalledTimes(1)
      expect(LogRocket.captureException.mock.calls[0][0]).toMatchObject({
        name: 'NotFoundError',
        status: 404,
      })
    })

    test('T-106 c2 @P0 Q-090 the one-argument call of the works and outputs pages: the logo is the id, GET {API_URL}undefined, result null', async () => {
      // pages/works/[id].jsx:41 and pages/outputs/[id].jsx:56 call
      // checkLogo(dataProvider.logo): a null logo matches the member without a
      // repo_id, and the logo URL argument is undefined
      await expect(checkLogo(null)).resolves.toBeNull()
      expect(requests.map((r) => [r.method, r.url])).toEqual([
        ['GET', `${API_URL}undefined`],
      ])
      // a URL string used as the id matches no member: no request
      requests.length = 0
      await expect(
        checkLogo('https://logo.example.test/x.png')
      ).resolves.toBeNull()
      expect(requests).toEqual([])
    })

    test('T-106 c2 @P0 a member with a logo URL: the URL is requested as it is and returned on success', async () => {
      const logo = 'https://logo.example.test/members/4835.png'
      server.use(
        http.get(logo, () =>
          HttpResponse.text('logo-bytes', {
            headers: { 'content-type': 'image/png' },
          })
        )
      )
      await expect(checkLogo(4835, logo)).resolves.toBe(logo)
      expect(requests.map((r) => [r.method, r.url])).toEqual([['GET', logo]])
      expect(LogRocket.captureException).not.toHaveBeenCalled()
    })

    test('T-106 c2 @P0 a member whose logo request fails (500) gets null', async () => {
      const logo = 'https://logo.example.test/members/broken.png'
      server.use(http.get(logo, () => new HttpResponse(null, { status: 500 })))
      await expect(checkLogo(4835, logo)).resolves.toBeNull()
      expect(requests.map((r) => r.url)).toEqual([logo])
      expect(LogRocket.captureException).toHaveBeenCalledTimes(1)
      expect(LogRocket.captureException.mock.calls[0][0]).toMatchObject({
        name: 'InternalServerError',
        status: 500,
      })
    })
  })
})
