// T-716 (41 H, J14, R-020, R-033; Q-002, Q-003, Q-001, Q-047, Q-010, Q-100). Error and empty states in the
// browser, as the app shows them today; the SSR failure matrix (500 pages) is J23 (T-731).
//   c1  J14 (41 §2.4): `/search/` without parameters answers 308 with `Location: /` (the gateway does not route `/`,
//       so the redirect is read without following it); the empty states of the search page (no hits, page past
//       1000, a network error: "no results"; an upstream error with a status: the error card with "Try again" to
//       `/`, and no header search bar); the soft 404s of works and outputs ("Uh-oh", HTTP 200, "Go to homepage",
//       "Go back" to the Referer on works); the app's own 404 pages (`/data-providers/<id>/` of a provider that
//       is not in the formap, `/search/foo/`, `/works/`);
//   c2  a client navigation from the data state of `/search/?q=climate` to the error state (header search for
//       `__status500`) and back (41 expects React #300 and a blank page here; see the note at the test: the app
//       renders the error card in place, no console error, and the way back works);
//   c3  Q-100: the header search of a hydrated works or outputs page crashes (React #300 through console.error,
//       blank #__next for a moment), and the search page renders after the boundary retried.
// Fixtures: search-zzzzqqq, search-climate, search-x(-page0), works-4040, outputs-4100, provider-999999999 /
// 503 (404), works-1001, outputs-2001, members.
import { test, expect } from '../lib/P1-05/fixtures.mjs'
import {
  NAV_TIMEOUT,
  TEST_TIMEOUT,
  buildIdOf,
  firstLine,
  historySince,
  netLog,
  pageConsole,
  rel,
  requestsOf,
  routerEvents,
  settle,
  trackPage,
  watchRouter,
} from '../lib/P1-05/page.mjs'
import { declareCrash, expectClean, expectCrash } from '../lib/P1-05/crash.mjs'

test.use({
  cookieState: 'essential',
  navigationTimeout: NAV_TIMEOUT,
  actionTimeout: 60000,
})

const TITLE = 'CORE – Aggregating the world’s open access research papers'
const NOT_FOUND_LOG =
  'Failed to load resource: the server responded with a status of 404 (Not Found)'
const HEADER_INPUT = 'select-app-bar-search'

// the visible state of an error or empty page, read in the page
const shown = (page) =>
  page.evaluate(() => {
    const text = (el) => el.textContent.replace(/\s+/g, ' ').trim()
    const main = document.querySelector('#__next main') || document.body
    return {
      title: document.title,
      headings: [...main.querySelectorAll('h1, h2, h3')].map(text),
      paragraphs: [...main.querySelectorAll('p, span')]
        .filter((e) => e.children.length === 0)
        .map(text)
        .filter(Boolean),
      links: [...main.querySelectorAll('a')].map((a) => [
        text(a),
        a.getAttribute('href'),
      ]),
      images: [...main.querySelectorAll('img')].map((i) => i.alt),
      headerInputs: [...document.querySelectorAll('header input')].map(
        (i) => i.id
      ),
    }
  })

const declareNotFoundLog = (testObj) =>
  testObj
    .info()
    .annotations.push({ type: 'guard-expect', description: 'console' })

const only404 = (guardLog) =>
  expect(
    pageConsole(guardLog)
      .filter((c) => c.type === 'error')
      .map((c) => firstLine(c.text))
  ).toEqual([NOT_FOUND_LOG])

const NO_RESULTS = (q) => ({
  title: TITLE,
  headings: [`Sorry, we couldn’t find any results for “${q}”.`],
  paragraphs: [
    'Double check your search request for any spelling errors or try a different search term.',
  ],
  links: [],
  images: ['No results found'],
  headerInputs: [HEADER_INPUT],
})

const UH_OH = (message, first) => ({
  title: TITLE,
  headings: ['Uh-oh'],
  paragraphs: [message],
  links: [first, ['Contact us', '/contact']],
  images: [],
})

test.describe('T-716 @P1 J14 error and empty states', () => {
  test.describe.configure({ timeout: TEST_TIMEOUT })

  test('T-716 c1 @P1 /search/ without parameters: 308 to / (Q-002)', async ({
    request,
    p2Env,
  }) => {
    const res = await request.get(`${p2Env.baseURL}/search/`, {
      maxRedirects: 0,
    })
    expect(res.status()).toBe(308)
    expect(res.headers().location).toBe('/')
    // the same for a query string that is empty after parsing
    const res2 = await request.get(`${p2Env.baseURL}/search`, {
      maxRedirects: 0,
    })
    expect([res2.status(), res2.headers().location]).toEqual([308, '/search/'])
  })

  for (const c of [
    {
      path: '/search/?q=zzzzqqq',
      what: 'no hits: the empty state',
      want: NO_RESULTS('zzzzqqq'),
    },
    {
      path: '/search/?q=x&page=1001',
      what: 'page past 1000: the empty state, no search call',
      want: NO_RESULTS('x'),
    },
    {
      path: '/search/?q=__neterror',
      what: 'network error: shown as "no results" (Q-003)',
      want: NO_RESULTS('__neterror'),
    },
    {
      path: '/search/?q=__status500',
      what: 'upstream 500: the error card, no header search bar (Q-003)',
      want: {
        title: TITLE,
        headings: [
          'This page is not available now. Try again in a few minutes.',
        ],
        paragraphs: [
          'Our team is already working to resolve this issue as soon as possible.',
        ],
        links: [['Try again', '/']],
        images: ['img'],
        headerInputs: [],
      },
    },
  ])
    test(`T-716 c1 @P1 ${c.path}: ${c.what}`, async ({ page }) => {
      const res = await page.goto(c.path)
      expect(res.status()).toBe(200)
      const tracker = trackPage(page)
      await watchRouter(page)
      await settle(page, tracker)
      expect(await shown(page)).toEqual(c.want)
    })

  for (const c of [
    {
      path: '/works/4040/',
      status: 200,
      what: 'soft 404 (Q-001): "Uh-oh", HTTP 200',
      message: 'The page you were looking for could not be found',
    },
    {
      path: '/outputs/4100/',
      status: 200,
      what: 'disabled output: "Uh-oh", HTTP 200',
      message: 'The article with ID 4100 has been disabled',
    },
  ])
    test(`T-716 c1 @P1 ${c.path}: ${c.what}`, async ({ page }) => {
      const res = await page.goto(c.path)
      expect(res.status()).toBe(c.status)
      const tracker = trackPage(page)
      await watchRouter(page)
      await settle(page, tracker)
      expect(await shown(page)).toEqual({
        ...UH_OH(c.message, ['Go to homepage', '/']),
        // the works and outputs pages keep the collapsed header search
        headerInputs: [],
      })
      await expect(
        page.getByRole('button', { name: 'Search icon' })
      ).toBeVisible()
    })

  test('T-716 c1 @P1 /works/4040/ with a Referer: "Go back" points at the Referer', async ({
    page,
    p2Env,
  }) => {
    const referer = `${p2Env.baseURL}/search/?q=climate`
    const res = await page.goto('/works/4040/', { referer })
    expect(res.status()).toBe(200)
    const tracker = trackPage(page)
    await watchRouter(page)
    await settle(page, tracker)
    const s = await shown(page)
    expect(s.links).toEqual([
      ['Go back', referer],
      ['Contact us', '/contact'],
    ])
  })

  for (const c of [
    { path: '/data-providers/999999999/', what: 'provider not in the formap' },
    {
      path: '/data-providers/503/',
      what: 'provider 503 is not in the snapshot formap',
    },
    { path: '/search/foo/', what: 'unknown path under /search' },
    { path: '/works/', what: 'works without an id' },
  ])
    test(`T-716 c1 @P1 ${c.path}: ${c.what}: the app's 404 page`, async ({
      page,
      guardLog,
    }) => {
      declareNotFoundLog(test)
      const res = await page.goto(c.path)
      expect(res.status()).toBe(404)
      const tracker = trackPage(page)
      await watchRouter(page)
      await settle(page, tracker)
      expect(await shown(page)).toEqual({
        ...UH_OH('The page you were looking for could not be found', [
          'Go to homepage',
          '/',
        ]),
        headerInputs: [],
      })
      // the document load itself is the one console error (Chromium reports the 404 status)
      only404(guardLog)
    })

  test('T-716 c2 @P1 /search/?q=climate: header search for __status500 (client navigation) shows the error card in place, the way back works (R-033, Q-047, Q-010)', async ({
    page,
    p2Env,
    guardLog,
  }) => {
    // NOTE (plan correction): 41 expects the hooks-order crash (React #300, blank #__next) here. On the unchanged
    // app the data -> error transition renders without a console error: React 17 only reports "fewer hooks"
    // when the previous render had hooks left over, and the early return of pages/search/index.jsx:118 skips
    // all of them; the way back (error -> data) mounts the hooks fresh. The crash is the works/outputs ->
    // search transition (c3).
    const tracker = trackPage(page)
    const log = netLog(page, p2Env)
    await page.goto('/search/?q=climate')
    await watchRouter(page)
    await settle(page, tracker)
    const buildId = await buildIdOf(page)
    await page.evaluate(() => {
      window.__marker = 'survives'
    })
    const box = page.getByRole('combobox', {
      name: /from papers around the world$/,
    })
    await expect(page.getByText(/research outputs found/)).toBeVisible()
    const histBefore = (await historySince(page, p2Env)).length

    // data -> error
    let m = log.mark()
    await box.fill('__status500')
    await box.press('Enter')
    await expect(page).toHaveURL(
      `${p2Env.baseURL}/search/?q=__status500&page=1`,
      { timeout: NAV_TIMEOUT }
    )
    await settle(page, tracker)
    await expect(
      page.getByText(
        'This page is not available now. Try again in a few minutes.'
      )
    ).toBeVisible()
    // in place: no document, one _next/data request, the marker survives; no crash
    expect(requestsOf(p2Env, buildId, log.since(m))).toEqual([
      [
        'next-data',
        'GET',
        '/search/_next/data/<buildId>/search.json?q=__status500&page=1',
        200,
      ],
    ])
    expect(await page.evaluate(() => window.__marker)).toBe('survives')
    expect(
      await page.evaluate(
        () => document.querySelector('#__next').children.length
      )
    ).toBe(1)
    expectClean(guardLog)
    // the early return skips the header search hook: the bar keeps the typed text
    expect(await shown(page)).toMatchObject({
      headings: ['This page is not available now. Try again in a few minutes.'],
      links: [['Try again', '/']],
      headerInputs: [HEADER_INPUT],
    })
    await expect(box).toHaveValue('__status500')

    // error -> data
    m = log.mark()
    await box.fill('climate')
    await box.press('Enter')
    await expect(page).toHaveURL(`${p2Env.baseURL}/search/?q=climate&page=1`, {
      timeout: NAV_TIMEOUT,
    })
    await settle(page, tracker)
    await expect(page.getByText(/research outputs found/)).toBeVisible()
    expect(
      requestsOf(p2Env, buildId, log.since(m)).filter(
        ([, , url]) => !/\/data-providers\/\d+\/logo$/.test(url)
      )
    ).toEqual([
      ['api', 'POST', 'https://api.core.ac.uk/v3/search/works/aggregate', 200],
      [
        'next-data',
        'GET',
        '/search/_next/data/<buildId>/search.json?q=climate&page=1',
        200,
      ],
    ])
    expect(await page.evaluate(() => window.__marker)).toBe('survives')
    expectClean(guardLog)
    expect(
      (await routerEvents(page)).map(([n, u]) => [n, rel(p2Env, u)])
    ).toEqual([
      ['routeChangeStart', '/search/?q=__status500&page=1'],
      ['routeChangeComplete', '/search/?q=__status500&page=1'],
      ['routeChangeStart', '/search/?q=climate&page=1'],
      ['routeChangeComplete', '/search/?q=climate&page=1'],
    ])
    expect(
      (await historySince(page, p2Env, histBefore)).map((h) => [
        h.method,
        h.url,
      ])
    ).toEqual([
      ['pushState', '/search/?q=__status500&page=1'],
      ['pushState', '/search/?q=climate&page=1'],
    ])
  })

  for (const c of [
    { name: 'works', start: '/works/1001/' },
    { name: 'outputs', start: '/outputs/2001/' },
  ])
    test(`T-716 c3 @P1 ${c.name} page: the header search crashes with React #300, #__next is emptied once and the search page renders (Q-100)`, async ({
      page,
      p2Env,
      guardLog,
    }) => {
      declareCrash(test)
      const tracker = trackPage(page)
      await page.goto(c.start)
      await watchRouter(page)
      await settle(page, tracker)
      await page.evaluate(() => {
        window.__marker = 'survives'
        window.__sizes = []
        new MutationObserver(() => {
          const n = document.querySelector('#__next')
          window.__sizes.push(n ? n.innerHTML.length : -1)
        }).observe(document.body, { subtree: true, childList: true })
      })
      const consoleFrom = guardLog.console.length
      await page.getByRole('button', { name: 'Search icon' }).click()
      const box = page.getByRole('combobox')
      await box.fill('climate')
      await page.evaluate(() => {
        window.__sizes = []
      })
      await box.press('Enter')
      await expect(page).toHaveURL(`${p2Env.baseURL}/search/?q=climate`, {
        timeout: NAV_TIMEOUT,
      })
      await settle(page, tracker)
      await expect(page.getByText(/research outputs found/)).toBeVisible()
      // the crash and the retry: #__next held nothing for a moment, then the search page
      const sizes = await page.evaluate(() => window.__sizes)
      expect(Math.min(...sizes)).toBe(0)
      expect(sizes[sizes.length - 1]).toBeGreaterThan(0)
      expect(await page.evaluate(() => window.__marker)).toBe('survives')
      expectCrash(guardLog, consoleFrom)
      expect(await page.title()).toBe('Search CORE')
    })
})
