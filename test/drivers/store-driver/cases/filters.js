// T-212 filters cases: the Filters rows of T-203 and the store parts of
// T-201, T-202 and T-211 through the driver. Every Filters method is an
// action: its synchronous writes notify once (fetchFilters' part before the
// await too); after the await each action called notifies on its own.
// Assigned arrays and objects are copied unless they are already the
// store's own, so activeFilterSuggestions aliases data[i].items (R-030) and
// in-place `checked` writes reach both. reset() fetches with the signal in
// the sortType slot (Q-020).
const Router = require('next/router').default

const AGG_URL = 'https://api.core.ac.uk/v3/search/works/aggregate'

const aggregations = {
  fieldsOfStudy: { Physics: 30, Biology: 20 },
  yearPublished: { 2019: 4, 2015: 6, 2021: 2 },
  documentType: { thesis: 7, research: 9 },
  authors: { 'Doe, J': 3 },
  language: { en: 11, fr: 1 },
  publisher: { "'Elsevier'": 5 },
}

const INITIAL = {
  data: [],
  initialData: {},
  activeFilter: {},
  activeFilterSuggestions: [],
  aggregationsNames: [
    'fieldsOfStudy',
    'yearPublished',
    'documentType',
    'authors',
    'language',
    'publisher',
  ],
  groupedYearDates: [],
  isLoading: false,
  yearWorksCount: null,
  isVisibleClearButton: false,
}

module.exports = ({ driver, server, http, HttpResponse }) => {
  let bodies
  beforeEach(() => {
    bodies = []
    server.use(
      http.post(AGG_URL, async ({ request }) => {
        const body = JSON.parse(await request.text())
        bodies.push(body)
        if (body.q === 'fail')
          return HttpResponse.json({ message: 'no' }, { status: 500 })
        return HttpResponse.json({ aggregations })
      })
    )
  })

  const all = (t) => driver.spec.reactive.map((f) => t.get(f))
  const at = (field) => driver.spec.reactive.indexOf(field)
  const facet = (h, value) => h.get('data').find((f) => f.value === value)

  test('T-212 filters c1 @P1 initial state; the first fetch: loading on, initial data, data, clear button, loading off', async () => {
    const filters = driver.create()
    // the computeds throw without a year facet: reactive fields only
    expect(
      Object.fromEntries(
        driver.spec.reactive.map((f) => [f, filters.plain(filters.get(f))])
      )
    ).toEqual(INITIAL)
    const probe = filters.observe(all)
    const pending = filters.call('fetchFilters', 'climate', 'relevance')
    expect(probe.values).toHaveLength(2)
    await pending
    expect(bodies).toEqual([
      { aggregations: INITIAL.aggregationsNames, q: 'climate' },
    ])
    expect(filters.plain(filters.get('initialData'))).toEqual(aggregations)
    expect(filters.get('initialData')).not.toBe(aggregations)
    expect(filters.get('data').map((f) => [f.value, f.label])).toEqual([
      ['fieldsOfStudy', 'field'],
      ['yearPublished', 'year'],
      ['documentType', 'type'],
      ['authors', 'author'],
      ['language', 'language'],
      ['publisher', 'publisher'],
    ])
    expect(filters.plain(facet(filters, 'yearPublished').items)).toEqual([
      { value: 2015, count: 6, checked: false },
      { value: 2019, count: 4, checked: false },
      { value: 2021, count: 2, checked: false },
    ])
    expect(filters.plain(filters.get('groupedYearDates'))).toEqual([
      { yearFrom: 2018, count: 6, checked: false },
      { yearFrom: 2016, count: 6, checked: false },
      { yearFrom: 2014, count: 12, checked: false },
    ])
    expect(filters.get('isVisibleClearButton')).toBeUndefined()
    expect(filters.get('isLoading')).toBe(false)
    expect(probe.values.map((v) => v[at('isLoading')])).toEqual([
      false,
      true,
      true,
      true,
      true,
      false,
    ])
    probe.dispose()
  })

  test('T-212 filters c2 @P1 a second fetch diffs against the initial data and keeps the active suggestions in step', async () => {
    const filters = driver.create()
    await filters.call('fetchFilters', 'climate', 'relevance')
    const type = facet(filters, 'documentType')
    filters.call('setActiveFilter', type)
    filters.call('setActiveFilterSuggestions', type.items)
    expect(filters.get('activeFilter')).toBe(type)
    // R-030: the suggestions are the facet's own items array
    expect(filters.get('activeFilterSuggestions')).toBe(type.items)
    const probe = filters.observe(all)
    await filters.call(
      'fetchFilters',
      'climate AND documentType:"thesis"',
      'relevance'
    )
    expect(bodies[1]).toEqual({
      aggregations: INITIAL.aggregationsNames,
      q: 'climate AND documentType:"thesis"',
    })
    const next = facet(filters, 'documentType')
    expect(next).not.toBe(type)
    expect(filters.plain(next.items)).toEqual([
      { value: 'research', count: 9, checked: false },
      { value: 'thesis', count: 7, checked: true },
    ])
    // after a refetch the suggestions are a copy of the transform's items,
    // not the facet's (checkYearPublishedStatis passes its local array)
    const suggestions = filters.get('activeFilterSuggestions')
    expect(suggestions).not.toBe(next.items)
    expect(suggestions[0]).not.toBe(next.items[1])
    expect(filters.plain(suggestions)).toEqual([
      { value: 'thesis', count: 7, checked: true },
      { value: 'research', count: 9, checked: false },
    ])
    expect(filters.get('isVisibleClearButton')).toBe(next)
    // loading on, data, clear button, loading off
    expect(probe.values).toHaveLength(5)
    probe.dispose()
  })

  test('T-212 filters c3 @P1 toggleCheckboxFilter writes checked in place (data sees it), pushes the clause, one notification', async () => {
    const push = jest.spyOn(Router, 'push')
    Router.query = { q: 'climate', page: '2' }
    const filters = driver.create()
    await filters.call('fetchFilters', 'climate', 'relevance')
    const lang = facet(filters, 'language')
    filters.call('setActiveFilter', lang)
    filters.call('setActiveFilterSuggestions', lang.items)
    const probe = filters.observe(all)
    const fr = lang.items.find((i) => i.code === 'fr')
    filters.call('toggleCheckboxFilter', fr, '/search')
    expect(fr.checked).toBe(true)
    expect(facet(filters, 'language').items[0]).toBe(fr)
    expect(filters.get('isVisibleClearButton')).toBe(true)
    expect(filters.get('isLoading')).toBe(true)
    expect(push.mock.calls).toEqual([
      [
        {
          pathname: '/search',
          query: { q: 'climate AND language:"fr"', page: 1 },
        },
      ],
    ])
    expect(probe.values).toHaveLength(2)
    probe.dispose()
  })

  test('T-212 filters c4 @P1 setActiveYearDate checks the range, sets the count and pushes the year clause', async () => {
    const push = jest.spyOn(Router, 'push')
    Router.query = { q: 'climate' }
    const filters = driver.create()
    await filters.call('fetchFilters', 'climate', 'relevance')
    const year = facet(filters, 'yearPublished')
    filters.call('setActiveFilter', year)
    filters.call('setActiveFilterSuggestions', year.items)
    const probe = filters.observe(all)
    filters.call('setActiveYearDate', [2015, 2019], '/search')
    expect(
      filters
        .plain(filters.get('activeFilterSuggestions'))
        .map((i) => [i.value, i.checked])
    ).toEqual([
      [2015, true],
      [2019, true],
      [2021, false],
    ])
    expect(filters.get('activeFilterSuggestions')).not.toBe(year.items)
    expect(filters.get('activeFilterSuggestions')[0]).toBe(year.items[0])
    expect(filters.get('yearWorksCount')).toBe(10)
    expect(push.mock.calls[0][0].query.q).toBe(
      'climate AND (yearPublished>=2015 AND yearPublished<=2019)'
    )
    expect(filters.get('isVisibleClearButton')).toBe(true)
    // the action, then setIsVisibleClearButton after the push is still in it
    expect(probe.values).toHaveLength(2)
    probe.dispose()
  })

  test('T-212 filters c5 @P1 reset clears, pushes the first word and fetches it with the signal as sortType (Q-020), one notification', async () => {
    const push = jest.spyOn(Router, 'push')
    Router.query = { q: 'climate AND language:"fr"', page: '4' }
    const filters = driver.create()
    await filters.call('fetchFilters', 'climate AND language:"fr"', 'relevance')
    const probe = filters.observe(all)
    filters.call('reset', 'climate AND language:"fr"', '/search')
    expect(probe.values).toHaveLength(2)
    expect(probe.values[1][at('isLoading')]).toBe(true)
    expect(probe.values[1][at('initialData')]).toEqual({})
    expect(push.mock.calls).toEqual([
      [{ pathname: '/search', query: { q: 'climate', page: 1 } }],
    ])
    await new Promise((resolve) => {
      setTimeout(resolve, 50)
    })
    expect(bodies[1]).toEqual({
      aggregations: INITIAL.aggregationsNames,
      q: 'climate',
    })
    expect(filters.get('isLoading')).toBe(false)
    probe.dispose()
  })

  test('T-212 filters c6 @P1 routeChanged clears the active filter, the initial data and the year count in one notification; maxYear and the name lists', async () => {
    const filters = driver.create()
    await filters.call('fetchFilters', 'climate', 'relevance')
    filters.write('yearWorksCount', 5)
    const probe = filters.observe(all)
    filters.call('routeChanged')
    expect(probe.values).toHaveLength(2)
    expect(filters.get('initialData')).toEqual({})
    expect(filters.get('yearWorksCount')).toBeNull()
    expect(filters.get('maxYear')).toBe(2021)
    expect(filters.get('filterNamesWithoutYear')).toEqual([
      'fieldsOfStudy',
      'documentType',
      'authors',
      'language',
      'publisher',
    ])
    probe.dispose()
  })
}
