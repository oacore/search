// Settled states only (40 §5): hydration done (Next 10's own `Next.js-hydration` measure), no request of the
// page in flight, no client route change running, loaders gone, images and map tiles complete, and the value
// read on two consecutive polls at least 300 ms apart (each read after two animation frames) is equal. The
// effects that fire requests after a render (E8 similar works, E9 citations, member logos) start within that
// window. No sleeps: the polls are expect.poll intervals. The timeouts are generous because the stacks of the
// parallel packages share this machine's CPUs (a hydration can stall for a minute under that load).
import { expect } from '../../fixtures/guard.mjs'
import { LOADER_SELECTORS } from '../../fixtures/visual-ready.mjs'

// in-flight requests of one page (incl. the third-party ones the guard aborts); attach before the first goto
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

export const hydrated = (page) =>
  page.waitForFunction(
    () => performance.getEntriesByName('Next.js-hydration').length > 0
  )

// 1 while the client router runs a route change (routeChangeStart until routeChangeComplete or -Error)
async function watchRouter(page) {
  await page.waitForFunction(() => Boolean(window.next && window.next.router))
  await page.evaluate(() => {
    if (window.__p10router) return
    const w = { routing: 0 }
    window.__p10router = w
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
              routing: window.__p10router ? window.__p10router.routing : 0,
              loaders: loaders.reduce(
                (n, sel) => n + document.querySelectorAll(sel).length,
                0
              ),
              images: [...document.images].every((i) => i.complete),
              tiles: [...document.querySelectorAll('img.leaflet-tile')].every(
                (i) => i.classList.contains('leaflet-tile-loaded')
              ),
              url: location.href,
            })
          )
        )
      ),
    LOADER_SELECTORS
  )

// waits for the settled state and returns read()'s value in it
export async function settle(page, tracker, read, { timeout = 120000 } = {}) {
  await page.waitForLoadState('load')
  await hydrated(page)
  await watchRouter(page)
  let last = null
  let value
  await expect
    .poll(
      async () => {
        const st = await pageState(page)
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

// a client navigation the way the app performs it (router.push of the hydrated page), then the settled state;
// url = where the router ends (default href)
export async function clientNav(
  page,
  tracker,
  href,
  read,
  { url = href, ...opts } = {}
) {
  await watchRouter(page)
  const base = new URL(page.url())
  await page.evaluate((u) => window.next.router.push(u), href)
  await expect(page).toHaveURL(new URL(url, base).href)
  return settle(page, tracker, read, opts)
}
