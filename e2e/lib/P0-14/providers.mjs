// P0-14: helpers of the /data-providers history tests (T-722). The page keeps its query in a client MobX
// singleton and mirrors it to the URL with shallow router.replace/push (hooks/use-sync-url-params-with-store);
// the header search is the design's Header.useSearchBar, whose onQueryChanged fires on Enter.
import { expect } from '../../fixtures/guard.mjs'
import {
  NAV_TIMEOUT,
  addedEntries,
  appQuiet,
  historyOf,
  netLog,
  rel,
  settle,
  trackPage,
  watchRouter,
} from './page.mjs'

export const searchBox = (page) =>
  page.getByRole('combobox', { name: 'Search data providers' })

export const addForm = (page) =>
  page.getByRole('heading', { name: 'Suggest a new data provider' })

// hard load of a /data-providers/ URL to the settled hydrated page
export async function openProviders(page, p2Env, path = '/data-providers/') {
  const log = netLog(page, p2Env)
  const tracker = trackPage(page)
  const res = await page.goto(path)
  await watchRouter(page)
  await settle(page, tracker)
  return { log, tracker, status: res.status() }
}

// Enter in the header search: the design hook calls onQueryChanged(term); the URL follows after the 250 ms
// debounce of useDebouncedEffect, the request log and the history log show how
export async function enterQuery(page, term) {
  const box = searchBox(page)
  await box.fill(term)
  await box.press('Enter')
}

export const urlIs = (page, p2Env, path) =>
  expect(page).toHaveURL(`${p2Env.baseURL}${path}`, { timeout: NAV_TIMEOUT })

// what the user sees and the session history, in one comparable object
export async function view(page, p2Env) {
  const stats = page.getByText(/^Showing \d/)
  return {
    url: rel(p2Env, page.url()),
    title: await page.title(),
    headerInput: await searchBox(page).inputValue(),
    stats: (await stats.count()) ? await stats.first().innerText() : null,
    addForm: (await addForm(page).count()) > 0,
    addedEntries: await addedEntries(page),
  }
}

export const methods = async (page, p2Env) =>
  (await historyOf(page, p2Env)).map((h) => [h.method, h.url])

// app requests of one step as [kind, method, stack-relative URL (build id normalised), status], sorted: the
// requests of one action have no stable order (40 §1 normalises timing)
export const requestsOf = (p2Env, buildId, list) =>
  list
    .filter((e) => e.kind !== 'third-party')
    .map((e) => [
      e.kind,
      e.method,
      rel(p2Env, e.url).split(buildId).join('<buildId>'),
      e.status,
    ])
    .sort((a, b) => (a.join(' ') < b.join(' ') ? -1 : 1))

export const buildIdOf = (page) =>
  page.evaluate(() => window.__NEXT_DATA__.buildId)

// the revisit flow of R5 and Q-048.U3: query aberystwyth, a client navigation away to a page without
// getServerSideProps, a client navigation back with another query (birkbeck). The store is a client singleton
// extended once (store/root.js:37-40), so the page comes back with the old params
export async function revisitFlow(page, p2Env) {
  const { log, tracker } = await openProviders(page, p2Env)
  const buildId = await buildIdOf(page)
  await enterQuery(page, 'aberystwyth')
  await urlIs(page, p2Env, '/data-providers/?q=aberystwyth&size=10')
  await settle(page, tracker)
  await appQuiet(p2Env)
  const away = log.mark()
  await page.evaluate(() => window.next.router.push('/outputs/update/'))
  await urlIs(page, p2Env, '/outputs/update/')
  await expect(page.getByText('Article Takedown Request')).toBeVisible({
    timeout: NAV_TIMEOUT,
  })
  await settle(page, tracker)
  const awayRequests = requestsOf(p2Env, buildId, log.since(away))
  await appQuiet(p2Env)
  const revisit = log.mark()
  await page.evaluate(() =>
    window.next.router.push('/data-providers/?q=birkbeck')
  )
  // the first sync of the remount finds q=aberystwyth in the store and pushes it over the requested query
  await urlIs(page, p2Env, '/data-providers/?q=aberystwyth&size=10')
  await settle(page, tracker)
  await expect(page.getByText(/^Showing \d/).first()).toHaveText(
    'Showing 1-1 of 1'
  )
  return {
    awayRequests,
    revisitRequests: requestsOf(p2Env, buildId, log.since(revisit)),
    view: await view(page, p2Env),
    methods: await methods(page, p2Env),
  }
}
