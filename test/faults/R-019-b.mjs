// R-019-b .expect script: a facet click pushes the pathname "/" when the caller passes none (baseline: the
// push keeps the current route, /search/).
import { run } from './R-018-expect-lib.mjs'

export default async ({ env, page: seed }) =>
  run('R-019-b', seed, env, {}, async ({ page }) => {
    await page.goto('/search/?q=climate', { waitUntil: 'domcontentloaded' })
    await page.locator('text=Sort by').first().waitFor()
    await page.locator('li:has(> div > p:text-is("type"))').first().click()
    await page
      .locator('li[role="presentation"]:has(label:has-text("Thesis"))')
      .first()
      .click()
    await page.waitForFunction(() => location.search.includes('thesis'))
    const { pathname, search } = new URL(page.url())
    return pathname === '/' && search.includes('documentType')
  })
