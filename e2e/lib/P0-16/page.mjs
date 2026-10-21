// P0-16 page helpers: the settled state (40 §5 "settled states only": web-first waits and expect.poll, no
// sleeps), a guarded context for a sub-stack (T-721 c2) and the routes of T-721/T-907.
import { expect, guardContext } from '../../fixtures/guard.mjs'
import { LOCALE, TIMEZONE_ID } from '../../fixtures/constants.mjs'
import { LOADER_SELECTORS } from '../../fixtures/visual-ready.mjs'
import { coverBrowserGaps } from './harness-gaps.mjs'

// the log shape of e2e/fixtures/guard.mjs (emptyLog is not exported): a sub-stack context writes into its own
// object, so the package's main guard never sees the control stack's violations
export const newGuardLog = () => ({
  requests: [],
  console: [],
  consoleErrors: [],
  pageErrors: [],
  windowErrors: [],
  csp: [],
  badResponses: [],
  unexpected: [],
  unmatched: [],
  aborted: {},
  sentry: [],
  corsAdded: [],
  guardAbortConsole: [],
  preflights: 0,
  screenshots: 0,
  ssrProblems: [],
})

// a guarded context for another stack (its own env, resolver and log), with the harness-gap stand-ins
export async function guardedContext(
  browser,
  { env, resolver, log, gaps, cookieState = 'absent', javaScriptEnabled = true }
) {
  const ctx = await browser.newContext({
    javaScriptEnabled,
    baseURL: env.baseURL,
    timezoneId: TIMEZONE_ID,
    locale: LOCALE,
  })
  await guardContext(ctx, {
    env,
    resolver,
    log,
    cookieState,
    baseURL: env.baseURL,
  })
  await coverBrowserGaps(ctx, { p2Env: env, resolver, gaps })
  return ctx
}

// in-flight requests of one page (incl. the ones the guard fulfils or aborts); attach before the first goto
export function trackPage(page) {
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

// 1 while the client router runs a route change (routeChangeStart until routeChangeComplete or -Error)
async function watchRouter(page) {
  await page.waitForFunction(() => Boolean(window.next && window.next.router))
  await page.evaluate(() => {
    if (window.__p016router) return
    const w = { routing: 0 }
    window.__p016router = w
    const ev = window.next.router.events
    ev.on('routeChangeStart', () => {
      w.routing = 1
    })
    ev.on('routeChangeComplete', () => {
      w.routing = 0
    })
    ev.on('routeChangeError', () => {
      w.routing = 0
    })
  })
}

const pageState = (page) =>
  page.evaluate(
    (loaders) =>
      new Promise((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            resolve({
              routing: window.__p016router ? window.__p016router.routing : 0,
              loaders: loaders.reduce(
                (n, sel) => n + document.querySelectorAll(sel).length,
                0
              ),
              images: [...document.images].every((i) => i.complete),
              tiles: [...document.querySelectorAll('img.leaflet-tile')].every(
                (i) => i.classList.contains('leaflet-tile-loaded')
              ),
            })
          )
        )
      ),
    LOADER_SELECTORS
  )

// Waits for the settled state and returns read()'s value in it: load event, hydration (Next 10's own
// `Next.js-hydration` measure; `hydrate: false` for a page whose scripts cannot load, the T-721 negative
// control), no request in flight, no route change, loaders gone, images complete, and the same read() on two
// consecutive polls. The timeouts are generous: the stacks of the parallel packages share this machine's CPUs.
export async function settle(
  page,
  tracker,
  read,
  { hydrate = true, timeout = 120000 } = {}
) {
  await page.waitForLoadState('load')
  if (hydrate) {
    await page.waitForFunction(
      () => performance.getEntriesByName('Next.js-hydration').length > 0,
      null,
      { timeout }
    )
    await watchRouter(page)
  }
  let last = null
  let value
  await expect
    .poll(
      async () => {
        const st = hydrate
          ? await pageState(page)
          : { routing: 0, loaders: 0, images: true, tiles: true }
        value = await read()
        const sig = JSON.stringify([st, tracker.started, value])
        const quiet =
          tracker.inflight.size === 0 &&
          st.routing === 0 &&
          st.loaders === 0 &&
          st.images &&
          st.tiles
        const stable = quiet && sig === last
        last = sig
        return stable
      },
      { timeout, intervals: [300, 300, 300, 500] }
    )
    .toBe(true)
  return value
}

export const urlOf = (env, route) =>
  `${route.origin === 'allow' ? env.allowURL : env.baseURL}${route.path}`

export const stackOriginsOf = (env) =>
  new Set(
    [env.baseURL, env.allowURL, env.appURL]
      .filter(Boolean)
      .map((u) => new URL(u).origin)
  )

// a client route change through the app's own Next router (window.next.router, Next 10), settled the same way
export async function routeChange(page, tracker, read, target) {
  await page.evaluate(
    (u) =>
      new Promise((resolve, reject) => {
        const ev = window.next.router.events
        const ok = () => {
          ev.off('routeChangeComplete', ok)
          ev.off('routeChangeError', bad)
          resolve()
        }
        const bad = (err) => {
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
  return settle(page, tracker, read, { hydrate: false })
}
