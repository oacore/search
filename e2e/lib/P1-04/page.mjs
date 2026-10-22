// P1-04 page helpers (output and display journeys, T-709..T-713, T-723, T-732): settled states (40 §5
// "settled states only"), the app's request log, route gates for browser API calls, and the guard
// declarations of the journeys that pin console lines of today's app.
// A page is settled when it is hydrated, no request of the page is in flight, no Next.js route change is
// running, and that holds on two consecutive polls at least 500 ms apart. Absence assertions are made only on
// a settled page. Waits are generous: the machine runs other stacks and browsers at the same time (40 §5:
// timeouts, never retries).
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect as guardExpect, test } from '../../fixtures/guard.mjs'
import { SCREENSHOT_OPTIONS } from '../../fixtures/pixel-exact.mjs'
import { comparePngs, COMPARATOR } from '../../fixtures/pixel-compare.mjs'

export const NAV_TIMEOUT = 150000
export const ACTION_TIMEOUT = 90000
export const EXPECT_TIMEOUT = 60000
export const TEST_TIMEOUT = 480000

export const expect = guardExpect.configure({ timeout: EXPECT_TIMEOUT })

export const API = 'https://api.core.ac.uk'
export const RECOMMEND = `${API}/v3/recommend`

// ---------- settle ----------

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

// router events of the hydrated app (window.next.router is the client router of Next 10), per document
export async function watchRouter(page) {
  await page.waitForFunction(
    () => Boolean(window.next && window.next.router),
    null,
    { timeout: NAV_TIMEOUT, polling: 250 }
  )
  await page.evaluate(() => {
    if (window.__p104router) return
    const w = { routing: 0, events: [] }
    window.__p104router = w
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
  page.evaluate(() => (window.__p104router ? window.__p104router.events : null))

// settled: hydrated, router idle, nothing in flight (requests `ignore` matches excepted), the same request
// count and URL on two polls at least 500 ms apart
export async function settle(
  page,
  tracker,
  { timeout = NAV_TIMEOUT, ignore = () => false } = {}
) {
  let last = null
  let routing = null
  await waitHydrated(page)
  await watchRouter(page)
  try {
    await expect
      .poll(
        async () => {
          routing = await page
            .evaluate(() =>
              window.__p104router ? window.__p104router.routing : 0
            )
            .catch(() => -1)
          const open = [...tracker.inflight].filter((r) => !ignore(r)).length
          const sig = `${open}|${routing}|${tracker.started}|${page.url()}`
          const stable = sig === last && open === 0 && routing === 0
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
        .filter((r) => !ignore(r))
        .map((r) => `${r.method()} ${r.url().slice(0, 160)}`)
        .join(' | ') || 'none'
    }`
    throw e
  }
}

// open a page and settle it; returns the tracker
export async function open(page, path, { status = 200, ignore } = {}) {
  page.setDefaultTimeout(ACTION_TIMEOUT)
  page.setDefaultNavigationTimeout(NAV_TIMEOUT)
  const tracker = trackPage(page)
  const res = await page.goto(path, { timeout: NAV_TIMEOUT })
  expect(res.status(), `GET ${path}`).toBe(status)
  await settle(page, tracker, { ignore })
  return tracker
}

// the stack-relative form of a URL
export const rel = (p2Env, url) =>
  url == null ? url : url.split(new URL(p2Env.baseURL).origin).join('')

// ---------- the app's request log (documents, _next/data, API hosts) ----------
const API_HOSTS = new Set(['api.core.ac.uk', 'doi.org'])

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
    if (!kind) return
    const body = r.postDataBuffer()
    const e = {
      kind,
      method: r.method(),
      url: r.url(),
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

export const isRecommend = (e) => e.method === 'POST' && e.url === RECOMMEND
export const recommendBodies = (list) =>
  list.filter(isRecommend).map((e) => e.bodyText)
// documents and _next/data, stack-relative, the build ID as <buildId>
export const navigations = (list, p2Env, buildId) =>
  list
    .filter((e) => e.kind === 'document' || e.kind === 'next-data')
    .map((e) => [
      e.kind,
      e.method,
      rel(p2Env, e.url).split(buildId).join('<buildId>'),
    ])

export const buildIdOf = (page) =>
  page.evaluate(() => window.__NEXT_DATA__.buildId)

// ---------- route gates (browser API calls held until released) ----------
// The browser's answer of a request is held at a page route until `release()`; the guard's routing then answers
// it (route.fallback). OPTIONS preflights pass. `minMs` keeps each held request at least that long.
export async function holdRequests(page, match, { minMs = 0 } = {}) {
  const held = []
  let holding = true
  const pass = async (route) => {
    try {
      await route.fallback()
    } catch {
      // the page aborted the request itself (an unmounted fetch) or closed
    }
  }
  await page.route(match, async (route) => {
    if (route.request().method() === 'OPTIONS' || !holding) return pass(route)
    const at = Date.now()
    await new Promise((resolve) => held.push({ resolve, at }))
    const wait = minMs - (Date.now() - at)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    return pass(route)
  })
  return {
    count: () => held.length,
    // release everything held so far and pass later requests at once
    release() {
      holding = false
      for (const h of held.splice(0)) h.resolve()
    },
    // release what is held now; later requests are held again
    releaseHeld() {
      for (const h of held.splice(0)) h.resolve()
    },
  }
}

// ---------- guard declarations ----------
// a journey that pins console lines or CSP reports of today's app declares the guard kinds it asserts itself
// (negative-control rule of e2e/fixtures/guard.mjs) and checks the exact lines with expectConsole
export const declareGuard = (...kinds) => {
  for (const kind of kinds)
    test.info().annotations.push({ type: 'guard-expect', description: kind })
}

// the first lines of the page's console.error messages, in order, match `patterns` one to one
export const consoleLines = (guardLog) =>
  guardLog.consoleErrors.map((e) => e.text.split('\n')[0])
export function expectConsole(guardLog, patterns) {
  const lines = consoleLines(guardLog)
  expect(lines, `console.error lines: ${JSON.stringify(lines)}`).toHaveLength(
    patterns.length
  )
  patterns.forEach((re, i) => expect(lines[i]).toMatch(re))
  expect(guardLog.pageErrors).toEqual([])
  expect(guardLog.windowErrors).toEqual([])
}

// ---------- small utils ----------
export const sha256 = (buf) =>
  crypto.createHash('sha256').update(buf).digest('hex')
// stable JSON text for snapshots (2-space indent, trailing newline)
export const stableJson = (v) => `${JSON.stringify(v, null, 2)}\n`

// ---------- timers ----------
// React 17 runs passive effects (useEffect) in a scheduler task posted through a MessageChannel, which
// page.clock does not fake: two message round trips let an effect queued by the last commit run, so a
// setTimeout it schedules exists before the test advances the paused clock
export const flushTasks = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const ch = new MessageChannel()
        let n = 0
        ch.port1.onmessage = () => {
          n += 1
          if (n === 2) resolve(true)
          else ch.port2.postMessage(n)
        }
        ch.port2.postMessage(n)
      })
  )

// ---------- pixels against another test's baseline ----------
const E2E_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)
// the committed capture of a T-801 state (e2e/visual/<spec>-snapshots/<name>-visual-<platform>.png)
export const t801Baseline = (spec, name) =>
  path.join(
    E2E_DIR,
    'visual',
    `${spec}-snapshots`,
    `${name}-visual-${process.platform}.png`
  )

// a full-page capture compared exactly (e2e/fixtures/pixel-exact.mjs rules: exact RGBA, a diff-pixels
// annotation per screenshot, the actual and diff PNGs attached on a difference) with a baseline that another
// test owns; never written here (record mode only notes that the comparison runs in compare mode)
export async function expectBaselinePixels(
  page,
  baselineFile,
  { fullPage = true } = {}
) {
  const info = test.info()
  const name = path.basename(baselineFile)
  const actual = await page.screenshot({ ...SCREENSHOT_OPTIONS, fullPage })
  if (process.env.RECORD === '1' || info.config.updateSnapshots === 'all') {
    info.annotations.push({
      type: 'diff-pixels',
      description: `${name}: another test's baseline, compared in compare mode only`,
    })
    return { recorded: false }
  }
  if (!fs.existsSync(baselineFile)) {
    info.annotations.push({
      type: 'diff-pixels',
      description: `missing baseline ${name}`,
    })
    throw new Error(
      `pixel-exact: no baseline ${path.relative(process.cwd(), baselineFile)}`
    )
  }
  const expected = fs.readFileSync(baselineFile)
  const res = comparePngs(expected, actual)
  info.annotations.push({
    type: 'diff-pixels',
    description: `${res.diffPixels} ${name} (${COMPARATOR})`,
  })
  if (!res.sameSize || res.diffPixels !== 0) {
    await info.attach(`${name}-actual`, {
      body: actual,
      contentType: 'image/png',
    })
    if (res.diffPng)
      await info.attach(`${name}-diff`, {
        body: res.diffPng,
        contentType: 'image/png',
      })
    throw new Error(
      `pixel-exact: ${name}: ${
        res.sameSize
          ? `${res.diffPixels} differing pixels`
          : `size ${res.width} x ${res.height}`
      } (${COMPARATOR})`
    )
  }
  return { diffPixels: 0 }
}

// ---------- other services ----------
// a page of another service (core.ac.uk in production) opened by the app: answered with an empty document at
// the context and counted, so the journey can assert where the browser went without leaving the stack
export async function answerOtherService(context, match) {
  const hits = []
  await context.route(match, (route) => {
    const r = route.request()
    hits.push({
      method: r.method(),
      url: r.url(),
      navigation: r.isNavigationRequest(),
    })
    return route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>other service</title>',
    })
  })
  return hits
}
