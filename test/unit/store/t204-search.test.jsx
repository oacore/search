// T-204 (41 C, R-019): the Search store, findings/03 §5.1 "Search" and
// findings/06 §7.2 "Search CSV download". Q-043 (data-provider sort inverted)
// and the CSV flow (E3) on the recorded answers of scenario search-csv.
// js-file-download is the harness factory spy (callable: api/search.js reads it
// with require() and calls it).
const { toJS } = require('mobx')
const FileDownload = require('js-file-download')
const nextRouter = require('next/router')

const { setupMsw } = require('../../utils/msw')
const Search = require('../../../store/search').default

const { server, resolver, http } = setupMsw()

const Router = nextRouter.default
const WORKS_URL = 'https://api.core.ac.uk/v3/search/works'

const csvAnswer = (limit) =>
  resolver.resolve(
    'POST',
    WORKS_URL,
    JSON.stringify({ q: 'climate', accept: 'text/csv', limit })
  )

// logs the E3 requests (body text and Content-Type); the answers come from
// the recorded fixtures
let requests
const trackCsv = () => {
  requests = []
  server.use(
    http.post(WORKS_URL, async ({ request }) => {
      requests.push({
        body: await request.clone().text(),
        contentType: request.headers.get('content-type'),
        accept: request.headers.get('accept'),
      })
      return undefined
    })
  )
}

describe('T-204 @P0 Search store', () => {
  beforeEach(() => FileDownload.mockClear())
  afterEach(() => jest.restoreAllMocks())

  test('T-204 @P0 setSortOptions marks the chosen option, setActiveSortOption pushes it', () => {
    const search = new Search()
    expect(toJS(search.sortOptions)).toEqual([])
    search.setSortOptions('recent')
    expect(toJS(search.sortOptions)).toEqual([
      { value: 'recent', checked: true },
      { value: 'relevance', checked: false },
    ])
    search.setSortOptions('relevance')
    expect(toJS(search.sortOptions)).toEqual([
      { value: 'recent', checked: false },
      { value: 'relevance', checked: true },
    ])
    search.setSortOptions(undefined)
    expect(toJS(search.sortOptions)).toEqual([
      { value: 'recent', checked: false },
      { value: 'relevance', checked: false },
    ])
    // the options are copies: another store is not affected
    const other = new Search()
    other.setSortOptions('recent')
    expect(search.sortOptions.some((o) => o.checked)).toBe(false)

    nextRouter.setRouter({
      query: { q: 'climate', sort: 'relevance', page: '4' },
    })
    search.setActiveSortOption({ value: 'recent' })
    expect(Router.push).toHaveBeenCalledTimes(1)
    expect(Router.push).toHaveBeenCalledWith({
      pathname: '/search',
      query: { q: 'climate', sort: 'recent', page: 1 },
    })
    expect(toJS(search.sortOptions)).toEqual([
      { value: 'recent', checked: true },
      { value: 'relevance', checked: false },
    ])
  })

  test('T-204 @P0 Q-043 data-provider sort: both options push relevance, id is deleted, offset kept', () => {
    const search = new Search()
    const makeQuery = () => ({
      id: '5',
      q: 'climate',
      offset: '20',
      sort: 'recency',
    })
    const query = makeQuery()

    nextRouter.setRouter({ query })
    search.setActiveSortOptionData({ value: 'recent' }, '/data-providers/5')
    // "recent" pushes sort=relevance
    expect(Router.push).toHaveBeenLastCalledWith({
      pathname: '/data-providers/5',
      query: { q: 'climate', offset: '20', sort: 'relevance', page: 1 },
    })
    // the router's own query object loses `id`
    expect('id' in Router.query).toBe(false)
    expect(Router.query).toBe(query)
    // the option shown as checked is the one that was clicked
    expect(toJS(search.sortOptions)).toEqual([
      { value: 'recent', checked: true },
      { value: 'relevance', checked: false },
    ])

    nextRouter.setRouter({ query: makeQuery() })
    search.setActiveSortOptionData({ value: 'relevance' }, '/data-providers/5')
    expect(Router.push).toHaveBeenLastCalledWith({
      pathname: '/data-providers/5',
      query: { q: 'climate', offset: '20', sort: 'relevance', page: 1 },
    })
    expect(toJS(search.sortOptions)).toEqual([
      { value: 'recent', checked: false },
      { value: 'relevance', checked: true },
    ])

    // any other pathname keeps `id` and still maps "recent" to relevance
    nextRouter.setRouter({ query: makeQuery() })
    search.setActiveSortOptionData({ value: 'recent' }, '/search')
    expect(Router.push).toHaveBeenLastCalledWith({
      pathname: '/search',
      query: {
        id: '5',
        q: 'climate',
        offset: '20',
        sort: 'relevance',
        page: 1,
      },
    })
    // and an undefined pathname does not throw
    search.setActiveSortOptionData({ value: 'recent' }, undefined)
    expect(Router.push).toHaveBeenLastCalledWith({
      pathname: undefined,
      query: {
        id: '5',
        q: 'climate',
        offset: '20',
        sort: 'relevance',
        page: 1,
      },
    })
    expect(Router.push).toHaveBeenCalledTimes(4)
  })

  test('T-204 @P0 CSV download: body {q, accept, limit}, results.csv, modal closes, loading ends', async () => {
    trackCsv()
    const search = new Search()
    search.setQuery('climate')
    search.setActiveDownloadModal(true)
    expect(search.activeLimit).toBe(10)

    const pending = search.downloadResults()
    expect(search.isLoading).toBe(true)
    await pending

    expect(requests).toEqual([
      {
        body: '{"q":"climate","accept":"text/csv","limit":10}',
        contentType: 'application/json',
        accept: 'application/json',
      },
    ])
    expect(FileDownload).toHaveBeenCalledTimes(1)
    const [blob, name] = FileDownload.mock.calls[0]
    expect(name).toBe('results.csv')
    expect(blob).toBeInstanceOf(Blob)
    expect(await blob.text()).toBe(csvAnswer(10).body.toString('utf8'))
    expect(search.isLoading).toBe(false)
    expect(search.activeDownloadModal).toBe(false)

    // the limit chosen in the modal goes into the body
    search.setActiveDownloadModal(true)
    search.setActiveLimit(100)
    await search.downloadResults()
    expect(requests[1].body).toBe(
      '{"q":"climate","accept":"text/csv","limit":100}'
    )
    expect(FileDownload).toHaveBeenCalledTimes(2)
    expect(search.activeDownloadModal).toBe(false)
  })

  test('T-204 @P0 CSV download error: console.error, loading ends, modal stays open', async () => {
    trackCsv()
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    const search = new Search()
    // reset() sets the limit to 1000, which the API refuses (400)
    search.reset()
    expect(search.activeLimit).toBe(1000)
    expect(search.query).toBeNull()
    expect(toJS(search.works)).toEqual([])
    search.setQuery('climate')
    search.setActiveDownloadModal(true)

    await search.downloadResults()

    expect(requests.map((r) => r.body)).toEqual([
      '{"q":"climate","accept":"text/csv","limit":1000}',
    ])
    expect(error).toHaveBeenCalledTimes(1)
    const [logged] = error.mock.calls[0]
    expect(logged).toBeInstanceOf(Error)
    expect(logged.status).toBe(400)
    expect(FileDownload).not.toHaveBeenCalled()
    expect(search.isLoading).toBe(false)
    expect(search.activeDownloadModal).toBe(true)
  })
})
