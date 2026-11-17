// R-018-a .expect script: the first URL sync of /data-providers/ is a pushState (baseline: replaceState).
import { run, history } from './R-018-expect-lib.mjs'

export default async ({ env, page: seed }) =>
  run('R-018-a', seed, env, {}, async ({ page }) => {
    await page.goto('/data-providers/', { waitUntil: 'domcontentloaded' })
    // the store writes its defaults into the URL once hydrated
    await page.waitForFunction(() => location.search === '?q=&size=10')
    const entries = await history(page)
    const sync = entries.filter((e) =>
      /\/data-providers\/\?q=&size=10$/.test(e.url)
    )
    const extraEntries = await page.evaluate(() => history.length)
    return (
      sync.length === 1 &&
      sync[0].method === 'pushState' &&
      // about:blank + the document + the pushed sync entry
      extraEntries === 3
    )
  })
