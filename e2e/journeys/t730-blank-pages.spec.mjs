// T-730 (41, J24; R-058): the Q-074 (a)-(e) blank pages. Per fixture: the SSR HTML is intact (200, #__next
// rendered, __NEXT_DATA__ present), the hydrated page ends with an empty #__next (Q-010: the ErrorBoundary of
// pages/_app.jsx has no fallback), and the error signature is pinned exactly: React 17 reports the render
// error through console.error (the boundary catches it, so no `pageerror` and no window `error`), and the one
// Sentry report it triggers is blocked by the CSP (`connect-src ... sentry.io` does not cover the test DSN host
// o0.ingest.sentry.io; Q-096, R-026), which prints two more console errors and one securitypolicyviolation;
// no Sentry request leaves the page. The guard's console and csp checks are declared expected (guard-expect)
// and asserted here exactly.
import { test as base, expect } from '../fixtures/guard.mjs'
import { p012Fixtures } from '../lib/P0-12/fixtures.mjs'
import { Q074 } from '../lib/P0-12/routes.mjs'
import {
  firstLine,
  pageConsole,
  settle,
  ssrNextMarkup,
  trackRequests,
} from '../lib/P0-12/page.mjs'

const test = base.extend(p012Fixtures)
// a hard load plus the settle wait can take minutes on a heavily loaded machine (40 §5: timeouts, never retries)
test.describe.configure({ timeout: 300000 })

// Sentry 7 reports to the envelope endpoint (AD-026; Sentry 5.30:
// .../api/0/store/?sentry_key=public&sentry_version=7)
const STORE =
  'https://o0.ingest.sentry.io/api/0/envelope/?sentry_version=7&sentry_key=public&sentry_client=sentry.javascript.nextjs%2F11.12.0'
// the connect-src directive as Chromium quotes it, with the LogRocket host of CS-LR-2 (AD-053 for T-730; AD-035 for T-716 c3)
const CSP_CONNECT =
  "connect-src 'self' *.core.ac.uk core.ac.uk sentry.io *.google-analytics.com *.doubleclick.net *.googletagmanager.com *.cloudflareinsights.com *.logrocket.com *.lgrckt-in.com *.logr-in.com"
const CSP_LINES = [
  `Connecting to '${STORE}' violates the following Content Security Policy directive: "${CSP_CONNECT}". The action has been blocked.`,
  `Fetch API cannot load ${STORE}. Refused to connect because it violates the document's Content Security Policy.`,
]

const nextInner = (page) =>
  page.evaluate(() => {
    const n = document.querySelector('#__next')
    return n ? n.innerHTML : null
  })

for (const q of Q074)
  test(`T-730 @P0 ${q.id} ${q.path}: ${q.what}: #__next empty, error signature, SSR HTML intact (${q.clause})`, async ({
    page,
    request,
    p2Env,
    guardLog,
  }) => {
    test
      .info()
      .annotations.push(
        { type: 'guard-expect', description: 'console' },
        { type: 'guard-expect', description: 'csp' }
      )

    // SSR HTML intact (through the gateway-faithful proxy)
    const raw = await request.get(`${p2Env.baseURL}${q.path}`)
    expect(raw.status()).toBe(200)
    const html = await raw.text()
    const ssr = ssrNextMarkup(html)
    expect(ssr).not.toBeNull()
    expect(ssr).toContain(q.ssrMarker)
    expect(ssr).toContain('<main')
    expect(html).toContain(
      '<script id="__NEXT_DATA__" type="application/json">'
    )

    const tracker = trackRequests(page)
    const res = await page.goto(q.path)
    expect(res.status()).toBe(200)
    expect(ssrNextMarkup(await res.text())).toBe(ssr)

    if (q.openYearFacet) {
      // the page hydrates and renders; opening the year facet throws in render
      await settle(page, tracker)
      expect((await nextInner(page)).length).toBeGreaterThan(0)
      await page
        .locator('[role="presentation"]')
        .filter({ has: page.getByText('year', { exact: true }) })
        .click()
    }

    await expect.poll(() => nextInner(page), { timeout: 120000 }).toBe('')
    await settle(page, tracker)
    expect(await nextInner(page)).toBe('')

    // the error signature (React 17 + ErrorBoundary without fallback)
    expect(guardLog.pageErrors.map((e) => e.message)).toEqual([])
    expect(guardLog.windowErrors.map((e) => e.message)).toEqual([])
    const errors = pageConsole(guardLog)
      .filter((c) => c.type === 'error')
      .map((c) => firstLine(c.text))
      .sort()
    expect(errors).toEqual([q.signature, ...CSP_LINES].sort())
    expect(
      guardLog.csp.map((v) => [v.effectiveDirective, v.blockedURI])
    ).toEqual([['connect-src', STORE]])
    expect(guardLog.sentry).toEqual([])
    expect(guardLog.unexpected).toEqual([])
    expect(guardLog.badResponses).toEqual([])
  })
