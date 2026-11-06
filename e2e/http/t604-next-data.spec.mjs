// T-604 (41 G, R-002, R-068): `_next/data` through the gateway prefix. Every clause runs on two stacks of the
// same build: the gateway-faithful proxy as today (`npm run e2e:up -- --run P0-09`) and the same proxy with the
// CS-OPS-1 rule (`npm run e2e:up -- --run P0-09-ops1 --overlay cs-ops-1`: PathPrefix /search/_next/data ->
// ReplacePrefixMatch /_next/data, 20 §2.0). Next 10.2.3 rewrites /search/_next/data itself
// (next.config.js:15-21), so both stacks answer the same bytes; only the gateway decision differs, read from the
// proxy's debug headers (X-P2-Route, X-P2-Upstream). HTTP answers via Playwright `request`; the browser halves
// show how the client router of today uses each answer (the `_app.jsx:70-80` data-href patch, R-002).
// Clauses: c1 JSON + pageProps, c2 __N_REDIRECT, c3 {notFound:true}, c4 stale buildId -> 404 + hard-nav
// fallback, c5 root /_next/data -> other service. Fixtures: works-1001, search-climate, e19-client-nav,
// provider-999999999, outputs/update (no API call).
import { test, expect } from '../lib/P0-09/fixtures.mjs'
import {
  probe,
  M,
  DEFAULT_TITLE,
  WORK_1001_TITLE,
} from '../lib/P0-09/routes.mjs'
import { netLog } from '../lib/P0-09/netlog.mjs'
import {
  trackPage,
  watchRouter,
  settle,
  routerEvents,
  NAV_TIMEOUT,
} from '../lib/P0-09/settle.mjs'

const DEBUG = { headers: { 'X-P2-Debug': '1' } }
const STALE = 'stale-build-id'
const API = 'https://api.core.ac.uk'
// browser App.getInitialProps on a client navigation to a page without gSSP (Q-011)
const E19 = [
  ['api', 'GET', `${API}/internal/statistics`, 200],
  ['api', 'GET', `${API}/internal/repositories/formap`, 200],
  ['api', 'GET', `${API}/internal/members`, 200],
]
const STATISTICS = { totalArticlesCount: 'more than 356 million' }
const RESOURCE_404 =
  'Failed to load resource: the server responded with a status of 404 (Not Found)'

const overlayOf = (env) => (env.proxy && env.proxy.overlay) || null
// the gateway decision for a /search/_next/data path: today the /search rule passes it through; with CS-OPS-1
// its own rule strips the prefix before the app
const gatewayOf = (env, path) =>
  overlayOf(env) === 'cs-ops-1'
    ? {
        route: '/search/_next/data',
        upstream: path.replace(/^\/search\/_next\/data/, '/_next/data'),
      }
    : { route: '/search', upstream: path }

const buildIdOf = async (request, env) => {
  const html = (await probe(request, env.baseURL, '/search/?q=climate')).body
  return /"buildId":"([^"]+)"/.exec(html)[1]
}

const annotate = (env) =>
  test.info().annotations.push({
    type: 'gateway',
    description: overlayOf(env) || 'today (no CS-OPS-1)',
  })

// a hard load, settled, with the request log and router watch of the page
async function hardLoad(page, env, path) {
  const log = netLog(page, env)
  const tracker = trackPage(page)
  await page.goto(path)
  await settle(page, tracker)
  await watchRouter(page)
  return { log, tracker }
}

// a client navigation by the router of the loaded page (Router.push, as next/link does); the promise is not
// awaited inside the page, since a hard-navigation fallback replaces the document
async function clientNav(page, env, { log, tracker }, target, { url } = {}) {
  await page.evaluate(() => {
    window.__marker = 'T-604'
  })
  const m = log.mark()
  await page.evaluate((t) => {
    window.next.router.push(t)
  }, target)
  await expect(page).toHaveURL(`${env.baseURL}${url || target}`, {
    timeout: NAV_TIMEOUT,
  })
  await settle(page, tracker)
  const entries = log
    .since(m)
    .filter((e) => e.kind !== 'third-party')
    .map((e) => [e.kind, e.method, e.url, e.status])
  return { entries, marker: await page.evaluate(() => window.__marker) }
}

const consoleLines = (guardLog) =>
  guardLog.consoleErrors.map((e) => [
    e.text.split('\n')[0],
    (e.location && e.location.url) || null,
  ])

test.describe('T-604 @P0 _next/data via the gateway prefix', () => {
  // several page loads or ~70 sequential requests per test; the machine runs other stacks in parallel
  test.describe.configure({ timeout: 300000 })

  test('T-604 c1 @P0 /search/_next/data/<id>/works/1001.json with and without CS-OPS-1: application/json + pageProps', async ({
    request,
    page,
    p2Env,
  }) => {
    annotate(p2Env)
    const id = await buildIdOf(request, p2Env)
    const paths = [
      `/search/_next/data/${id}/works/1001.json`,
      `/search/_next/data/${id}/works/1001.json?id=1001`,
    ]
    const rows = []
    for (const path of paths) {
      const p = await probe(request, p2Env.baseURL, path, DEBUG)
      // the app origin's own root data route: the bytes the client must get through the gateway
      const app = await probe(
        request,
        p2Env.appURL,
        path.replace(/^\/search\/_next\/data/, '/_next/data')
      )
      const json = JSON.parse(p.body)
      rows.push({
        path,
        status: p.status,
        contentType: p.contentType,
        route: p.route,
        upstream: p.upstream,
        keys: Object.keys(json),
        ssp: json.__N_SSP,
        statistics: json.statistics,
        pageProps: Object.keys(json.pageProps),
        work: [json.pageProps.data.id, json.pageProps.data.title],
        sameBytesAsApp: p.body === app.body && app.status === 200,
      })
    }
    expect(rows).toEqual(
      paths.map((path) => ({
        path,
        status: 200,
        contentType: 'application/json',
        ...gatewayOf(p2Env, path),
        keys: ['statistics', '__N_SSP', 'pageProps'],
        ssp: true,
        statistics: STATISTICS,
        pageProps: ['data'],
        work: [
          1001,
          'Mandatory due diligence laws and climate change litigation: Bridging the corporate climate accountability gap?',
        ],
        sameBytesAsApp: true,
      }))
    )

    // the client router takes that data path: a client navigation to the works page (from the takedown
    // page, which has no gSSP) requests it once, renders the work and keeps the window
    const s = await hardLoad(page, p2Env, '/outputs/update/')
    const nav = await clientNav(page, p2Env, s, '/works/1001/')
    expect(nav.entries.filter(([kind]) => kind !== 'api')).toEqual([
      [
        'next-data',
        'GET',
        `${p2Env.baseURL}/search/_next/data/${id}/works/1001.json?id=1001`,
        200,
      ],
    ])
    expect(nav.marker).toBe('T-604')
    await expect(page).toHaveTitle(WORK_1001_TITLE)
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Mandatory due diligence laws and climate change litigation: Bridging the corporate climate accountability gap?',
      })
    ).toBeVisible()
  })

  test('T-604 c2 @P0 __N_REDIRECT', async ({ request, page, p2Env }) => {
    annotate(p2Env)
    const id = await buildIdOf(request, p2Env)
    // the empty search redirects permanently to / (Q-002); its data route answers the redirect as props
    const path = `/search/_next/data/${id}/search.json`
    const p = await probe(request, p2Env.baseURL, path, DEBUG)
    expect({
      status: p.status,
      contentType: p.contentType,
      route: p.route,
      upstream: p.upstream,
      json: JSON.parse(p.body),
    }).toEqual({
      status: 200,
      contentType: 'application/json',
      ...gatewayOf(p2Env, path),
      json: {
        statistics: STATISTICS,
        __N_SSP: true,
        pageProps: { __N_REDIRECT: '/', __N_REDIRECT_STATUS: 308 },
      },
    })
    const doc = await probe(request, p2Env.baseURL, '/search/')
    expect([doc.status, doc.location]).toEqual([308, '/'])

    // in the browser the router follows the internal destination client-side: / is a page of the build
    // (pages/index.js, no gSSP), so App.getInitialProps runs in the browser (E19 x3, Q-011); no document
    // request, the window survives, the URL becomes / (a path the gateway does not route, Q-005)
    const s = await hardLoad(page, p2Env, '/search/?q=climate')
    const nav = await clientNav(page, p2Env, s, '/search/', { url: '/' })
    expect(nav.entries).toEqual([
      ['next-data', 'GET', `${p2Env.baseURL}${path}`, 200],
      ...E19,
    ])
    expect(nav.marker).toBe('T-604')
    expect(await routerEvents(page)).toEqual([
      ['routeChangeStart', '/search/'],
      ['routeChangeStart', '/'],
      ['routeChangeComplete', '/'],
    ])
    await expect(page).toHaveTitle(DEFAULT_TITLE)
  })

  test('T-604 c3 @P0 {notFound:true}', async ({
    request,
    page,
    p2Env,
    guardLog,
  }) => {
    // the browser half pins the console line Chromium prints for the 404 data answer (asserted below)
    test
      .info()
      .annotations.push({ type: 'guard-expect', description: 'console' })
    annotate(p2Env)
    const id = await buildIdOf(request, p2Env)
    // provider 999999999 is not in the provider map: gSSP returns notFound
    const path = `/search/_next/data/${id}/data-providers/999999999.json?id=999999999`
    const p = await probe(request, p2Env.baseURL, path, DEBUG)
    expect({
      status: p.status,
      contentType: p.contentType,
      route: p.route,
      upstream: p.upstream,
      body: p.body,
    }).toEqual({
      status: 404,
      contentType: null,
      ...gatewayOf(p2Env, path),
      body: '{"notFound":true}',
    })

    // the router renders the 404 page client-side (pages/404.jsx has no gSSP: E19 x3, Q-011); the URL stays
    const s = await hardLoad(page, p2Env, '/search/?q=climate')
    const nav = await clientNav(page, p2Env, s, '/data-providers/999999999/')
    expect(nav.entries).toEqual([
      ['next-data', 'GET', `${p2Env.baseURL}${path}`, 404],
      ...E19,
    ])
    expect(nav.marker).toBe('T-604')
    await expect(page.getByText(M.uhoh)).toBeVisible()
    expect(guardLog.pageErrors).toEqual([])
    expect(consoleLines(guardLog)).toEqual([
      [RESOURCE_404, `${p2Env.baseURL}${path}`],
    ])
  })

  test('T-604 c4 @P0 stale buildId -> 404 + hard-nav fallback', async ({
    request,
    page,
    p2Env,
    guardLog,
  }) => {
    // the browser half pins the console line Chromium prints for the stale 404 (asserted below)
    test
      .info()
      .annotations.push({ type: 'guard-expect', description: 'console' })
    annotate(p2Env)
    const path = `/search/_next/data/${STALE}/works/1001.json?id=1001`
    const p = await probe(request, p2Env.baseURL, path, DEBUG)
    // an unknown build ID is no data route: the app's 404 page as HTML
    expect({
      status: p.status,
      contentType: p.contentType,
      route: p.route,
      upstream: p.upstream,
      title: p.title,
      marker: p.text.includes(M.uhoh),
    }).toEqual({
      status: 404,
      contentType: 'text/html; charset=utf-8',
      ...gatewayOf(p2Env, path),
      title: DEFAULT_TITLE,
      marker: true,
    })

    // a client that still runs an older build (its page loader's build ID; what a deploy leaves in open tabs)
    // gets that 404, cannot parse it as data and falls back to a full navigation to the target
    const s = await hardLoad(page, p2Env, '/search/?q=climate')
    await page.evaluate((stale) => {
      window.next.router.pageLoader.buildId = stale
    }, STALE)
    const nav = await clientNav(page, p2Env, s, '/works/1001/')
    expect(nav.entries.filter(([kind]) => kind !== 'api')).toEqual([
      ['next-data', 'GET', `${p2Env.baseURL}${path}`, 404],
      ['document', 'GET', `${p2Env.baseURL}/works/1001/`, 200],
    ])
    expect(nav.marker).toBeUndefined()
    await expect(page).toHaveTitle(WORK_1001_TITLE)
    expect(guardLog.pageErrors).toEqual([])
    expect(consoleLines(guardLog)).toEqual([
      [RESOURCE_404, `${p2Env.baseURL}${path}`],
      // AD-137, AD-154, AD-172, AD-180, AD-204
      [
        'Error: Failed to load static props',
        `${p2Env.baseURL}/static/search/_next/static/chunks/pages/_app-567f1dd739948905.js`,
      ],
    ])
  })

  test('T-604 c5 @P0 root /_next/data -> other service', async ({
    request,
    p2Env,
  }) => {
    annotate(p2Env)
    const id = await buildIdOf(request, p2Env)
    const paths = [
      `/_next/data/${id}/works/1001.json?id=1001`,
      `/_next/data/${id}/search.json?q=climate`,
      `/_next/data/${STALE}/works/1001.json?id=1001`,
    ]
    const rows = []
    for (const path of paths) {
      const p = await probe(request, p2Env.baseURL, path, DEBUG)
      rows.push([path, p.status, p.contentType, p.route, p.body])
    }
    // no gateway rule has the root prefix, with or without CS-OPS-1
    expect(rows).toEqual(
      paths.map((path) => [path, 404, 'text/plain', 'other', `${M.other}\n`])
    )
    // the app itself would answer it: the 404 is the gateway's
    const app = await probe(request, p2Env.appURL, paths[0])
    expect([app.status, app.contentType]).toEqual([200, 'application/json'])
  })
})
