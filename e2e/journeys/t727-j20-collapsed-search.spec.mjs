// T-727 (41 H, J20, R-051, Q-012): the collapsed header search of a works or outputs page. The design Header
// shows a "Search icon" button; a click opens the input, Enter calls the page's onQueryChanged, which pushes the
// term as typed, unencoded (pages/works/[id].jsx:130 `/search?q=${searchTerm}`, pages/outputs/[id].jsx:113
// `/search/?q=${searchTerm}`). The term `a&b c++` therefore reaches the router as `q=a` plus a stray parameter
// named `b c++`: the address bar shows `/search/?q=a&b%20c++`, the `_next/data` request is
// `search.json?q=a&b+c++=`, and the server searches for `a` only (the E1 body of the search fixture q=a).
// Pinned as it is today (R-051: the BR fault encodes the term, and the server would search for `a&b c++`).
// Both starting pages also hit the hooks-order crash of a mounted header search bar (Q-100, pinned by T-716 c3):
// the test declares it (guard-expect console and csp) and asserts the exact signature, then the search page
// renders anyway (the ErrorBoundary retries the subtree).
// The server-side window of the search reads the SSR stub's wire log, so the tests carry @wire and run in the
// serial wire project.
// Fixtures: works-1001 and outputs-2001 (the starting pages), req-P1-05 (E1 of q=a, E2 of q=a derived), members.
import { test, expect } from '../lib/P1-05/fixtures.mjs'
import {
  NAV_TIMEOUT,
  TEST_TIMEOUT,
  buildIdOf,
  historySince,
  netLog,
  pageConsole,
  rel,
  requestsOf,
  routerEvents,
  settle,
  stubMark,
  stubWindow,
  trackPage,
  watchRouter,
} from '../lib/P1-05/page.mjs'
import { declareCrash, expectCrash } from '../lib/P1-05/crash.mjs'

test.use({
  cookieState: 'essential',
  navigationTimeout: NAV_TIMEOUT,
  actionTimeout: 60000,
})

const TERM = 'a&b c++'

// the works page pushes `/search?q=...`, the outputs page `/search/?q=...`: the router normalises both
const CASES = [
  { name: 'works', start: '/works/1001/' },
  { name: 'outputs', start: '/outputs/2001/' },
]

test.describe('T-727 @P1 J20 collapsed search with a&b c++', () => {
  test.describe.configure({ timeout: TEST_TIMEOUT })

  for (const c of CASES)
    test(`T-727 @P1 @wire ${c.name} page: the term is pushed unencoded, the server searches for q=a only`, async ({
      page,
      p2Env,
      guardLog,
    }) => {
      declareCrash(test)
      const tracker = trackPage(page)
      const log = netLog(page, p2Env)
      await page.goto(c.start)
      await watchRouter(page)
      await settle(page, tracker)
      const buildId = await buildIdOf(page)
      await page.evaluate(() => {
        window.__marker = 'survives'
      })

      // collapsed: the icon button, no input
      const icon = page.getByRole('button', { name: 'Search icon' })
      await expect(icon).toBeVisible()
      await expect(page.getByRole('combobox')).toHaveCount(0)
      // the icon opens the input
      await icon.click()
      const box = page.getByRole('combobox')
      await expect(box).toBeVisible()
      await expect(icon).toBeHidden()
      await box.fill(TERM)
      await expect(box).toHaveValue(TERM)

      // from here the window of the search: browser log, history, console, server wire
      const consoleFrom = guardLog.console.length
      const m = log.mark()
      const histBefore = (await historySince(page, p2Env)).length
      const mark = await stubMark(p2Env, `t727-${c.name}`)
      await box.press('Enter')
      await expect(page).toHaveURL(`${p2Env.baseURL}/search/?q=a&b%20c++`, {
        timeout: NAV_TIMEOUT,
      })
      await settle(page, tracker)

      // the address bar and the history: one push, the term unencoded up to what the router normalises
      expect(rel(p2Env, page.url())).toBe('/search/?q=a&b%20c++')
      expect(await historySince(page, p2Env, histBefore)).toEqual([
        {
          method: 'pushState',
          url: '/search/?q=a&b%20c++',
          stateKeys: ['__N', 'as', 'idx', 'options', 'url'],
        },
      ])
      expect(
        (await routerEvents(page)).filter(([n]) => n === 'routeChangeStart')
      ).toEqual([['routeChangeStart', '/search/?q=a&b%20c++']])
      // a client navigation: the document survives
      expect(await page.evaluate(() => window.__marker)).toBe('survives')

      // the app's requests: the data request carries q=a and the stray parameter `b c++` with an empty value;
      // the filters bar asks for the aggregation (twice: the subtree is mounted again after the crash)
      // (the member card's logo image, E21/E22, is left out: the browser fetches it once per document)
      const steps = requestsOf(p2Env, buildId, log.since(m)).filter(
        ([, , url]) => !/\/data-providers\/\d+\/logo$/.test(url)
      )
      expect(steps).toEqual(
        [
          [
            'api',
            'POST',
            'https://api.core.ac.uk/v3/search/works/aggregate',
            200,
          ],
          [
            'api',
            'POST',
            'https://api.core.ac.uk/v3/search/works/aggregate',
            200,
          ],
          [
            'next-data',
            'GET',
            '/search/_next/data/<buildId>/search.json?q=a&b+c++=',
            200,
          ],
        ].sort((a, b) => (a.join(' ') < b.join(' ') ? -1 : 1))
      )
      // the server searched for `a` only: its E1 and members calls hit the fixtures of q=a
      const server = await stubWindow(p2Env, mark.seq)
      expect(
        server.map((r) => [r.method, r.path, r.status, r.fixture])
      ).toEqual([
        ['POST', '/v3/search/works?t=undefined', 200, 'req-P1-05'],
        ['GET', '/internal/members', 200, 'members'],
      ])

      // the rendered page is the search for `a`
      await expect(page).toHaveTitle('Search CORE')
      // the header input shows the term of the search the server ran
      expect(await box.inputValue()).toBe('a')
      await expect(page.getByText(/research outputs found/)).toHaveText(
        '114,246,124 research outputs found'
      )
      // the router's own view of the URL: q and the stray parameter (its name is the rest of the term)
      expect(await page.evaluate(() => window.next.router.query)).toEqual({
        'q': 'a',
        'b c  ': '',
      })
      expectCrash(guardLog, consoleFrom)
      expect(pageConsole(guardLog, consoleFrom).length).toBeGreaterThan(0)
    })
})
