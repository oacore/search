// T-704 (41 H, J2, J21, Q-042, R-011, R-019, R-030): checkbox facet filters. J2 (findings/07 §3, with the 41
// §2.4 correction "facet box stays open"): open the "type" facet, apply "thesis" (q gets an AND fragment,
// page 1), the box stays open until an outside click, Clear all filters appears and the pills highlight; Back
// restores the query, Forward returns, a second click removes the fragment. J21 facet variants: values of two
// facets, the facet's own search field, the empty language facet. Q-042: Clear all filters keeps only the
// first word of the query. Per step the URL, the DOM view, the browser request log, the history log of the
// guard (pushState/replaceState/popstate), the router events and the loading bar are asserted; steps are
// settled states (40 §5).
// Fixtures: scenario search-climate (climate, the thesis facet), req-P0-13 (machine learning, its thesis facet,
// machine, climate + thesis + publisher; test/fixtures/requests/P0-13.json).
import { test, expect } from '../lib/P0-13/harness-gaps.mjs'
import { Journey } from '../lib/P0-13/journey.mjs'
import {
  pillHead,
  facetItem,
  facetBox,
  headerSearch,
} from '../lib/P0-13/locators.mjs'
import { answer, activePills, openPills } from '../lib/P0-13/states.mjs'
import { facetItems } from '../lib/P0-13/view.mjs'

const AGGREGATIONS = [
  'fieldsOfStudy',
  'yearPublished',
  'documentType',
  'authors',
  'language',
  'publisher',
]
const NEXT_DATA = '/search/_next/data/<buildId>/search.json'
const STATE_KEYS = ['__N', 'as', 'idx', 'options', 'url']
const THESIS_URL = '/search/?q=climate+AND+documentType%3A%22thesis%22&page=1'
const THESIS_Q = 'climate AND documentType:"thesis"'

const push = (url) => ({
  method: 'pushState',
  url,
  stateKeys: STATE_KEYS,
  scrollRestoration: 'auto',
  scrollY: 0,
})
const routeChange = (url) => [
  ['routeChangeStart', url],
  ['routeChangeComplete', url],
]
// what a navigation to `q` (page param as in the URL) costs in the browser: one data request, one filters call
const nav = (query, e2q = query.q) => ({
  documents: 0,
  nextData: [{ path: NEXT_DATA, query }],
  e2: [e2q],
  e2Aggregations: [AGGREGATIONS],
  apiOther: [],
})
const NO_REQUESTS = {
  documents: 0,
  nextData: [],
  e2: [],
  e2Aggregations: [],
  apiOther: [],
}

// a cookie consent is given so that the bottom-fixed consent popup (T-719, T-740) never covers the page
test.use({ cookieState: 'essential' })

test.describe('T-704 @P0 J2 checkbox facets, Back, Q-042', () => {
  test.describe.configure({ timeout: 300000 })

  test('T-704 @P0 J2 type facet: apply thesis, box stays open, Back, Forward, apply again removes it', async ({
    page,
    p2Env,
    resolver,
  }) => {
    const j = await Journey.open(page, p2Env, '/search/?q=climate')
    const base = answer(resolver, { q: 'climate' })
    const thesis = answer(resolver, { q: THESIS_Q })

    // loaded: no facet loading block (six pills), nothing highlighted, no Clear all, no box open
    expect(j.first.view).toMatchObject({
      url: '/search/?q=climate',
      hits: base.hits,
      ids: base.ids,
      clear: false,
    })
    expect(j.first.view.pills.map((p) => p.label)).toEqual([
      'field',
      'year',
      'type',
      'author',
      'language',
      'publisher',
    ])
    expect(activePills(j.first.view)).toEqual([])
    expect(openPills(j.first.view)).toEqual([])

    // open the facet: a box with the search field and the values by count (a click on the pill; the pills
    // are role=presentation without a keyboard path); no request, no history entry
    const opened = await j.act('open type', () =>
      pillHead(page, 'type').click()
    )
    expect(opened.requests).toEqual(NO_REQUESTS)
    expect(opened.history).toEqual([])
    expect(openPills(opened.view)).toEqual(['type'])
    const box = await facetItems(page, 'type')
    expect(box.search).toBe('')
    expect(box.items.slice(0, 3)).toEqual([
      {
        text: 'thesis',
        count: '132,192',
        checked: false,
        disabled: false,
        pointerEvents: 'auto',
      },
      {
        text: 'research article',
        count: '106,060',
        checked: false,
        disabled: false,
        pointerEvents: 'auto',
      },
      {
        text: 'conference paper',
        count: '63,798',
        checked: false,
        disabled: false,
        pointerEvents: 'auto',
      },
    ])

    // apply "thesis": q + AND fragment, page 1 (R-019)
    const applied = await j.act(
      'apply thesis',
      () => facetItem(page, 'type', 'thesis').click(),
      { url: THESIS_URL, e2: 1 }
    )
    const pushed = new URL(page.url())
    expect(pushed.searchParams.get('q')).toBe(THESIS_Q)
    expect(pushed.searchParams.get('page')).toBe('1')
    expect(applied.view).toMatchObject({
      url: THESIS_URL,
      input: 'climate',
      hits: thesis.hits,
      ids: thesis.ids,
      clear: true,
    })
    // the pills of "type" and, by substring match of "thesis" in the field values (Q-034), "field" are
    // highlighted; the "type" box stays open (it closes on an outside click only)
    expect(activePills(applied.view)).toEqual(['field', 'type'])
    expect(openPills(applied.view)).toEqual(['type'])
    const afterBox = await facetItems(page, 'type')
    expect(afterBox.items[0]).toEqual({
      text: 'thesis',
      count: '132,192',
      checked: true,
      disabled: false,
      pointerEvents: 'auto',
    })
    // every other value has count 0 in the thesis result and is disabled: pointer-events:none (Q-083)
    expect(afterBox.items.slice(1).every((i) => i.count === '0')).toBe(true)
    expect(afterBox.items.slice(1).every((i) => i.disabled && !i.checked)).toBe(
      true
    )
    // Q-083: the disabled values carry `pointer-events:none`, so a pointer cannot reach them (the item has
    // no keyboard path either: the pill, the item and the radio input are not focusable)
    expect(
      afterBox.items.slice(1).every((i) => i.pointerEvents === 'none')
    ).toBe(true)
    expect(applied.requests).toEqual(nav({ q: THESIS_Q, page: '1' }, THESIS_Q))
    expect(applied.history).toEqual([push(THESIS_URL)])
    expect(applied.router).toEqual(routeChange(THESIS_URL))
    expect(applied.bar).toEqual(['added', 'removed'])

    // Back: the query without the fragment, no pill highlighted, Clear all hidden; the box is still open
    const back = await j.act('back', () => page.goBack(), {
      url: '/search/?q=climate',
      e2: 1,
    })
    expect(back.view).toMatchObject({
      url: '/search/?q=climate',
      hits: base.hits,
      ids: base.ids,
      clear: false,
    })
    expect(activePills(back.view)).toEqual([])
    expect(openPills(back.view)).toEqual(['type'])
    expect(back.requests).toEqual(nav({ q: 'climate' }, 'climate'))
    expect(back.history.map((h) => [h.method, h.url])).toEqual([
      ['popstate', '/search/?q=climate'],
      ['replaceState', '/search/?q=climate'],
    ])
    expect(back.marker).toBe('kept')

    // Forward: the thesis state again
    const forward = await j.act('forward', () => page.goForward(), {
      url: THESIS_URL,
      e2: 1,
    })
    expect(forward.view).toMatchObject({
      url: THESIS_URL,
      hits: thesis.hits,
      ids: thesis.ids,
      clear: true,
    })
    expect(activePills(forward.view)).toEqual(['field', 'type'])
    expect(forward.requests).toEqual(nav({ q: THESIS_Q, page: '1' }, THESIS_Q))
    expect(forward.history.map((h) => [h.method, h.url])).toEqual([
      ['popstate', THESIS_URL],
      ['replaceState', THESIS_URL],
    ])

    // apply "thesis" again: the fragment is removed (the value is in q), page 1 added to the URL
    const removed = await j.act(
      'remove thesis',
      () => facetItem(page, 'type', 'thesis').click(),
      { url: '/search/?q=climate&page=1', e2: 1 }
    )
    expect(new URL(page.url()).searchParams.get('q')).toBe('climate')
    expect(removed.view).toMatchObject({
      url: '/search/?q=climate&page=1',
      hits: base.hits,
      ids: base.ids,
      clear: false,
    })
    expect(activePills(removed.view)).toEqual([])
    expect(removed.requests).toEqual(
      nav({ q: 'climate', page: '1' }, 'climate')
    )
    expect(removed.history).toEqual([push('/search/?q=climate&page=1')])
    expect(removed.marker).toBe('kept')
  })

  test('T-704 @P0 Q-042 Clear all filters keeps only the first word of the query', async ({
    page,
    p2Env,
    resolver,
  }) => {
    const j = await Journey.open(page, p2Env, '/search/?q=machine+learning')
    const q = 'machine learning AND documentType:"thesis"'
    const url =
      '/search/?q=machine+learning+AND+documentType%3A%22thesis%22&page=1'
    expect(j.first.view).toMatchObject({
      url: '/search/?q=machine+learning',
      input: 'machine learning',
      hits: answer(resolver, { q: 'machine learning' }).hits,
      clear: false,
    })
    await pillHead(page, 'type').click()
    const applied = await j.act(
      'apply thesis',
      () => facetItem(page, 'type', 'thesis').click(),
      { url, e2: 1 }
    )
    expect(applied.view).toMatchObject({
      url,
      hits: answer(resolver, { q }).hits,
      ids: answer(resolver, { q }).ids,
      clear: true,
    })
    expect(new URL(page.url()).searchParams.get('q')).toBe(q)

    // Clear all: q is cut at the first space (store/filters.js reset); the header input keeps the typed text
    const cleared = await j.act(
      'clear all',
      () => page.getByRole('button', { name: 'Clear all filters' }).click(),
      { url: '/search/?q=machine&page=1', e2: 2 }
    )
    const word = answer(resolver, { q: 'machine' })
    expect(new URL(page.url()).searchParams.get('q')).toBe('machine')
    expect(cleared.view).toMatchObject({
      url: '/search/?q=machine&page=1',
      hits: word.hits,
      ids: word.ids,
      clear: false,
    })
    expect(activePills(cleared.view)).toEqual([])
    // one data request; the filters are fetched twice with the same body (reset() and the route change, Q-092)
    expect(cleared.requests).toEqual({
      ...nav({ q: 'machine', page: '1' }, 'machine'),
      e2: ['machine', 'machine'],
      e2Aggregations: [AGGREGATIONS, AGGREGATIONS],
    })
    expect(cleared.history).toEqual([push('/search/?q=machine&page=1')])
    expect(cleared.marker).toBe('kept')
  })

  test('T-704 @P0 J21 two facets: thesis, then a publisher, keep both AND fragments', async ({
    page,
    p2Env,
    resolver,
  }) => {
    const j = await Journey.open(page, p2Env, '/search/?q=climate')
    const q = `${THESIS_Q} AND publisher:"Oregon State University"`
    const url =
      '/search/?q=climate+AND+documentType%3A%22thesis%22+AND+publisher%3A%22Oregon+State+University%22&page=1'
    await pillHead(page, 'type').click()
    await j.act(
      'apply thesis',
      () => facetItem(page, 'type', 'thesis').click(),
      {
        url: THESIS_URL,
        e2: 1,
      }
    )
    // another pill: the mousedown outside the "type" item closes its box
    const opened = await j.act('open publisher', () =>
      pillHead(page, 'publisher').click()
    )
    expect(opened.requests).toEqual(NO_REQUESTS)
    expect(openPills(opened.view)).toEqual(['publisher'])
    const publisher = await facetItems(page, 'publisher')
    expect(publisher.items[0]).toMatchObject({
      text: 'Oregon State University',
      count: '6,901',
      checked: false,
      disabled: false,
    })

    const applied = await j.act(
      'apply publisher',
      () => facetItem(page, 'publisher', 'Oregon State University').click(),
      { url, e2: 1 }
    )
    const state = answer(resolver, { q })
    expect(new URL(page.url()).searchParams.get('q')).toBe(q)
    expect(applied.view).toMatchObject({
      url,
      hits: state.hits,
      ids: state.ids,
      clear: true,
    })
    expect(activePills(applied.view)).toEqual(['field', 'type', 'publisher'])
    expect(openPills(applied.view)).toEqual(['publisher'])
    expect(applied.requests).toEqual(nav({ q, page: '1' }, q))
    expect(applied.history).toEqual([push(url)])
  })

  test('T-704 @P0 J21 facet search field filters the values on the client, no request', async ({
    page,
    p2Env,
  }) => {
    const j = await Journey.open(page, p2Env, '/search/?q=climate')
    await pillHead(page, 'type').click()
    const search = facetBox(page, 'type').getByRole('textbox', {
      name: 'Search',
    })
    // a case-insensitive substring of the value; the list is replaced, the order stays by count
    const typed = await j.act('search res', () => search.fill('RES'))
    expect(typed.requests).toEqual(NO_REQUESTS)
    expect(typed.history).toEqual([])
    expect(typed.router).toEqual([])
    const filtered = await facetItems(page, 'type')
    expect(filtered.search).toBe('RES')
    expect(filtered.items.map((i) => [i.text, i.count])).toEqual([
      ['research article', '106,060'],
      ['presentation', '5,011'],
      ['research report', '59'],
    ])
    // clearing the text brings the whole list back
    const cleared = await j.act('clear search', () => search.fill(''))
    expect(cleared.requests).toEqual(NO_REQUESTS)
    const all = await facetItems(page, 'type')
    expect(all.items.length).toBeGreaterThan(30)
    expect(all.items[0]).toMatchObject({ text: 'thesis', count: '132,192' })
  })

  test('T-704 @P0 J21 facet search field after a filter lists the counts of the pill as it was opened (stale alias)', async ({
    page,
    p2Env,
  }) => {
    const j = await Journey.open(page, p2Env, '/search/?q=climate')
    await pillHead(page, 'type').click()
    await j.act(
      'apply thesis',
      () => facetItem(page, 'type', 'thesis').click(),
      {
        url: THESIS_URL,
        e2: 1,
      }
    )
    // after the filter every value but "thesis" has count 0 and is disabled; the search field filters the
    // items of the pill captured when the box was opened (filters.activeFilter), so typing brings back the
    // counts and the enabled state of the unfiltered result
    const before = await facetItems(page, 'type')
    expect(before.items.filter((i) => i.disabled).length).toBe(
      before.items.length - 1
    )
    await facetBox(page, 'type')
      .getByRole('textbox', { name: 'Search' })
      .fill('res')
    await expect
      .poll(async () =>
        (
          await facetItems(page, 'type')
        ).items.map((i) => [i.text, i.count, i.disabled])
      )
      .toEqual([
        ['research article', '106,060', false],
        ['presentation', '5,011', false],
        ['research report', '59', false],
      ])
  })

  test('T-704 @P0 J21 language facet: the aggregation has no values, the box holds only the search field', async ({
    page,
    p2Env,
  }) => {
    const j = await Journey.open(page, p2Env, '/search/?q=climate')
    const opened = await j.act('open language', () =>
      pillHead(page, 'language').click()
    )
    expect(opened.requests).toEqual(NO_REQUESTS)
    expect(openPills(opened.view)).toEqual(['language'])
    expect(activePills(opened.view)).toEqual([])
    // the recorded answer (the live API returns an empty language aggregation) gives no value to select,
    // so the "language code with no name" variant of findings/07 §2.2 cannot be reached with live data
    const box = await facetItems(page, 'language')
    expect(box).toEqual({ search: '', items: [] })
    // the header input is untouched
    await expect(headerSearch(page)).toHaveValue('climate')
  })
})
