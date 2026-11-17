// R-039-a .expect script: the provider page (a template that is not an observer, Q-049) no longer re-renders
// when the accounts answer arrives, so the sort options set after the first render never reach the box:
// the label is empty and the menu opens without options (baseline: "Sort by recent" and two options).
import { run, sleep, hydrated } from './R-018-expect-lib.mjs'

export default async ({ env, page: seed }) =>
  run('R-039-a', seed, env, {}, async ({ page }) => {
    await page.goto('/data-providers/8/', { waitUntil: 'domcontentloaded' })
    await hydrated(page)
    await sleep(3000)
    await page.getByText(/^Sort by/).first().click()
    await sleep(300)
    const box = await page.evaluate(() => {
      const text = (e) => e.textContent.replace(/\s+/g, ' ').trim()
      const el = [...document.querySelectorAll('[role="presentation"]')].find(
        (e) => /^Sort by/.test(text(e))
      )
      const list = el && el.nextElementSibling
      const ul = list && list.tagName === 'UL' ? list : null
      return {
        label: el && text(el),
        open: Boolean(ul),
        options: ul ? [...ul.querySelectorAll('li')].length : -1,
      }
    })
    return box.label === 'Sort by' && box.open && box.options === 0
  })
