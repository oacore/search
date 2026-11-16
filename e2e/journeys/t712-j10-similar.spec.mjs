// T-712 (41 H, J10, Q-055, R-029): similar works and related searches of the output pages, as they behave
// today (findings/07 §2.12, §3 J10):
//   c1  J10 and Q-055: a page load shows "Loading suggested articles..." while the browser's E8 (POST
//       /v3/recommend) is open, then the similar cards under "Similar works" and the "Related searches" links
//       (//core.ac.uk/search?q=<word>, target _blank, rel noreferrer: a new page without opener); a failing E8
//       shows the error block and leaves the rest of the page; a client navigation from output A to output B
//       sends no E8 and keeps A's similar works on B's page (Q-055: fetched only on mount).
//   c2  the remount path: hard load A, client navigation to the search page, Back to A. Every mount sends one
//       E8; the loader is visible before E8 resolves; the remount's loading state is pixel-identical to the
//       T-801 V12 loading capture of A (0 px, exact RGBA). Today the path crosses Q-100: the navigation to the
//       search page logs React #300 and the Back logs #310 (each with the browser Sentry report blocked by the
//       CSP, Q-096); React renders the tree again after each error, so the search page is not blank and the
//       Back mounts the works page twice (two insertions of the "Similar works" section, two E8: still one
//       per mount; P1-04 issue).
//   c3  T-702's window events on the works page after settle (visibilitychange hidden -> visible, window blur
//       -> focus, offline -> online): no E8, no other request, DOM and URL unchanged, the record = the
//       capture of the golden build.
// Local mode: the browser's E8 never reaches the SSR stub (the guard answers api.core.ac.uk from the fixture
// resolver in the browser), so "E8 delayed 1 s" is a route gate in the page that holds each E8 for at least
// 1 s and until the test releases it (the T-734 pattern for E16; P1-04 issue). The client navigation to the
// search page is `window.next.router.push` (the T-702 c9 mechanism; the header search of a works page is the
// collapsed icon of J20, T-727).
// The c2 captures need the capture setting of the visual project (CHROMIUM_CAPTURE_ARGS, reduced motion): the
// launch argument is a worker option, so it is set for the whole file.
// Fixtures: works-1001, works-1007 (E8 404), outputs-2001, outputs-2006 (E8 404), search-climate, members.
import { test } from '../fixtures/guard.mjs'
import { setFixedTime } from '../fixtures/guard.mjs'
import { visualReady } from '../fixtures/visual-ready.mjs'
import { CHROMIUM_CAPTURE_ARGS } from '../fixtures/constants.mjs'
import {
  expect,
  open,
  settle,
  trackPage,
  netLog,
  rel,
  isRecommend,
  recommendBodies,
  navigations,
  buildIdOf,
  holdRequests,
  declareGuard,
  expectConsole,
  answerOtherService,
  expectBaselinePixels,
  t801Baseline,
  stableJson,
  RECOMMEND,
  ACTION_TIMEOUT,
  NAV_TIMEOUT,
  TEST_TIMEOUT,
} from '../lib/P1-04/page.mjs'

test.use({
  navigationTimeout: NAV_TIMEOUT,
  actionTimeout: ACTION_TIMEOUT,
  launchOptions: { args: CHROMIUM_CAPTURE_ARGS },
  cookieState: 'essential',
})
test.describe.configure({ timeout: TEST_TIMEOUT })

const LOADING = 'Loading suggested articles...'
const ERROR_TEXT = 'Sorry, we are unable to process this request at the moment'
const NOT_FOUND_LOG =
  /^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/
const E8_WORK_1001 = '{"identifier":"core:1001","limit":5,"resultType":"work"}'
const E8_OUTPUT_2001 = '{"identifier":"core:2001","limit":5}'
// the similar works of the fixtures (works 1001: the first five results of the climate search; outputs 2001:
// three outputs)
const SIMILAR_1001 = [19211324, 62704171, 19212910, 18872441, 17489114]
const SIMILAR_2001 = [566708785, 567714872, 580296804]
const RELATED_1001 = ['change', 'climate', 'climate change']
const TITLES = {
  works:
    'Mandatory due diligence laws and climate change litigation: Bridging the corporate climate accountability gap?',
  outputs: /^Novel approach for deriving genome wide SNP analysis data/,
}

const recommendMatch = (u) => u.href === RECOMMEND
const ignoreRecommend = (r) => r.url() === RECOMMEND

// the "Similar works" section: card ids (the design SearchResult prefixes its own ids with the id it gets),
// loader, error block
const similarState = (page) =>
  page.evaluate(() => {
    const section = [...document.querySelectorAll('section')].find(
      (s) =>
        s.firstElementChild &&
        s.firstElementChild.tagName === 'H2' &&
        s.firstElementChild.textContent === 'Similar works'
    )
    if (!section) return null
    const ids = [
      ...new Set(
        [...section.querySelectorAll('[id^="similar-output-"]')].map((e) =>
          Number(e.id.replace(/^similar-output-(\d+)-.*$/, '$1'))
        )
      ),
    ]
    const text = section.innerText
    return {
      ids,
      loader: text.includes('Loading suggested articles...'),
      error: text.includes(
        'Sorry, we are unable to process this request at the moment'
      ),
    }
  })

// the "Related searches" links (null when the block is absent)
const relatedLinks = (page) =>
  page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find(
      (e) => e.textContent === 'Related searches'
    )
    if (!h) return null
    return [...h.nextElementSibling.querySelectorAll('a')].map((a) => ({
      text: a.textContent,
      href: a.getAttribute('href'),
      target: a.getAttribute('target'),
      rel: a.getAttribute('rel'),
    }))
  })

// E8 requests of a page with their answer times
function e8Timing(page) {
  const list = []
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url() === RECOMMEND)
      list.push({
        body: r.postData(),
        sent: Date.now(),
        done: null,
        status: null,
      })
  })
  page.on('requestfinished', async (r) => {
    if (r.method() !== 'POST' || r.url() !== RECOMMEND) return
    const e = list.find((x) => x.done === null && x.body === r.postData())
    if (!e) return
    e.done = Date.now()
    const res = await r.response().catch(() => null)
    e.status = res ? res.status() : null
  })
  return list
}

test.describe('T-712 @P1 J10 similar works and related searches', () => {
  test('T-712 c1 @P1 J10 works 1001: loader while E8 is open, five similar works, three related searches opening a new page without opener', async ({
    page,
    context,
    p2Env,
  }) => {
    const log = netLog(page, p2Env)
    const gate = await holdRequests(page, recommendMatch)
    const tracker = trackPage(page)
    page.setDefaultTimeout(ACTION_TIMEOUT)
    const res = await page.goto('/works/1001/')
    expect(res.status()).toBe(200)
    await settle(page, tracker, { ignore: ignoreRecommend })
    // E8 open: the loader, no card, no related searches
    await expect.poll(() => gate.count()).toBe(1)
    await expect(page.getByText(LOADING, { exact: true })).toBeVisible()
    expect(await similarState(page)).toEqual({
      ids: [],
      loader: true,
      error: false,
    })
    expect(await relatedLinks(page)).toBeNull()
    gate.release()
    await expect(page.getByText(LOADING, { exact: true })).toHaveCount(0)
    await settle(page, tracker)
    expect(await similarState(page)).toEqual({
      ids: SIMILAR_1001,
      loader: false,
      error: false,
    })
    expect(recommendBodies(log.entries)).toEqual([E8_WORK_1001])
    // related searches: words of the title and the similar titles, protocol-relative links, raw query
    expect(await relatedLinks(page)).toEqual(
      RELATED_1001.map((w) => ({
        text: w,
        href: `//core.ac.uk/search?q=${w}`,
        target: '_blank',
        rel: 'noreferrer',
      }))
    )
    // core.ac.uk/search is another service: the new page is answered at the context
    const hits = await answerOtherService(
      context,
      (u) => u.hostname === 'core.ac.uk' && u.pathname === '/search'
    )
    const scheme = new URL(p2Env.baseURL).protocol
    const [popup] = await Promise.all([
      context.waitForEvent('page', { timeout: NAV_TIMEOUT }),
      page.getByRole('link', { name: 'climate change', exact: true }).click(),
    ])
    await popup.waitForLoadState('load')
    expect(popup.url()).toBe(`${scheme}//core.ac.uk/search?q=climate%20change`)
    expect(
      await popup.evaluate(() => ({
        opener: window.opener,
        referrer: document.referrer,
      }))
    ).toEqual({ opener: null, referrer: '' })
    expect(hits).toEqual([
      {
        method: 'GET',
        url: `${scheme}//core.ac.uk/search?q=climate%20change`,
        navigation: true,
      },
    ])
    await popup.close()
    // the works page stays, no further E8
    expect(rel(p2Env, page.url())).toBe('/works/1001/')
    expect(recommendBodies(log.entries)).toEqual([E8_WORK_1001])
  })

  for (const [kind, id, body] of [
    ['works', 1007, '{"identifier":"core:1007","limit":5,"resultType":"work"}'],
    ['outputs', 2006, '{"identifier":"core:2006","limit":5}'],
  ])
    test(`T-712 c1 @P1 J10 ${kind} ${id}: E8 answered 404 shows the error block, no related searches, the rest of the page stays`, async ({
      page,
      p2Env,
      guardLog,
    }) => {
      // the recorded recommender answer is a 404: Chromium logs the failed fetch (one console error)
      declareGuard('console')
      const log = netLog(page, p2Env)
      await open(page, `/${kind}/${id}/`)
      await expect(page.getByText(ERROR_TEXT, { exact: true })).toBeVisible()
      expect(await similarState(page)).toEqual({
        ids: [],
        loader: false,
        error: true,
      })
      expect(await relatedLinks(page)).toBeNull()
      expect(recommendBodies(log.entries)).toEqual([body])
      expect(log.entries.filter(isRecommend).map((e) => e.status)).toEqual([
        404,
      ])
      // the rest of the page: title, abstract
      await expect(
        page.getByRole('heading', { level: 1, name: TITLES[kind] })
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Abstract', exact: true })
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Similar works', exact: true })
      ).toBeVisible()
      expectConsole(guardLog, [NOT_FOUND_LOG])
    })

  for (const [kind, from, to, body, similar] of [
    ['outputs', 2001, 2006, E8_OUTPUT_2001, SIMILAR_2001],
    ['works', 1001, 1007, E8_WORK_1001, SIMILAR_1001],
  ])
    test(`T-712 c1 @P1 Q-055 client nav ${kind} ${from} -> ${to}: _next/data only, no E8, ${from}'s similar works stay on ${to}`, async ({
      page,
      p2Env,
    }) => {
      const log = netLog(page, p2Env)
      const tracker = await open(page, `/${kind}/${from}/`)
      expect(await similarState(page)).toEqual({
        ids: similar,
        loader: false,
        error: false,
      })
      const related = await relatedLinks(page)
      const buildId = await buildIdOf(page)
      const m = log.mark()
      await page.evaluate((u) => window.next.router.push(u), `/${kind}/${to}/`)
      await expect(page).toHaveURL(`${p2Env.baseURL}/${kind}/${to}/`)
      await settle(page, tracker)
      expect(await page.evaluate(() => window.next.router.query.id)).toBe(
        String(to)
      )
      const nav = log.since(m)
      expect(navigations(nav, p2Env, buildId)).toEqual([
        [
          'next-data',
          'GET',
          `/static/search/_next/data/<buildId>/${kind}/${to}.json?id=${to}`,
        ],
      ])
      // Q-055: no E8 for B; B's page keeps A's similar works and related searches (a hard load of B shows the
      // error block, c1 above)
      expect(nav.filter(isRecommend)).toEqual([])
      expect(recommendBodies(log.entries)).toEqual([body])
      expect(await similarState(page)).toEqual({
        ids: similar,
        loader: false,
        error: false,
      })
      expect(await relatedLinks(page)).toEqual(related)
      await expect(page.getByText(ERROR_TEXT, { exact: true })).toHaveCount(0)
    })
})

test.describe('T-712 @P1 remount path', () => {
  // the T-801 V12 widths (41 §2.5 M)
  const HEIGHTS = { 1920: 1080, 1440: 900, 768: 1024, 767: 900, 375: 812 }
  const REACT_300 = /^Error: Minified React error #300;/
  const REACT_310 = /^Error: Minified React error #310;/
  // the blocked browser report of Sentry 7 goes to the envelope endpoint (AD-025; Sentry 5.30:
  // .../api/0/store/?sentry_key=public&sentry_version=7)
  const SENTRY_CSP =
    /^Connecting to 'https:\/\/o0\.ingest\.sentry\.io\/api\/0\/envelope\/\?sentry_version=7&sentry_key=public&sentry_client=sentry\.javascript\.browser%2F11\.12\.0' violates the following Content Security Policy directive: "connect-src /
  const SENTRY_FETCH =
    /^Fetch API cannot load https:\/\/o0\.ingest\.sentry\.io\/api\/0\/envelope\/\?sentry_version=7&sentry_key=public&sentry_client=sentry\.javascript\.browser%2F11\.12\.0\. Refused to connect because it violates the document's Content Security Policy\.$/
  const SENTRY_URL =
    'https://o0.ingest.sentry.io/api/0/envelope/?sentry_version=7&sentry_key=public&sentry_client=sentry.javascript.browser%2F11.12.0'
  // insertions of the "Similar works" section (a client render mounts it into the DOM; the hydrated mount of a
  // hard load inserts nothing)
  const countMounts = (page) =>
    page.addInitScript(() => {
      window.__p104similarMounts = 0
      const start = () =>
        new MutationObserver((list) => {
          for (const m of list)
            for (const n of m.addedNodes) {
              if (n.nodeType !== 1) continue
              const hs = [n, ...n.querySelectorAll('h2')].filter(
                (e) => e.tagName === 'H2' && e.textContent === 'Similar works'
              )
              window.__p104similarMounts += hs.length
            }
        }).observe(document, { subtree: true, childList: true })
      if (document.documentElement) start()
      else document.addEventListener('readystatechange', start, { once: true })
    })
  const mounts = (page) => page.evaluate(() => window.__p104similarMounts)

  for (const w of [1920, 1440, 768, 767, 375])
    test(`T-712 c2 @P1 works 1001 -> client nav to search -> Back at ${w}: E8 = 1 per mount (Back mounts twice, Q-100), held >= 1 s, loader before E8 resolves, remount loading state = T-801 V12 at 0 px`, async ({
      page,
      p2Env,
      guardLog,
    }) => {
      // Q-100: the client navigation from a hydrated works page to the search page logs React #300 and the
      // Back logs #310 (console.error), each followed by the browser Sentry report that the CSP blocks (Q-096)
      declareGuard('console', 'csp')
      page.setDefaultTimeout(ACTION_TIMEOUT)
      page.setDefaultNavigationTimeout(NAV_TIMEOUT)
      await page.setViewportSize({ width: w, height: HEIGHTS[w] })
      await setFixedTime(page)
      await countMounts(page)
      const log = netLog(page, p2Env)
      const timing = e8Timing(page)
      const gate = await holdRequests(page, recommendMatch, { minMs: 1000 })
      const tracker = trackPage(page)

      // ---- mount 1: hard load (the hydrated mount) ----
      const res = await page.goto('/works/1001/')
      expect(res.status()).toBe(200)
      await settle(page, tracker, { ignore: ignoreRecommend })
      await expect.poll(() => gate.count()).toBe(1)
      await expect(page.getByText(LOADING, { exact: true })).toBeVisible()
      expect(timing.map((e) => e.done)).toEqual([null])
      gate.releaseHeld()
      await expect(page.getByText(LOADING, { exact: true })).toHaveCount(0)
      await settle(page, tracker)
      expect((await similarState(page)).ids).toEqual(SIMILAR_1001)
      expect(await mounts(page)).toBe(0)
      expect(guardLog.consoleErrors).toEqual([])

      // ---- client navigation to the search page: no E8; React #300 (Q-100), the page renders ----
      await page.evaluate(() => window.next.router.push('/search/?q=climate'))
      await expect(page).toHaveURL(`${p2Env.baseURL}/search/?q=climate`)
      await settle(page, tracker)
      await expect(
        page.getByText('research outputs found', { exact: false })
      ).toBeVisible()
      await expect.poll(() => guardLog.consoleErrors.length).toBe(3)
      expect(recommendBodies(log.entries)).toEqual([E8_WORK_1001])

      // ---- Back to the works page: React #310, the page mounts twice, one E8 per mount ----
      await page.goBack()
      await expect(page).toHaveURL(`${p2Env.baseURL}/works/1001/`)
      await settle(page, tracker, { ignore: ignoreRecommend })
      await expect.poll(() => gate.count()).toBe(2)
      await expect(page.getByText(LOADING, { exact: true })).toBeVisible()
      expect(await mounts(page)).toBe(2)
      expect(recommendBodies(log.entries)).toEqual([
        E8_WORK_1001,
        E8_WORK_1001,
        E8_WORK_1001,
      ])
      expect(timing.map((e) => e.done === null)).toEqual([false, true, true])
      expect(await similarState(page)).toEqual({
        ids: [],
        loader: true,
        error: false,
      })
      await expect.poll(() => guardLog.consoleErrors.length).toBe(6)
      // the remount's loading state is the T-801 V12 loading capture of a hard load
      await visualReady(page, { loaders: false, tiles: true })
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
      await expectBaselinePixels(
        page,
        t801Baseline('t801-content.spec.mjs', `V12-works-loading-${w}`)
      )
      gate.release()
      await expect(page.getByText(LOADING, { exact: true })).toHaveCount(0)
      await settle(page, tracker)
      expect((await similarState(page)).ids).toEqual(SIMILAR_1001)
      expect(await mounts(page)).toBe(2)
      // one E8 per mount, each answered 200 at least 1 s after it was sent
      expect(timing.map((e) => [e.body, e.status])).toEqual([
        [E8_WORK_1001, 200],
        [E8_WORK_1001, 200],
        [E8_WORK_1001, 200],
      ])
      for (const e of timing)
        expect(e.done - e.sent).toBeGreaterThanOrEqual(1000)
      expect(recommendBodies(log.entries)).toHaveLength(3)
      expectConsole(guardLog, [
        REACT_300,
        SENTRY_CSP,
        SENTRY_FETCH,
        REACT_310,
        SENTRY_CSP,
        SENTRY_FETCH,
      ])
      await expect
        .poll(() =>
          guardLog.csp.map((v) => [v.effectiveDirective, v.blockedURI])
        )
        .toEqual([
          ['connect-src', SENTRY_URL],
          ['connect-src', SENTRY_URL],
        ])
      expect(guardLog.sentry).toEqual([])
    })
})

test.describe('T-712 @P1 window events', () => {
  test('T-712 c3 @P1 works 1001 after settle: visibilitychange, blur/focus, offline/online send no E8 and change neither DOM nor URL', async ({
    page,
    p2Env,
    context,
  }) => {
    const log = netLog(page, p2Env)
    const tracker = await open(page, '/works/1001/')
    expect((await similarState(page)).ids).toEqual(SIMILAR_1001)
    expect(recommendBodies(log.entries)).toEqual([E8_WORK_1001])
    const dom = () =>
      page.evaluate(() => document.getElementById('__next').innerHTML)
    const before = { dom: await dom(), url: page.url() }
    const m = log.mark()
    const steps = []
    const record = async (event) => {
      await settle(page, tracker)
      steps.push({
        event,
        url: rel(p2Env, page.url()),
        domUnchanged: (await dom()) === before.dom,
        e8: log.since(m).filter(isRecommend).length,
      })
    }
    for (const state of ['hidden', 'visible']) {
      await page.evaluate((s) => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => s,
        })
        Object.defineProperty(document, 'hidden', {
          configurable: true,
          get: () => s === 'hidden',
        })
        document.dispatchEvent(new Event('visibilitychange'))
      }, state)
      await record(`visibilitychange ${state}`)
    }
    for (const name of ['blur', 'focus']) {
      await page.evaluate((n) => window.dispatchEvent(new Event(n)), name)
      await record(`window ${name}`)
    }
    for (const offline of [true, false]) {
      await context.setOffline(offline)
      await record(offline ? 'offline' : 'online')
    }
    const after = log.since(m)
    // today nothing revalidates: no request at all, the DOM and the URL stay
    expect(after.map((e) => [e.method, e.url])).toEqual([])
    expect(page.url()).toBe(before.url)
    expect(steps.every((s) => s.domUnchanged && s.e8 === 0)).toBe(true)
    expect(
      stableJson({
        steps,
        requests: after.map((e) => [e.kind, e.method, rel(p2Env, e.url)]),
      })
    ).toMatchSnapshot('t712-c3-window-events.json')
  })
})
