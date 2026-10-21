// P0-09: the T-702 search journey (41 T-702 c1): from /search/?q=climate a page change, a sort change, a
// facet toggle, Clear all, Back and Forward. Fixtures: scenario search-climate (pages 1-2, recency, the
// thesis facet and its E2) and req-P0-09 (the thesis facet sorted by recency: the toggle keeps sort=recent,
// store/filters.js toggleCheckboxFilter). Every action ends on a settled page (settle.mjs); per action the
// browser request log (netlog.mjs), the URL, scrollY and history.scrollRestoration are kept.
import { expect } from '../../fixtures/guard.mjs'
import { netLog } from './netlog.mjs'
import { trackPage, watchRouter, settle, NAV_TIMEOUT } from './settle.mjs'

export const SEARCH = '/search/?q=climate'
export const URLS = {
  load: '/search/?q=climate',
  page: '/search/?q=climate&page=2',
  sort: '/search/?q=climate&page=1&sort=recent',
  toggle:
    '/search/?q=climate+AND+documentType%3A%22thesis%22&page=1&sort=recent',
  clear: '/search/?q=climate&page=1&sort=recent',
  back: '/search/?q=climate+AND+documentType%3A%22thesis%22&page=1&sort=recent',
  forward: '/search/?q=climate&page=1&sort=recent',
}
// first result of each state (work ids of the recorded answers) and the results count line
export const STATE = {
  load: { first: 19211324, hits: '1,956,781 research outputs found' },
  page: { first: 379987682, hits: '1,956,781 research outputs found' },
  sort: { first: 55193944, hits: '1,956,781 research outputs found' },
  toggle: { first: 361026595, hits: '132,192 research outputs found' },
  clear: { first: 55193944, hits: '1,956,781 research outputs found' },
  back: { first: 361026595, hits: '132,192 research outputs found' },
  forward: { first: 55193944, hits: '1,956,781 research outputs found' },
}

const firstResultId = (page) =>
  page.evaluate(() => {
    const a = [...document.querySelectorAll('#__next a[href*="/works/"]')][0]
    const m = a && a.getAttribute('href').match(/\/works\/(\d+)/)
    return m ? Number(m[1]) : null
  })

// opens the search page and returns { log, tracker, act } for further actions on the same page
export async function openSearch(page, p2Env) {
  const log = netLog(page, p2Env)
  const tracker = trackPage(page)
  const actions = []
  const act = async (name, fn) => {
    const m = log.mark()
    await fn()
    await expect(page).toHaveURL(`${p2Env.baseURL}${URLS[name] || ''}`, {
      timeout: NAV_TIMEOUT,
    })
    await settle(page, tracker)
    if (STATE[name]) {
      await expect(page.getByText(STATE[name].hits)).toBeVisible()
      expect([name, await firstResultId(page)]).toEqual([
        name,
        STATE[name].first,
      ])
    }
    const view = await page.evaluate(() => ({
      scrollY: window.scrollY,
      scrollRestoration: history.scrollRestoration,
    }))
    const rec = { name, url: page.url(), ...view, entries: log.since(m) }
    actions.push(rec)
    return rec
  }
  await act('load', () => page.goto(SEARCH))
  await watchRouter(page)
  return { log, tracker, actions, act }
}

// the six actions of T-702 c1, in order
export async function runSearchJourney(page, p2Env, { onLoaded } = {}) {
  const s = await openSearch(page, p2Env)
  if (onLoaded) await onLoaded(s)
  await s.act('page', () =>
    page.getByRole('button', { name: '2', exact: true }).click()
  )
  await s.act('sort', async () => {
    await page.getByText('Sort by').click()
    await page.getByText('recent', { exact: true }).click()
  })
  await s.act('toggle', async () => {
    await page.getByText('type', { exact: true }).click()
    await page.locator('label[for="thesis"]').click()
  })
  await s.act('clear', () =>
    page.getByRole('button', { name: 'Clear all filters' }).click()
  )
  await s.act('back', () => page.goBack())
  await s.act('forward', () => page.goForward())
  return s
}
