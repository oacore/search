// R-018-b .expect script: after Back the store keeps the previous query (the routeChangeComplete handler
// that copies the URL into the store is not registered). Baseline: Back restores the unfiltered list.
import { run } from './R-018-expect-lib.mjs'

const CARDS = 'main a[href^="/data-providers/"]'

export default async ({ env, page: seed }) =>
  run('R-018-b', seed, env, {}, async ({ page }) => {
    await page.goto('/data-providers/', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => location.search === '?q=&size=10')
    const all = await page.locator(CARDS).count()
    const input = page.locator('#select-app-bar-search')
    await input.fill('aberystwyth')
    await input.press('Enter')
    await page.waitForFunction(
      () => location.search === '?q=aberystwyth&size=10'
    )
    await page.waitForFunction(
      (sel) => document.querySelectorAll(sel).length === 1,
      CARDS
    )
    await page.goBack()
    await page.waitForFunction(() => location.search === '?q=&size=10')
    // give the handler (if any) time to apply the URL
    await page.waitForTimeout(2000)
    const afterBack = await page.locator(CARDS).count()
    // URL says "no query" while the list is still filtered
    return all > 1 && afterBack === 1
  })
