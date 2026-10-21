// T-740 (41, J28; R-041; Q-070, Q-051, Q-059): consent flows in the browser, the counterpart of the jsdom pin
// T-416. Q-070: the popup is keyed on `essential_cookies_allowed` alone; "Essential cookies only" writes that
// cookie, "I agree" writes it and `analytics_cookies_allowed`; value `true`, `Path=/`, one year, no other
// attribute; consent given after mount applies at the next load (the analytics hook reads its cookie at mount,
// Q-059). The raw document.cookie writes are logged by an init script (e2e/lib/P0-15/consent.mjs); the
// browser's cookie jar is read through context.cookies(); GA is observed through the gtag.js request and
// window.dataLayer (e2e/lib/P0-15/analytics.mjs).
import { test as base, expect } from '../lib/P0-15/fixtures.mjs'
import { trackPage } from '../lib/P0-15/settle.mjs'
import {
  GA_ID,
  GTAG_URL,
  census,
  cookieNames,
  dataLayerOf,
  hardLoad,
  loaded,
  normaliseDates,
  routeChange,
} from '../lib/P0-15/analytics.mjs'
import {
  ANALYTICS,
  ESSENTIAL,
  REMOVE,
  SET,
  YEAR,
  consentCookie,
  cookieLogInit,
  cookieWrites,
  popupOf,
} from '../lib/P0-15/consent.mjs'

const test = base.extend({
  // the cookie-write log of every document of the test
  cookieLog: [
    async ({ context }, use) => {
      await context.addInitScript(cookieLogInit)
      await use(true)
    },
    { auto: true },
  ],
})
// a hard load plus the settle wait can take tens of seconds on a loaded machine (40 §5: timeouts, never retries)
test.describe.configure({ timeout: 240000 })

const J28 = '/search/?q=climate'
const NAV = '/outputs/update/'
const POPUP_TEXT = 'We use cookies to improve our website.'
const JAR = (c) => ({
  name: c.name,
  value: c.value,
  path: c.path,
  httpOnly: c.httpOnly,
  secure: c.secure,
})

const jarOf = async (context) =>
  (await context.cookies()).sort((a, b) => (a.name < b.name ? -1 : 1))

// the written cookies are valid for one year from now (the browser stores an absolute expiry)
const expectOneYear = (cookie) =>
  expect(Math.abs(cookie.expires - (Date.now() / 1000 + YEAR))).toBeLessThan(
    120
  )

const gtagHits = (guardLog, from = 0) => census(guardLog, from).gtag

test.describe('first visit (cookie state absent)', () => {
  test('T-740 @P0 J28 the popup appears after hydration (not in the server HTML) with its two choices; nothing is written', async ({
    page,
    request,
    context,
    p2Env,
  }) => {
    // Q-051: the design Cookies renders on `typeof window` only, so the server HTML has no popup
    const raw = await request.get(`${p2Env.baseURL}${J28}`)
    expect(raw.status()).toBe(200)
    expect(await raw.text()).not.toContain('cookies-popup')

    const tracker = trackPage(page)
    await hardLoad(page, tracker, J28)
    const popup = popupOf(page)
    await expect(popup).toBeVisible()
    await expect(popup.locator('p')).toHaveText(POPUP_TEXT)
    await expect(
      popup.getByRole('link', { name: 'Learn more' })
    ).toHaveAttribute('href', '/cookies')
    await expect(popup.getByRole('button')).toHaveCount(2)
    // the button ids carry the cookie names the handler writes
    await expect(
      popup.getByRole('button', { name: 'Essential cookies only' })
    ).toHaveAttribute('id', ESSENTIAL)
    await expect(
      popup.getByRole('button', { name: 'I agree' })
    ).toHaveAttribute('id', `${ESSENTIAL},${ANALYTICS}`)
    expect(await cookieWrites(page)).toEqual([])
    expect(await context.cookies()).toEqual([])

    // a client navigation keeps the popup and writes nothing
    await routeChange(page, tracker, NAV)
    await expect(popupOf(page)).toBeVisible()
    expect(await cookieWrites(page)).toEqual([])
    expect(await context.cookies()).toEqual([])
  })

  test('T-740 @P0 J28 "Essential cookies only" removes both cookies without a path, then writes the essential one for a year; analytics stays off, also at the next load', async ({
    page,
    context,
    guardLog,
  }) => {
    const tracker = trackPage(page)
    await hardLoad(page, tracker, J28)
    await page.getByRole('button', { name: 'Essential cookies only' }).click()
    await expect(popupOf(page)).toHaveCount(0)

    expect(await cookieWrites(page)).toEqual([
      REMOVE(ESSENTIAL),
      REMOVE(ANALYTICS),
      SET(ESSENTIAL),
    ])
    const jar = await jarOf(context)
    expect(jar.map(JAR)).toEqual([
      {
        name: ESSENTIAL,
        value: 'true',
        path: '/',
        httpOnly: false,
        secure: false,
      },
    ])
    expectOneYear(jar[0])
    expect(await page.evaluate(() => document.cookie)).toBe(`${ESSENTIAL}=true`)

    // analytics was off at mount and stays off
    await loaded(page, tracker)
    expect(gtagHits(guardLog)).toEqual([])
    expect(await dataLayerOf(page)).toEqual([])

    // the next load: no popup, no write, no GA
    await page.reload()
    await loaded(page, tracker)
    await expect(popupOf(page)).toHaveCount(0)
    expect(await cookieWrites(page)).toEqual([])
    expect(gtagHits(guardLog)).toEqual([])
    expect(await dataLayerOf(page)).toEqual([])
    expect(await cookieNames(context)).toEqual([ESSENTIAL])
  })

  test('T-740 @P0 J28 "I agree" writes the essential and the analytics cookie for a year; GA starts at the next load, not in this one (Q-059)', async ({
    page,
    context,
    guardLog,
  }) => {
    const tracker = trackPage(page)
    await hardLoad(page, tracker, J28)
    await page.getByRole('button', { name: 'I agree' }).click()
    await expect(popupOf(page)).toHaveCount(0)

    expect(await cookieWrites(page)).toEqual([
      REMOVE(ESSENTIAL),
      REMOVE(ANALYTICS),
      SET(ESSENTIAL),
      SET(ANALYTICS),
    ])
    const jar = await jarOf(context)
    expect(jar.map(JAR)).toEqual([
      {
        name: ANALYTICS,
        value: 'true',
        path: '/',
        httpOnly: false,
        secure: false,
      },
      {
        name: ESSENTIAL,
        value: 'true',
        path: '/',
        httpOnly: false,
        secure: false,
      },
    ])
    for (const c of jar) expectOneYear(c)

    // consent after mount applies next load: no GA in this document, also after a client navigation
    await loaded(page, tracker)
    await routeChange(page, tracker, NAV)
    expect(gtagHits(guardLog)).toEqual([])
    expect(await dataLayerOf(page)).toEqual([])

    const mark = guardLog.requests.length
    await page.goto(J28)
    await loaded(page, tracker)
    await expect(popupOf(page)).toHaveCount(0)
    expect(await cookieWrites(page)).toEqual([])
    expect(gtagHits(guardLog, mark)).toEqual([`GET ${GTAG_URL}`])
    expect(normaliseDates(await dataLayerOf(page))).toEqual([
      ['js', '<date>'],
      ['config', GA_ID],
    ])
  })
})

test.describe('the popup is keyed on the essential cookie alone', () => {
  test('T-740 @P0 J28 with only the analytics cookie the popup is shown while GA runs; "Essential cookies only" leaves that cookie (the removal has no Path)', async ({
    page,
    context,
    guardLog,
    baseURL,
  }) => {
    await context.addCookies([consentCookie(ANALYTICS, 'true', baseURL)])
    const tracker = trackPage(page)
    await hardLoad(page, tracker, J28)
    await expect(popupOf(page)).toBeVisible()
    expect(gtagHits(guardLog)).toEqual([`GET ${GTAG_URL}`])
    expect(normaliseDates(await dataLayerOf(page))).toEqual([
      ['js', '<date>'],
      ['config', GA_ID],
    ])

    await page.getByRole('button', { name: 'Essential cookies only' }).click()
    await expect(popupOf(page)).toHaveCount(0)
    expect(await cookieWrites(page)).toEqual([
      REMOVE(ESSENTIAL),
      REMOVE(ANALYTICS),
      SET(ESSENTIAL),
    ])
    // the removals carry no Path: on /search/ the browser scopes them to /search, so the root-path analytics
    // cookie survives the "essential only" choice
    expect(
      (await jarOf(context)).map((c) => [c.name, c.value, c.path])
    ).toEqual([
      [ANALYTICS, 'true', '/'],
      [ESSENTIAL, 'true', '/'],
    ])

    const mark = guardLog.requests.length
    await page.reload()
    await loaded(page, tracker)
    await expect(popupOf(page)).toHaveCount(0)
    expect(gtagHits(guardLog, mark)).toEqual([`GET ${GTAG_URL}`])
  })

  test('T-740 @P0 J28 a cookie value other than "true" counts as the app reads it: "false" is no consent, any other value is consent', async ({
    page,
    context,
    guardLog,
    baseURL,
  }) => {
    // "false" -> popup shown, no GA
    await context.addCookies([
      consentCookie(ESSENTIAL, 'false', baseURL),
      consentCookie(ANALYTICS, 'false', baseURL),
    ])
    const tracker = trackPage(page)
    await hardLoad(page, tracker, J28)
    await expect(popupOf(page)).toBeVisible()
    expect(gtagHits(guardLog)).toEqual([])

    // "yes" -> no popup, GA on (react-cookie converts only 'true' and 'false')
    await context.clearCookies()
    await context.addCookies([
      consentCookie(ESSENTIAL, 'yes', baseURL),
      consentCookie(ANALYTICS, 'yes', baseURL),
    ])
    const mark = guardLog.requests.length
    await page.goto(J28)
    await loaded(page, tracker)
    await expect(popupOf(page)).toHaveCount(0)
    expect(gtagHits(guardLog, mark)).toEqual([`GET ${GTAG_URL}`])
  })
})

const POPUP_ROUTES = [
  '/search/?q=climate',
  '/works/1001/',
  '/outputs/2001/',
  '/data-providers/86/',
  '/outputs/update/',
]

for (const route of POPUP_ROUTES)
  test.describe(`popup on ${route}`, () => {
    test(`T-740 @P0 J28 ${route} cookie state absent: the popup is shown and nothing is written`, async ({
      page,
      context,
    }) => {
      const tracker = trackPage(page)
      await hardLoad(page, tracker, route)
      await expect(popupOf(page)).toBeVisible()
      await expect(popupOf(page).getByRole('button')).toHaveCount(2)
      expect(await cookieWrites(page)).toEqual([])
      expect(await context.cookies()).toEqual([])
    })

    test.describe('consented', () => {
      test.use({ cookieState: 'essential' })
      test(`T-740 @P0 J28 ${route} cookie state essential: no popup, nothing is written`, async ({
        page,
        context,
      }) => {
        const tracker = trackPage(page)
        await hardLoad(page, tracker, route)
        await expect(popupOf(page)).toHaveCount(0)
        expect(await cookieWrites(page)).toEqual([])
        expect(await cookieNames(context)).toEqual([ESSENTIAL])
      })
    })
  })

test.describe('consent cookies given', () => {
  test.use({ cookieState: 'essential+analytics' })
  test('T-740 @P0 J28 cookie state essential+analytics: no popup, nothing is written, GA runs once', async ({
    page,
    context,
    guardLog,
  }) => {
    const tracker = trackPage(page)
    await hardLoad(page, tracker, J28)
    await expect(popupOf(page)).toHaveCount(0)
    expect(await cookieWrites(page)).toEqual([])
    expect(await cookieNames(context)).toEqual([ANALYTICS, ESSENTIAL])
    expect(gtagHits(guardLog)).toEqual([`GET ${GTAG_URL}`])
  })
})
