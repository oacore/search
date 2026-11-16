// T-731 (41 H, J23, R-045, R-085): the SSR failure matrix in the browser. The SSR 500 fixtures of T-601 c3
// (W-410-json, W-410-text, W-emptydate, W-nodp, O-nofulltext null and absent; Q-001, Q-073 (a)-(c)) plus the
// other two 500 routes of T-601 (works 4100, Q-001; /data-providers/?q=100%25, Q-028, Q-073 (d)). c1: a hard
// load answers 500 with Next's built-in error page inside the app layout and its 10.2.3 title (no
// pages/_error, Q-098); c2: the client data route of the same URL answers 200 JSON (the failure happens while
// rendering, after gSSP). Tables: e2e/lib/P0-09/routes.mjs.
import { test, expect } from '../lib/P0-09/fixtures.mjs'
import { C3_ROWS, ERROR_TITLE, M, probe } from '../lib/P0-09/routes.mjs'
import { netLog } from '../lib/P0-09/netlog.mjs'
import { trackPage, settle } from '../lib/P0-09/settle.mjs'

// path, client data route under /search/_next/data/<buildId>, the pageProps keys of its JSON
const ROWS = [
  ...C3_ROWS.map((r) => ({ path: r.path, fixture: r.fixture })),
  { path: '/works/4100/', fixture: 'Works 4100 (API 410)' },
  { path: '/data-providers/?q=100%25', fixture: 'q=100% (URIError)' },
]
const DATA = {
  '/works/4101/': ['/works/4101.json?id=4101', ['serverError']],
  '/works/4102/': ['/works/4102.json?id=4102', ['serverError']],
  '/works/6948813/': ['/works/6948813.json?id=6948813', ['data']],
  '/works/4200/': ['/works/4200.json?id=4200', ['data']],
  '/outputs/2102/': ['/outputs/2102.json?id=2102', ['data']],
  '/outputs/2103/': ['/outputs/2103.json?id=2103', ['data']],
  '/works/4100/': ['/works/4100.json?id=4100', ['serverError']],
  '/data-providers/?q=100%25': [
    '/data-providers.json?q=100%25',
    ['initialState'],
  ],
}
const RESOURCE_500 =
  'Failed to load resource: the server responded with a status of 500 (Internal Server Error)'

test.describe('T-731 @P0 J23 SSR failure matrix', () => {
  // several page loads or ~70 sequential requests per test; the machine runs other stacks in parallel
  test.describe.configure({ timeout: 300000 })

  test('T-731 c1 @P0 T-601 500 fixtures in the browser: _error in layout, <title>', async ({
    page,
    p2Env,
    guardLog,
  }) => {
    // each 500 load prints two console lines (asserted exactly below)
    test
      .info()
      .annotations.push({ type: 'guard-expect', description: 'console' })
    const log = netLog(page, p2Env)
    const tracker = trackPage(page)
    const actual = []
    for (const row of ROWS) {
      const c0 = guardLog.consoleErrors.length
      const m = log.mark()
      const res = await page.goto(row.path)
      await settle(page, tracker)
      const view = await page.evaluate(() => {
        const d = window.__NEXT_DATA__
        const root = document.getElementById('__next')
        return {
          page: d.page,
          err: d.err
            ? { name: d.err.name, statusCode: d.err.statusCode }
            : null,
          pageProps: Object.keys((d.props && d.props.pageProps) || {}),
          header: root.querySelectorAll('header#header').length,
          footer: root.querySelectorAll('footer#footer').length,
          h2: [...root.querySelectorAll('main h2')].map((h) => h.textContent),
        }
      })
      actual.push({
        path: row.path,
        fixture: row.fixture,
        status: res.status(),
        title: await page.title(),
        ...view,
        requests: log
          .since(m)
          .filter((e) => e.kind !== 'third-party')
          .map((e) => [e.kind, e.method, e.url, e.status]),
        console: guardLog.consoleErrors
          .slice(c0)
          .map((e) => [
            e.text.split('\n')[0],
            e.location && e.location.url === `${p2Env.baseURL}${row.path}`
              ? '<document>'
              : '<script>',
          ]),
      })
      await expect(page.getByText(M.error500)).toBeVisible()
    }
    expect(actual).toEqual(
      ROWS.map((row) => ({
        path: row.path,
        fixture: row.fixture,
        status: 500,
        title: ERROR_TITLE,
        page: '/_error',
        err: { name: 'Internal Server Error.', statusCode: 500 },
        pageProps: [],
        header: 1,
        footer: 1,
        h2: ['An unexpected error has occurred.'],
        requests: [['document', 'GET', `${p2Env.baseURL}${row.path}`, 500]],
        console: [[RESOURCE_500, '<document>']], // AD-113, AD-229
      }))
    )
    expect(guardLog.pageErrors).toEqual([])
    expect(guardLog.windowErrors).toEqual([])
  })

  test('T-731 c2 @P0 _next/data 200 where direct is 500', async ({
    request,
    page,
    p2Env,
  }) => {
    const html = (await probe(request, p2Env.baseURL, '/search/?q=climate'))
      .body
    const buildId = /"buildId":"([^"]+)"/.exec(html)[1]
    const rows = []
    for (const row of ROWS) {
      const [dataPath] = DATA[row.path]
      const direct = await probe(request, p2Env.baseURL, row.path)
      const data = await probe(
        request,
        p2Env.baseURL,
        `/static/search/_next/data/${buildId}${dataPath}`
      )
      const json = JSON.parse(data.body)
      rows.push([
        row.path,
        direct.status,
        data.status,
        data.contentType,
        Object.keys(json),
        Object.keys(json.pageProps),
      ])
    }
    expect(rows).toEqual(
      ROWS.map((row) => [
        row.path,
        500,
        200,
        'application/json; charset=utf-8',
        ['statistics', '__N_SSP', 'pageProps'],
        DATA[row.path][1],
      ])
    )
    // the client's view: the same-origin data request of each route answers 200 JSON in the browser too
    // (sent from the takedown page, which loads without API calls or console output)
    const tracker = trackPage(page)
    await page.goto('/outputs/update/')
    await settle(page, tracker)
    const inPage = await page.evaluate(
      async ({ hrefs }) => {
        const out = []
        for (const href of hrefs) {
          const r = await fetch(href, { credentials: 'same-origin' })
          const j = await r.json()
          out.push([
            href,
            r.status,
            r.headers.get('content-type'),
            Object.keys(j.pageProps),
          ])
        }
        return out
      },
      {
        hrefs: ROWS.map(
          (row) => `/static/search/_next/data/${buildId}${DATA[row.path][0]}`
        ),
      }
    )
    expect(inPage).toEqual(
      ROWS.map((row) => [
        `/static/search/_next/data/${buildId}${DATA[row.path][0]}`,
        200,
        'application/json; charset=utf-8',
        DATA[row.path][1],
      ])
    )
  })
})
