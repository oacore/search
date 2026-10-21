// P0-14 page helpers: settled states (40 §5 "settled states only"), the app's request log and the history
// view. A page is settled when it is hydrated, no request of the page is in flight, no Next.js route change is
// running, and that holds on two consecutive polls at least 500 ms apart (the effects that fire requests after
// a render start within that window; the URL-sync debounce is 250 ms, the claim form's 500 ms). Absence
// assertions are only made on a settled page. Waits are generous: the machine runs other stacks in parallel.
import { expect } from '../../fixtures/guard.mjs'

// Generous waits (40 §5: timeouts, never retries): the machine runs other stacks and browsers at the same time,
// and a loaded host has frozen a page for two minutes. A wait only costs time when a test fails.
export const NAV_TIMEOUT = 150000
export const ACTION_TIMEOUT = 90000
export const EXPECT_TIMEOUT = 60000
export const TEST_TIMEOUT = 480000

// the page's React root is hydrated (Next's hydration measure, or the legacy ReactDOM.hydrate container)
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

// router events of the hydrated app (window.next.router is the client router of Next 10); per document
export async function watchRouter(page) {
  await page.waitForFunction(
    () => Boolean(window.next && window.next.router),
    null,
    { timeout: NAV_TIMEOUT, polling: 250 }
  )
  await page.evaluate(() => {
    if (window.__p14router) return
    const w = { routing: 0, events: [] }
    window.__p14router = w
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

export const routerEvents = (page) =>
  page.evaluate(() => (window.__p14router ? window.__p14router.events : null))

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
              window.__p14router ? window.__p14router.routing : 0
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

// The app is one Node process: a server render of the 7 MB /data-providers page keeps its event loop busy for
// seconds. Next 10's route loader gives the first client navigation to a route 3.8 s to fetch the route's
// stylesheet and scripts ("Route did not complete loading"); past that it leaves the router and loads the page
// with a full navigation. A test that pins a client navigation therefore waits until the app answers three
// health probes in a row within a second, so a render in flight does not turn the navigation into a document
// load. (The probe goes to the app itself; the page, the stub and the proxy log are not involved.)
export async function appQuiet(p2Env) {
  let fast = 0
  await expect
    .poll(
      async () => {
        const t0 = Date.now()
        const res = await fetch(`${p2Env.appURL}/api/healthz/`).catch(
          () => null
        )
        fast =
          res && res.status === 200 && Date.now() - t0 < 1000 ? fast + 1 : 0
        return fast
      },
      { timeout: EXPECT_TIMEOUT, intervals: [250] }
    )
    .toBeGreaterThanOrEqual(3)
}

// the stack-relative form of a URL
export const rel = (p2Env, url) =>
  url.split(new URL(p2Env.baseURL).origin).join('')

// ---------- the app's request log (documents, _next/data, API hosts) ----------
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
    const e = {
      kind,
      method: r.method(),
      url: r.url(),
      host: u.hostname,
      bodyText: body ? body.toString('utf8') : null,
      status: null,
    }
    entries.push(e)
    r.response()
      .then((res) => {
        if (res) e.status = res.status()
      })
      .catch(() => {})
  })
  return {
    entries,
    mark: () => entries.length,
    since: (m) => entries.slice(m),
  }
}

// documents, _next/data and API requests (third-party hosts are not part of the app's own contract here)
export const appOnly = (list) => list.filter((e) => e.kind !== 'third-party')

// ---------- history view ----------
// the init script of the guard logs pushState/replaceState/popstate of the current document
export const historyOf = async (page, p2Env) =>
  (await page.evaluate(() => (window.__p2 || {}).history || [])).map((h) => ({
    method: h.method,
    url: h.url && h.url.split(new URL(p2Env.baseURL).origin).join('<origin>'),
    ...(h.stateKeys ? { stateKeys: h.stateKeys.join(',') } : {}),
  }))

// entries added to the session history by the current document: history.length - its length at document start
export const addedEntries = (page) =>
  page.evaluate(() => history.length - window.__p14h0)

// stable JSON text for snapshots (2-space indent, trailing newline)
export const stableJson = (v) => `${JSON.stringify(v, null, 2)}\n`
