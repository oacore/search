// P0-09 helpers: settled states for the browser journeys (40 §5 "settled states only"). A page is settled when
// it is hydrated, no request of the page is in flight, no Next.js route change is running, and that holds on
// two consecutive polls at least 500 ms apart (the effects that fire requests after a render, e.g. the
// filters' E2 and the member logos, start within that window). Absence assertions (E2 x0, E8 x0) are only made
// on a settled page. Waits are generous (NAV_TIMEOUT): with several stacks and builds on one machine (load
// averages above 100, swap nearly full), a page's renderer has been seen to stall for 90-146 s after its
// scripts loaded. A longer wait only delays a failure; every assertion still pins the same settled state.
import { expect } from '../../fixtures/guard.mjs'

export const NAV_TIMEOUT = 180000

// the page's React root is hydrated: Next's hydration measure (pages router), or the root container that
// legacy ReactDOM.hydrate (React 17, synchronous) or a React 18+ root leaves on #__next
export const waitHydrated = (page) =>
  page.waitForFunction(
    () => {
      const el = document.getElementById('__next')
      if (!el) return false
      return (
        performance.getEntriesByName('Next.js-hydration').length > 0 ||
        '_reactRootContainer' in el ||
        Object.keys(el).some((k) => k.startsWith('__reactContainer$'))
      )
    },
    null,
    { timeout: NAV_TIMEOUT, polling: 250 }
  )

// in-flight tracking of one page (requests issued by the page, incl. aborted third-party ones)
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

// router events of the hydrated app (window.next.router is the client router of Next 10). `routing` is 1
// from a routeChangeStart until the next routeChangeComplete or routeChangeError: a client-side
// `__N_REDIRECT` emits two starts (the requested URL, then the destination) and one complete.
export async function watchRouter(page) {
  await page.waitForFunction(
    () => Boolean(window.next && window.next.router),
    null,
    { timeout: NAV_TIMEOUT, polling: 250 }
  )
  await page.evaluate(() => {
    if (window.__p09router) return
    const w = { routing: 0, events: [] }
    window.__p09router = w
    const ev = window.next.router.events || window.next.emitter
    const on = (name, busy) =>
      ev.on(name, (url) => {
        w.routing = busy
        w.events.push([name, String(url && url.message ? url.message : url)])
      })
    on('routeChangeStart', 1)
    on('routeChangeComplete', 0)
    on('routeChangeError', 0)
  })
}

// router events seen since watchRouter (name, URL or error message)
export const routerEvents = (page) =>
  page.evaluate(() => (window.__p09router ? window.__p09router.events : null))

export async function settle(page, tracker, { timeout = NAV_TIMEOUT } = {}) {
  let last = null
  let routing = null
  try {
    await waitHydrated(page)
    await expect
      .poll(
        async () => {
          // read directly (no requestAnimationFrame: frames can stall for seconds on a loaded machine);
          // the 500 ms between two equal polls covers the effects that run after a commit
          routing = await page
            .evaluate(() =>
              window.__p09router ? window.__p09router.routing : 0
            )
            .catch(() => -1)
          const sig = `${tracker.inflight.size}|${routing}|${
            tracker.started
          }|${page.url()}`
          const stable =
            sig === last && tracker.inflight.size === 0 && routing === 0
          last = sig
          return stable
        },
        { timeout, intervals: [500] }
      )
      .toBe(true)
  } catch (e) {
    // name what kept the page busy
    const events = await routerEvents(page).catch(() => null)
    e.message += `\nsettle: router events ${JSON.stringify(
      (events || []).slice(-8)
    )}`
    e.message += `\nsettle: url ${page.url()}, routing ${routing}, in flight: ${
      [...tracker.inflight]
        .map((r) => `${r.method()} ${r.url().slice(0, 160)}`)
        .join(' | ') || 'none'
    }`
    throw e
  }
}
