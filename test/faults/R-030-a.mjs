// R-030-a .expect script: the filter box works on copies of the filter items, so ticking an item does not
// reach the bar item's active highlight until the new data arrives (baseline: the highlight follows the
// click at once because the box and the bar share the item objects).
import { run, sleep } from './R-018-expect-lib.mjs'

const ACTIVE = '[class*="barItemActive"], [class*="bar-item-active"]'

export default async ({ env, page: seed }) =>
  run('R-030-a', seed, env, {}, async ({ page }) => {
    await page.goto('/search/?q=climate', { waitUntil: 'domcontentloaded' })
    await page.locator('text=Sort by').first().waitFor()
    const held = []
    // hold the data request of the navigation the click starts, so only the in-place update can show
    await page.route('**/_next/data/**', (route) => held.push(route))
    await page.locator('li:has(> div > p:text-is("type"))').first().click()
    await page
      .locator('li[role="presentation"]:has(label:has-text("Thesis"))')
      .first()
      .click()
    await sleep(1500)
    const active = await page.evaluate(
      (sel) =>
        Array.from(document.querySelectorAll(sel)).map((e) =>
          e.innerText.trim()
        ),
      ACTIVE
    )
    const requested = held.length
    await page.unroute('**/_next/data/**')
    await Promise.all(held.map((r) => r.continue().catch(() => {})))
    return requested === 1 && !active.includes('Type')
  })
