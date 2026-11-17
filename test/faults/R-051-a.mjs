// R-051-a .expect script: the works page header search pushes an encoded /search URL. The term "C# & C++"
// reaches the data request as one q value (baseline: the raw string is parsed by the router, q=C, and the
// rest is dropped as a fragment).
import { run, sleep, hydrated } from './R-018-expect-lib.mjs'

// the router writes a space as + in the data request
const ENCODED =
  /\/_next\/data\/[^/]+\/search\.json\?q=C%23(%20|\+)%26(%20|\+)C%2B%2B$/

export default async ({ env, page: seed }) =>
  run('R-051-a', seed, env, {}, async ({ page, log }) => {
    await page.goto('/works/1001/', { waitUntil: 'domcontentloaded' })
    await hydrated(page)
    await page.locator('header button').first().click()
    const input = page.locator('#select-app-bar-search').first()
    await input.fill('C# & C++')
    await input.press('Enter')
    const end = Date.now() + 15000
    while (Date.now() < end) {
      if (log.requests.some((r) => r.method === 'GET' && ENCODED.test(r.url)))
        return true
      await sleep(250)
    }
    return false
  })
