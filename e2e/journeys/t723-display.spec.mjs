// T-723 (41 H, `/display/:id/`, Q-075, Q-005, R-010, R-020): the `/display/` alias through the gateway-faithful
// proxy (the HTTPRoute rewrites the `/display` prefix to `/outputs`, 30 Q-005), as it behaves today:
//   render  /display/2001/ is answered in place (200, the URL stays): the app renders /outputs/2001/, so the
//           server HTML is byte-identical to /outputs/2001/ (page `/outputs/[id]`, query {id: '2001'}); the
//           client asPath stays `/display/2001/`, so after hydration the trail keeps only "Search results"
//           (React 17 deletes the server tail "> Research output from <provider>" silently: no console error,
//           Q-075) and the link keeps the server's href (attributes are not patched on hydration);
//           `/display/2001` (no slash) is the app's trailing-slash 308 to `/outputs/2001/`; `/display/` is the
//           app's 404 for `/outputs/` (Q-005).
//   client nav  router.push to /outputs/2004/ fetches /search/_next/data/<buildId>/outputs/2004.json and renders
//           the outputs trail; router.push to /display/2004/ is a document load (the client router has no
//           /display page), answered in place.
// Fixtures: outputs-2001, outputs-2004, members, logos.
import { test } from '../fixtures/guard.mjs'
import {
  expect,
  open,
  settle,
  netLog,
  rel,
  navigations,
  buildIdOf,
  ACTION_TIMEOUT,
  NAV_TIMEOUT,
  TEST_TIMEOUT,
} from '../lib/P1-04/page.mjs'

test.use({
  navigationTimeout: NAV_TIMEOUT,
  actionTimeout: ACTION_TIMEOUT,
  cookieState: 'essential',
})
test.describe.configure({ timeout: TEST_TIMEOUT })

const PROVIDER = 'Open Research Online (The Open University)'
const TAIL = `Research output from ${PROVIDER}`

// the breadcrumb trail of the output template (first element of the page's background block)
const trailOf = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('[class*="navigation-trail"]')
    return el
      ? [...el.children].map((c) => [
          c.tagName.toLowerCase(),
          c.textContent,
          c.getAttribute('href'),
        ])
      : null
  })
const ssrTrail = (html) => {
  const m = html.match(/<div class="[^"]*navigation-trail[^"]*">(.*?)<\/div>/s)
  return m
    ? [...m[1].matchAll(/<(a|span)\b([^>]*)>(.*?)<\/\1>/gs)].map((x) => [
        x[1],
        x[3].replace(/<!-- -->/g, '').replace(/&gt;/g, '>'),
        (x[2].match(/href="([^"]*)"/) || [null, null])[1],
      ])
    : null
}
const outputsTrail = (id) => [
  ['a', 'Search results', `https://core.ac.uk/search/?ts/${id}/`],
  ['span', '>', null],
  ['a', TAIL, '#'],
]

test.describe('T-723 @P1 /display/:id/', () => {
  test('T-723 @P1 render: /display/2001/ in place, server HTML = /outputs/2001/, hydrated trail without the tail (Q-075); /display/2001 308, /display/ 404 (Q-005)', async ({
    page,
    request,
    p2Env,
  }) => {
    // ---- the server answers (no redirect followed) ----
    const display = await request.get('/display/2001/', { maxRedirects: 0 })
    const outputs = await request.get('/outputs/2001/', { maxRedirects: 0 })
    expect([display.status(), outputs.status()]).toEqual([200, 200])
    const html = await display.text()
    expect(html).toBe(await outputs.text())
    expect(ssrTrail(html)).toEqual(outputsTrail(2001))
    const nextData = JSON.parse(
      html.match(
        /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s
      )[1]
    )
    expect([nextData.page, nextData.query]).toEqual([
      '/outputs/[id]',
      { id: '2001' },
    ])
    const noSlash = await request.get('/display/2001', { maxRedirects: 0 })
    expect([noSlash.status(), noSlash.headers().location]).toEqual([
      308,
      '/outputs/2001/',
    ])
    const prefixOnly = await request.get('/display/', { maxRedirects: 0 })
    expect(prefixOnly.status()).toBe(404)

    // ---- the browser: the URL stays, the client asPath is /display/2001/, the tail is gone ----
    await open(page, '/display/2001/')
    expect(rel(p2Env, page.url())).toBe('/display/2001/')
    expect(
      await page.evaluate(() => ({
        asPath: window.next.router.asPath,
        route: window.next.router.route,
        query: window.next.router.query,
        state: window.history.state && {
          url: window.history.state.url,
          as: window.history.state.as,
        },
      }))
    ).toEqual({
      asPath: '/display/2001/',
      route: '/outputs/[id]',
      query: { id: '2001' },
      state: { url: '/outputs/[id]/?id=2001', as: '/display/2001/' }, // AD-127
    })
    expect(await trailOf(page)).toEqual([outputsTrail(2001)[0]])
    await expect(page.getByText(TAIL, { exact: true })).toHaveCount(0)
    // the rest of the page is the outputs page
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /^Novel approach for deriving genome wide SNP analysis data/,
      })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Report', exact: true })
    ).toBeVisible()
    // the /outputs/2001/ load keeps the full trail
    await open(page, '/outputs/2001/')
    expect(await trailOf(page)).toEqual(outputsTrail(2001))
  })

  test('T-723 @P1 client nav from /display/2001/: router.push /outputs/2004/ = _next/data, outputs trail; router.push /display/2004/ = a document load, in place', async ({
    page,
    p2Env,
    guardLog,
  }) => {
    // row W4d-18 of the owner's jump 2 batch round 1 (signed 2026-10-30, applied apart): Next 12.3.7 prints the
    // route lookup error of the push to /display/2004/ before its document-load fallback; declared here and
    // asserted exactly below (no console line before that push, exactly that one line after it)
    test
      .info()
      .annotations.push({ type: 'guard-expect', description: 'console' })
    const log = netLog(page, p2Env)
    const tracker = await open(page, '/display/2001/')
    const buildId = await buildIdOf(page)

    let m = log.mark()
    await page.evaluate(() => window.next.router.push('/outputs/2004/'))
    await expect(page).toHaveURL(`${p2Env.baseURL}/outputs/2004/`)
    await settle(page, tracker)
    expect(navigations(log.since(m), p2Env, buildId)).toEqual([
      [
        'next-data',
        'GET',
        '/search/_next/data/<buildId>/outputs/2004.json?id=2004',
      ],
    ])
    expect(log.since(m).filter((e) => e.kind === 'next-data')[0].status).toBe(
      200
    )
    expect(await trailOf(page)).toEqual(outputsTrail(2004))

    expect(guardLog.consoleErrors.map((x) => x.text.split('\n')[0])).toEqual([])
    m = log.mark()
    await page.evaluate(() => window.next.router.push('/display/2004/'))
    await expect(page).toHaveURL(`${p2Env.baseURL}/display/2004/`)
    await settle(page, tracker)
    expect(navigations(log.since(m), p2Env, buildId)).toEqual([
      ['document', 'GET', '/display/2004/'],
    ])
    expect(log.since(m).find((e) => e.kind === 'document').status).toBe(200)
    expect(await page.evaluate(() => window.next.router.asPath)).toBe(
      '/display/2004/'
    )
    expect(await trailOf(page)).toEqual([outputsTrail(2004)[0]])
    // W4d-18
    expect(guardLog.consoleErrors.map((x) => x.text.split('\n')[0])).toEqual([
      'Error: Failed to lookup route: /display/2004',
    ])
  })
})
