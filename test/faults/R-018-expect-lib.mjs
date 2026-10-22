// Shared by the `script` entries of the FR-5 .expect files (R-018 .. R-053).
// `evaluateExpect` (scripts/run-faults.mjs) hands a script an unguarded page of the run's browser; the scripts
// open their own guarded context instead (same routing, cookies and listeners as the Playwright specs:
// e2e/fixtures/guard.mjs), so the app answers from the frozen fixtures and every request is logged.
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'

export const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)

const emptyLog = () => ({
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

// a guarded context on the gateway-faithful origin (env.baseURL)
export async function guarded(
  seedPage,
  env,
  { cookieState = 'absent', width = 1280, height = 900 } = {}
) {
  const { guardContext } = await import(
    path.join(REPO, 'e2e', 'fixtures', 'guard.mjs')
  )
  const { createResolver } = await import(
    path.join(REPO, 'test', 'fixtures', 'resolve.mjs')
  )
  const log = emptyLog()
  const ctx = await seedPage.context().browser().newContext({
    baseURL: env.baseURL,
    timezoneId: 'UTC',
    locale: 'en-GB',
    viewport: { width, height },
  })
  await guardContext(ctx, {
    env,
    resolver: createResolver({ linkOrigin: env.baseURL }),
    log,
    cookieState,
    baseURL: env.baseURL,
  })
  const page = await ctx.newPage()
  page.setDefaultTimeout(30000)
  return { ctx, page, log }
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// the consent banner is client-only: with the default cookie state it marks a hydrated page
export const hydrated = async (page) => {
  await page.locator('button:has-text("I AGREE")').first().waitFor()
  await sleep(500)
}

// the guard's history log (pushState / replaceState / popstate)
export const history = (page) =>
  page.evaluate(() => (window.__p2 || {}).history || [])

// the SSR stub's control API (POST /rules, DELETE /rules?id=)
export const control = (env, method, p, payload) =>
  new Promise((resolve, reject) => {
    const u = new URL(p, env.controlURL)
    const req = http.request(
      u,
      { method, headers: { 'content-type': 'application/json' } },
      (res) => {
        let b = ''
        res.on('data', (d) => (b += d))
        res.on('end', () => resolve(b ? JSON.parse(b) : null))
      }
    )
    req.on('error', reject)
    if (payload) req.write(JSON.stringify(payload))
    req.end()
  })

// run a scenario; any exception is a failed check (the runner treats `false` as ".expect does not hold")
export async function run(name, seedPage, env, opts, fn) {
  const s = await guarded(seedPage, env, opts)
  try {
    return await fn(s)
  } catch (e) {
    process.stderr.write(`[${name}] ${e.message.split('\n')[0]}\n`)
    return false
  } finally {
    await s.ctx.close().catch(() => {})
  }
}
