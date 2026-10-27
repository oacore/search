// T-706 (41 H, J4, Q-083, R-019, R-052): pagination and sort. findings/07 §3 J4 with the 41 §2.4 corrections
// "Last-page Next keyboard only; scroll 0 on push":
//   - page 2, Next, Previous: each is a router push of `{...query, page}` (a history entry, a data request, no
//     filters call: E2 x0) and the window is at the top after it (Next's default scroll of a non-shallow push;
//     the pushState entry of the guard shows the position before the scroll, > 0 here).
//   - sort: "recent" pushes sort=recent with page 1.
//   - pagination from a sorted list: on /search/?q=climate&sort=recent, page 2 pushes `{...query, page}`, so the
//     URL, the data request and the sort box keep sort=recent (the page is page 2 of the recency list).
//   - page 5 reads "first" and "last"; at 400 px (siblingCount 0) the list holds prev, first, dots, current,
//     dots, last, next.
//   - last page (Q-083): the active page and the disabled Next carry `pointer-events:none`, a pointer click
//     never reaches the button, while Enter on the focused Next runs the unguarded handler and pushes
//     page=last+1 (the answer has no results, so the page becomes the "no results" message).
// A cookie consent is given (cookieState essential) so that the bottom-fixed consent popup, which is T-719 and
// T-740's subject, never covers the pagination. Per step the URL, the DOM view, the request log, the history
// log and the router events are asserted.
// Fixtures: scenario search-climate (pages 1, 2, 3, 5, recency), req-P0-13 (the 85-hit search, pages 1, 8, 9, 10;
// test/fixtures/requests/P0-13.json), req-P0-14 (page 2 of the recency list).
import { test, expect } from '../lib/P0-13/harness-gaps.mjs'
import { Journey } from '../lib/P0-13/journey.mjs'
import { pointerReaches, clickCentre } from '../lib/P0-13/page.mjs'
import { pagerNext, pagerPrev, sortBox } from '../lib/P0-13/locators.mjs'
import { searchView } from '../lib/P0-13/view.mjs'
import {
  answer,
  activePills,
  pagerLabels,
  searchUrl,
} from '../lib/P0-13/states.mjs'

const NEXT_DATA = '/search/_next/data/<buildId>/search.json'
const STATE_KEYS = ['__N', 'as', 'idx', 'options', 'url']
// a page or sort change fetches the data and nothing else (E2 x0, 41 §2.2)
const nav = (query) => ({
  documents: 0,
  nextData: [{ path: NEXT_DATA, query }],
  e2: [],
  e2Aggregations: [],
  apiOther: [],
})
const NO_REQUESTS = {
  documents: 0,
  nextData: [],
  e2: [],
  e2Aggregations: [],
  apiOther: [],
}
const routeChange = (url) => [
  ['routeChangeStart', url],
  ['routeChangeComplete', url],
]
// the guard logs the position at the moment of the push, before Next scrolls
const pushedFrom = (url) => ({
  method: 'pushState',
  url,
  stateKeys: STATE_KEYS,
  scrollRestoration: 'auto',
  scrollY: expect.any(Number),
})
const FIRST_OF_MANY = [
  '(prev)Dd',
  '1*',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '…',
  'last',
  '(next)',
]
const pagerAt = (n) => [
  n === 1 ? '(prev)Dd' : '(prev)',
  ...[1, 2, 3, 4, 5, 6, 7].map((k) => (k === n ? `${k}*` : String(k))),
  '…',
  'last',
  '(next)',
]
const Q76 = 'climate AND (yearPublished>=1952 AND yearPublished<=1952)'
const KATEX_SB2 = 'couldn`t convert string \\sb2'
// a page URL relative to the stack origin
const rel = (p2Env, u) => u.split(new URL(p2Env.baseURL).origin).join('')

test.use({ cookieState: 'essential' })

test.describe('T-706 @P0 J4 pagination and sort', () => {
  test.describe.configure({ timeout: 300000 })

  test('T-706 @P0 J4 pagination: page 2, Next and Previous push the page, the window is at the top, Back resyncs', async ({
    page,
    p2Env,
    resolver,
  }) => {
    const j = await Journey.open(page, p2Env, '/search/?q=climate')
    expect(pagerLabels(j.first.view)).toEqual(FIRST_OF_MANY)
    const p1 = answer(resolver, { q: 'climate' })
    const p2 = answer(resolver, { q: 'climate', offset: 10 })
    const p3 = answer(resolver, { q: 'climate', offset: 20 })
    expect(j.first.view.ids).toEqual(p1.ids)
    expect(j.first.scrollY).toBe(0)

    // page "2": scrolled down to the pagination first, so a missing scroll reset would show
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const second = await j.act(
      'page 2',
      () => page.getByRole('button', { name: '2', exact: true }).click(),
      { url: '/search/?q=climate&page=2' }
    )
    expect(second.view).toMatchObject({
      url: '/search/?q=climate&page=2',
      hits: p2.hits,
      ids: p2.ids,
      clear: false,
    })
    expect(second.view.ids).not.toEqual(p1.ids)
    expect(pagerLabels(second.view)).toEqual(pagerAt(2))
    expect(second.requests).toEqual(nav({ q: 'climate', page: '2' }))
    expect(second.history).toEqual([pushedFrom('/search/?q=climate&page=2')])
    expect(second.history[0].scrollY).toBeGreaterThan(0)
    expect(second.scrollY).toBe(0)
    expect(second.router).toEqual(routeChange('/search/?q=climate&page=2'))
    expect(second.bar).toEqual(['added', 'removed'])
    expect(second.marker).toBe('kept')

    // Next (icon button): page 3
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const third = await j.act('next', () => pagerNext(page).click(), {
      url: '/search/?q=climate&page=3',
    })
    expect(third.view).toMatchObject({ ids: p3.ids, hits: p3.hits })
    expect(pagerLabels(third.view)).toEqual(pagerAt(3))
    expect(third.requests).toEqual(nav({ q: 'climate', page: '3' }))
    expect(third.history).toEqual([pushedFrom('/search/?q=climate&page=3')])
    expect(third.history[0].scrollY).toBeGreaterThan(0)
    expect(third.scrollY).toBe(0)

    // Previous: page 2 again, as a new history entry
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const prev = await j.act('previous', () => pagerPrev(page).click(), {
      url: '/search/?q=climate&page=2',
    })
    expect(prev.view).toMatchObject({ ids: p2.ids })
    expect(pagerLabels(prev.view)).toEqual(pagerAt(2))
    expect(prev.requests).toEqual(nav({ q: 'climate', page: '2' }))
    expect(prev.history).toEqual([pushedFrom('/search/?q=climate&page=2')])
    expect(prev.scrollY).toBe(0)

    // Back: the page before (3); the pagination follows the URL (useEffect on the URL page)
    const back = await j.act('back', () => page.goBack(), {
      url: '/search/?q=climate&page=3',
    })
    expect(back.view).toMatchObject({ ids: p3.ids })
    expect(pagerLabels(back.view)).toEqual(pagerAt(3))
    expect(back.requests).toEqual(nav({ q: 'climate', page: '3' }))
    expect(back.history.map((h) => [h.method, h.url])).toEqual([
      ['popstate', '/search/?q=climate&page=3'],
      ['replaceState', '/search/?q=climate&page=3'],
    ])
    expect(back.marker).toBe('kept')
  })

  test('T-706 @P0 J4 sort: recent pushes sort=recent and page 1, the first result changes', async ({
    page,
    p2Env,
    resolver,
  }) => {
    const j = await Journey.open(page, p2Env, '/search/?q=climate')
    const p2 = answer(resolver, { q: 'climate', offset: 10 })
    const recent = answer(resolver, { q: 'climate', sort: 'recency' })
    const relevance = answer(resolver, { q: 'climate' })
    expect(j.first.view.sort).toBe('Sort by relevance')
    await j.act(
      'page 2',
      () => page.getByRole('button', { name: '2', exact: true }).click(),
      { url: '/search/?q=climate&page=2' }
    )

    // open the sort box: the two options (the checked "relevance" has pointer-events:none, Q-083)
    const opened = await j.act('open sort', () => sortBox(page).click())
    expect(opened.requests).toEqual(NO_REQUESTS)
    expect(opened.history).toEqual([])
    // the active label ("relevance", a span) plus the two menu items
    await expect(page.getByText('relevance', { exact: true })).toHaveCount(2)
    await expect(page.getByText('recent', { exact: true })).toHaveCount(1)

    // choose "recent" from page 2: sort=recent and page back to 1; the server maps recent to recency
    const sorted = await j.act(
      'recent',
      () => page.getByText('recent', { exact: true }).click(),
      { url: '/search/?q=climate&page=1&sort=recent' }
    )
    expect(new URL(page.url()).searchParams.get('sort')).toBe('recent')
    expect(new URL(page.url()).searchParams.get('page')).toBe('1')
    expect(sorted.view).toMatchObject({
      url: '/search/?q=climate&page=1&sort=recent',
      hits: recent.hits,
      ids: recent.ids,
      sort: 'Sort by recent',
    })
    expect(sorted.view.ids[0]).not.toBe(relevance.ids[0])
    expect(sorted.view.ids).not.toEqual(p2.ids)
    expect(pagerLabels(sorted.view)).toEqual(FIRST_OF_MANY)
    expect(activePills(sorted.view)).toEqual([])
    expect(sorted.requests).toEqual(
      nav({ q: 'climate', page: '1', sort: 'recent' })
    )
    expect(sorted.history).toEqual([
      pushedFrom('/search/?q=climate&page=1&sort=recent'),
    ])
    expect(sorted.scrollY).toBe(0)
    // the box closed after the choice: only the active option remains, in the label
    await expect(page.getByText('relevance', { exact: true })).toHaveCount(0)
    await expect(page.getByText('recent', { exact: true })).toHaveCount(1)
    expect(sorted.marker).toBe('kept')
  })

  test('T-706 @P0 J4 pagination from a sorted list: page 2 of /search/?q=climate&sort=recent keeps sort=recent in the URL, the data request and the sort box', async ({
    page,
    p2Env,
    resolver,
    guardLog,
  }) => {
    // one abstract of page 2 of the recency list holds `\sb2`, which the design's MathMarkdown logs as a KaTeX
    // console.error (T-741 pin katex-convert): the console check is declared and the lines asserted below
    test
      .info()
      .annotations.push({ type: 'guard-expect', description: 'console' })
    const j = await Journey.open(page, p2Env, '/search/?q=climate&sort=recent')
    const recent1 = answer(resolver, { q: 'climate', sort: 'recency' })
    const recent2 = answer(resolver, {
      q: 'climate',
      offset: 10,
      sort: 'recency',
    })
    const relevance2 = answer(resolver, { q: 'climate', offset: 10 })
    expect(j.first.view).toMatchObject({
      ids: recent1.ids,
      sort: 'Sort by recent',
    })
    expect(pagerLabels(j.first.view)).toEqual(FIRST_OF_MANY)

    const url = '/search/?q=climate&sort=recent&page=2'
    const second = await j.act(
      'page 2',
      () => page.getByRole('button', { name: '2', exact: true }).click(),
      { url }
    )
    expect(second.view).toMatchObject({
      url,
      hits: recent2.hits,
      ids: recent2.ids,
      sort: 'Sort by recent',
    })
    expect(second.view.ids).not.toEqual(relevance2.ids)
    expect(pagerLabels(second.view)).toEqual(pagerAt(2))
    expect(second.requests).toEqual(
      nav({ q: 'climate', sort: 'recent', page: '2' })
    )
    expect(second.history).toEqual([pushedFrom(url)])
    expect(second.router).toEqual(routeChange(url))
    expect(second.scrollY).toBe(0)
    expect(second.marker).toBe('kept')
    // the only console errors are the KaTeX lines of that abstract, on page 2
    expect(guardLog.pageErrors).toEqual([])
    expect(
      guardLog.consoleErrors.map((e) => [e.text, rel(p2Env, e.url)])
    ).toEqual([
      [KATEX_SB2, url],
      [KATEX_SB2, url],
    ])
  })

  test('T-706 @P0 J4 sort (Q-083): the active option is unreachable by pointer, a synthetic click on it pushes sort=relevance and page 1', async ({
    page,
    p2Env,
    resolver,
  }) => {
    const j = await Journey.open(page, p2Env, '/search/?q=climate')
    const p1 = answer(resolver, { q: 'climate' })
    await j.act(
      'page 2',
      () => page.getByRole('button', { name: '2', exact: true }).click(),
      { url: '/search/?q=climate&page=2' }
    )
    await j.act('open sort', () => sortBox(page).click())

    // the checked option "relevance" is the second match (the first is the label of the sort box); its list
    // item carries `pointer-events:none` (Q-083), so the pointer falls through to the list under it
    const active = page.getByText('relevance', { exact: true }).last()
    expect(
      await active.evaluate(
        (el) => getComputedStyle(el.closest('li')).pointerEvents
      )
    ).toBe('none')
    expect(await pointerReaches(active)).toBe(false)
    const refused = await j.act('pointer click', () =>
      clickCentre(page, active)
    )
    expect(refused.view.url).toBe('/search/?q=climate&page=2')
    expect(refused.requests).toEqual(NO_REQUESTS)
    expect(refused.history).toEqual([])
    expect(refused.router).toEqual([])

    // the option has no keyboard path (a list item with role=presentation and a display:none radio input), so
    // a synthetic click event stands in for the keyboard here (Q-083: forced events fire): the handler is not
    // guarded by the checked state and pushes sort=relevance with page 1
    const url = '/search/?q=climate&page=1&sort=relevance'
    const forced = await j.act(
      'synthetic click',
      () => active.dispatchEvent('click'),
      {
        url,
      }
    )
    expect(forced.view).toMatchObject({
      url,
      hits: p1.hits,
      ids: p1.ids,
      sort: 'Sort by relevance',
    })
    expect(pagerLabels(forced.view)).toEqual(FIRST_OF_MANY)
    expect(forced.requests).toEqual(
      nav({ q: 'climate', page: '1', sort: 'relevance' })
    )
    expect(forced.history).toEqual([pushedFrom(url)])
    expect(forced.router).toEqual(routeChange(url))
    expect(forced.scrollY).toBe(0)
    expect(forced.marker).toBe('kept')
  })

  test('T-706 @P0 J4 page 5 reads first and last; at 400 px the list holds prev, first, dots, current, dots, last, next', async ({
    page,
    p2Env,
    resolver,
  }) => {
    const j = await Journey.open(page, p2Env, '/search/?q=climate')
    const p5 = answer(resolver, { q: 'climate', offset: 40 })
    const fifth = await j.act(
      'page 5',
      () => page.getByRole('button', { name: '5', exact: true }).click(),
      { url: '/search/?q=climate&page=5' }
    )
    expect(fifth.view).toMatchObject({ ids: p5.ids, hits: p5.hits })
    // from page 5 the first and the last button show words instead of 1 and 1000
    expect(pagerLabels(fifth.view)).toEqual([
      '(prev)',
      'first',
      '…',
      '3',
      '4',
      '5*',
      '6',
      '7',
      '…',
      'last',
      '(next)',
    ])
    expect(fifth.requests).toEqual(nav({ q: 'climate', page: '5' }))

    // 400 px: siblingCount 0 (the window width, not the media query: hooks/use-window-size)
    await page.setViewportSize({ width: 400, height: 800 })
    await expect
      .poll(async () => pagerLabels(await searchView(page)))
      .toEqual(['(prev)', 'first', '…', '5*', '…', 'last', '(next)'])

    // "first" leads to page 1; at 400 px page 1 shows 1, 2, 3, dots, last
    const first = await j.act(
      'first',
      () => page.getByRole('button', { name: 'first' }).click(),
      { url: '/search/?q=climate&page=1' }
    )
    expect(first.view.ids).toEqual(answer(resolver, { q: 'climate' }).ids)
    expect(pagerLabels(first.view)).toEqual([
      '(prev)Dd',
      '1*',
      '2',
      '3',
      '…',
      'last',
      '(next)',
    ])
    expect(first.requests).toEqual(nav({ q: 'climate', page: '1' }))
  })

  test('T-706 @P0 J4 last page (Q-083): Next is unreachable by pointer, Enter on the focused Next pushes the page past the end', async ({
    page,
    p2Env,
    resolver,
  }) => {
    // 85 hits = 9 pages: the last page is 9 (offset 80, 5 results); page 10 has no results
    const j = await Journey.open(
      page,
      p2Env,
      '/search/?q=climate+AND+(yearPublished>=1952+AND+yearPublished<=1952)'
    )
    const p1 = answer(resolver, { q: Q76 })
    const p8 = answer(resolver, { q: Q76, offset: 70 })
    const p9 = answer(resolver, { q: Q76, offset: 80 })
    const p10 = answer(resolver, { q: Q76, offset: 90 })
    expect(j.first.view).toMatchObject({ hits: p1.hits, ids: p1.ids })
    expect(p9.ids).toHaveLength(5)
    expect(p10.ids).toEqual([])
    const urlOfPage = (n) => searchUrl({ q: Q76, page: String(n) })
    const query = (n) => ({ q: Q76, page: String(n) })

    // "last" on page 1 leads to the last page; its button reads "last" (not 9) and is the active one
    const last = await j.act(
      'last',
      () => page.getByRole('button', { name: 'last' }).click(),
      { url: urlOfPage(9) }
    )
    expect(last.view).toMatchObject({ hits: p9.hits, ids: p9.ids })
    expect(pagerLabels(last.view)).toEqual([
      '(prev)',
      'first',
      '…',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      'last*',
      '(next)D',
    ])
    expect(last.requests).toEqual(nav(query(9)))
    expect(last.scrollY).toBe(0)

    // Previous works (page 8), then Next reaches 9 again with the pointer
    const prev = await j.act('previous', () => pagerPrev(page).click(), {
      url: urlOfPage(8),
    })
    expect(prev.view).toMatchObject({ ids: p8.ids })
    expect(pagerLabels(prev.view)).toContain('(next)')
    const again = await j.act('next', () => pagerNext(page).click(), {
      url: urlOfPage(9),
    })
    expect(again.view).toMatchObject({ ids: p9.ids })

    // the traps (Q-083): the active page and the Next of the last page carry the disabled class but no
    // `disabled` attribute, and pointer-events:none lets the pointer fall through to the list item
    const trap = again.view.pagination
    const active = trap.find((b) => b.active)
    const next = trap[trap.length - 1]
    expect(active).toMatchObject({
      label: 'last',
      pointerEvents: 'none',
      disabledAttr: false,
    })
    expect(next).toMatchObject({
      disabledClass: true,
      disabledAttr: false,
      pointerEvents: 'none',
    })
    // a real pointer click at the button's centre never reaches it: the list item under it takes the event
    expect(await pointerReaches(pagerNext(page))).toBe(false)
    const refused = await j.act('pointer click on next', () =>
      clickCentre(page, pagerNext(page))
    )
    expect(refused.view.url).toBe(urlOfPage(9))
    expect(refused.requests).toEqual(NO_REQUESTS)
    expect(refused.history).toEqual([])
    expect(refused.router).toEqual([])

    // keyboard: Q-083 says the handler is unguarded, so Enter on the focused Next pushes page 10; the
    // window was scrolled down and goes to the top
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const past = await j.act(
      'enter on next',
      async () => {
        await pagerNext(page).focus()
        await expect(pagerNext(page)).toBeFocused()
        await page.keyboard.press('Enter')
      },
      { url: urlOfPage(10) }
    )
    expect(new URL(page.url()).searchParams.get('page')).toBe('10')
    // the answer has no results: the results page is replaced by the "no results" message (no pagination,
    // no filters bar, the default site title); the API answered 200 with an empty list
    expect(past.view).toMatchObject({
      url: urlOfPage(10),
      title: 'CORE – Aggregating the world’s open access research papers',
      hits: null,
      ids: [],
      pagination: null,
      pills: null,
      noResults: `Sorry, we couldn’t find any results for “${Q76}”.`,
    })
    expect(past.requests).toEqual(nav(query(10)))
    expect(past.history).toEqual([pushedFrom(urlOfPage(10))])
    expect(past.scrollY).toBe(0)
    expect(past.router).toEqual(routeChange(urlOfPage(10)))
    expect(past.marker).toBe('kept')
  })
})
