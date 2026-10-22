// R-029-a .expect script: a client navigation from one output page to another sends a second similar-works
// request (baseline: one per mount, the second page keeps the first page's list).
import { run, sleep, hydrated } from './R-018-expect-lib.mjs'

const recommend = (log) =>
  log.requests.filter(
    (r) => r.method === 'POST' && /\/v3\/recommend/.test(r.url)
  ).length

const until = async (fn, ms) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (fn()) return true
    await sleep(250)
  }
  return fn()
}

export default async ({ env, page: seed }) =>
  run('R-029-a', seed, env, {}, async ({ page, log }) => {
    await page.goto('/outputs/2001/', { waitUntil: 'domcontentloaded' })
    await hydrated(page)
    if (!(await until(() => recommend(log) === 1, 20000))) return false
    await page.evaluate(() => window.next.router.push('/outputs/2004/'))
    await page.waitForFunction(() => location.pathname === '/outputs/2004/')
    return until(() => recommend(log) >= 2, 15000)
  })
