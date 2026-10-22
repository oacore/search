// P1-05 page helpers (T-714, T-715, T-716, T-726, T-727, T-735, T-736): settled states (40 §5 "settled states
// only": web-first waits and expect.poll, no sleeps), the router watcher, the app's browser request log, the
// history view of the guard's init script and the console views of the guard log.
//
// A page is settled when it is hydrated, no request of the page is in flight, no Next.js route change is
// running, and that holds on two consecutive polls at least 500 ms apart (the effects that fire requests after
// a render start within that window; the URL-sync debounce of /data-providers is 250 ms, the claim form's
// 500 ms). Absence assertions are only made on a settled page. Waits are generous (40 §5: timeouts, never
// retries): the machine runs several stacks, builds and suites at once, and a starved renderer needs tens of
// seconds for one route change.
import { expect, historyLog, stubControl } from '../../fixtures/guard.mjs'

export const NAV_TIMEOUT = 150000
export const ACTION_TIMEOUT = 90000
export const EXPECT_TIMEOUT = 60000
export const TEST_TIMEOUT = 480000

// the stack-relative form of a URL
export const rel = (p2Env, url) =>
  url == null ? url : url.split(new URL(p2Env.baseURL).origin).join('')

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

// router events of the hydrated app (window.next.router is the client router of Next 10), per document.
// `routing` is 1 from a routeChangeStart until the next routeChangeComplete or routeChangeError.
export async function watchRouter(page) {
  await page.waitForFunction(
    () => Boolean(window.next && window.next.router),
    null,
    { timeout: NAV_TIMEOUT, polling: 250 }
  )
  await page.evaluate(() => {
    if (window.__p105router) return
    const w = { routing: 0, events: [] }
    window.__p105router = w
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
  page.evaluate(() => (window.__p105router ? window.__p105router.events : null))

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
              window.__p105router ? window.__p105router.routing : 0
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

// ---------- the app's browser request log ----------

// Logged: main-frame document navigations of the stack, every `_next/data` request, every request to the API
// hosts (api.core.ac.uk, doi.org) with method, URL, body and status, and the third-party hosts the guard
// serves or aborts (kept apart). Not logged: static assets (chunks, CSS, images, icons.svg, tiles), whose names
// are build hashes, and OPTIONS preflights (40 §1).
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

export const buildIdOf = (page) =>
  page.evaluate(() => window.__NEXT_DATA__.buildId)

// app requests of one step as [kind, method, stack-relative URL (build id normalised), status], sorted: the
// requests of one action have no stable order (40 §1 normalises timing); third-party hosts are not part of
// the app's own contract here
export const requestsOf = (p2Env, buildId, list) =>
  list
    .filter((e) => e.kind !== 'third-party')
    .map((e) => [
      e.kind,
      e.method,
      rel(p2Env, e.url).split(buildId).join('<buildId>'),
      e.status,
    ])
    .sort((a, b) => (a.join(' ') < b.join(' ') ? -1 : 1))

// ---------- history ----------

// the guard's init script logs pushState/replaceState/popstate of the current document
export async function historySince(page, p2Env, from = 0) {
  const all = await historyLog(page)
  return all.slice(from).map((h) => ({
    method: h.method,
    url: rel(p2Env, h.url),
    ...(h.stateKeys ? { stateKeys: h.stateKeys } : {}),
  }))
}

// ---------- the SSR stub's wire window ----------

export const stubMark = (p2Env, name) =>
  stubControl(p2Env, 'POST', '/mark', { name })

// the server-side requests made since a mark: [method, path+search, status] in wire order
export async function stubWindow(p2Env, since) {
  const w = await stubControl(p2Env, 'GET', `/collect?since=${since}`)
  return w.records.map((r) => ({
    method: r.method,
    path: new URL(r.url).pathname + new URL(r.url).search,
    status: r.status,
    rule: r.rule,
    fixture: r.fixture || null,
    bodyLength: r.bodyLength,
  }))
}

// ---------- console views of the guard log ----------

// the lines Chromium prints for resources the guard itself aborted (40 §2.4 abort-and-count) are not page
// messages (the guard pushes the same entry object to both lists)
export function pageConsole(guardLog, from = 0) {
  const own = new Set(guardLog.guardAbortConsole)
  return guardLog.console.slice(from).filter((c) => !own.has(c))
}

// the first line of a console text (a React error carries its component stack on the following lines)
export const firstLine = (text) => text.split('\n')[0]
