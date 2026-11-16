// T-732 (41 H, J22, extends T-723; Q-075, Q-082, R-010, R-020): the `/display/:id` alias as a user journey
// through the gateway-faithful proxy (review:ui-flows §4.2 J22), as it behaves today:
//   - typing /display/2001 (no slash) ends on /outputs/2001/ (the app's trailing-slash 308) with the outputs
//     trail; /display/2001/ stays in place;
//   - breadcrumb flip: without JavaScript the trail is "Search results > Research output from <provider>";
//     hydration removes the separator and the tail (two nodes, no console error, Q-075);
//   - the Report chain works on the alias: takedown as Author sends E10 for output 2001, "Thank you!", and
//     "got it" does not soft-refresh (asPath `/display/2001/` is not `/outputs/2001`, Q-082);
//   - client navigation: router.push /outputs/2004/ (_next/data), Back to /display/2001/ fetches the data of
//     the history entry's page (`/outputs/2001.json`) and renders the trail on the client from the asPath
//     (`.../search/?ay/2001/`, the broken "Search results" link of UI-07), Forward fetches /outputs/2004.json.
// Fixtures: outputs-2001, outputs-2004, hand e10-report (takedown as author, report-ok), members, logos.
import { test } from '../fixtures/guard.mjs'
import {
  expect,
  open,
  settle,
  netLog,
  rel,
  navigations,
  buildIdOf,
  routerEvents,
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

const PROVIDER = 'Open Research Online (The Open University)'
const TAIL = `Research output from ${PROVIDER}`
const E10_URL = `${API}/internal/outputs/update`

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
const fullTrail = (hrefTail) => [
  ['a', 'Search results', `https://core.ac.uk/search/?${hrefTail}`],
  ['span', '>', null],
  ['a', TAIL, '#'],
]

test.describe('T-732 @P1 J22 /display/:id alias', () => {
  test('T-732 @P1 J22 /display/2001 (no slash) lands on /outputs/2001/ by a 308; /display/2001/ stays; the trail flips from the no-JS three parts to "Search results" on hydration', async ({
    page,
    jsOffContext,
    p2Env,
  }) => {
    // ---- no slash: the 308 of the app, the outputs page ----
    page.setDefaultTimeout(ACTION_TIMEOUT)
    const redirected = []
    page.on('response', (r) => {
      if (r.request().isNavigationRequest())
        redirected.push([r.status(), rel(p2Env, r.url())])
    })
    await open(page, '/display/2001')
    expect(redirected).toEqual([
      [308, '/display/2001'],
      [200, '/outputs/2001/'],
    ])
    expect(rel(p2Env, page.url())).toBe('/outputs/2001/')
    expect(await page.evaluate(() => window.next.router.asPath)).toBe(
      '/outputs/2001/'
    )
    expect(await trailOf(page)).toEqual(fullTrail('ts/2001/'))

    // ---- JS off: the server trail of /display/2001/ (three parts) ----
    const off = await jsOffContext.newPage()
    off.setDefaultTimeout(ACTION_TIMEOUT)
    const offRes = await off.goto('/display/2001/', { timeout: NAV_TIMEOUT })
    expect(offRes.status()).toBe(200)
    expect(rel(p2Env, off.url())).toBe('/display/2001/')
    expect(await trailOf(off)).toEqual(fullTrail('ts/2001/'))
    await off.close()

    // ---- JS on: hydration removes the separator and the tail (two nodes), silently ----
    await page.addInitScript(() => {
      window.__p104trail = []
      const start = () =>
        new MutationObserver((list) => {
          for (const m of list)
            if (
              m.target.nodeType === 1 &&
              /navigation-trail/.test(m.target.className)
            )
              for (const n of m.removedNodes)
                window.__p104trail.push(['removed', n.textContent])
        }).observe(document, { subtree: true, childList: true })
      if (document.documentElement) start()
      else document.addEventListener('readystatechange', start, { once: true })
    })
    await open(page, '/display/2001/')
    expect(rel(p2Env, page.url())).toBe('/display/2001/')
    expect(await trailOf(page)).toEqual([fullTrail('ts/2001/')[0]])
    expect(await page.evaluate(() => window.__p104trail)).toEqual([
      ['removed', '>'],
      ['removed', TAIL],
    ])
  })

  test('T-732 @P1 J22 Report on /display/2001/: takedown as Author sends E10 for 2001, Thank you!, "got it" does not soft-refresh (Q-082)', async ({
    page,
    p2Env,
  }) => {
    const log = netLog(page, p2Env)
    const tracker = await open(page, '/display/2001/')
    const buildId = await buildIdOf(page)
    await page.getByRole('button', { name: 'Report', exact: true }).click()
    const type = page.getByRole('dialog', { name: 'Problem-type-modal' })
    await type
      .getByText('The document should not be published', { exact: true })
      .click()
    await type.getByRole('button', { name: 'Continue' }).click()
    const form = page.getByRole('dialog', { name: 'Problem-form-modal' })
    await form.getByText('Author', { exact: true }).click()
    await expect(form).toContainText(
      'Why this document should not be published?'
    )
    await form.getByLabel('Name').fill('Test Reporter')
    await form.getByLabel('Email').fill('reporter@localhost')
    await form.getByLabel('Comment').fill('report-ok')
    await form.getByRole('button', { name: 'Submit' }).click()
    const success = page.getByRole('dialog', { name: 'Success-type-modal' })
    await expect(success.getByRole('heading', { level: 3 })).toHaveText(
      'Thank you!'
    )
    await expect(success).toContainText(
      `We can remove the output's record only if the the document was removed at ${PROVIDER}.`
    )
    await expect
      .poll(() =>
        log.entries
          .filter((e) => e.method === 'POST' && e.url === E10_URL)
          .map((e) => [e.bodyText, e.status])
      )
      .toEqual([
        [
          '{"outputId":2001,"name":"Test Reporter","email":"reporter@localhost","message":"report-ok","updateOption":"takeDownFullText","role":"author"}',
          201,
        ],
      ])
    const m = log.mark()
    await success.getByRole('button', { name: 'got it' }).click()
    await expect(success).toHaveCount(0)
    await settle(page, tracker)
    expect(navigations(log.since(m), p2Env, buildId)).toEqual([])
    expect(log.since(m)).toEqual([])
    expect(await routerEvents(page)).toEqual([])
    expect(rel(p2Env, page.url())).toBe('/display/2001/')
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(
      'unset'
    )
  })

  test('T-732 @P1 J22 client nav: /display/2001/ -> push /outputs/2004/ -> Back (/outputs/2001.json, client trail ?ay/2001/) -> Forward', async ({
    page,
    p2Env,
  }) => {
    const log = netLog(page, p2Env)
    const tracker = await open(page, '/display/2001/')
    const buildId = await buildIdOf(page)
    const step = async (fn, url) => {
      const m = log.mark()
      await fn()
      await expect(page).toHaveURL(`${p2Env.baseURL}${url}`)
      await settle(page, tracker)
      return {
        url: rel(p2Env, page.url()),
        asPath: await page.evaluate(() => window.next.router.asPath),
        requests: navigations(log.since(m), p2Env, buildId),
        status: log
          .since(m)
          .filter((e) => e.kind === 'next-data')
          .map((e) => e.status),
        trail: await trailOf(page),
      }
    }
    expect(
      await step(
        () => page.evaluate(() => window.next.router.push('/outputs/2004/')),
        '/outputs/2004/'
      )
    ).toEqual({
      url: '/outputs/2004/',
      asPath: '/outputs/2004/',
      requests: [
        [
          'next-data',
          'GET',
          '/static/search/_next/data/<buildId>/outputs/2004.json?id=2004',
        ],
      ],
      status: [200],
      trail: fullTrail('ts/2004/'),
    })
    expect(await step(() => page.goBack(), '/display/2001/')).toEqual({
      url: '/display/2001/',
      asPath: '/display/2001/',
      requests: [
        [
          'next-data',
          'GET',
          '/static/search/_next/data/<buildId>/outputs/2001.json?id=2001',
        ],
      ],
      status: [200],
      trail: [['a', 'Search results', 'https://core.ac.uk/search/?ay/2001/']],
    })
    expect(await step(() => page.goForward(), '/outputs/2004/')).toEqual({
      url: '/outputs/2004/',
      asPath: '/outputs/2004/',
      requests: [
        [
          'next-data',
          'GET',
          '/static/search/_next/data/<buildId>/outputs/2004.json?id=2004',
        ],
      ],
      status: [200],
      trail: fullTrail('ts/2004/'),
    })
    // one document for the whole journey
    expect(
      navigations(log.entries, p2Env, buildId).filter(
        (n) => n[0] === 'document'
      )
    ).toEqual([['document', 'GET', '/display/2001/']])
  })
})
