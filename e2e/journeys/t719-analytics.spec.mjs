// T-719 (41, J17; R-026, R-041; Q-059, Q-071, Q-096): analytics per cookie state. The guard answers
// https://www.googletagmanager.com/gtag/js with an empty script and aborts-and-counts LogRocket, so the page's
// `window.dataLayer` holds exactly what react-ga4 2.1.0 pushed (e2e/lib/P0-15/analytics.mjs).
//   c1  0 gtag.js / dataLayer hits before consent (absent, essential), 1 `config` hit on a consented hard load,
//       0 on client navigation (the `send({hitType:'search'})` call is a no-op that warns once per load and per
//       route change, Q-071); consent given on a page applies at the next load (Q-059, Q-070).
//   c2  every dataLayer entry equals the reference per cookie state, dates normalised (the reference is the
//       literal below and the record-mode baseline next to this spec: provisional at 2.3, B0 from 2.5).
//   c3  Sentry through the prod-shaped test DSN (host o0.ingest.sentry.io): the SDK is initialised with it, a
//       clean page sends nothing, a client error makes one report attempt that the CSP `connect-src ... sentry.io`
//       blocks, so none reaches the counting stub (Q-096, R-026).
//   c4  LogRocket: one script request per hard load, aborted and counted by the guard after the CSP check (no
//       violation), none on client navigation, whatever the cookie state.
//   c5  the whole third-party census per cookie state (requests, guard counters, console, cookies, storage).
import { test, expect } from '../lib/P0-15/fixtures.mjs'
import { COOKIE_STATES } from '../fixtures/constants.mjs'
import { trackPage } from '../lib/P0-15/settle.mjs'
import {
  GA_ID,
  GA_WARNING,
  GTAG_URL,
  LOGROCKET_HOST,
  LOGROCKET_URL,
  LOGROCKET_WARNING,
  SENTRY_DSN,
  SENTRY_STORE,
  census,
  cookieNames,
  countText,
  counts,
  dataLayerOf,
  hardLoad,
  loaded,
  normaliseDates,
  pageConsole,
  routeChange,
  stableJson,
  storageKeys,
} from '../lib/P0-15/analytics.mjs'
// the LogRocket host of the census snapshots: AD-032
import { expectSnapshot } from '../lib/P0-10/baseline.mjs'

// a hard load plus the settle wait can take tens of seconds on a loaded machine (40 §5: timeouts, never retries)
test.describe.configure({ timeout: 240000 })

const J17 = '/search/?q=climate'
// client navigations that stay clear of the crashing pairs of T-716 (Q-047): search -> update -> provider 86
const NAV_1 = '/outputs/update/'
const NAV_2 = '/data-providers/86/'
const Q074A = '/works/7401/' // output with doi null: the page hydrates into an error (Q-074 a)
const CONSENTED = (state) => state === 'essential+analytics'
const slug = (state) => state.replace('+', '-')

// the reference dataLayer per cookie state (react-ga4 2.1.0 `initialize`: `js` with the load time, then
// `config`; nothing else is ever pushed, Q-071)
const REFERENCE = {
  'absent': [],
  'essential': [],
  'essential+analytics': [
    ['js', '<date>'],
    ['config', GA_ID],
  ],
}

// the pinned census of one settled J17 session (hard load, two client navigations) per cookie state
const CENSUS = {
  'absent': { gtag: 0, google: 0, logrocket: 1, sentry: 0, cloudflare: 0 },
  'essential': { gtag: 0, google: 0, logrocket: 1, sentry: 0, cloudflare: 0 },
  'essential+analytics': {
    gtag: 1,
    google: 0,
    logrocket: 1,
    sentry: 0,
    cloudflare: 0,
  },
}
const COOKIES = {
  'absent': [],
  'essential': ['essential_cookies_allowed'],
  'essential+analytics': [
    'analytics_cookies_allowed',
    'essential_cookies_allowed',
  ],
}

for (const cookieState of COOKIE_STATES)
  test.describe(`cookie state ${cookieState}`, () => {
    test.use({ cookieState })
    const consented = CONSENTED(cookieState)

    test(`T-719 c1 @P0 ${cookieState}: ${
      consented ? '1 config hit on the hard load' : '0 hits'
    }, 0 on client navigation (Q-071)`, async ({ page, guardLog }) => {
      const tracker = trackPage(page)
      await hardLoad(page, tracker, J17)

      const load = census(guardLog)
      expect(load.gtag).toEqual(consented ? [`GET ${GTAG_URL}`] : [])
      expect(load.google).toEqual([])
      const entries = await dataLayerOf(page)
      expect(entries.filter((e) => e[0] === 'config')).toEqual(
        consented ? [['config', GA_ID]] : []
      )
      expect(entries.length).toBe(consented ? 2 : 0)
      // the script tag react-ga4 appends to <body> exists only with consent
      expect(
        await page
          .locator('script[src*="googletagmanager.com"]')
          .evaluateAll((els) => els.map((e) => [e.src, e.async]))
      ).toEqual(consented ? [[GTAG_URL, true]] : [])

      // client navigation: no further gtag.js request, no further dataLayer entry
      const reqMark = guardLog.requests.length
      await routeChange(page, tracker, NAV_1)
      await routeChange(page, tracker, NAV_2)
      const nav = census(guardLog, reqMark)
      expect(nav.gtag).toEqual([])
      expect(nav.google).toEqual([])
      expect(await dataLayerOf(page)).toEqual(entries)

      // the page-view call runs on every load and route change and is a no-op (Q-071): one warning each
      expect(countText(pageConsole(guardLog), GA_WARNING)).toBe(3)
      expect(guardLog.csp).toEqual([])
    })
  })

test('T-719 c1 @P0 consent given on a page applies at the next load: 0 hits until then, then 1 config hit (Q-059, Q-070)', async ({
  page,
  guardLog,
}) => {
  const tracker = trackPage(page)
  await hardLoad(page, tracker, J17)
  expect(census(guardLog).gtag).toEqual([])
  expect(await dataLayerOf(page)).toEqual([])

  await page.getByRole('button', { name: 'I agree' }).click()
  await expect(page.locator('#cookies-popup')).toHaveCount(0)
  await routeChange(page, tracker, NAV_1)
  // the consent is stored, the running page keeps analytics off (the hook read its cookie at mount)
  expect(await cookieNames(page.context())).toEqual(
    COOKIES['essential+analytics']
  )
  expect(census(guardLog).gtag).toEqual([])
  expect(await dataLayerOf(page)).toEqual([])

  const reqMark = guardLog.requests.length
  await page.goto(J17)
  await loaded(page, tracker)
  expect(census(guardLog, reqMark).gtag).toEqual([`GET ${GTAG_URL}`])
  expect(normaliseDates(await dataLayerOf(page))).toEqual(
    REFERENCE['essential+analytics']
  )
})

for (const cookieState of COOKIE_STATES)
  test.describe(`cookie state ${cookieState} dataLayer`, () => {
    test.use({ cookieState })

    test(`T-719 c2 @P0 ${cookieState}: every dataLayer entry equals the reference, dates normalised`, async ({
      page,
    }) => {
      const tracker = trackPage(page)
      await hardLoad(page, tracker, J17)
      const afterLoad = normaliseDates(await dataLayerOf(page))
      await routeChange(page, tracker, NAV_1)
      const afterNavigation = normaliseDates(await dataLayerOf(page))

      expect(afterLoad).toEqual(REFERENCE[cookieState])
      expect(afterNavigation).toEqual(REFERENCE[cookieState])
      expect(stableJson({ afterLoad, afterNavigation })).toMatchSnapshot(
        `t719-c2-datalayer-${slug(cookieState)}.json`
      )
    })
  })

for (const cookieState of COOKIE_STATES)
  test.describe(`cookie state ${cookieState} sentry`, () => {
    test.use({ cookieState })

    test(`T-719 c3 @P0 ${cookieState}: Sentry is initialised with the prod-shaped test DSN and a clean page sends nothing`, async ({
      page,
      guardLog,
    }) => {
      const tracker = trackPage(page)
      await hardLoad(page, tracker, J17)
      await routeChange(page, tracker, NAV_1)
      const dsn = await page.evaluate(() => {
        const hub = window.__SENTRY__ && window.__SENTRY__.hub
        const client = hub && hub.getClient && hub.getClient()
        return client ? client.getOptions().dsn : null
      })
      expect(dsn).toBe(SENTRY_DSN)
      // the DSN host is a subdomain of sentry.io, which the CSP source `sentry.io` does not cover (Q-096)
      expect(new URL(dsn).hostname).toBe('o0.ingest.sentry.io')
      expect(counts(guardLog).sentry).toBe(0)
      expect(guardLog.sentry).toEqual([])
      expect(guardLog.csp).toEqual([])
    })

    test(`T-719 c3 @P0 ${cookieState}: a client error makes one Sentry report attempt, blocked by the CSP, none reaches the counting stub (Q-096)`, async ({
      page,
      guardLog,
    }) => {
      // the Q-074 (a) page hydrates into an error: React 17 console.error for the render error and for the two
      // CSP lines of the blocked report; the guard's console and csp checks are asserted here instead
      test
        .info()
        .annotations.push(
          { type: 'guard-expect', description: 'console' },
          { type: 'guard-expect', description: 'csp' }
        )
      const tracker = trackPage(page)
      await page.goto(Q074A)
      await expect
        .poll(
          () =>
            page.evaluate(() => document.querySelector('#__next').innerHTML),
          {
            timeout: 60000,
          }
        )
        .toBe('')
      // the render error, the blocked report and its two console lines
      await expect
        .poll(() => guardLog.consoleErrors.length, { timeout: 30000 })
        .toBe(3)
      await expect.poll(() => tracker.inflight.size).toBe(0)
      expect(
        guardLog.csp.map((v) => [v.effectiveDirective, v.blockedURI])
      ).toEqual([['connect-src', SENTRY_STORE]])
      expect(guardLog.sentry).toEqual([])
      expect(counts(guardLog).sentry).toBe(0)
      expect(guardLog.pageErrors).toEqual([])
      expect(guardLog.windowErrors).toEqual([])
      expect(guardLog.consoleErrors).toHaveLength(3)
      expect(guardLog.unexpected).toEqual([])
    })
  })

for (const cookieState of COOKIE_STATES)
  test.describe(`cookie state ${cookieState} logrocket`, () => {
    test.use({ cookieState })

    test(`T-719 c4 @P0 ${cookieState}: one LogRocket script request per hard load, aborted and counted, none on client navigation`, async ({
      page,
      guardLog,
    }) => {
      const tracker = trackPage(page)
      await hardLoad(page, tracker, J17)
      const first = guardLog.requests.filter(
        (r) => new URL(r.url).hostname === LOGROCKET_HOST
      )
      expect(first.map((r) => [r.method, r.url, r.resourceType])).toEqual([
        ['GET', LOGROCKET_URL, 'script'],
      ])
      expect(guardLog.aborted).toEqual({ [LOGROCKET_HOST]: 1 })
      // Chromium prints one line for the resource the guard aborted (logged, never an app error), the SDK warns
      expect(guardLog.guardAbortConsole).toHaveLength(1)
      expect(countText(pageConsole(guardLog), LOGROCKET_WARNING)).toBe(1)
      // aborted after the CSP check: the host is allowed, no violation
      expect(guardLog.csp).toEqual([])

      await routeChange(page, tracker, NAV_1)
      await routeChange(page, tracker, NAV_2)
      expect(guardLog.aborted).toEqual({ [LOGROCKET_HOST]: 1 })
      expect(counts(guardLog).logrocket).toBe(1)

      // a second hard load is one more request
      await page.reload()
      await loaded(page, tracker)
      expect(guardLog.aborted).toEqual({ [LOGROCKET_HOST]: 2 })
      expect(counts(guardLog).logrocket).toBe(2)
      expect(guardLog.csp).toEqual([])
    })
  })

for (const cookieState of COOKIE_STATES)
  test.describe(`cookie state ${cookieState} census`, () => {
    test.use({ cookieState })

    test(`T-719 c5 @P0 ${cookieState}: the third-party census of a J17 session equals the pinned table`, async ({
      page,
      context,
      guardLog,
    }) => {
      const tracker = trackPage(page)
      await hardLoad(page, tracker, J17)
      await routeChange(page, tracker, NAV_1)
      await routeChange(page, tracker, NAV_2)

      expect(counts(guardLog)).toEqual(CENSUS[cookieState])
      expect(guardLog.aborted).toEqual({ [LOGROCKET_HOST]: 1 })
      expect(guardLog.sentry).toEqual([])
      expect(guardLog.csp).toEqual([])
      expect(guardLog.unexpected).toEqual([])
      const messages = pageConsole(guardLog)
      expect(countText(messages, GA_WARNING)).toBe(3)
      expect(countText(messages, LOGROCKET_WARNING)).toBe(1)
      expect(countText(messages, 'GA')).toBe(CONSENTED(cookieState) ? 1 : 0)
      // nothing else is written by the analytics code: the cookie jar is the state's own, no storage keys
      expect(await cookieNames(context)).toEqual(COOKIES[cookieState])
      const storage = await storageKeys(page)
      expect(storage).toEqual({ local: [], session: [] })

      expectSnapshot(
        stableJson({
          counts: counts(guardLog),
          aborted: guardLog.aborted,
          requests: census(guardLog),
          dataLayer: normaliseDates(await dataLayerOf(page)),
          cookies: await cookieNames(context),
          storage,
          messages: ['GA', GA_WARNING, LOGROCKET_WARNING].map((t) => [
            t,
            countText(messages, t),
          ]),
        }),
        `t719-c5-census-${slug(cookieState)}.json`
      )
    })
  })
