// T-735 (41 H, J26, Q-079, Q-044, Q-043, R-018, R-039): provider page search, pager and sort as one journey on
// provider 8, with the counts of 41 §2.2.
//   c1  the journey step by step: the first change of the search box is swallowed, the second one pushes
//       `?q=thesis&offset=0`; Back and Forward re-fetch the data (popstate, then Next's replaceState); Next adds 10
//       to the offset; Previous points at the current offset (a push of the same URL is a replace, the data is
//       fetched again); "recent" pushes `sort=relevance&page=1` and keeps the offset (Q-043); each step's URL,
//       stats, box text, sort label, results (the fixture of the step's E13 request), history entries and
//       `_next/data` requests;
//       (c1 carries @wire too: ten client navigations in a row, each of which a render that runs in another test
//       can turn into a document load, so it runs in the serial wire project, after the other tests);
//   c2  @wire the counts of the same steps (41 §2.2 "Load /data-providers/{id}" and "page or sort change"): the
//       server asks E11, E12, E13 (and E18, un-awaited, on a document load only); the browser asks E18 twice on
//       load (provider with accounts) and once for a provider without, and every client navigation costs one
//       `_next/data` request, one server E11/E12/E13 triple and three more E18 (ClaimCard re-renders, Q-087). The
//       swallowed change costs nothing. The wire tests read the SSR stub's log of their own steps, so they run
//       in the serial wire project.
// Fixtures: provider-8 (+ req-P1-05: thesis, offset 10, relevance at offset 10), provider-3354.
import { test, expect } from '../lib/P1-05/fixtures.mjs'
import {
  ACTION_TIMEOUT,
  NAV_TIMEOUT,
  TEST_TIMEOUT,
  buildIdOf,
  historySince,
  requestsOf,
  settle,
  stubMark,
  stubWindow,
} from '../lib/P1-05/page.mjs'
import { openProvider, providerView } from '../lib/P1-05/provider.mjs'
import { journey } from '../lib/P1-05/provider-journey.mjs'
import { resultsOf } from '../lib/P1-05/results.mjs'

test.use({
  cookieState: 'essential',
  navigationTimeout: NAV_TIMEOUT,
  actionTimeout: ACTION_TIMEOUT,
})

const P = '/data-providers/8/'
const API = 'https://api.core.ac.uk/v3/data-providers/8'
const E13 = (q, offset, sort) =>
  `${API}/outputs?q=${q}&offset=${offset}&limit=10&sort=${sort}`
const ACCOUNT = 'https://api.core.ac.uk/internal/data-providers/8/account'
const DATA = (qs) =>
  `/static/search/_next/data/<buildId>/data-providers/8.json?${qs}id=8`
// the server's calls for one render of the page (E11, E12, E13) at the E13 URL
const sortKey = (a, b) => (a.join(' ') < b.join(' ') ? -1 : 1)
const SERVER = (q, offset, sort) => [
  ['GET', '/v3/data-providers/8?t=undefined', 200],
  ['GET', '/v3/data-providers/8/stats', 200],
  [
    'GET',
    `/v3/data-providers/8/outputs?q=${q}&offset=${offset}&limit=10&sort=${sort}`,
    200,
  ],
]

// per step: the E13 request the page shows, and the labels
const SHOWN = {
  swallowed: ['', 0, 'recency'],
  search: ['thesis', 0, 'recency'],
  back1: ['', 0, 'recency'],
  forward1: ['thesis', 0, 'recency'],
  back2: ['', 0, 'recency'],
  next: ['', 10, 'recency'],
  previous: ['', 10, 'recency'],
  sort: ['', 10, 'relevance'],
  back3: ['', 10, 'recency'],
  back4: ['', 0, 'recency'],
}
const STATS = (offset) =>
  offset === 0 ? 'Showing 1-10 of 30,950' : 'Showing 11-20 of 30,950'
const URLS = {
  swallowed: P,
  search: `${P}?q=thesis&offset=0`,
  back1: P,
  forward1: `${P}?q=thesis&offset=0`,
  back2: P,
  next: `${P}?offset=10`,
  previous: `${P}?offset=10`,
  sort: `${P}?offset=10&sort=relevance&page=1`,
  back3: `${P}?offset=10`,
  back4: P,
}
// the history entries of each step: [method, url]
const HISTORY = {
  swallowed: [],
  search: [['pushState', URLS.search]],
  back1: [
    ['popstate', P],
    ['replaceState', P],
  ],
  forward1: [
    ['popstate', URLS.search],
    ['replaceState', URLS.search],
  ],
  back2: [
    ['popstate', P],
    ['replaceState', P],
  ],
  next: [['pushState', URLS.next]],
  previous: [['replaceState', URLS.next]],
  sort: [['pushState', URLS.sort]],
  back3: [
    ['popstate', URLS.next],
    ['replaceState', URLS.next],
  ],
  back4: [
    ['popstate', P],
    ['replaceState', P],
  ],
}
// the `_next/data` URL of each step (one per step, none for the swallowed change)
const NEXT_DATA = {
  swallowed: [],
  search: [DATA('q=thesis&offset=0&')],
  back1: [DATA('')],
  forward1: [DATA('q=thesis&offset=0&')],
  back2: [DATA('')],
  next: [DATA('offset=10&')],
  previous: [DATA('offset=10&')],
  sort: [DATA('offset=10&sort=relevance&page=1&')],
  back3: [DATA('offset=10&')],
  back4: [DATA('')],
}

// the view fields a step pins
const pick = (v) => ({
  url: v.url,
  stats: v.stats,
  input: v.input,
  sort: v.sort,
  found: v.found,
  notice: v.notice,
  results: v.results,
})

test.describe('T-735 @P1 J26 provider search, pager, sort', () => {
  test.describe.configure({ timeout: TEST_TIMEOUT })

  test('T-735 c1 @P1 @wire the journey: search is swallowed once, Previous keeps the offset, sort pushes relevance; Back and Forward re-fetch', async ({
    page,
    p2Env,
    resolver,
  }) => {
    const steps = {}
    let buildId
    await journey(page, p2Env, async (label, run, ctx) => {
      if (label === 'load') {
        buildId = await buildIdOf(page)
        return
      }
      const m = ctx.log.mark()
      const h = (await historySince(page, p2Env)).length
      await run()
      const requests = requestsOf(p2Env, buildId, ctx.log.since(m))
      steps[label] = {
        view: pick(await providerView(page)),
        history: (await historySince(page, p2Env, h)).map((x) => [
          x.method,
          x.url,
        ]),
        nextData: requests
          .filter(([kind]) => kind === 'next-data')
          .map(([, method, url, status]) => [method, url, status]),
        documents: requests.filter(([kind]) => kind === 'document').length,
      }
    })

    const expected = {}
    for (const label of Object.keys(SHOWN)) {
      const [q, offset, sort] = SHOWN[label]
      expected[label] = {
        view: {
          url: URLS[label],
          stats: [STATS(offset)],
          input: 'thesis',
          sort: ['Sort by recent'],
          found: ['30950 research outputs found'],
          notice: [],
          results: resultsOf(resolver, E13(q, offset, sort)),
        },
        history: HISTORY[label],
        nextData: NEXT_DATA[label].map((u) => ['GET', u, 200]),
        documents: 0,
      }
    }
    expect(steps).toEqual(expected)
  })

  test('T-735 c2 @P1 @wire the counts of the journey: E11, E12, E13 per render, one _next/data and three E18 per client navigation, nothing for the swallowed change', async ({
    page,
    p2Env,
  }) => {
    const mark0 = await stubMark(p2Env, 't735-load')
    const steps = {}
    let buildId
    await journey(page, p2Env, async (label, run, ctx) => {
      if (label === 'load') {
        await settle(page, ctx.tracker)
        buildId = await buildIdOf(page)
        const server = await stubWindow(p2Env, mark0.seq)
        steps.load = {
          server: server.map((r) => [r.method, r.path, r.status]),
          browser: requestsOf(p2Env, buildId, ctx.log.since(0))
            .filter(([, , url]) => !/\/logo$/.test(url))
            .map(([kind, method, url, status]) => [kind, method, url, status]),
        }
        return
      }
      const m = ctx.log.mark()
      const mark = await stubMark(p2Env, `t735-${label}`)
      await run()
      const server = await stubWindow(p2Env, mark.seq)
      steps[label] = {
        server: server.map((r) => [r.method, r.path, r.status]),
        browser: requestsOf(p2Env, buildId, ctx.log.since(m))
          .filter(([, , url]) => !/\/logo$/.test(url))
          .map(([kind, method, url, status]) => [kind, method, url, status]),
      }
    })

    const account = ['api', 'GET', ACCOUNT, 200]
    const expected = {
      // a document load: E11, E12, E13, then E18 un-awaited; the browser asks E18 twice (a provider with accounts)
      load: {
        server: [
          ...SERVER('', 0, 'recency'),
          ['GET', '/internal/data-providers/8/account', 200],
        ],
        browser: [account, account, ['document', 'GET', P, 200]].sort(sortKey),
      },
    }
    for (const label of Object.keys(SHOWN)) {
      const [q, offset, sort] = SHOWN[label]
      expected[label] =
        label === 'swallowed'
          ? { server: [], browser: [] }
          : {
              server: SERVER(q, offset, sort),
              browser: [
                account,
                account,
                account,
                ['next-data', 'GET', NEXT_DATA[label][0], 200],
              ].sort(sortKey),
            }
    }
    expect(steps).toEqual(expected)
  })

  test('T-735 c2 @P1 @wire provider 3354 (no accounts): E18 once on the server and once in the browser', async ({
    page,
    p2Env,
  }) => {
    const mark = await stubMark(p2Env, 't735-3354')
    const { log, tracker } = await openProvider(
      page,
      p2Env,
      '/data-providers/3354/'
    )
    await settle(page, tracker)
    const buildId = await buildIdOf(page)
    const server = await stubWindow(p2Env, mark.seq)
    expect(server.map((r) => [r.method, r.path, r.status])).toEqual([
      ['GET', '/v3/data-providers/3354?t=undefined', 200],
      ['GET', '/v3/data-providers/3354/stats', 200],
      [
        'GET',
        '/v3/data-providers/3354/outputs?q=&offset=0&limit=10&sort=recency',
        200,
      ],
      ['GET', '/internal/data-providers/3354/account', 200],
    ])
    expect(
      requestsOf(p2Env, buildId, log.since(0)).filter(
        ([, , url]) => !/\/logo$/.test(url)
      )
    ).toEqual(
      [
        [
          'api',
          'GET',
          'https://api.core.ac.uk/internal/data-providers/3354/account',
          200,
        ],
        ['document', 'GET', '/data-providers/3354/', 200],
      ].sort(sortKey)
    )
  })
})
