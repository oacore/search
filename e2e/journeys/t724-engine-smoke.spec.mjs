// T-724 (41 H; R-032, R-065, R-077): engine smoke, J1, J5 and J12 (findings/07 §3 with the 41 §2.4
// corrections) in every engine: tagged @engines, so the chromium project runs them here and the runner's
// webkit and firefox projects run them with the same title (playwright.config.mjs, runner only). The third
// leg, "one engine at the T-015 floor" (an old browser build at the floor of the Next version, R-077), needs a
// browser download that is not approved: DEFERRED (issue P1-06-2). The guard fails each journey on a page
// error, a console error outside the allow-list, a window error, a CSP violation or a failed asset, so a
// polyfill or syntax gap of an engine (R-065, R-077) or a second React copy (R-032) shows up as a red journey.
//   J1  /search/?q=climate: status 200, title, count line, 10 result cards with title links; the header search
//       replaces the results (URL /search/?q=machine+learning&page=1, input kept).
//   J5  /search/?q=climate&page=2&sort=recent: the first result title is a full navigation to its works page
//       (title "<title> - CORE", h1); Back returns to the search URL with its results and sort label. The
//       search page logs the design's KaTeX console.error for `\sb2` in one abstract (T-741 pin
//       katex-convert, Q-097): the journey declares the console check expected and asserts that those lines
//       are the only console errors.
//   J12 /data-providers/: the URL becomes ?q=&size=10, 10 provider cards and the ItemList JSON-LD with 10
//       items, the map's clusters; Load more writes size=20 (20 cards); the header search lists 10
//       suggestions for "open univ" and Enter filters the list (16 providers).
import { test, expect } from '../fixtures/guard.mjs'
import {
  TEST_TIMEOUT,
  NAV_TIMEOUT,
  slow,
  openAt,
  quiet,
  appQuiet,
  track,
  watchRouter,
  waitHydrated,
  rel,
} from '../lib/P1-06/page.mjs'
import { headerSearch, providersSearch } from '../lib/P1-06/states.mjs'
import { answer } from '../lib/P1-06/fixtures.mjs'

test.use({ cookieState: 'essential' })

const KATEX = /^couldn`t convert string /
const showing = (page) => page.getByText(/^Showing \d/).first()

// result cards of a search page: the title links to works pages
const resultLinks = (page) =>
  page
    .locator('#__next a[href*="/works/"]')
    .evaluateAll((as) =>
      as
        .filter((a) => a.closest('h3, h2, [class*="title"]'))
        .map((a) => a.getAttribute('href'))
    )

test.describe('T-724 engine smoke', () => {
  test.describe.configure({ timeout: TEST_TIMEOUT })

  test('T-724 @P1 @engines J1 search -> results, header search replaces the results', async ({
    page,
    p2Env,
    resolver,
  }) => {
    const climate = answer(resolver, { q: 'climate' })
    const { tracker, response } = await openAt(page, '/search/?q=climate', 1440)
    expect(response.status()).toBe(200)
    await expect(page).toHaveTitle('Search CORE')
    await slow(page.getByText(climate.hits)).toBeVisible()
    const links = await resultLinks(page)
    expect(links).toHaveLength(10)
    expect(links.map((h) => h.split('/works/')[1].split('/')[0])).toEqual(
      climate.ids
    )
    const input = headerSearch(page)
    await expect(input).toHaveValue('climate')

    const ml = answer(resolver, { q: 'machine learning' })
    await appQuiet(p2Env)
    await input.fill('machine learning')
    await input.press('Enter')
    await slow(page).toHaveURL(
      `${p2Env.baseURL}/search/?q=machine+learning&page=1`,
      { timeout: NAV_TIMEOUT }
    )
    await slow(page.getByText(ml.hits)).toBeVisible()
    await quiet(page, tracker)
    const after = await resultLinks(page)
    expect(after.map((h) => h.split('/works/')[1].split('/')[0])).toEqual(
      ml.ids
    )
    await expect(input).toHaveValue('machine learning')
  })

  test('T-724 @P1 @engines J5 search -> work (full navigation) -> Back', async ({
    page,
    p2Env,
    guardLog,
  }) => {
    test
      .info()
      .annotations.push({ type: 'guard-expect', description: 'console' })
    const START = '/search/?q=climate&page=2&sort=recent'
    await openAt(page, START, 1440)
    await slow(page.getByText(/^Sort by /).first()).toHaveText('Sort by recent')
    const links = await resultLinks(page)
    expect(links).toHaveLength(10)
    const first = page.locator(`#__next a[href="${links[0]}"]`).first()
    const target = new URL(links[0], p2Env.baseURL)
    // the title link is the absolute display URL of the fixture, served from the stack (40 §2.4)
    expect(target.origin).toBe(new URL(p2Env.baseURL).origin)
    expect(target.pathname).toMatch(/^\/works\/\d+\/$/)
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url() === target.href, {
        timeout: NAV_TIMEOUT,
      }),
      first.click(),
    ])
    expect(res.request().isNavigationRequest()).toBe(true)
    expect(res.status()).toBe(200)
    await slow(page).toHaveURL(target.href, { timeout: NAV_TIMEOUT })
    await waitHydrated(page)
    const workTracker = track(page)
    await watchRouter(page)
    await quiet(page, workTracker)
    const h1 = (await page.locator('h1').first().innerText()).trim()
    expect(h1.length).toBeGreaterThan(0)
    await expect(page).toHaveTitle(`${h1} - CORE`)

    await page.goBack({ timeout: NAV_TIMEOUT })
    await slow(page).toHaveURL(`${p2Env.baseURL}${START}`, {
      timeout: NAV_TIMEOUT,
    })
    await waitHydrated(page)
    const backTracker = track(page)
    await watchRouter(page)
    await quiet(page, backTracker)
    await slow(page.getByText(/^Sort by /).first()).toHaveText('Sort by recent')
    expect(await resultLinks(page)).toEqual(links)
    expect(rel(p2Env, page.url())).toBe(START)
    // the only console errors are the design's KaTeX lines of the search page loads
    expect(guardLog.pageErrors).toEqual([])
    expect(guardLog.windowErrors).toEqual([])
    const texts = guardLog.consoleErrors.map((e) => e.text)
    expect(texts.length).toBeGreaterThan(0)
    expect(texts.filter((t) => !KATEX.test(t))).toEqual([])
    expect(guardLog.consoleErrors.every((e) => e.url.endsWith(START))).toBe(
      true
    )
  })

  test('T-724 @P1 @engines J12 providers directory: list, JSON-LD, map, Load more, suggestions, search', async ({
    page,
    p2Env,
  }) => {
    const { tracker } = await openAt(page, '/data-providers/', 1440)
    await slow(page).toHaveURL(`${p2Env.baseURL}/data-providers/?q=&size=10`)
    await expect(page).toHaveTitle('Data providers search')
    await slow(showing(page)).toHaveText('Showing 1-10 of 15,672')
    const cards = page.locator('#__next a[href^="/data-providers/"]')
    await expect(cards).toHaveCount(10)
    const head = await page.evaluate(() => {
      const ld = [
        ...document.querySelectorAll('script[type="application/ld+json"]'),
      ].map((s) => JSON.parse(s.textContent))
      const graph = ld.flatMap((j) => j['@graph'] || [j])
      const page = graph.find((g) => g['@type'] === 'SearchResultsPage')
      return {
        description: document
          .querySelector('meta[name="description"]')
          .getAttribute('content'),
        items: page ? page.mainEntity.itemListElement.length : null,
      }
    })
    expect(head).toEqual({
      description:
        'Search over 15672 repositories and journals around the world',
      items: 10,
    })
    await expect(page.locator('.leaflet-container')).toHaveCount(1)
    await slow
      .poll(() => page.locator('.marker-cluster').count())
      .toBeGreaterThan(0)

    // Load more: size=20, 20 cards
    await page.getByRole('button', { name: 'Load more' }).click()
    await slow(page).toHaveURL(`${p2Env.baseURL}/data-providers/?q=&size=20`)
    await slow(showing(page)).toHaveText('Showing 1-20 of 15,672')
    await expect(cards).toHaveCount(20)
    await quiet(page, tracker)

    // the header search: suggestions while typing, Enter filters the list (the label overlays the input,
    // Q-083: the input is focused through its label)
    await page.locator('label[for="select-app-bar-search"]').click()
    await expect(providersSearch(page)).toBeFocused()
    await page.keyboard.type('open univ')
    const options = page.locator(
      '[id^="suggestion-results"] li, [role="option"]'
    )
    await slow.poll(() => options.count()).toBe(10)
    await page.keyboard.press('Enter')
    await slow(page).toHaveURL(
      `${p2Env.baseURL}/data-providers/?q=open+univ&size=20`
    )
    await slow(showing(page)).toHaveText('Showing 1-16 of 16')
    await quiet(page, tracker)
    await expect(page).toHaveTitle('Data providers search')
  })
})
