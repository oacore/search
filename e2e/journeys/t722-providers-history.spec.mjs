// T-722 (41 H, R-018): /data-providers history. The page mirrors a client MobX singleton to the URL with
// shallow router.replace/push (hooks/use-sync-url-params-with-store, findings/03 §3.3 and §5 R5). Pins today's
// behaviour exactly, quirks included:
//   c1  the findings/03 §5 R5 list: type a query (URL updates, shallow: no document or _next/data request),
//       Back restores the previous query, Load more writes size=20 and keeps the scroll, navigate away and back,
//       a no-results query shows the form and writes action=ADD (U4); Q-080 (title never shows the query, the
//       header input starts empty);
//   c2  Q-048.U1 (Back to a URL without q leaves the old q in the store) and U3 (a client revisit keeps the old
//       params and rewrites the URL to the old query), U2 (unknown params are stripped) on the way;
//   c3  history.length: the first sync replaces when the URL has no query (a plain load adds no entry), every
//       user change adds exactly one entry, Back and Forward add none (R-018: "first sync pushes").
// Fixtures: the data snapshot (SSR needs no API on this page), provider 8 for the card click,
// e19-client-nav for the client navigations (Q-011). Queries: test/fixtures/scenarios.json
// picks.dataProvidersQueries (aberystwyth -> 4835; birkbeck -> 24390, 8).
import { test, expect } from '../lib/P0-14/fixtures.mjs'
import {
  historyOf,
  stableJson,
  ACTION_TIMEOUT,
  NAV_TIMEOUT,
  TEST_TIMEOUT,
  appQuiet,
  settle,
} from '../lib/P0-14/page.mjs'
import {
  addForm,
  buildIdOf,
  enterQuery,
  methods,
  openProviders,
  requestsOf,
  revisitFlow,
  searchBox,
  urlIs,
  view,
} from '../lib/P0-14/providers.mjs'

// a hard load of these pages can take tens of seconds on a loaded machine (40 §5: timeouts, never retries)
test.use({ navigationTimeout: NAV_TIMEOUT, actionTimeout: ACTION_TIMEOUT })

const ALL = 'Showing 1-10 of 15,672'
const TITLE = 'Data providers search'

// the page's scroll position and the entries it added, read together
const scrollY = (page) => page.evaluate(() => Math.round(window.scrollY))

test.describe('T-722 @P0 /data-providers history', () => {
  // a 7 MB page that hydrates 15,672 rows, several steps, on a machine that runs other stacks too. The tests run
  // one after the other in one worker: the app is one Node process, and a server render of the 7 MB page keeps
  // its event loop busy for seconds. Next 10's route loader gives a client navigation 3.8 s to fetch the target
  // route's stylesheet (`Route did not complete loading`) and falls back to a full page load past that, so two
  // tests in parallel can turn the client navigations of the "away and Back" flows into document loads.
  test.describe.configure({ mode: 'default', timeout: TEST_TIMEOUT })

  test('T-722 c1 @P0 R5: type a query (shallow push), Back and Forward restore the query; Q-080', async ({
    page,
    p2Env,
  }) => {
    const { log, tracker } = await openProviders(page, p2Env)
    const buildId = await buildIdOf(page)
    const steps = []
    const step = async (name, fn, path, stats) => {
      const m = log.mark()
      await fn()
      await urlIs(page, p2Env, path)
      await settle(page, tracker)
      await expect(page.getByText(/^Showing \d/).first()).toHaveText(stats)
      steps.push({
        step: name,
        ...(await view(page, p2Env)),
        requests: requestsOf(p2Env, buildId, log.since(m)),
      })
    }
    // the first sync of the load: replaceState, no entry added; Q-080: title without the query, header input
    // empty
    expect(await view(page, p2Env)).toEqual({
      url: '/data-providers/?q=&size=10',
      title: TITLE,
      headerInput: '',
      stats: ALL,
      addForm: false,
      addedEntries: 0,
    })
    await step(
      'type aberystwyth + Enter',
      () => enterQuery(page, 'aberystwyth'),
      '/data-providers/?q=aberystwyth&size=10',
      'Showing 1-1 of 1'
    )
    await step(
      'type birkbeck + Enter',
      () => enterQuery(page, 'birkbeck'),
      '/data-providers/?q=birkbeck&size=10',
      'Showing 1-2 of 2'
    )
    await step(
      'Back',
      () => page.goBack(),
      '/data-providers/?q=aberystwyth&size=10',
      'Showing 1-1 of 1'
    )
    await step('Back', () => page.goBack(), '/data-providers/?q=&size=10', ALL)
    await step(
      'Forward',
      () => page.goForward(),
      '/data-providers/?q=aberystwyth&size=10',
      'Showing 1-1 of 1'
    )
    // shallow: no document and no _next/data request for any step (the page is never re-fetched)
    for (const s of steps) expect(s.requests, s.step).toEqual([])
    // the quirks: the title never shows the query (Q-080); the header input keeps what the user typed
    expect(steps.map((s) => [s.step, s.title, s.headerInput])).toEqual([
      ['type aberystwyth + Enter', TITLE, 'aberystwyth'],
      ['type birkbeck + Enter', TITLE, 'birkbeck'],
      ['Back', TITLE, 'birkbeck'],
      ['Back', TITLE, 'birkbeck'],
      ['Forward', TITLE, 'birkbeck'],
    ])
    // one entry per typed query, none for Back and Forward
    expect(steps.map((s) => [s.step, s.addedEntries])).toEqual([
      ['type aberystwyth + Enter', 1],
      ['type birkbeck + Enter', 2],
      ['Back', 2],
      ['Back', 2],
      ['Forward', 2],
    ])
    expect(await methods(page, p2Env)).toEqual([
      ['replaceState', '<origin>/data-providers/'],
      ['replaceState', '<origin>/data-providers/?q=&size=10'],
      ['pushState', '<origin>/data-providers/?q=aberystwyth&size=10'],
      ['pushState', '<origin>/data-providers/?q=birkbeck&size=10'],
      ['popstate', '<origin>/data-providers/?q=aberystwyth&size=10'],
      ['replaceState', '<origin>/data-providers/?q=aberystwyth&size=10'],
      ['popstate', '<origin>/data-providers/?q=&size=10'],
      ['replaceState', '<origin>/data-providers/?q=&size=10'],
      ['popstate', '<origin>/data-providers/?q=aberystwyth&size=10'],
      ['replaceState', '<origin>/data-providers/?q=aberystwyth&size=10'],
    ])
    expect(
      stableJson({ steps, history: await historyOf(page, p2Env) })
    ).toMatchSnapshot('t722-c1-type-back-forward.json')
  })

  test('T-722 c1 @P0 R5: Load more writes size=20, keeps the scroll, adds one entry', async ({
    page,
    p2Env,
  }) => {
    const { log, tracker } = await openProviders(page, p2Env)
    const buildId = await buildIdOf(page)
    const more = page.getByRole('button', { name: 'Load more' })
    await more.scrollIntoViewIfNeeded()
    const before = await scrollY(page)
    expect(before).toBeGreaterThan(0)
    const m = log.mark()
    await more.click()
    await urlIs(page, p2Env, '/data-providers/?q=&size=20')
    await settle(page, tracker)
    await expect(page.getByText(/^Showing \d/).first()).toHaveText(
      'Showing 1-20 of 15,672'
    )
    // the layout effect restores the scroll position of the click
    expect(await scrollY(page)).toBe(before)
    expect(requestsOf(p2Env, buildId, log.since(m))).toEqual([])
    expect(await view(page, p2Env)).toMatchObject({
      url: '/data-providers/?q=&size=20',
      title: TITLE,
      addedEntries: 1,
    })
    expect((await methods(page, p2Env)).slice(2)).toEqual([
      ['pushState', '<origin>/data-providers/?q=&size=20'],
    ])
  })

  test('T-722 c1 @P0 R5: away to a provider page and Back keeps the query in the store', async ({
    page,
    p2Env,
  }) => {
    const { log, tracker } = await openProviders(page, p2Env)
    const buildId = await buildIdOf(page)
    await enterQuery(page, 'birkbeck')
    await urlIs(page, p2Env, '/data-providers/?q=birkbeck&size=10')
    await settle(page, tracker)
    await expect(page.getByText(/^Showing \d/).first()).toHaveText(
      'Showing 1-2 of 2'
    )
    // the card is a next/link: a client navigation to the provider page (getServerSideProps over _next/data)
    const card = page.locator('#__next a[href="/data-providers/8"]')
    await expect(card).toHaveText('Birkbeck Institutional Research Online')
    const away = log.mark()
    await card.click()
    await urlIs(page, p2Env, '/data-providers/8/')
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Birkbeck, University of London',
      })
    ).toBeVisible({ timeout: NAV_TIMEOUT })
    await settle(page, tracker)
    const awayRequests = requestsOf(p2Env, buildId, log.since(away))
    await appQuiet(p2Env)
    const back = log.mark()
    await page.goBack()
    await urlIs(page, p2Env, '/data-providers/?q=birkbeck&size=10')
    await settle(page, tracker)
    // the store singleton kept the query: the list is the filtered one
    await expect(page.getByText(/^Showing \d/).first()).toHaveText(
      'Showing 1-2 of 2'
    )
    const backRequests = requestsOf(p2Env, buildId, log.since(back))
    expect(stableJson({ awayRequests, backRequests })).toMatchSnapshot(
      't722-c1-away-and-back-requests.json'
    )
    expect(await view(page, p2Env)).toMatchObject({
      url: '/data-providers/?q=birkbeck&size=10',
      title: TITLE,
      addedEntries: 2,
    })
    expect(await methods(page, p2Env)).toEqual([
      ['replaceState', '<origin>/data-providers/'],
      ['replaceState', '<origin>/data-providers/?q=&size=10'],
      ['pushState', '<origin>/data-providers/?q=birkbeck&size=10'],
      ['pushState', '<origin>/data-providers/8/'],
      ['popstate', '<origin>/data-providers/?q=birkbeck&size=10'],
      ['replaceState', '<origin>/data-providers/?q=birkbeck&size=10'],
    ])
  })

  test('T-722 c1 @P0 R5: a no-results query shows the form and writes action=ADD (U4)', async ({
    page,
    p2Env,
  }) => {
    const { tracker } = await openProviders(page, p2Env)
    await expect(addForm(page)).toHaveCount(0)
    await enterQuery(page, 'zzzqqq')
    await urlIs(page, p2Env, '/data-providers/?action=ADD&q=zzzqqq&size=10')
    await settle(page, tracker)
    await expect(addForm(page)).toBeVisible()
    await expect(page.getByText('Is there a mistake?')).toBeVisible()
    await expect(page.getByText(/^Showing \d/)).toHaveCount(0)
    expect(await view(page, p2Env)).toMatchObject({
      title: TITLE,
      headerInput: 'zzzqqq',
      addForm: true,
      addedEntries: 1,
    })
    // results come back: the effect restores the action of the first render (none), the form goes
    await enterQuery(page, 'aberystwyth')
    await urlIs(page, p2Env, '/data-providers/?q=aberystwyth&size=10')
    await settle(page, tracker)
    await expect(addForm(page)).toHaveCount(0)
    expect(await view(page, p2Env)).toMatchObject({
      stats: 'Showing 1-1 of 1',
      addForm: false,
      addedEntries: 2,
    })
    expect((await methods(page, p2Env)).slice(2)).toEqual([
      ['pushState', '<origin>/data-providers/?action=ADD&q=zzzqqq&size=10'],
      ['pushState', '<origin>/data-providers/?q=aberystwyth&size=10'],
    ])
  })

  test('T-722 c1 @P0 Q-080: a loaded ?q= filters the list but title and header input never show it', async ({
    page,
    p2Env,
    request,
  }) => {
    // SSR: the title is the fixed text and the list is already filtered by the server store
    const html = await (
      await request.get('/data-providers/?q=aberystwyth')
    ).text()
    expect(html).toContain(`<title>${TITLE}</title>`)
    expect(html).not.toContain('aberystwyth - ')
    await openProviders(page, p2Env, '/data-providers/?q=aberystwyth')
    expect(await view(page, p2Env)).toEqual({
      url: '/data-providers/?q=aberystwyth&size=10',
      title: TITLE,
      headerInput: '',
      stats: 'Showing 1-1 of 1',
      addForm: false,
      // the load puts q=aberystwyth in the entry; the first sync then pushes size=10 (the URL has a query)
      addedEntries: 1,
    })
  })

  test('T-722 c2 @P0 Q-048.U1 Back to a URL without q keeps the old q in the store; U2 strips unknown params', async ({
    page,
    p2Env,
  }) => {
    const { tracker } = await openProviders(
      page,
      p2Env,
      '/data-providers/?foo=bar'
    )
    // U2: the first sync writes the schema keys only; ?foo=bar stays as the entry before it
    expect(await view(page, p2Env)).toMatchObject({
      url: '/data-providers/?q=&size=10',
      stats: ALL,
      addedEntries: 1,
    })
    await enterQuery(page, 'aberystwyth')
    await urlIs(page, p2Env, '/data-providers/?q=aberystwyth&size=10')
    await settle(page, tracker)
    await expect(page.getByText(/^Showing \d/).first()).toHaveText(
      'Showing 1-1 of 1'
    )
    // two entries back: the entry ?foo=bar has no q
    await page.evaluate(() => window.history.go(-2))
    await urlIs(page, p2Env, '/data-providers/?foo=bar')
    await settle(page, tracker)
    // U1: URL -> store only applies keys present in the URL, so the store keeps q=aberystwyth: the list is
    // still the filtered one while the URL names no query, and nothing pushes the old q again
    expect(await view(page, p2Env)).toMatchObject({
      url: '/data-providers/?foo=bar',
      stats: 'Showing 1-1 of 1',
      addedEntries: 2,
    })
    expect(await methods(page, p2Env)).toEqual([
      ['replaceState', '<origin>/data-providers/?foo=bar'],
      ['pushState', '<origin>/data-providers/?q=&size=10'],
      ['pushState', '<origin>/data-providers/?q=aberystwyth&size=10'],
      ['popstate', '<origin>/data-providers/?foo=bar'],
      ['replaceState', '<origin>/data-providers/?foo=bar'],
    ])
  })

  test('T-722 c1 @P0 R5: navigate away and back with a different ?q= shows the old query (client revisit)', async ({
    page,
    p2Env,
  }) => {
    const flow = await revisitFlow(page, p2Env)
    // the user asked for birkbeck (2 providers) and sees aberystwyth (1): the URL was rewritten to the old query
    expect(flow.view).toEqual({
      url: '/data-providers/?q=aberystwyth&size=10',
      title: TITLE,
      headerInput: '',
      stats: 'Showing 1-1 of 1',
      addForm: false,
      addedEntries: 4,
    })
  })

  test('T-722 c2 @P0 Q-048.U3 a client revisit keeps the old params and rewrites the URL to the old query', async ({
    page,
    p2Env,
  }) => {
    const flow = await revisitFlow(page, p2Env)
    // the navigation away is to a page without getServerSideProps: the 3 internal GETs of Q-011
    expect(flow.awayRequests).toEqual([
      ['api', 'GET', 'https://api.core.ac.uk/internal/members', 200],
      [
        'api',
        'GET',
        'https://api.core.ac.uk/internal/repositories/formap',
        200,
      ],
      ['api', 'GET', 'https://api.core.ac.uk/internal/statistics', 200],
    ])
    // the revisit is a gSSP page: its data request only; the store was extended once, so the page renders
    // with q=aberystwyth and the first sync of the remount pushes the old query over the requested one
    expect(flow.revisitRequests).toEqual([
      [
        'next-data',
        'GET',
        '/search/_next/data/<buildId>/data-providers.json?q=birkbeck',
        200,
      ],
    ])
    expect(flow.methods).toEqual([
      ['replaceState', '<origin>/data-providers/'],
      ['replaceState', '<origin>/data-providers/?q=&size=10'],
      ['pushState', '<origin>/data-providers/?q=aberystwyth&size=10'],
      ['pushState', '<origin>/outputs/update/'],
      ['pushState', '<origin>/data-providers/?q=birkbeck'],
      ['pushState', '<origin>/data-providers/?q=aberystwyth&size=10'],
    ])
  })

  test('T-722 c3 @P0 history.length: a plain load adds no entry (first sync replaces)', async ({
    page,
    p2Env,
  }) => {
    await openProviders(page, p2Env)
    expect(await view(page, p2Env)).toMatchObject({
      url: '/data-providers/?q=&size=10',
      addedEntries: 0,
    })
    expect((await historyOf(page, p2Env)).map((h) => h.method)).toEqual([
      'replaceState',
      'replaceState',
    ])
  })

  test('T-722 c3 @P0 history.length: one entry per user change, none for Back and Forward', async ({
    page,
    p2Env,
  }) => {
    const { tracker } = await openProviders(page, p2Env)
    const added = []
    const record = async (name, fn, path) => {
      await fn()
      await urlIs(page, p2Env, path)
      await settle(page, tracker)
      added.push([name, (await view(page, p2Env)).addedEntries])
    }
    await record(
      'query',
      () => enterQuery(page, 'birkbeck'),
      '/data-providers/?q=birkbeck&size=10'
    )
    await record(
      'another query',
      () => enterQuery(page, 'aberystwyth'),
      '/data-providers/?q=aberystwyth&size=10'
    )
    await record(
      'no results',
      () => enterQuery(page, 'zzzqqq'),
      '/data-providers/?action=ADD&q=zzzqqq&size=10'
    )
    await record(
      'Back',
      () => page.goBack(),
      '/data-providers/?q=aberystwyth&size=10'
    )
    await record(
      'Back',
      () => page.goBack(),
      '/data-providers/?q=birkbeck&size=10'
    )
    await record(
      'Forward',
      () => page.goForward(),
      '/data-providers/?q=aberystwyth&size=10'
    )
    expect(added).toEqual([
      ['query', 1],
      ['another query', 2],
      ['no results', 3],
      ['Back', 3],
      ['Back', 3],
      ['Forward', 3],
    ])
  })

  test('T-722 c3 @P0 history.length: a load whose URL has a query pushes its first sync', async ({
    page,
    p2Env,
  }) => {
    await openProviders(page, p2Env, '/data-providers/?q=birkbeck')
    // the URL already has a search, so setUrlParams calls router.push, not replace (R-018 pins the plain
    // load above; this is the other branch)
    expect(await view(page, p2Env)).toMatchObject({
      url: '/data-providers/?q=birkbeck&size=10',
      stats: 'Showing 1-2 of 2',
      addedEntries: 1,
    })
    expect(await methods(page, p2Env)).toEqual([
      ['replaceState', '<origin>/data-providers/?q=birkbeck'],
      ['pushState', '<origin>/data-providers/?q=birkbeck&size=10'],
    ])
  })
})
