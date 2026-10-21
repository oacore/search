// P0-13 page helpers for the search journeys (T-703..T-706): settled states (40 §5: web-first waits and
// expect.poll, no sleeps), the router watcher, the loading-bar log, the history log of the guard shaped per
// step, and the browser request log of one step (41 §2.2 browser column).
//
// A page is settled when it is hydrated, no request of the page is in flight, no Next.js route change is
// running, and that holds on two consecutive polls at least 500 ms apart (the effects that fire requests after
// a render, e.g. the filters' E2 and the member logos, start within that window). Absence assertions
// (E2 x0) are only made on a settled page. Waits are generous (90 s per navigation): the machine runs several
// stacks, builds and suites at once, and a starved renderer needs tens of seconds for one route change.
import crypto from 'node:crypto'
import { expect, historyLog } from '../../fixtures/guard.mjs'

export const NAV_TIMEOUT = 90000

// ---------- settled state ----------

// the page's React root is hydrated: Next's hydration measure (pages router), or the root container that
// legacy ReactDOM.hydrate (React 17, synchronous) leaves on #__next
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
    { timeout: NAV_TIMEOUT }
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

// router events of the hydrated app (window.next.router is the client router of Next 10). `routing` is 1 from
// a routeChangeStart until the next routeChangeComplete or routeChangeError.
export async function watchRouter(page) {
  await page.waitForFunction(
    () => Boolean(window.next && window.next.router),
    null,
    { timeout: NAV_TIMEOUT }
  )
  await page.evaluate(() => {
    if (window.__p13router) return
    const w = { routing: 0, events: [] }
    window.__p13router = w
    const ev = window.next.router.events
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

export const routerEvents = (page) =>
  page.evaluate(() => (window.__p13router ? window.__p13router.events : null))

export async function settle(page, tracker, { timeout = NAV_TIMEOUT } = {}) {
  let last = null
  let routing = null
  try {
    await waitHydrated(page)
    await expect
      .poll(
        async () => {
          routing = await page
            .evaluate(() =>
              window.__p13router ? window.__p13router.routing : 0
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

// let the tasks that the last render queued run: React 17 flushes passive effects (the filters' E2 call starts in
// one) from a scheduler task after the commit. Two frames and a zero timer pass after everything queued before;
// bounded, so a stalled frame clock never hangs a test.
export const flushTasks = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const give = setTimeout(resolve, 3000)
        const frame = (n) =>
          requestAnimationFrame(() =>
            setTimeout(() => {
              if (n > 1) return frame(n - 1)
              clearTimeout(give)
              return resolve()
            }, 0)
          )
        frame(2)
      })
  )

// ---------- loading bar ----------

// init script: the design LoadingBar is a plain div (class loading-bar-loading-bar-*); log when one is added
// to and removed from the document, so "appears, then disappears" is a recorded fact and not a race
export const loadingBarInit = () => {
  const w = (window.__p13bar = { events: [] })
  const isBar = (n) =>
    n.nodeType === 1 && /(^|\s)loading-bar-loading-bar/.test(n.className || '')
  const scan = (list, kind) => {
    for (const n of list)
      if (isBar(n)) w.events.push(kind)
      else if (n.nodeType === 1 && n.querySelector)
        for (const _ of n.querySelectorAll(
          '[class*="loading-bar-loading-bar"]'
        ))
          w.events.push(kind)
  }
  new MutationObserver((records) => {
    for (const r of records) {
      scan(r.addedNodes, 'added')
      scan(r.removedNodes, 'removed')
    }
  }).observe(document, { subtree: true, childList: true })
}

export const installLoadingBarLog = (page) => page.addInitScript(loadingBarInit)

export const loadingBarEvents = (page) =>
  page.evaluate(() => (window.__p13bar ? window.__p13bar.events : null))

// ---------- history log (guard init script) shaped per step ----------

// relative form of a logged URL (the stack origin dropped)
export const rel = (p2Env, url) =>
  url == null ? url : url.replace(new URL(p2Env.baseURL).origin, '')

export async function historySince(page, p2Env, from) {
  const all = await historyLog(page)
  return all.slice(from).map((h) => ({
    method: h.method,
    url: rel(p2Env, h.url),
    ...(h.stateKeys ? { stateKeys: h.stateKeys } : {}),
    scrollRestoration: h.scrollRestoration,
    scrollY: h.scrollY,
  }))
}

// ---------- browser request log ----------

// Logged: main-frame document navigations of the stack, every `_next/data` request, every request to the API
// hosts (api.core.ac.uk, doi.org) with method, URL and body, and a per-host count of third-party hosts the
// guard serves or aborts. Not logged: static assets (chunks, CSS, images, icons.svg, tiles), whose names are
// build hashes, and OPTIONS preflights (40 §1).
const API_HOSTS = new Set(['api.core.ac.uk', 'doi.org'])
const THIRD_PARTY = [
  /(^|\.)googletagmanager\.com$/,
  /(^|\.)google-analytics\.com$/,
  /(^|\.)lgrckt-in\.com$/,
  /(^|\.)logrocket\.com$/,
  /(^|\.)logr-in\.com$/,
  /(^|\.)sentry\.io$/,
]

export function netLog(page, env) {
  const stack = new Set(
    [env.baseURL, env.allowURL, env.appURL]
      .filter(Boolean)
      .map((u) => new URL(u).origin)
  )
  const entries = []
  page.on('request', (r) => {
    if (r.method() === 'OPTIONS') return
    let u
    try {
      u = new URL(r.url())
    } catch {
      return
    }
    let kind = null
    if (
      stack.has(u.origin) &&
      r.isNavigationRequest() &&
      r.frame() === page.mainFrame()
    )
      kind = 'document'
    else if (stack.has(u.origin) && u.pathname.includes('/_next/data/'))
      kind = 'next-data'
    else if (API_HOSTS.has(u.hostname)) kind = 'api'
    else if (THIRD_PARTY.some((re) => re.test(u.hostname))) kind = 'third-party'
    if (!kind) return
    const body = r.postDataBuffer()
    entries.push({
      kind,
      method: r.method(),
      url: r.url(),
      host: u.hostname,
      bodyText: body ? body.toString('utf8') : null,
      bodySha256: body
        ? crypto.createHash('sha256').update(body).digest('hex')
        : null,
    })
  })
  return {
    entries,
    mark: () => entries.length,
    since: (m) => entries.slice(m),
  }
}

const E2_URL = 'https://api.core.ac.uk/v3/search/works/aggregate'
export const isE2 = (e) => e.method === 'POST' && e.url === E2_URL
export const isNextData = (e) => e.kind === 'next-data'
export const isDocument = (e) => e.kind === 'document'
export const isLogo = (e) =>
  e.kind === 'api' && /\/data-providers\/[^/]+\/logo$/.test(e.url)

// the decoded `q` of the E2 bodies of a step (the filters' aggregation calls)
export const e2Queries = (list) =>
  list.filter(isE2).map((e) => JSON.parse(e.bodyText).q)

// `_next/data` requests of a step as { path, query } with the build ID normalised
export const nextDataOf = (list, buildId) =>
  list.filter(isNextData).map((e) => {
    const u = new URL(e.url)
    return {
      path: u.pathname.split(buildId).join('<buildId>'),
      query: Object.fromEntries(u.searchParams),
    }
  })

export const buildIdOf = (page) =>
  page.evaluate(() => window.__NEXT_DATA__.buildId)

// ---------- pointer-events traps (Q-083) ----------

// whether a real pointer at the centre of the element would reach it (or a descendant): the element at that
// point is not hidden by `pointer-events:none`. The element is scrolled into view first.
export async function pointerReaches(locator) {
  await locator.scrollIntoViewIfNeeded()
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(
      r.left + r.width / 2,
      r.top + r.height / 2
    )
    return Boolean(hit) && (hit === el || el.contains(hit))
  })
}

// a real mouse click at the centre of the element (what a pointer does; the element under the point takes it)
export async function clickCentre(page, locator) {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}
