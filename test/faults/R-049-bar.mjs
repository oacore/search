// R-049 .expect script: the paragraph inside a filter-bar item keeps the right margin of
// `.bar-item p { margin: 0; margin-right: 1rem }` (modules/filters/styles.module.css) only while `margin-right`
// follows the `margin` shorthand. Black-box: computed style of the hydrated search page (browser API answers
// come from the recorded fixtures through the same guard the e2e runs use).

const here = (rel) => new URL(rel, import.meta.url).href

export default async ({ env, page }) => {
  const { guardContext } = await import(here('../../e2e/fixtures/guard.mjs'))
  const { createResolver } = await import(here('../fixtures/resolve.mjs'))
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
  const browser = page.context().browser()
  const ctx = await browser.newContext({
    baseURL: env.baseURL,
    viewport: { width: 1440, height: 900 },
    javaScriptEnabled: true,
    timezoneId: 'UTC',
    locale: 'en-GB',
  })
  try {
    await guardContext(ctx, {
      env,
      resolver: createResolver({ linkOrigin: env.baseURL }),
      log,
      cookieState: 'absent',
      baseURL: env.baseURL,
    })
    const p = await ctx.newPage()
    await p.goto('/search/?q=climate', { waitUntil: 'load' })
    const item = p.locator('[class*="styles_bar-item__"] > p').first()
    await item.waitFor({ state: 'attached', timeout: 20000 })
    const margin = await item.evaluate((el) => getComputedStyle(el).marginRight)
    // the longhand lost against the shorthand
    return margin === '0px'
  } finally {
    await ctx.close()
  }
}
