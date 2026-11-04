// T-707 (41 H, J5, R-051): search -> open the first result's work page -> Back. Pins today's behaviour
// exactly, quirks included:
//   - the start page /search/?q=climate&page=2&sort=recent: ten result links built with the unencoded query
//     (`search=q=climate&page=2&sort=recent`, Q-012);
//   - the click is a full navigation to the absolute display URL (the fixtures give `https://core.ac.uk/works/<id>`,
//     the resolver rewrites it to the gateway origin, 40 §2.4): one document request, no _next/data, the page's
//     `window` is gone;
//   - the work page: title `<title> - CORE`, authors, date, publisher; the "Search results" back-link carries the
//     SSR-re-encoded asPath (`?q%3Dclimate&page=2&sort=recent`) and hydration does not patch it (Q-076); the DOI
//     list exists only after hydration (Q-062); without `search=` the back-link is `slice(6)` of asPath (Q-046);
//   - author links point to https://core.ac.uk/search?q=authors:(...), which the gateway answers 308 to the
//     trailing-slash URL;
//   - Back reloads the search page (a new document): same URL, results, sort label; history log, history.length
//     and scroll position are provisional baselines (= B0 at 2.5);
//   - the header search of a work page pushes the raw string `/search?q=<term>` (Q-012, R-051).
// The search page prints the design's KaTeX console.error twice per hard load (`\sb2` in one abstract, T-741 pin
// katex-convert): the journey declares the guard's console check expected and asserts exactly those lines.
import { test, expect } from '../lib/P0-14/fixtures.mjs'
import {
  appOnly,
  netLog,
  rel,
  settle,
  stableJson,
  trackPage,
  watchRouter,
  ACTION_TIMEOUT,
  NAV_TIMEOUT,
  TEST_TIMEOUT,
} from '../lib/P0-14/page.mjs'
import {
  HITS,
  RESULT_IDS,
  SEARCH_ID,
  START,
  WORK_ID,
  WORK_PATH,
  WORK_TITLE,
  expectKatexOnly,
  searchView,
  workView,
} from '../lib/P0-14/j5.mjs'

// a hard load of these pages can take tens of seconds on a loaded machine (40 §5: timeouts, never retries)
test.use({ navigationTimeout: NAV_TIMEOUT, actionTimeout: ACTION_TIMEOUT })

const AUTHORS = [
  ['Annalisa Savaresi', 'Annalisa Savaresi'],
  ['Mikko Rajavuori', 'Mikko Rajavuori'],
  ['Rajavuori, Mikko', 'Mikko Rajavuori'],
  ['Harro van Asselt', 'Harro van Asselt'],
  ['van Asselt, Harro', 'Harro van Asselt'],
  ['Savaresi, Annalisa', 'Annalisa Savaresi'],
].map(([name, text]) => [`https://core.ac.uk/search?q=authors:(${name})`, text])

const resultHref = (origin, id) =>
  `${origin}/works/${id}/?t=${SEARCH_ID}-${id}&search=q=climate&page=2&sort=recent`

test.describe('T-707 @P0 J5 search -> work -> Back', () => {
  // two hard loads of the search page and one of the work page, on a machine that runs other stacks too
  test.describe.configure({ timeout: TEST_TIMEOUT })

  test('T-707 @P0 J5: first result = full navigation to the absolute display URL, work page, Back', async ({
    page,
    p2Env,
    guardLog,
    request,
  }) => {
    test
      .info()
      .annotations.push({ type: 'guard-expect', description: 'console' })
    const origin = new URL(p2Env.baseURL).origin
    const log = netLog(page, p2Env)
    const tracker = trackPage(page)

    // ---- the start page ----
    const mStart = log.mark()
    await page.goto(START)
    await watchRouter(page)
    await settle(page, tracker)
    const start = await searchView(page, p2Env)
    expect(start).toMatchObject({
      url: START,
      title: 'Search CORE',
      hits: 1,
      sort: 'Sort by recent',
      clearAllFilters: 0,
      addedEntries: 0,
      scrollY: 0,
      scrollRestoration: 'auto',
    })
    // Q-012: ten result links, each with the unencoded query of the page (`search=q=climate&page=2&sort=recent`)
    expect(start.resultLinks.map((l) => l.href)).toEqual(
      RESULT_IDS.map((id) => resultHref(origin, id))
    )
    expect(start.history.map((h) => [h.method, h.url])).toEqual([
      ['replaceState', `<origin>${START}`],
    ])
    const startRequests = appOnly(log.since(mStart))

    // ---- the click: a full navigation ----
    const link = page.locator(`#__next a[href*="/works/${WORK_ID}/"]`).first()
    await expect(link).toHaveAttribute('href', resultHref(origin, WORK_ID))
    // the title link of the first result card
    await expect(link).toContainText(
      'An Analysis of the Relationship Between School-Based Management'
    )
    await page.evaluate(() => {
      window.__marker = 'T-707'
    })
    const mWork = log.mark()
    const target = `${origin}${WORK_PATH}`
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url() === target),
      link.click(),
    ])
    expect(res.request().isNavigationRequest()).toBe(true)
    expect(res.status()).toBe(200)
    await expect(page).toHaveURL(target, { timeout: NAV_TIMEOUT })
    await watchRouter(page)
    await settle(page, tracker)
    expect(await page.evaluate(() => window.__marker)).toBeUndefined()
    const workRequests = appOnly(log.since(mWork))
    // one document request, none for _next/data: the click left the document
    expect(
      workRequests
        .filter((e) => e.kind === 'document' || e.kind === 'next-data')
        .map((e) => [e.kind, e.method, rel(p2Env, e.url), e.status])
    ).toEqual([['document', 'GET', WORK_PATH, 200]])

    // ---- the work page: SSR bytes against the settled page ----
    const ssr = await (await request.get(WORK_PATH)).text()
    const ssrBackLink = ssr.match(
      /<a href="([^"]*)"[^>]*>Search results<\/a>/
    )[1]
    // Q-076: the server builds the back-link from its re-encoded asPath; the HTML escapes the ampersands
    expect(ssrBackLink).toBe(
      'https://core.ac.uk/search/?q%3Dclimate&amp;page=2&amp;sort=recent'
    )
    // Q-062: the DOI label is there, the list is empty until the mount effect has run
    expect(ssr.match(/DOI: /g)).toBeNull()
    expect(ssr).toContain('<dt id="doi-title">Doi</dt>')
    const work = await workView(page, p2Env)
    expect(work).toMatchObject({
      url: WORK_PATH,
      title: `${WORK_TITLE} - CORE`,
      h1: WORK_TITLE,
      date: '14 March 2023',
      publisher: 'Wiley',
      doiLabel: 'Doi',
      // Q-062: after hydration the list holds the work DOI once (the three outputs carry the same DOI)
      doi: ['DOI: 10.1111/REGO.12518'],
      addedEntries: 0,
    })
    expect(work.authors).toEqual(AUTHORS)
    await expect(page.getByRole('heading', { name: 'Abstract' })).toBeVisible()
    // Q-076: the settled DOM keeps the server's href; the client would have built another one from its own asPath
    const clientBuilt = await page.evaluate(() => {
      const p = window.next.router.asPath
      return `https://core.ac.uk/search/?${p.slice(p.indexOf('search=') + 7)}`
    })
    expect(clientBuilt).toBe(
      'https://core.ac.uk/search/?q=climate&page=2&sort=recent'
    )
    expect(work.backLink).toBe(
      'https://core.ac.uk/search/?q%3Dclimate&page=2&sort=recent'
    )
    expect(work.backLink).not.toBe(clientBuilt)
    expect(work.history.map((h) => [h.method, h.url])).toEqual([
      ['replaceState', `<origin>${WORK_PATH}`],
    ])

    // ---- Back: a new document of the start page ----
    const mBack = log.mark()
    await page.goBack()
    await expect(page).toHaveURL(`${origin}${START}`, { timeout: NAV_TIMEOUT })
    await watchRouter(page)
    await settle(page, tracker)
    expect(await page.evaluate(() => window.__marker)).toBeUndefined()
    const back = await searchView(page, p2Env)
    // J5: URL, results of page 2, sort label "recent", no filter highlighted - as before the click
    expect(back).toEqual(start)
    const backRequests = appOnly(log.since(mBack))
    expect(
      backRequests
        .filter((e) => e.kind === 'document' || e.kind === 'next-data')
        .map((e) => [e.kind, e.method, rel(p2Env, e.url), e.status])
    ).toEqual([['document', 'GET', START, 200]])
    await expect(page.getByText(HITS)).toBeVisible()

    // the KaTeX lines: three per hard load of the search page on React 18 (AD-167), none on the work page
    expectKatexOnly(guardLog, 3, 2) // AD-167

    // provisional baselines (B0 at 2.5): history log, history.length and scroll after each step, the app requests
    const buildId = await page.evaluate(() => window.__NEXT_DATA__.buildId)
    const norm = (list) =>
      list
        .filter((e) => e.kind !== 'third-party')
        .map((e) => ({
          kind: e.kind,
          method: e.method,
          url: rel(p2Env, e.url).split(buildId).join('<buildId>'),
          body: e.bodyText,
          status: e.status,
        }))
        .sort((a, b) =>
          `${a.kind} ${a.method} ${a.url} ${a.body}` <
          `${b.kind} ${b.method} ${b.url} ${b.body}`
            ? -1
            : 1
        )
    expect(
      stableJson({
        start: {
          history: start.history,
          addedEntries: start.addedEntries,
          scrollY: start.scrollY,
          scrollRestoration: start.scrollRestoration,
        },
        work: { history: work.history, addedEntries: work.addedEntries },
        back: {
          history: back.history,
          addedEntries: back.addedEntries,
          scrollY: back.scrollY,
          scrollRestoration: back.scrollRestoration,
        },
        requests: {
          start: norm(startRequests),
          work: norm(workRequests),
          back: norm(backRequests),
        },
      })
    ).toMatchSnapshot('t707-j5-history-and-requests.json')
  })
  test('T-707 @P0 author links go to core.ac.uk/search?q=authors:(...) and the gateway answers them 308', async ({
    request,
  }) => {
    const html = await (await request.get(WORK_PATH)).text()
    const hrefs = [
      ...html.matchAll(
        /<a href="(https:\/\/core\.ac\.uk\/search\?q=authors:\([^"]*\))"/g
      ),
    ].map((m) => m[1])
    expect(hrefs).toEqual(AUTHORS.map(([href]) => href))
    // the same path and query on the gateway (what core.ac.uk serves in production): the trailing-slash
    // redirect of the app, permanent, the query re-encoded (R-002)
    const redirects = []
    for (const href of hrefs) {
      const u = new URL(href)
      const res = await request.get(`${u.pathname}${u.search}`, {
        maxRedirects: 0,
      })
      redirects.push([res.status(), res.headers().location])
    }
    expect(redirects).toEqual([
      [308, '/search/?q=authors%3A(Annalisa%20Savaresi)'],
      [308, '/search/?q=authors%3A(Mikko%20Rajavuori)'],
      [308, '/search/?q=authors%3A(Rajavuori%2C%20Mikko)'],
      [308, '/search/?q=authors%3A(Harro%20van%20Asselt)'],
      [308, '/search/?q=authors%3A(van%20Asselt%2C%20Harro)'],
      [308, '/search/?q=authors%3A(Savaresi%2C%20Annalisa)'],
    ])
  })

  test('T-707 @P0 Q-046: without search= the back-link is slice(6) of asPath', async ({
    page,
    p2Env,
    request,
  }) => {
    const backLink = async (path) => {
      const html = await (await request.get(path)).text()
      return html.match(/<a href="([^"]*)"[^>]*>Search results<\/a>/)[1]
    }
    // '/works/1001/'.slice(6) = '/1001/', '/outputs/2001/'.slice(6) = 'ts/2001/': a nonsense query
    expect(await backLink('/works/1001/')).toBe(
      'https://core.ac.uk/search/?/1001/'
    )
    expect(await backLink('/outputs/2001/')).toBe(
      'https://core.ac.uk/search/?ts/2001/'
    )
    // hydrated: the same href (the effect-free render computes the same asPath on the client)
    const tracker = trackPage(page)
    await page.goto('/works/1001/')
    await watchRouter(page)
    await settle(page, tracker)
    await expect(
      page.getByRole('link', { name: 'Search results' })
    ).toHaveAttribute('href', 'https://core.ac.uk/search/?/1001/')
    expect(rel(p2Env, page.url())).toBe('/works/1001/')
  })

  test('T-707 @P0 Q-012: the work page header search pushes the raw string /search?q=<term>', async ({
    page,
  }) => {
    const tracker = trackPage(page)
    await page.goto('/works/1001/')
    await watchRouter(page)
    await settle(page, tracker)
    // the router would navigate to /search/ and, with an unrecorded query, fail; what is pinned is the push
    // argument (pages/works/[id].jsx:130), so the push is replaced by a recorder
    await page.evaluate(() => {
      window.__pushes = []
      window.next.router.push = (...args) => {
        window.__pushes.push(args)
        return Promise.resolve(true)
      }
    })
    await page.getByRole('button', { name: 'Search icon' }).first().click()
    const box = page.getByRole('combobox')
    await box.fill('C# & C++')
    await box.press('Enter')
    await expect
      .poll(() => page.evaluate(() => window.__pushes), {
        timeout: NAV_TIMEOUT,
      })
      .toEqual([['/search?q=C# & C++']])
  })
})
