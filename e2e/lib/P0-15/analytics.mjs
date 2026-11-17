// P0-15 third-party views of one page (T-719, T-720, T-740; 40 §2.4 browser-host table). What the app does
// today, per 30 Q-059, Q-070, Q-071, Q-096 and 10 R-026, R-041:
//   GA        react-ga4 (2.1.0; 3.0.1 from W4c.2, the same calls) loads
//             https://www.googletagmanager.com/gtag/js?id=<GA_TRACKING_CODE> and pushes
//             `js` and `config` once, only when `analytics_cookies_allowed` was set at mount (hooks/use-analytics.js).
//             The guard answers gtag.js with an empty script, so `window.dataLayer` keeps every pushed entry.
//   LogRocket `LogRocket.init` on every App render in production loads https://cdn.logr-in.com/logger-1.min.js
//             (logrocket >= 11; https://cdn.lgrckt-in.com/logger-1.min.js with 10.0.0);
//             the guard aborts it and counts it in guardLog.aborted (after the CSP check, 40 §2.4).
//   Sentry    `Sentry.init({ dsn, ... })` with the test DSN `https://public@o0.ingest.sentry.io/0` (prod host shape);
//             a client error reports to .../api/0/envelope/ (Sentry 7; .../api/0/store/ with 5.30), which the CSP
//             `connect-src ... sentry.io` blocks (Q-096).
//
// The harness spy on dataLayer.push (guard.mjs initScript, `window.__p2.dataLayer`) records every entry twice
// when the app runs `window.dataLayer = window.dataLayer || []` (its setter wraps the already wrapped array
// again; issue P0-15-1). These helpers therefore read the array itself: with the empty gtag.js nothing consumes
// or reorders it, so its contents are exactly the entries the app pushed.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect } from '../../fixtures/guard.mjs'
import { settle, watchRouter } from './settle.mjs'
import { formatJsonSync } from '../../../scripts/prettier-sync.mjs'

const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
)

export const GA_ID = 'G-TEST000000'
export const GTAG_URL = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
// the recorder script host of logrocket >= 11 (CS-LR-1; AD-032 for T-719, AD-031 for the T-720 sweep;
// cdn.lgrckt-in.com with 10.0.0)
export const LOGROCKET_HOST = 'cdn.logr-in.com'
export const LOGROCKET_URL = `https://${LOGROCKET_HOST}/logger-1.min.js`
export const SENTRY_DSN = 'https://public@o0.ingest.sentry.io/0'
// the browser report URL of a client error: Sentry 7 sends every event to the envelope endpoint (AD-021 for
// T-719 c3, AD-022 for the T-720 control; Sentry 5.30 sent it to
// .../api/0/store/?sentry_key=public&sentry_version=7)
export const SENTRY_STORE =
  'https://o0.ingest.sentry.io/api/0/envelope/?sentry_version=7&sentry_key=public&sentry_client=sentry.javascript.nextjs%2F11.12.0'
export const GA_WARNING = "Send command doesn't exist: search"
export const LOGROCKET_WARNING =
  'LogRocket: script could not load. Check that you have a valid network connection.'

const GTAG_HOST = 'www.googletagmanager.com'
const GOOGLE =
  /(^|\.)(google[a-z-]*\.[a-z.]+|doubleclick\.net|googletagmanager\.com)$/
const LOGROCKET = /(^|\.)(logrocket\.com|lgrckt-in\.com|logr-in\.com)$/
const SENTRY = /(^|\.)sentry\.io$/
const CLOUDFLARE = /(^|\.)cloudflareinsights\.com$/

// baselines are committed JSON that `lint:json` checks with the repository's Prettier (40 §7 rule 7): they are
// written in that format, so a re-capture is byte-identical
export const stableJson = (v) => {
  const file = path.join(REPO, 'e2e', 'journeys', 'baseline.json')
  return formatJsonSync(v, file)
}

// the third-party requests the page issued (guardLog.requests holds every request, also the ones the guard
// aborts or fulfils), by class, from log index `from`
export function census(guardLog, from = 0) {
  const out = {
    gtag: [],
    google: [],
    logrocket: [],
    sentry: [],
    cloudflare: [],
  }
  for (const r of guardLog.requests.slice(from)) {
    let u
    try {
      u = new URL(r.url)
    } catch {
      continue
    }
    const line = `${r.method} ${r.url}`
    if (u.hostname === GTAG_HOST && u.pathname.startsWith('/gtag/js'))
      out.gtag.push(line)
    else if (GOOGLE.test(u.hostname)) out.google.push(line)
    else if (LOGROCKET.test(u.hostname)) out.logrocket.push(line)
    else if (SENTRY.test(u.hostname)) out.sentry.push(line)
    else if (CLOUDFLARE.test(u.hostname)) out.cloudflare.push(line)
  }
  return out
}

// the numbers the T-719 census table pins (guard counters next to the request log)
export const counts = (guardLog, from = 0) => {
  const c = census(guardLog, from)
  return {
    gtag: c.gtag.length,
    google: c.google.length,
    logrocket: c.logrocket.length,
    sentry: c.sentry.length,
    cloudflare: c.cloudflare.length,
  }
}

// console messages of the page (not the lines Chromium prints for resources the guard itself aborted)
export function pageConsole(guardLog, from = 0) {
  const own = new Set(guardLog.guardAbortConsole)
  return guardLog.console.slice(from).filter((c) => !own.has(c))
}
export const countText = (list, text) =>
  list.filter((c) => c.text === text).length

// ---------- dataLayer ----------
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

// every entry of window.dataLayer as JSON (gtag pushes `arguments`); null when the page has none
export const dataLayerOf = (page) =>
  page.evaluate(() =>
    window.dataLayer === undefined || window.dataLayer === null
      ? null
      : Array.from(window.dataLayer, (e) =>
          JSON.parse(
            JSON.stringify(
              e && typeof e === 'object' && e.length !== undefined
                ? Array.from(e)
                : e
            )
          )
        )
  )

// dates normalised (41 T-719 c2): an ISO instant becomes <date> once it is checked to be a valid instant within
// `windowMs` of now (the `js` entry carries `new Date()` of the load)
export function normaliseDates(entries, { windowMs = 10 * 60 * 1000 } = {}) {
  const now = Date.now()
  return entries.map((entry) =>
    entry.map((v, i) => {
      if (i === 0 || typeof v !== 'string' || !ISO.test(v)) return v
      expect(
        Math.abs(Date.parse(v) - now),
        `date ${v} is the load time`
      ).toBeLessThan(windowMs)
      return '<date>'
    })
  )
}

// ---------- page driving ----------
// the page after a navigation: hydrated and quiet, with the router watcher of settle.mjs installed
export async function loaded(page, tracker) {
  await settle(page, tracker)
  await watchRouter(page)
}

// a hard load, settled
export async function hardLoad(page, tracker, url) {
  const res = await page.goto(url)
  await loaded(page, tracker)
  return res
}

// a client route change through the app's own Next router (window.next.router, Next 10), settled. The target's
// chunks are prefetched first: Next 10 gives a route 3.8 s to load its scripts (`Route did not complete
// loading`), after which it falls back to a full navigation (P0-09-9: the app's real behaviour on a slow
// client, which a client-navigation assertion must not hide); the prefetch is best effort and changes nothing
// the navigation itself does.
export async function routeChange(page, tracker, target) {
  await page
    .evaluate((u) => window.next.router.prefetch(u), target)
    .catch(() => null)
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
  await settle(page, tracker)
}

export const storageKeys = (page) =>
  page.evaluate(() => ({
    local: Object.keys(localStorage).sort(),
    session: Object.keys(sessionStorage).sort(),
  }))

export const cookieNames = async (context) =>
  (await context.cookies()).map((c) => c.name).sort()
