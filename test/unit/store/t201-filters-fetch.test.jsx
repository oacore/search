// T-201 (41 C, R-011, R-029): the Filters fetch flow, findings/03 §5.1
// "Filters" and findings/06 §2.3 / §7.2. Dom project, router mock, MSW on the
// recorded E2 aggregation answers (scenario search-climate). Characterise,
// never correct: `isVisibleClearButton` is `undefined` (not `false`) until a
// filter is checked, then the first checked filter object (findings/03 says
// `false`, P0-05 issue); the year facet of the recorded answers carries junk
// keys (1..10000), so `maxYear` is 10000 and the "since" buckets sum every
// year from 2014/2016/2018 upwards.
const { toJS } = require('mobx')
const Router = require('next/router').default

const { setupMsw } = require('../../utils/msw')
const { waitFor } = require('../../utils/render')
const Filters = require('../../../store/filters').default

const { server, resolver, http, HttpResponse } = setupMsw()

const AGG_URL = 'https://api.core.ac.uk/v3/search/works/aggregate'
const ALL = [
  'fieldsOfStudy',
  'yearPublished',
  'documentType',
  'authors',
  'language',
  'publisher',
]
const WITHOUT_YEAR = ALL.filter((name) => name !== 'yearPublished')
const LABELS = ['field', 'year', 'type', 'author', 'language', 'publisher']
const THESIS_Q = 'climate AND documentType:"thesis"'
const YEAR_Q = 'climate AND (yearPublished>=2014 AND yearPublished<=2020)'

// the `aggregations` object of a recorded E2 answer
const recorded = (q, names = ALL) => {
  const r = resolver.resolve(
    'POST',
    AGG_URL,
    JSON.stringify({ aggregations: names, q })
  )
  if (r.status !== 200) throw new Error(`no recorded E2 answer for q=${q}`)
  return JSON.parse(r.body.toString('utf8')).aggregations
}

// logs the body of every E2 request; `answer(body)` may return a response
// (anything else falls through to the recorded fixtures)
let calls
const track = (answer) => {
  calls = []
  server.use(
    http.post(AGG_URL, async ({ request }) => {
      const text = await request.clone().text()
      calls.push(text)
      return answer ? answer(JSON.parse(text)) : undefined
    })
  )
}
const bodies = () => calls.map((text) => JSON.parse(text))

const facet = (filters, value) => filters.data.find((f) => f.value === value)
const counts = (facetItems) => facetItems.map((item) => item.count)
const keysOf = (...objects) =>
  new Set(objects.flatMap((object) => Object.keys(object)))

// [value, count] pairs in a canonical order. The transform strips quotes from
// the bucket names (utils/filters-transform.js), so the expected pairs are
// built from the recorded keys the same way: first answer, next answer
// (a bucket the next answer lacks counts 0)
const strip = (key) => key.replace(/['"]+/g, '')
const pairs = (items) =>
  items
    .map((i) => [String(i.value), i.count])
    .sort((a, b) => (`${a[0]}\u0000${a[1]}` < `${b[0]}\u0000${b[1]}` ? -1 : 1))
const expectedPairs = (base, next) =>
  [...keysOf(base, next)]
    .map((key) => [strip(key), next[key] || 0])
    .sort((a, b) => (`${a[0]}\u0000${a[1]}` < `${b[0]}\u0000${b[1]}` ? -1 : 1))

describe('T-201 @P0 Filters fetch', () => {
  afterEach(() => jest.restoreAllMocks())

  test('T-201 c1 @P0 first fetch stores initialData, the next fetch diffs against it', async () => {
    track()
    const filters = new Filters()
    const climate = recorded('climate')

    const first = filters.fetchFilters('climate', 'relevance')
    expect(filters.isLoading).toBe(true)
    await first

    // E2 body: the six names in aggregationsNames order, then q
    expect(bodies()).toEqual([{ aggregations: ALL, q: 'climate' }])
    expect(toJS(filters.initialData)).toEqual(climate)
    expect(filters.isLoading).toBe(false)
    expect(filters.data.map((f) => f.value)).toEqual(ALL)
    expect(filters.data.map((f) => f.label)).toEqual(LABELS)
    for (const f of filters.data) {
      // sorted by count, descending
      expect(counts(f.items)).toEqual(
        [...counts(f.items)].sort((a, b) => b - a)
      )
      expect(f.items.length).toBe(Object.keys(climate[f.value]).length)
    }
    expect(filters.data.map((f) => f.items.length)).toEqual([
      100, 100, 36, 100, 0, 100,
    ])
    // year values are numbers, the others stay strings
    expect(
      facet(filters, 'yearPublished').items.every((i) =>
        Number.isInteger(i.value)
      )
    ).toBe(true)
    expect(facet(filters, 'documentType').items[0]).toEqual({
      value: 'thesis',
      count: 132192,
      checked: false,
    })
    // the "since" buckets: 2018, 2016, 2014 with the summed counts
    const years = climate.yearPublished
    const since = (from) =>
      Object.entries(years)
        .filter(([year]) => Number(year) >= from)
        .reduce((sum, [, count]) => sum + count, 0)
    expect(toJS(filters.groupedYearDates)).toEqual([
      { yearFrom: 2018, count: since(2018), checked: false },
      { yearFrom: 2016, count: since(2016), checked: false },
      { yearFrom: 2014, count: since(2014), checked: false },
    ])
    expect(filters.groupedYearDates.map((g) => g.count)).toEqual([
      1086604, 1263697, 1405745,
    ])
    expect(filters.maxYear).toBe(10000)
    expect(filters.isVisibleClearButton).toBeUndefined()
    expect(filters.activeFilterSuggestions).toEqual([])

    // second fetch: the else branch merges the new answer into initialData
    await filters.fetchFilters(THESIS_Q, 'relevance')
    expect(bodies()[1]).toEqual({ aggregations: ALL, q: THESIS_Q })
    expect(toJS(filters.initialData)).toEqual(climate)
    const thesis = recorded(THESIS_Q)
    const fullQuery = `${THESIS_Q}?sort=relevance`
    for (const name of ALL.filter((n) => n !== 'language')) {
      const { items } = facet(filters, name)
      // every bucket of the first answer or of this one is listed; a bucket
      // missing from the new answer counts 0
      expect(pairs(items)).toEqual(expectedPairs(climate[name], thesis[name]))
      for (const item of items) {
        // `checked` is a substring test of the value in "<q>?sort=<sort>"
        expect(item.checked).toBe(fullQuery.includes(String(item.value)))
      }
    }
    expect(facet(filters, 'documentType').items[0]).toEqual({
      value: 'thesis',
      count: 132192,
      checked: true,
    })
    expect(facet(filters, 'documentType').items.length).toBe(36)
    expect(
      facet(filters, 'documentType')
        .items.slice(1)
        .every((i) => i.count === 0)
    ).toBe(true)
    expect(filters.isVisibleClearButton).toBeTruthy()
    expect(filters.isLoading).toBe(false)
  })

  test('T-201 c2 @P0 year facet open requests five aggregations, without yearPublished', async () => {
    track()
    const filters = new Filters()
    await filters.fetchFilters('climate', 'relevance')
    expect(filters.filterNamesWithoutYear).toEqual(WITHOUT_YEAR)

    filters.setActiveFilter(facet(filters, 'yearPublished'))
    await filters.fetchFilters(YEAR_Q, 'relevance')

    expect(bodies()).toEqual([
      { aggregations: ALL, q: 'climate' },
      { aggregations: WITHOUT_YEAR, q: YEAR_Q },
    ])
    // the other facets took the counts of the five-aggregation answer
    const five = recorded(YEAR_Q, WITHOUT_YEAR)
    expect(facet(filters, 'documentType').items[0]).toEqual(
      expect.objectContaining({
        value: 'thesis',
        count: five.documentType.thesis,
      })
    )
    expect(five.documentType.thesis).toBe(41754)
    // the open facet is the suggestion list
    expect(filters.activeFilter.value).toBe('yearPublished')
    expect(filters.activeFilterSuggestions.map((i) => i.value)).toEqual(
      facet(filters, 'yearPublished').items.map((i) => i.value)
    )
  })

  test('T-201 c3 @P0 zero years are kept: an all-zero year answer keeps the previous year items', async () => {
    track()
    const filters = new Filters()
    await filters.fetchFilters('climate', 'relevance')
    const yearsBefore = toJS(facet(filters, 'yearPublished').items)
    const groupedBefore = toJS(filters.groupedYearDates)
    filters.setActiveFilter(facet(filters, 'yearPublished'))

    // the five-aggregation answer has no yearPublished: every year counts 0
    await filters.fetchFilters(YEAR_Q, 'relevance')
    expect(toJS(facet(filters, 'yearPublished').items)).toEqual(yearsBefore)
    expect(yearsBefore.some((item) => item.count > 0)).toBe(true)
    expect(toJS(filters.groupedYearDates)).toEqual(groupedBefore)

    // and a year bucket missing from a non-zero answer stays listed with 0
    const other = new Filters()
    await other.fetchFilters('climate', 'relevance')
    await other.fetchFilters('climate change', 'relevance')
    const years = facet(other, 'yearPublished').items
    const union = keysOf(
      recorded('climate').yearPublished,
      recorded('climate change').yearPublished
    )
    expect(years.length).toBe(union.size)
    expect(years.filter((item) => item.count === 0).length).toBe(12)
  })

  test('T-201 c4 @P0 unknown is listed first, after the count sort', async () => {
    // recorded 'climate' answer with one field changed: an `unknown` bucket
    // with a tiny count in documentType and authors
    track((body) => {
      if (body.q !== 'climate') return undefined
      const aggregations = recorded('climate')
      aggregations.documentType.unknown = 3
      aggregations.authors.unknown = 1
      return HttpResponse.json({ aggregations })
    })
    const filters = new Filters()
    await filters.fetchFilters('climate', 'relevance')
    const type = facet(filters, 'documentType').items
    expect(type.slice(0, 3).map((i) => [i.value, i.count])).toEqual([
      ['unknown', 3],
      ['thesis', 132192],
      ['research article', 106060],
    ])
    expect(facet(filters, 'authors').items[0]).toEqual({
      value: 'unknown',
      count: 1,
      checked: false,
    })
    // a facet without unknown is not reordered
    expect(counts(facet(filters, 'publisher').items)).toEqual(
      [...counts(facet(filters, 'publisher').items)].sort((a, b) => b - a)
    )

    // after a merge the missing unknown bucket counts 0 and is still first
    await filters.fetchFilters(THESIS_Q, 'relevance')
    const merged = facet(filters, 'documentType').items
    expect(merged.slice(0, 2).map((i) => [i.value, i.count])).toEqual([
      ['unknown', 0],
      ['thesis', 132192],
    ])
  })

  test('T-201 c5 @P0 E2 answering 500 logs the error and leaves the store empty', async () => {
    track()
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    const filters = new Filters()
    const pending = filters.fetchFilters('__status500', 'relevance')
    expect(filters.isLoading).toBe(true)
    await pending

    expect(error).toHaveBeenCalledTimes(1)
    const [logged] = error.mock.calls[0]
    expect(logged).toBeInstanceOf(Error)
    expect(logged.status).toBe(500)
    expect(logged.message).toBe(`Request for ${AGG_URL} failed on 500`)
    expect(bodies()).toEqual([{ aggregations: ALL, q: '__status500' }])
    expect(filters.isLoading).toBe(false)
    expect(filters.data).toEqual([])
    expect(toJS(filters.initialData)).toEqual({})
  })

  test('T-201 c6 @P0 clear all sends two identical E2 requests (Q-092)', async () => {
    track()
    require('next/router').setRouter({
      query: { q: THESIS_Q, sort: 'relevance', page: '1' },
    })
    const filters = new Filters()
    await filters.fetchFilters(THESIS_Q, 'relevance')
    expect(filters.isVisibleClearButton).toBeTruthy()
    calls.length = 0

    // the button calls reset(query): one push and, from the store itself,
    // one E2 for the first word of q
    filters.reset(THESIS_Q, '/search')
    expect(Router.push).toHaveBeenCalledTimes(1)
    expect(Router.push).toHaveBeenCalledWith({
      pathname: '/search',
      query: { q: 'climate', sort: 'relevance', page: 1 },
    })
    await waitFor(() => expect(filters.isLoading).toBe(false), {
      timeout: 5000,
    })
    expect(calls).toHaveLength(1)

    // the push changes the `query` prop of FiltersBar; its effect runs
    // routeChanged() (the new query does not contain the old one) and fetches
    // again with the same q
    filters.routeChanged()
    await filters.fetchFilters('climate', 'relevance')

    expect(calls).toHaveLength(2)
    expect(calls[1]).toBe(calls[0])
    expect(bodies()[0]).toEqual({ aggregations: ALL, q: 'climate' })
    expect(toJS(filters.initialData)).toEqual(recorded('climate'))
    expect(filters.isLoading).toBe(false)
  })

  test('T-201 c7 @P0 a refined q keeps the stale buckets with count 0 (Q-092)', async () => {
    track()
    const filters = new Filters()
    const first = recorded('climate')
    const refined = recorded('climate change')
    await filters.fetchFilters('climate', 'relevance')
    await filters.fetchFilters('climate change', 'relevance')

    // the two answers are distinct requests with distinct answers
    expect(bodies().map((b) => b.q)).toEqual(['climate', 'climate change'])
    expect(refined).not.toEqual(first)
    // the first answer stays the diff base
    expect(toJS(filters.initialData)).toEqual(first)

    let stale = 0
    for (const name of [
      'fieldsOfStudy',
      'yearPublished',
      'authors',
      'publisher',
    ]) {
      const { items } = facet(filters, name)
      expect(pairs(items)).toEqual(expectedPairs(first[name], refined[name]))
      // buckets of the first q that the refined q does not return
      stale += Object.keys(first[name]).filter(
        (key) => !(key in refined[name])
      ).length
      expect(items.filter((item) => item.count === 0)).toHaveLength(
        Object.keys(first[name]).filter((key) => !(key in refined[name])).length
      )
    }
    expect(stale).toBe(9 + 12 + 41 + 21)
    // the stale buckets sort last
    const fields = counts(facet(filters, 'fieldsOfStudy').items)
    expect(fields.slice(-9)).toEqual(Array(9).fill(0))
  })
})
