// T-202 (41 C, R-019): the Filters URL algebra, findings/03 §5.1 "Filters" and
// findings/06 §7.2 ("store/filters.js URL algebra"). Every change goes through
// Router.push (router mock); the string surgery on `q` is pinned as it is:
// Q-040 add/remove by substring, Q-041 greedy year regex, Q-042 "Clear all"
// keeps the first word, Q-020 the AbortSignal lands in `sortType`.
// the state is plain since the zustand port (CS-ZU-6)
const toJS = (value) => value
const nextRouter = require('next/router')

const { setupMsw } = require('../../utils/msw')
const { waitFor } = require('../../utils/render')
const { createFiltersStore } = require('../../../store/filters')
const live = require('../../drivers/store-driver/live')

const transformFiltersData = require('utils/filters-transform').default

// pass-through spy: the 4th argument of the call is `fullQuery`
// ("<q>?sort=<sortType>", store/filters.js:79)
jest.mock('utils/filters-transform', () => {
  const actual = jest.requireActual('utils/filters-transform')
  return { __esModule: true, ...actual, default: jest.fn(actual.default) }
})

const { server, resolver, http, HttpResponse } = setupMsw()

const Router = nextRouter.default
const AGG_URL = 'https://api.core.ac.uk/v3/search/works/aggregate'
const ALL = [
  'fieldsOfStudy',
  'yearPublished',
  'documentType',
  'authors',
  'language',
  'publisher',
]

const recorded = (q) => {
  const r = resolver.resolve(
    'POST',
    AGG_URL,
    JSON.stringify({ aggregations: ALL, q })
  )
  if (r.status !== 200) throw new Error(`no recorded E2 answer for q=${q}`)
  return JSON.parse(r.body.toString('utf8')).aggregations
}

let calls
const track = (answer) => {
  calls = []
  server.use(
    http.post(AGG_URL, async ({ request }) => {
      const text = await request.clone().text()
      calls.push(JSON.parse(text))
      return answer ? answer(JSON.parse(text)) : undefined
    })
  )
}

const facet = (filters, value) => filters.data.find((f) => f.value === value)

// a store after the first E2 of "climate" with one facet open
const opened = async (facetValue) => {
  const filters = live(createFiltersStore())
  await filters.fetchFilters('climate', 'relevance')
  const filter = facet(filters, facetValue)
  filters.setActiveFilter(filter)
  filters.setActiveFilterSuggestions(filter.items)
  return filters
}

const pushed = () => Router.push.mock.calls.map(([arg]) => arg)
const settled = (filters) =>
  waitFor(() => expect(filters.isLoading).toBe(false), { timeout: 5000 })

describe('T-202 @P0 Filters URL algebra', () => {
  beforeEach(() => {
    track()
    transformFiltersData.mockClear()
  })
  afterEach(() => jest.restoreAllMocks())

  test('T-202 c1 @P0 Q-040 toggle by substring, Q-041 greedy year regex', async () => {
    // add: q gets ` AND <filter>:"<value>"`, page goes back to 1, the other
    // query keys stay
    let filters = await opened('documentType')
    nextRouter.setRouter({
      query: { q: 'climate', sort: 'relevance', page: '3' },
    })
    filters.toggleCheckboxFilter({ value: 'thesis' }, '/search')
    expect(pushed()).toEqual([
      {
        pathname: '/search',
        query: {
          q: 'climate AND documentType:"thesis"',
          sort: 'relevance',
          page: 1,
        },
      },
    ])
    const thesis = () =>
      facet(filters, 'documentType').items.find((i) => i.value === 'thesis')
    // the open facet's suggestions alias the items of `data`
    expect(thesis().checked).toBe(true)
    expect(filters.isVisibleClearButton).toBe(true)
    expect(filters.isLoading).toBe(true)

    // remove: the exact ` AND <filter>:"<value>"` substring goes
    Router.push.mockClear()
    nextRouter.setRouter({
      query: { q: 'climate AND documentType:"thesis"', page: '2' },
    })
    filters.toggleCheckboxFilter({ value: 'thesis' }, '/search')
    expect(pushed()).toEqual([
      { pathname: '/search', query: { q: 'climate', page: 1 } },
    ])
    expect(thesis().checked).toBe(false)

    // Q-040: any q that merely contains the value counts as "applied", so the
    // filter cannot be added; the replace is a no-op, the push repeats q and
    // the item is shown checked
    filters = await opened('documentType')
    Router.push.mockClear()
    nextRouter.setRouter({ query: { q: 'climate thesis', page: '1' } })
    filters.toggleCheckboxFilter({ value: 'thesis' }, '/search')
    expect(pushed()).toEqual([
      { pathname: '/search', query: { q: 'climate thesis', page: 1 } },
    ])
    expect(
      facet(filters, 'documentType').items.find((i) => i.value === 'thesis')
        .checked
    ).toBe(true)

    // Q-041: the year range is appended after removing the greedy match of
    // / AND \(year(.*)\)/g
    const yearPush = async (q, range = [2000, 2001]) => {
      const f = await opened('yearPublished')
      Router.push.mockClear()
      nextRouter.setRouter({ query: { q, offset: '10' } })
      f.setActiveYearDate(range, '/search')
      return { f, pushes: pushed() }
    }
    const clause = ' AND (yearPublished>=2000 AND yearPublished<=2001)'

    let r = await yearPush('climate')
    expect(r.pushes).toEqual([
      {
        pathname: '/search',
        query: { q: `climate${clause}`, offset: '10', page: 1 },
      },
    ])
    // 6789 + 8394: the counts of 2000 and 2001 in the recorded answer
    expect(r.f.yearWorksCount).toBe(15183)
    expect(r.f.isVisibleClearButton).toBe(true)
    expect(r.f.groupedYearDates.every((g) => g.checked === false)).toBe(true)

    // an earlier year clause is replaced
    r = await yearPush(
      'climate AND (yearPublished>=2014 AND yearPublished<=2020)'
    )
    expect(r.pushes[0].query.q).toBe(`climate${clause}`)

    // a filter after the year clause survives while no `)` follows it
    r = await yearPush(
      'climate AND (yearPublished>=2014 AND yearPublished<=2020) AND documentType:"thesis"'
    )
    expect(r.pushes[0].query.q).toBe(
      `climate AND documentType:"thesis"${clause}`
    )

    // greedy: a `)` inside a later filter extends the match, the later filter
    // is wiped and its closing quote stays behind
    r = await yearPush(
      'climate AND (yearPublished>=2014 AND yearPublished<=2020) AND publisher:"Springer (UK)"'
    )
    expect(r.pushes[0].query.q).toBe(`climate"${clause}`)
  })

  test('T-202 c2 @P0 reset keeps the first word of q and fetches with the signal in sortType (Q-042, Q-020)', async () => {
    // E2 for q="machine" is not recorded: it gets the recorded "climate" answer
    track((body) =>
      body.q === 'machine'
        ? HttpResponse.json({ aggregations: recorded('climate') })
        : undefined
    )
    const filters = await opened('yearPublished')
    filters.setYearWorksCount([2000, 2002])
    expect(filters.yearWorksCount).toBe(15183)
    calls.length = 0
    transformFiltersData.mockClear()
    nextRouter.setRouter({
      query: { q: 'machine learning AND x', sort: 'recent', page: '4' },
    })

    filters.reset('machine learning AND x', '/search')

    expect(pushed()).toEqual([
      {
        pathname: '/search',
        query: { q: 'machine', sort: 'recent', page: 1 },
      },
    ])
    // the state is cleared before the request is sent
    expect(toJS(filters.initialData)).toEqual({})
    expect(toJS(filters.activeFilter)).toEqual({})
    expect(toJS(filters.groupedYearDates)).toEqual([])
    expect(filters.yearWorksCount).toBeNull()
    expect(filters.isVisibleClearButton).toBe(false)
    expect(filters.isLoading).toBe(true)

    await settled(filters)
    expect(calls).toEqual([{ aggregations: ALL, q: 'machine' }])
    // fetchFilters('machine') receives (query, sortType = AbortSignal)
    expect(transformFiltersData).toHaveBeenCalledTimes(1)
    expect(transformFiltersData.mock.calls[0][3]).toBe(
      'machine?sort=[object AbortSignal]'
    )
    expect(Object.keys(toJS(filters.initialData))).toEqual(ALL)
  })

  test('T-202 c3 @P0 reset(undefined) pushes, then throws', () => {
    const filters = live(createFiltersStore())
    nextRouter.setRouter({ query: { q: 'climate', page: '2' } })

    expect(() => filters.reset(undefined, '/search')).toThrow(TypeError)
    expect(() => filters.reset(undefined, '/search')).toThrow(/replace/)

    // the push (q undefined, page 1) happened before the TypeError
    expect(pushed()).toHaveLength(2)
    expect(pushed()[0]).toEqual({
      pathname: '/search',
      query: { q: undefined, page: 1 },
    })
    expect('q' in pushed()[0].query).toBe(true)
    // and no E2 was sent
    expect(calls).toEqual([])
    expect(filters.isLoading).toBe(false)
  })

  test('T-202 c4 @P0 pathname undefined is pushed as it is', async () => {
    const filters = await opened('documentType')
    nextRouter.setRouter({ query: { q: 'climate', page: '5' } })

    filters.toggleCheckboxFilter({ value: 'thesis' })
    const year = await opened('yearPublished')
    year.setActiveYearDate([2000, 2001])
    nextRouter.setRouter({ query: { q: 'climate', page: '5' } })
    const cleared = live(createFiltersStore())
    cleared.reset('climate')
    await settled(cleared)

    const args = pushed()
    expect(args).toHaveLength(3)
    for (const arg of args) {
      expect(Object.keys(arg).sort()).toEqual(['pathname', 'query'])
      expect(arg.pathname).toBeUndefined()
      expect(arg.query.page).toBe(1)
    }
    expect(args[0].query.q).toBe('climate AND documentType:"thesis"')
    expect(args[2].query.q).toBe('climate')
  })
})
