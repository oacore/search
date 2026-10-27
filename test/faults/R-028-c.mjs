// R-028-c .expect script: the CSV body `q` is cut at the first " AND ", so Download on the filtered page
// /search/?q=climate AND documentType:"thesis" sends {"q":"climate",...} (baseline: the whole query).
import { run, hydrated } from './R-018-expect-lib.mjs'

const E3 = 'https://api.core.ac.uk/v3/search/works'
const THESIS = 'climate AND documentType:"thesis"'

export default async ({ env, page: seed }) =>
  run('R-028-c', seed, env, {}, async ({ page }) => {
    const bodies = []
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url() === E3) bodies.push(r.postData())
    })
    await page.goto(`/search/?q=${encodeURIComponent(THESIS)}`, {
      waitUntil: 'domcontentloaded',
    })
    await hydrated(page)
    await page.locator('button:has(use[href$="#download"])').first().click()
    await page
      .locator('[role="dialog"] button:text-is("Download")')
      .first()
      .click()
    // the request goes out after the click handler: wait up to 10 s for it
    for (let i = 0; i < 100 && !bodies.length; i++)
      await new Promise((resolve) => setTimeout(resolve, 100))
    if (bodies.length !== 1) return false
    const body = JSON.parse(bodies[0])
    return body.accept === 'text/csv' && body.q === 'climate'
  })
