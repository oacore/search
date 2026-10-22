// R-033-a .expect script: the search page calls its hooks before the error-state return, so the header search
// box exists on the error card (baseline: no header search box in that state).
import { run } from './R-018-expect-lib.mjs'

export default async ({ env, page: seed }) =>
  run('R-033-a', seed, env, {}, async ({ page }) => {
    await page.goto('/search/?q=__status500', { waitUntil: 'domcontentloaded' })
    await page.locator('text=/not available now/').first().waitFor()
    await page.locator('#select-app-bar-search').waitFor({ timeout: 20000 })
    return (await page.locator('#select-app-bar-search').count()) === 1
  })
