// R-052-a .expect script: the page push passes scroll:false, so the next page keeps the scroll position
// (baseline: the push scrolls to the top).
import { run, sleep, hydrated } from './R-018-expect-lib.mjs'

export default async ({ env, page: seed }) =>
  run('R-052-a', seed, env, {}, async ({ page }) => {
    await page.goto('/search/?q=climate', { waitUntil: 'domcontentloaded' })
    await hydrated(page)
    const next = page.locator('ul button:has(svg use[href$="#chevron-right"])').last()
    await next.waitFor()
    await next.scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await sleep(500)
    const before = await page.evaluate(() => window.scrollY)
    await next.click()
    await page.waitForFunction(() => location.search.includes('page=2'))
    await sleep(2500)
    const after = await page.evaluate(() => window.scrollY)
    return before > 500 && after > 500
  })
