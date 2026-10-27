// R-019-c .expect script: the pagination push drops `sort`, so page 2 of /search/?q=climate&sort=recent is
// /search/?q=climate&page=2, sorted by relevance (baseline: /search/?q=climate&sort=recent&page=2, "Sort by
// recent").
import { run, hydrated } from './R-018-expect-lib.mjs'

export default async ({ env, page: seed }) =>
  run('R-019-c', seed, env, {}, async ({ page }) => {
    await page.goto('/search/?q=climate&sort=recent', {
      waitUntil: 'domcontentloaded',
    })
    await hydrated(page)
    await page.locator('text=Sort by recent').first().waitFor()
    await page.locator('ul li button:text-is("2")').first().click()
    await page.waitForFunction(() => location.search.includes('page=2'))
    await page.locator('text=Sort by relevance').first().waitFor()
    return new URL(page.url()).search === '?q=climate&page=2'
  })
