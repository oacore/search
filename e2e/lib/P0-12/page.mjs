// P0-12 page helpers: guarded extra contexts (other time zones, JS off), request tracking, the settled state
// (40 §5 "settled states only": web-first waits and expect.poll, no sleeps) and the console views of the guard
// log that T-701 and T-741 read.
import { expect, guardContext } from '../../fixtures/guard.mjs'
import { LOCALE } from '../../fixtures/constants.mjs'
import { coverBrowserGaps } from './harness-gaps.mjs'
import { moInitScript } from './dom.mjs'

export const TIME_ZONES = ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']

export const tzSlug = (tz) => tz.replace(/[^A-Za-z0-9]+/g, '_')

// a guarded context like the guard's own `context` fixture (same routing, same log), with another time
// zone or JavaScript off; the caller closes it
export async function guardedContext(
  browser,
  {
    p2Env,
    resolver,
    guardLog,
    gaps,
    cookieState,
    timezoneId = 'UTC',
    js = true,
    mutations = js,
  }
) {
  const ctx = await browser.newContext({
    javaScriptEnabled: js,
    baseURL: p2Env.baseURL,
    timezoneId,
    locale: LOCALE,
  })
  await guardContext(ctx, {
    env: p2Env,
    resolver,
    log: guardLog,
    cookieState,
    baseURL: p2Env.baseURL,
  })
  await coverBrowserGaps(ctx, { p2Env, resolver, gaps })
  if (mutations) await ctx.addInitScript(moInitScript)
  return ctx
}

// in-flight requests of one page (incl. the ones the guard fulfils or aborts)
export function trackRequests(page) {
  const state = { inflight: new Set(), started: 0 }
  page.on('request', (r) => {
    state.inflight.add(r)
    state.started += 1
  })
  const done = (r) => state.inflight.delete(r)
  page.on('requestfinished', done)
  page.on('requestfailed', done)
  return state
}

export const urlOf = (p2Env, route) =>
  `${route.origin === 'allow' ? p2Env.allowURL : p2Env.baseURL}${route.path}`

// Leaflet fades a map tile in over 200 ms from the tile image's own load event, which can come after the tile's
// request has finished and after `quietMs` without a mutation, so a capture can end inside the fade (J3-W55-RB-1,
// docs/upgrade/records/W5.5.md: Leaflet tiles at opacity 0.18). A tile is at the end of its fade when Leaflet has
// set its opacity to 1, or, on a map without the fade animation, has marked it loaded.
const tilesFaded = () =>
  [...document.querySelectorAll('img.leaflet-tile')].every(
    (t) =>
      t.style.opacity === '1' ||
      (t.style.opacity === '' && t.classList.contains('leaflet-tile-loaded'))
  )

// settled: the load event, Next's own `Next.js-hydration` measure (JS on, hard loads; Next clears its
// measures on a client route change), no request in flight and no DOM mutation under <body> for `quietMs`
// (MutationObserver of dom.mjs moInitScript), all read by expect.poll; with `tileFade` (T-728 only, E3 (a) of the
// owner's jump 3 batch W6a) also every Leaflet tile at the end of its fade (tilesFaded), read before the quiet
// time, so a fade that starts after that read still counts as a mutation
export async function settle(
  page,
  tracker,
  {
    js = true,
    hydration = true,
    quietMs = 400,
    timeout = 120000,
    tileFade = false,
  } = {}
) {
  await page.waitForLoadState('load')
  if (!js) return
  if (hydration)
    await page.waitForFunction(
      () => performance.getEntriesByName('Next.js-hydration').length > 0,
      null,
      { timeout }
    )
  await expect
    .poll(
      async () => {
        const faded = !tileFade || (await page.evaluate(tilesFaded))
        const quiet = await page.evaluate(
          () =>
            performance.now() -
            (window.__p012 ? window.__p012.lastMutationAt : 0)
        )
        return faded && tracker.inflight.size === 0 && quiet >= quietMs
      },
      { timeout, intervals: [100] }
    )
    .toBe(true)
}

// the page module of a route-change target (Next 10 page path), for warmRoute
export const PAGE_OF_TARGET = {
  '/outputs/update/': '/outputs/update',
  '/data-providers/86/': '/data-providers/[id]',
}

// Next 10 gives a client route change 3.8 s to load the target page's scripts and CSS
// (MS_MAX_IDLE_DELAY in next/dist/client/route-loader.js) and falls back to a document navigation after
// that; on a saturated machine the asset requests alone can take longer. The target page's files (its
// entry of the client build manifest, the list Next's route loader reads) are fetched into the browser's
// HTTP cache first (immutable static files), as a production client that prefetched the link has them, so
// the route change itself runs as on an idle client. No request of the app's own code (data, API) is made
// here, nothing is executed and nothing is logged.
export async function warmRoute(page, target) {
  const route = PAGE_OF_TARGET[target]
  if (!route) return
  const files = await page.evaluate(async (r) => {
    const prefix = window.next.router.pageLoader.assetPrefix || ''
    const list = ((self.__BUILD_MANIFEST || {})[r] || []).map(
      (f) => `${prefix}/_next/${encodeURI(f)}`
    )
    await Promise.all(list.map((u) => fetch(u).then((res) => res.text())))
    return list
  }, route)
  expect(
    files.length,
    `client build manifest entry of ${route}`
  ).toBeGreaterThan(0)
}

// a client route change through the app's own Next router (window.next.router, Next 10), settled the same way
export async function routeChange(page, tracker, target) {
  await warmRoute(page, target)
  await page.evaluate(
    (u) =>
      new Promise((resolve, reject) => {
        const ev = window.next.router.events
        const ok = () => {
          ev.off('routeChangeComplete', ok)
          ev.off('routeChangeError', bad)
          resolve()
        }
        const bad = (err, url) => {
          // row W4d-21 of the owner's jump 2 batch round 1 (signed 2026-10-30, applied apart; 40 §8 rule 8):
          // Next 12.3.7 first cancels the finished shallow route of the URL sync (routeChangeError 'Route
          // Cancelled' of another url), then routes to the target as before; any other error still rejects
          if (
            err &&
            err.cancelled &&
            err.message === 'Route Cancelled' &&
            url !== u
          )
            return
          ev.off('routeChangeComplete', ok)
          ev.off('routeChangeError', bad)
          reject(new Error(`routeChangeError ${err && err.message}`))
        }
        ev.on('routeChangeComplete', ok)
        ev.on('routeChangeError', bad)
        window.next.router.push(u)
      }),
    target
  )
  await settle(page, tracker, { hydration: false })
}

// the SSR markup inside #__next of a raw HTML answer: Next 10 writes `<div id="__next">...</div>` (Next 12
// with React 17: `<div id="__next" data-reactroot="">`, React renders the div itself), then (dev only) script
// elements, then `<script id="__NEXT_DATA__"`
const NEXT_OPEN = ['<div id="__next">', '<div id="__next" data-reactroot="">']
export const ssrNextMarkup = (html) => {
  const open = NEXT_OPEN.find((o) => html.includes(o))
  const start = open ? html.indexOf(open) : -1
  const end = html.indexOf('<script id="__NEXT_DATA__"')
  if (start < 0 || end < start) return null
  let m = html.slice(start + open.length, end)
  m = m.replace(/(<script\b[^>]*><\/script>)+$/, '')
  return m.endsWith('</div>') ? m.slice(0, -'</div>'.length) : null
}

// ---------- console views of the guard log ----------
// lines Chromium prints for resources the guard itself aborted (40 §2.4 abort-and-count) are not page messages
// (the guard pushes the same entry object to both lists)
export function pageConsole(guardLog, from = 0) {
  const own = new Set(guardLog.guardAbortConsole)
  return guardLog.console.slice(from).filter((c) => !own.has(c))
}

export const firstLine = (s) => String(s).split('\n')[0]
