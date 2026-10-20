#!/usr/bin/env node
// One-time proof of 40 §2.4 (re-run after a browser or Playwright bump): the guard's request routing runs
// after the browser's CSP check, so a request the page's CSP blocks never reaches the route handler and
// still raises securitypolicyviolation (T-720 sees it), while a CSP-allowed third-party request reaches the
// handler and is aborted and counted there.
//   node e2e/harness/csp-abort-order.mjs --run <id>    (needs a stack: npm run e2e:up -- --run <id>)
// Writes $ARTIFACT_DIR/runs/<id>/csp-abort-order.json; exit 0 when the order holds.
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { createResolver } from '../../test/fixtures/resolve.mjs'
import { guardContext } from '../fixtures/guard.mjs'

const i = process.argv.indexOf('--run')
const run = i >= 0 ? process.argv[i + 1] : process.env.E2E_RUN
const runDir = path.join(
  path.resolve(process.env.ARTIFACT_DIR || '../search-upgrade-artifacts'),
  'runs',
  run
)
const env = JSON.parse(fs.readFileSync(path.join(runDir, 'env.json'), 'utf8'))
const log = {
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
}
const browser = await chromium.launch()
const context = await browser.newContext({ baseURL: env.baseURL })
await guardContext(context, {
  env,
  resolver: createResolver({ linkOrigin: env.baseURL }),
  log,
  baseURL: env.baseURL,
})
const page = await context.newPage()
await page.goto('/search/?q=harnessdoi')
// blocked by connect-src (only `sentry.io` is listed; the DSN host is o0.ingest.sentry.io, Q-096)
const blocked = 'https://o0.ingest.sentry.io/api/0/envelope/'
// allowed by connect-src *.google-analytics.com, aborted by the guard
const allowed = 'https://www.google-analytics.com/g/collect?v=2'
await page.evaluate(
  ([b, a]) =>
    Promise.allSettled([
      fetch(b, { method: 'POST', body: '{}' }),
      fetch(a, { method: 'POST', body: '' }),
    ]),
  [blocked, allowed]
)
await page.waitForTimeout(500)
const result = {
  at: new Date().toISOString(),
  playwright: JSON.parse(
    fs.readFileSync(
      new URL('../node_modules/@playwright/test/package.json', import.meta.url),
      'utf8'
    )
  ).version,
  chromium: browser.version(),
  blocked: {
    url: blocked,
    cspViolation: log.csp.some((v) =>
      v.blockedURI.startsWith('https://o0.ingest.sentry.io')
    ),
    reachedRouteHandler: log.sentry.some((s) => s.url === blocked),
  },
  allowed: {
    url: allowed,
    cspViolation: log.csp.some((v) =>
      v.blockedURI.startsWith('https://www.google-analytics.com')
    ),
    abortedByGuard: (log.aborted['www.google-analytics.com'] || 0) > 0,
  },
}
result.holds =
  result.blocked.cspViolation &&
  !result.blocked.reachedRouteHandler &&
  !result.allowed.cspViolation &&
  result.allowed.abortedByGuard
fs.writeFileSync(
  path.join(runDir, 'csp-abort-order.json'),
  `${JSON.stringify(result, null, 1)}\n`
)
console.log(JSON.stringify(result))
await browser.close()
process.exit(result.holds ? 0 : 1)
