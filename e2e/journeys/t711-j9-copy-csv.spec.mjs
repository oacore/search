// T-711 (41 H, J9, Q-077, R-028): copy the search link and download the results as CSV on /search/?q=climate,
// as it behaves today (findings/07 §2.6, §2.7, §3 J9, review:ui-flows §4.1 J9):
//   - the share icon writes `https://core.ac.uk` + the router's asPath to the clipboard and shows "Link copied"
//     for exactly 2,500 ms: the clock is installed (page.clock.install does not freeze it), paused, and
//     advanced by runFor (40 §5 timer journeys);
//   - the download icon opens the CSV modal (aria-label "Download results in cvs modal", hideManually: no
//     Close X, Esc does nothing) with three size cards, "Current page" highlighted; Cancel closes it without
//     a request; "Top 100 results" + Download sends E3 `{q, accept: 'text/csv', limit: 100}` once, closes the
//     modal before the answer arrives (Q-056) and downloads the answer as results.csv;
//   - Q-077: reopened, the modal highlights "Current page" again, but Download sends the last choice (100).
//   - from a filtered search (/search/?q=climate AND documentType:"thesis"), Download sends the whole query, the
//     facet clause included, as the E3 body `q` (store/search.js:122); the CSV answer of that body is not
//     recorded, so the recorded answer of the same body for "climate" stands in for it at a page route.
// The share and download buttons have no accessible name (an icon only, the tooltip is a separate popover):
// they are located by their sprite icon.
// Fixtures: search-climate (also the thesis page), search-csv (E3 limit 10 / 100 answered 200 text/csv), members.
import { test } from '../fixtures/guard.mjs'
import { installClock } from '../fixtures/guard.mjs'
import {
  expect,
  open,
  netLog,
  holdRequests,
  flushTasks,
  sha256,
  ACTION_TIMEOUT,
  NAV_TIMEOUT,
  TEST_TIMEOUT,
  API,
} from '../lib/P1-04/page.mjs'

test.use({
  navigationTimeout: NAV_TIMEOUT,
  actionTimeout: ACTION_TIMEOUT,
  cookieState: 'essential',
})
test.describe.configure({ timeout: TEST_TIMEOUT })

const E3_URL = `${API}/v3/search/works`
const e3Body = (limit, q = 'climate') =>
  JSON.stringify({ q, accept: 'text/csv', limit })
const THESIS = 'climate AND documentType:"thesis"'
const isE3 = (e) =>
  e.method === 'POST' &&
  e.url === E3_URL &&
  (e.bodyText || '').includes('"accept":"text/csv"')
const CSV_HEADER = '"workID","oaiID","doi","title","authors","createdDate"'
const SIZES = [
  'Current page',
  'Top 100 results',
  'All the results (up to 1,000)',
]

const shareButton = (page) =>
  page.locator('button:has(use[href$="#share-variant"])')
const downloadButton = (page) =>
  page.locator('button:has(use[href$="#download"])')
const csvModal = (page) =>
  page.getByRole('dialog', { name: 'Download results in cvs modal' })
// the size cards of the design Fieldset with their highlight (box-item-active)
const sizeCards = (modal) =>
  modal.locator('fieldset [class*="fieldset-box-item"]').evaluateAll((els) =>
    els.map((e) => ({
      label: e.textContent.trim(),
      active: /fieldset-box-item-active/.test(e.className),
    }))
  )
const highlighted = (label) =>
  SIZES.map((l) => ({ label: l, active: l === label }))

test.describe('T-711 @P1 J9 copy link and CSV', () => {
  test('T-711 @P1 J9 share icon: clipboard = https://core.ac.uk/search/?q=climate, "Link copied" for exactly 2,500 ms on the advanced clock', async ({
    page,
    context,
    p2Env,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: new URL(p2Env.baseURL).origin,
    })
    // install() does not freeze time: the page runs on the installed clock until it is paused
    await installClock(page)
    await open(page, '/search/?q=climate')
    const toast = page.getByText('Link copied', { exact: true })
    await expect(toast).toHaveCount(0)
    const now = await page.evaluate(() => Date.now())
    // pause a few seconds ahead of the page's time (pauseAt cannot go back)
    await page.clock.pauseAt(now + 5000)
    await shareButton(page).click()
    await expect(toast).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'https://core.ac.uk/search/?q=climate'
    )
    // the hook's 2,500 ms timeout is scheduled by a passive effect after the toast renders
    await flushTasks(page)
    await page.clock.runFor(2499)
    await expect(toast).toBeVisible()
    await page.clock.runFor(1)
    await expect(toast).toHaveCount(0)
    await page.clock.resume()
    // a second copy shows the toast again
    await shareButton(page).click()
    await expect(toast).toBeVisible()
  })

  test('T-711 @P1 J9 CSV: hideManually modal, Cancel sends nothing, Top 100 sends E3 limit 100 and downloads results.csv after the modal closed (Q-056); reopened, "Current page" is highlighted but limit 100 is sent again (Q-077)', async ({
    page,
    p2Env,
    resolver,
  }) => {
    const log = netLog(page, p2Env)
    await open(page, '/search/?q=climate')
    const modal = csvModal(page)
    const e3 = () => log.entries.filter(isE3)

    // ---- open: title, text, three sizes, "Current page" highlighted, no Close X, Esc does nothing ----
    await downloadButton(page).click()
    await expect(modal).toBeVisible()
    await expect(modal.getByRole('heading', { level: 3 })).toHaveText(
      'Download results in CSV'
    )
    await expect(modal).toContainText(
      'By downloading the file you will receive the search results in a CSV format including the identifiers, title, authors and link to the CORE page.'
    )
    expect(await sizeCards(modal)).toEqual(highlighted('Current page'))
    await expect(modal.getByRole('button')).toHaveText(['Cancel', 'Download'])
    await expect(modal.getByRole('button', { name: 'Download' })).toBeEnabled()
    await expect(modal.locator('[aria-label="Close"]')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(modal).toBeVisible()

    // ---- Cancel: closed, no request ----
    await modal.getByRole('button', { name: 'Cancel' }).click()
    await expect(modal).toHaveCount(0)
    expect(e3()).toEqual([])

    // ---- Top 100 + Download: E3 limit 100; the modal closes before the answer (Q-056) ----
    await downloadButton(page).click()
    await expect(modal).toBeVisible()
    expect(await sizeCards(modal)).toEqual(highlighted('Current page'))
    await modal.getByText('Top 100 results', { exact: true }).click()
    expect(await sizeCards(modal)).toEqual(highlighted('Top 100 results'))
    const gate = await holdRequests(page, (u) => u.href === E3_URL)
    const downloaded = page.waitForEvent('download', { timeout: NAV_TIMEOUT })
    await modal.getByRole('button', { name: 'Download' }).click()
    await expect.poll(() => gate.count()).toBe(1)
    await expect(modal).toHaveCount(0)
    gate.release()
    const file = await downloaded
    expect(file.suggestedFilename()).toBe('results.csv')
    const bytes = await file
      .path()
      .then((p) => import('node:fs').then((fs) => fs.readFileSync(p)))
    expect(bytes.toString('utf8').split('\n')[0]).toBe(CSV_HEADER)
    // the file is the API's CSV answer, byte for byte
    const answer = resolver.resolve('POST', E3_URL, e3Body(100))
    expect(answer.status).toBe(200)
    expect(sha256(bytes)).toBe(sha256(answer.body))
    await expect
      .poll(() => e3().map((e) => [e.bodyText, e.status]))
      .toEqual([[e3Body(100), 200]])

    // ---- Q-077: reopened, "Current page" highlighted, Download sends 100 again ----
    await downloadButton(page).click()
    await expect(modal).toBeVisible()
    expect(await sizeCards(modal)).toEqual(highlighted('Current page'))
    const again = page.waitForEvent('download', { timeout: NAV_TIMEOUT })
    await modal.getByRole('button', { name: 'Download' }).click()
    expect((await again).suggestedFilename()).toBe('results.csv')
    await expect(modal).toHaveCount(0)
    await expect.poll(() => e3().length).toBe(2)
    expect(e3().map((e) => e.bodyText)).toEqual([e3Body(100), e3Body(100)])
    // nothing else was sent for the CSV (the current-page answer, limit 10, was never asked for)
    expect(log.entries.filter((e) => e.bodyText === e3Body(10))).toEqual([])
  })

  test('T-711 @P1 J9 CSV of a filtered search: Download sends the whole query, the facet clause included, as the E3 body q, and downloads results.csv', async ({
    page,
    p2Env,
    resolver,
  }) => {
    const log = netLog(page, p2Env)
    // the stand-in answer: the recorded CSV of the same body for "climate" (only the request is asserted)
    const standIns = []
    await page.route(
      (u) => u.href === E3_URL,
      async (route) => {
        const req = route.request()
        const text = req.postData() || ''
        if (req.method() !== 'POST' || !text.includes('"accept":"text/csv"'))
          return route.fallback()
        standIns.push(text)
        const stand = resolver.resolve(
          'POST',
          E3_URL,
          JSON.stringify({ ...JSON.parse(text), q: 'climate' })
        )
        const headers = {}
        for (const [n, v] of stand.headers) headers[n.toLowerCase()] = v
        const { origin } = await req.allHeaders()
        headers['access-control-allow-origin'] = origin
        headers['access-control-allow-credentials'] = 'true'
        return route.fulfill({
          status: stand.status,
          headers,
          body: stand.body,
        })
      }
    )
    await open(page, `/search/?q=${encodeURIComponent(THESIS)}`)
    await expect(
      page.getByText('132,192 research outputs found', { exact: true })
    ).toBeVisible()
    const modal = csvModal(page)
    await downloadButton(page).click()
    await expect(modal).toBeVisible()
    expect(await sizeCards(modal)).toEqual(highlighted('Current page'))
    const downloaded = page.waitForEvent('download', { timeout: NAV_TIMEOUT })
    await modal.getByRole('button', { name: 'Download' }).click()
    expect((await downloaded).suggestedFilename()).toBe('results.csv')
    await expect(modal).toHaveCount(0)
    await expect
      .poll(() => log.entries.filter(isE3).map((e) => [e.bodyText, e.status]))
      .toEqual([[e3Body(10, THESIS), 200]])
    expect(standIns).toEqual([e3Body(10, THESIS)])
  })
})
