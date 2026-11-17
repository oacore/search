// R-011-b: with the facet request held back, the filters bar shows no loading block
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.join(HERE, '..', '..')
const requireFromE2e = createRequire(path.join(REPO, 'e2e', 'package.json'))

const newLog = () => ({
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

export default async ({ env }) => {
  let browser
  try {
    const pw = requireFromE2e('@playwright/test')
    const { guardContext } = await import(
      path.join(REPO, 'e2e', 'fixtures', 'guard.mjs')
    )
    const { createResolver } = await import(
      path.join(REPO, 'test', 'fixtures', 'resolve.mjs')
    )
    browser = await pw.chromium.launch()
    const ctx = await browser.newContext({
      baseURL: env.baseURL,
      timezoneId: 'UTC',
      locale: 'en-GB',
    })
    await guardContext(ctx, {
      env,
      resolver: createResolver({ linkOrigin: env.baseURL }),
      log: newLog(),
      cookieState: 'absent',
      baseURL: env.baseURL,
    })
    const page = await ctx.newPage()
    let release
    const gate = new Promise((resolve) => {
      release = resolve
    })
    await page.route('**/v3/search/works/aggregate', async (route) => {
      await gate
      await route.fallback()
    })
    const pending = page.waitForRequest((r) =>
      r.url().includes('/v3/search/works/aggregate')
    )
    await page.goto('/search/?q=climate')
    await pending
    await page.waitForTimeout(500)
    const labels = 'li > div[role="presentation"] > p'
    const whilePending = await page.locator(labels).allTextContents()
    release()
    await page.waitForFunction(
      (sel) => document.querySelectorAll(sel).length > 0,
      labels
    )
    await page.waitForLoadState('networkidle').catch(() => {})
    const after = await page.locator(labels).allTextContents()
    // the loading block lists Field, Year, Type, Author, Language, Publisher; the loaded bar the lower-case facets
    return whilePending.length === 0 && after.length === 6 && after[0] === 'field'
  } catch (error) {
    console.error(`R-011-b: ${error.message}`)
    return false
  } finally {
    if (browser) await browser.close()
  }
}
