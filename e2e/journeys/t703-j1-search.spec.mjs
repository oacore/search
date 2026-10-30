// T-703 (41 H, J1, R-001, R-019): search -> results. The search page of /search/?q=climate (status, title, count
// line, 10 cards with title link, authors, date and abstract), the header search that replaces the results
// (URL, results, input, request log, history log, loading bar), the same with `&` and `+` in the term (the
// object push is encoded by Next; the result links carry the raw query, Q-012) and the blur that does not
// submit (changeOnBlur false, Q-084). findings/07 §3 J1 read with the 41 §2.4 correction "q pushed unencoded
// on some paths": on this page the header search pushes an object (encoded), while every result link nests the
// raw query string in `search=` (a `&page=1` of the search URL becomes a parameter of the works link).
// Fixtures: scenario search-climate, req-P0-13 (machine learning, tea&coffee c++; test/fixtures/requests/P0-13.json).
import { test, expect } from '../lib/P0-13/harness-gaps.mjs'
import { Journey } from '../lib/P0-13/journey.mjs'
import { headerSearch } from '../lib/P0-13/locators.mjs'
import { answer, activePills, pagerLabels } from '../lib/P0-13/states.mjs'
import { cardFacts } from '../lib/P0-13/view.mjs'

const AGGREGATIONS = [
  'fieldsOfStudy',
  'yearPublished',
  'documentType',
  'authors',
  'language',
  'publisher',
]
const NEXT_DATA = '/search/_next/data/<buildId>/search.json'
const STATE_KEYS = ['__N', 'as', 'key', 'options', 'url'] // AD-122
const PAGER_FIRST_PAGE = [
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
// "Publication date" of the 10 cards of the first climate page: a year, a formatted date or nothing (the
// card keeps an empty value row)
const CLIMATE_DATES = [
  '2015',
  '2008',
  '2015',
  '01/01/2001',
  '01/01/2008',
  '2015',
  '',
  '',
  '',
  '',
]

// a cookie consent is given so that the bottom-fixed consent popup (T-719, T-740) never covers the page
test.use({ cookieState: 'essential' })

test.describe('T-703 @P0 J1 search to results', () => {
  test.describe.configure({ timeout: 300000 })

  test('T-703 @P0 J1 /search/?q=climate: 200, title, count line and 10 cards with title link, authors, date and abstract', async ({
    page,
    p2Env,
    resolver,
  }) => {
    const j = await Journey.open(page, p2Env, '/search/?q=climate')
    expect(j.response.status()).toBe(200)
    await expect(page).toHaveTitle('Search CORE')
    const state = answer(resolver, { q: 'climate' })
    const { view } = j.first
    expect(view).toMatchObject({
      url: '/search/?q=climate',
      title: 'Search CORE',
      input: 'climate',
      hits: state.hits,
      ids: state.ids,
      clear: false,
      sort: 'Sort by relevance',
      noResults: null,
      // a CSS-module class of the card container survives the build (R-001)
      cardClassStems: ['styles_search-results'],
    })
    expect(view.ids).toHaveLength(10)
    expect(activePills(view)).toEqual([])
    expect(pagerLabels(view)).toEqual(PAGER_FIRST_PAGE)

    const cards = await cardFacts(page)
    expect(cards.map((c) => c.id)).toEqual(state.ids)
    cards.forEach((card, i) => {
      const work = state.works[i]
      const id = String(work.id)
      expect(card.title).toBe(work.title)
      // title link: the work page of the gateway host with the search id and the raw query string of the
      // search nested in `search=` (not encoded: Q-012 on the result link)
      expect(card.titleHref).toBe(
        `${p2Env.baseURL}/works/${id}/?t=${state.searchId}-${id}&search=q=climate`
      )
      // authors: links to an author search, `q` raw (parentheses, spaces and commas unencoded)
      expect(card.authorHrefs.length).toBeGreaterThan(0)
      expect(card.authorHrefs[0]).toBe(
        `/search?q=author:(${work.authors[0].name})&t=${state.searchId}-${id}`
      )
      expect(card.meta['Publication date']).toBe(CLIMATE_DATES[i])
      expect(card.abstract).toBeTruthy()
    })
    // request log of the load (41 §2.2, "Load /search/?q=x"): one document, the filters' aggregation call
    // once, no other API call besides member logos (E1 and the members call ran on the server)
    expect(j.first.requests).toMatchObject({
      documents: 1,
      nextData: [],
      e2: ['climate'],
      e2Aggregations: [AGGREGATIONS],
      apiOther: [],
    })
  })

  test('T-703 @P0 J1 header search: machine learning replaces the results, URL /search/?q=machine+learning&page=1, input kept, loading bar', async ({
    page,
    p2Env,
    resolver,
  }) => {
    const j = await Journey.open(page, p2Env, '/search/?q=climate')
    const input = headerSearch(page)
    await expect(input).toHaveValue('climate')
    const state = answer(resolver, { q: 'machine learning' })
    const url = '/search/?q=machine+learning&page=1'
    const rec = await j.act(
      'machine learning',
      async () => {
        await input.fill('machine learning')
        await input.press('Enter')
      },
      { url, e2: 1 }
    )

    // URL: the object push is encoded by Next; the decoded q is the typed term and page is 1 (R-019)
    const pushed = new URL(page.url())
    expect(pushed.searchParams.get('q')).toBe('machine learning')
    expect(pushed.searchParams.get('page')).toBe('1')
    // DOM: the results are the recorded answer for the new term, the input still shows it, no facet is
    // highlighted (a fresh query), the pager starts at page 1
    expect(rec.view).toMatchObject({
      url,
      title: 'Search CORE',
      input: 'machine learning',
      hits: state.hits,
      ids: state.ids,
      clear: false,
      sort: 'Sort by relevance',
      cardClassStems: ['styles_search-results'],
    })
    expect(activePills(rec.view)).toEqual([])
    expect(pagerLabels(rec.view)).toEqual(PAGER_FIRST_PAGE)
    expect(rec.view.ids).not.toEqual(j.first.view.ids)
    // request log: one client navigation (the data request of the gSSP page), no document, the filters'
    // aggregation call once for the new term, no other API call besides member logos
    expect(rec.requests).toMatchObject({
      documents: 0,
      nextData: [
        {
          path: NEXT_DATA,
          query: { q: 'machine learning', page: '1' },
        },
      ],
      e2: ['machine learning'],
      e2Aggregations: [AGGREGATIONS],
      apiOther: [],
    })
    // history: one pushState with the new URL; Next's state keys; the page was at the top
    expect(rec.history).toEqual([
      {
        method: 'pushState',
        url,
        stateKeys: STATE_KEYS,
        scrollRestoration: 'auto',
        scrollY: 0,
      },
    ])
    // the route change ran start -> complete, the LoadingBar was mounted and removed, the page stayed
    expect(rec.router).toEqual([
      ['routeChangeStart', url],
      ['routeChangeComplete', url],
    ])
    expect(rec.bar).toEqual(['added', 'removed'])
    expect(rec.marker).toBe('kept')
  })

  test('T-703 @P0 J1 header search with & and +: the push is encoded, the result links nest the raw query (Q-012)', async ({
    page,
    p2Env,
    resolver,
  }) => {
    const j = await Journey.open(page, p2Env, '/search/?q=climate')
    const input = headerSearch(page)
    const term = 'tea&coffee c++'
    const state = answer(resolver, { q: term })
    const url = '/search/?q=tea%26coffee+c%2B%2B&page=1'
    const rec = await j.act(
      'special',
      async () => {
        await input.fill(term)
        await input.press('Enter')
      },
      { url, e2: 1 }
    )
    // encoded by the router for an object push: & -> %26, + -> %2B, space -> +
    const pushed = new URL(page.url())
    expect([...pushed.searchParams.keys()]).toEqual(['q', 'page'])
    expect(pushed.searchParams.get('q')).toBe(term)
    expect(rec.view).toMatchObject({
      url,
      input: term,
      hits: state.hits,
      ids: state.ids,
    })
    expect(rec.requests).toMatchObject({
      documents: 0,
      nextData: [{ path: NEXT_DATA, query: { q: term, page: '1' } }],
      e2: [term],
    })
    expect(rec.history.map((h) => [h.method, h.url])).toEqual([
      ['pushState', url],
    ])

    // the unencoded paths: a result link nests the query string of this page as it stands in the address
    // bar, so `&page=1` becomes a parameter of the works link and `%26`, `%2B` stay encoded inside `search`
    const cards = await cardFacts(page)
    const first = cards[0]
    const id = state.ids[0]
    expect(first.titleHref).toBe(
      `${p2Env.baseURL}/works/${id}/?t=${state.searchId}-${id}&search=q=tea%26coffee+c%2B%2B&page=1`
    )
    const link = new URL(first.titleHref)
    expect([...link.searchParams.keys()]).toEqual(['t', 'search', 'page'])
    expect(link.searchParams.get('search')).toBe(`q=${term}`)
    expect(link.searchParams.get('page')).toBe('1')
    // the author links are raw too: a name with a comma or a parenthesis is not encoded
    expect(first.authorHrefs[0]).toBe(
      `/search?q=author:(${state.works[0].authors[0].name})&t=${state.searchId}-${id}`
    )
  })

  test('T-703 @P0 J1 header search: blur does not submit (changeOnBlur false)', async ({
    page,
    p2Env,
  }) => {
    const j = await Journey.open(page, p2Env, '/search/?q=climate')
    const input = headerSearch(page)
    const rec = await j.act('blur', async () => {
      await input.fill('machine learning')
      // Tab moves the focus out of the input: a blur without Enter
      await input.press('Tab')
      await expect(input).not.toBeFocused()
    })
    expect(rec.view.url).toBe('/search/?q=climate')
    expect(rec.view.ids).toEqual(j.first.view.ids)
    expect(rec.requests).toMatchObject({
      documents: 0,
      nextData: [],
      e2: [],
      apiOther: [],
    })
    expect(rec.history).toEqual([])
    expect(rec.router).toEqual([])
    // the typed text stays in the input
    await expect(input).toHaveValue('machine learning')
  })
})
