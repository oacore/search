// T-212 search cases: the Search rows of T-203 and T-204 through the driver.
// Actions (setSortOptions, setWorks, setQuery, reset, setActiveSortOption,
// downloadResults' synchronous part) notify once; setActiveLimit,
// setActiveDownloadModal and setActiveSortOptionData are not actions, so
// each write notifies on its own. An assigned array or object is copied
// (MobX made it observable), so the stored sortOptions never alias the
// module-level options that setSortOptions mutates (Q-043).
const Router = require('next/router').default

const WORKS_URL = 'https://api.core.ac.uk/v3/search/works'

const INITIAL = {
  works: [],
  query: null,
  isLoading: false,
  dataProviders: [],
  sortOptions: [],
  activeLimit: 10,
  activeDownloadModal: false,
}

module.exports = ({ driver, server, http, HttpResponse }) => {
  let bodies
  beforeEach(() => {
    bodies = []
    server.use(
      http.post(WORKS_URL, async ({ request }) => {
        const body = JSON.parse(await request.text())
        bodies.push(body)
        if (body.q === 'fail')
          return HttpResponse.json({ message: 'no' }, { status: 500 })
        return new HttpResponse('id,title\n1,A\n', {
          headers: { 'Content-Type': 'text/csv' },
        })
      })
    )
  })

  const all = (t) => driver.spec.reactive.map((f) => t.get(f))
  const at = (field) => driver.spec.reactive.indexOf(field)

  test('T-212 search c1 @P1 initial state; setSortOptions copies the options, one notification per call', () => {
    const search = driver.create()
    expect(search.snapshot()).toEqual(INITIAL)
    const probe = search.observe(all)
    search.call('setSortOptions', 'recent')
    const first = search.get('sortOptions')
    search.call('setSortOptions', 'relevance')
    expect(probe.values).toHaveLength(3)
    // the first array was copied: the second call did not change it
    expect(search.plain(first)).toEqual([
      { value: 'recent', checked: true },
      { value: 'relevance', checked: false },
    ])
    expect(search.plain(search.get('sortOptions'))).toEqual([
      { value: 'recent', checked: false },
      { value: 'relevance', checked: true },
    ])
    expect(search.get('sortOptions')).not.toBe(first)
    probe.dispose()
  })

  test('T-212 search c2 @P1 setWorks, setQuery and reset notify once each; works is a copy', () => {
    const search = driver.create()
    const probe = search.observe(all)
    const works = [{ id: 1, title: 'A' }]
    search.call('setWorks', works)
    search.call('setQuery', 'climate')
    expect(search.get('works')).not.toBe(works)
    expect(search.get('works')[0]).not.toBe(works[0])
    expect(search.plain(search.get('works'))).toEqual(works)
    search.call('reset')
    expect(probe.values).toHaveLength(4)
    expect(search.snapshot()).toEqual({ ...INITIAL, activeLimit: 1000 })
    probe.dispose()
  })

  test('T-212 search c3 @P1 setActiveLimit and setActiveDownloadModal are not actions: one notification per write', () => {
    const search = driver.create()
    const probe = search.observe(all)
    search.call('setActiveLimit', 100)
    search.call('setActiveDownloadModal', true)
    search.call('setActiveDownloadModal')
    expect(probe.values).toHaveLength(4)
    expect(
      probe.values.map((v) => [
        v[at('activeLimit')],
        v[at('activeDownloadModal')],
      ])
    ).toEqual([
      [10, false],
      [100, false],
      [100, true],
      [100, undefined],
    ])
    probe.dispose()
  })

  test('T-212 search c4 @P1 downloadResults: loading on, modal closed, loading off; the body takes query and limit', async () => {
    const search = driver.create()
    search.call('setQuery', 'climate')
    search.call('setActiveLimit', 100)
    search.call('setActiveDownloadModal', true)
    const probe = search.observe(all)
    const pending = search.call('downloadResults')
    expect(search.get('isLoading')).toBe(true)
    await pending
    expect(bodies).toEqual([{ q: 'climate', accept: 'text/csv', limit: 100 }])
    expect(
      probe.values.map((v) => [
        v[at('isLoading')],
        v[at('activeDownloadModal')],
      ])
    ).toEqual([
      [false, true],
      [true, true],
      [true, false],
      [false, false],
    ])
    probe.dispose()
  })

  test('T-212 search c5 @P1 a failed download logs the error, keeps the modal and turns loading off', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    const search = driver.create()
    search.call('setQuery', 'fail')
    search.call('setActiveDownloadModal', true)
    const probe = search.observe(all)
    await search.call('downloadResults')
    expect(error).toHaveBeenCalledTimes(1)
    expect(
      probe.values.map((v) => [
        v[at('isLoading')],
        v[at('activeDownloadModal')],
      ])
    ).toEqual([
      [false, true],
      [true, true],
      [false, true],
    ])
    probe.dispose()
  })

  test('T-212 search c6 @P1 setActiveSortOption and setActiveSortOptionData push the route; the data-provider sort is inverted (Q-043)', () => {
    const push = jest.spyOn(Router, 'push')
    Router.query = { q: 'climate', id: '86', page: '3' }
    const search = driver.create()
    const probe = search.observe(all)
    search.call('setActiveSortOption', { value: 'recent' })
    search.call(
      'setActiveSortOptionData',
      { value: 'recent' },
      '/data-providers/86'
    )
    expect(push.mock.calls).toEqual([
      [
        {
          pathname: '/search',
          query: { q: 'climate', id: '86', page: 1, sort: 'recent' },
        },
      ],
      [
        {
          pathname: '/data-providers/86',
          query: { q: 'climate', page: 1, sort: 'relevance' },
        },
      ],
    ])
    expect(Router.query).toEqual({ q: 'climate', page: '3' })
    expect(probe.values).toHaveLength(3)
    probe.dispose()
  })
}
