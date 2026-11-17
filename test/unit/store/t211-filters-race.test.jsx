// T-211 (41 C, R-073, RG-4 in 55): Q-021, "only Claim.retrieve cancels; the
// last *resolved* aggregation or similar-works response wins". The decorator
// invalidatePreviousRequests aborts the previous controller and appends its
// signal as the last argument, but Filters.fetchFilters and
// SimilarWorks.fetchSimilar never read it, so two overlapping calls both run
// to the end and the answer that arrives last owns the state, whichever call
// was issued last. Claim.retrieve passes the signal to fetch, so there the
// first request is cancelled.
//
// The arrival order is fixed by the stub, not by the clock: every answer of
// the racing requests is held until the test releases it (a fixed delay in the
// stub cannot rule out a reordering on a loaded machine), the answers come
// from the recorded fixtures (E2 scenario search-climate, E8 scenarios
// outputs-2001/2002/2006, E16 scenario e16-claim-form). Each outcome is
// compared with the state a sequential run of the winning call alone produces
// on a fresh store.
const { toJS } = require('mobx')

const { setupMsw } = require('../../utils/msw')
const { waitFor: baseWaitFor } = require('../../utils/render')
const Filters = require('../../../store/filters').default
const SimilarWorks = require('../../../store/similar-works').default
const { driverFor } = require('../../drivers/store-driver')

jest.setTimeout(30000)

const { server, resolver, http } = setupMsw()

// waits are generous: the suites of other packages run on the same machine
const waitFor = (callback, options) =>
  baseWaitFor(callback, { timeout: 8000, ...options })

const AGG_URL = 'https://api.core.ac.uk/v3/search/works/aggregate'
const RECOMMEND_URL = 'https://api.core.ac.uk/v3/recommend'
const E16_URL = 'https://api.core.ac.uk/internal/data-providers'
const CLIMATE = 'climate'
// the two racing queries: both have a recorded six-facet answer
const THESIS_Q = 'climate AND documentType:"thesis"'
const CHANGE_Q = 'climate change'
const SORT = 'relevance'

// a request the fixtures cannot answer is a 502 naming its triple: no test may
// depend on one by accident
let unmatched
beforeEach(() => {
  unmatched = []
  const resolve = resolver.resolve.bind(resolver)
  jest.spyOn(resolver, 'resolve').mockImplementation((...args) => {
    const answerOf = resolve(...args)
    if (answerOf.unmatched) unmatched.push(answerOf.unmatched)
    return answerOf
  })
})

const gate = () => {
  let release
  const promise = new Promise((resolve) => {
    release = resolve
  })
  return { promise, release }
}

// holds the answers of the requests whose key has a gate until it is
// released; `arrivals` lists the keys in the order the stub saw the requests
let gates
let arrivals
let fetchSpy
const hold = (url, keyOf) => {
  server.use(
    http.post(url, async ({ request }) => {
      const key = keyOf(JSON.parse(await request.clone().text()))
      arrivals.push(key)
      if (gates[key]) await gates[key].promise
      // anything but a response falls through to the recorded fixtures
      return undefined
    })
  )
}

beforeEach(() => {
  gates = {}
  arrivals = []
  fetchSpy = jest.spyOn(global, 'fetch')
})
afterEach(() => {
  // a test that failed early must not leave a request held
  Object.values(gates).forEach((g) => g.release())
  jest.restoreAllMocks()
  expect(unmatched).toEqual([])
})

// the init object of the fetch calls to this URL, in call order
const initsOf = (url) =>
  fetchSpy.mock.calls.filter(([u]) => String(u) === url).map(([, init]) => init)

// everything of the Filters store an answer writes
const filtersState = (filters) =>
  toJS({
    data: filters.data,
    initialData: filters.initialData,
    activeFilterSuggestions: filters.activeFilterSuggestions,
    groupedYearDates: filters.groupedYearDates,
    isVisibleClearButton: filters.isVisibleClearButton,
    yearWorksCount: filters.yearWorksCount,
  })

// the state after the first fetch ("climate") and then one more fetch of `q`,
// one after the other
const sequential = async (q) => {
  const filters = new Filters()
  await filters.fetchFilters(CLIMATE, SORT)
  await filters.fetchFilters(q, SORT)
  return filtersState(filters)
}

describe('T-211 @P1 Filters and SimilarWorks race (Q-021)', () => {
  beforeEach(() => hold(AGG_URL, (body) => body.q))

  test('T-211 @P1 Filters: the aggregation answer that arrives last wins, not the call issued last', async () => {
    const expectedA = await sequential(THESIS_Q)
    const expectedB = await sequential(CHANGE_Q)
    // the two outcomes differ, so the comparison below can tell them apart
    expect(expectedA).not.toEqual(expectedB)
    arrivals.length = 0
    fetchSpy.mockClear()

    const filters = new Filters()
    await filters.fetchFilters(CLIMATE, SORT)
    const primed = filtersState(filters)
    arrivals.length = 0

    // A is issued first, B second; both answers are held
    gates[THESIS_Q] = gate()
    gates[CHANGE_Q] = gate()
    const a = filters.fetchFilters(THESIS_Q, SORT)
    const b = filters.fetchFilters(CHANGE_Q, SORT)
    await waitFor(() => expect(arrivals).toEqual([THESIS_Q, CHANGE_Q]))
    expect(filters.isLoading).toBe(true)
    expect(filtersState(filters)).toEqual(primed)

    // B (the later call) answers first: its state is shown, loading is off
    // although A is still in flight
    gates[CHANGE_Q].release()
    await b
    expect(filters.isLoading).toBe(false)
    expect(filtersState(filters)).toEqual(expectedB)

    // A (the earlier call) answers last and overwrites it
    gates[THESIS_Q].release()
    await a
    expect(filters.isLoading).toBe(false)
    expect(filtersState(filters)).toEqual(expectedA)

    // neither call was cancelled: both requests ran to the end with no signal
    const inits = initsOf(AGG_URL)
    expect(inits).toHaveLength(3)
    expect(inits.map((init) => init.signal)).toEqual([
      undefined,
      undefined,
      undefined,
    ])
    expect(inits.map((init) => JSON.parse(init.body).q)).toEqual([
      CLIMATE,
      THESIS_Q,
      CHANGE_Q,
    ])
  })

  test('T-211 @P1 Filters: with the answers released the other way round the call issued last wins', async () => {
    const expectedB = await sequential(CHANGE_Q)

    const filters = new Filters()
    await filters.fetchFilters(CLIMATE, SORT)
    arrivals.length = 0

    gates[THESIS_Q] = gate()
    gates[CHANGE_Q] = gate()
    const a = filters.fetchFilters(THESIS_Q, SORT)
    const b = filters.fetchFilters(CHANGE_Q, SORT)
    await waitFor(() => expect(arrivals).toEqual([THESIS_Q, CHANGE_Q]))

    // A answers first, B last: the result is B's, now the later call
    gates[THESIS_Q].release()
    await a
    expect(filters.isLoading).toBe(false)
    gates[CHANGE_Q].release()
    await b
    expect(filtersState(filters)).toEqual(expectedB)
  })

  test('T-211 @P1 Filters: a failed earlier request that answers last logs its error and keeps the later state', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    const expectedB = await sequential(CHANGE_Q)

    const filters = new Filters()
    await filters.fetchFilters(CLIMATE, SORT)
    arrivals.length = 0

    // the first call fails after the second one has answered
    gates[THESIS_Q] = gate()
    server.use(
      http.post(AGG_URL, async ({ request }) => {
        const { q } = JSON.parse(await request.clone().text())
        if (q !== THESIS_Q) return undefined
        await gates[THESIS_Q].promise
        return new Response('{"message":"upstream failure"}', {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      })
    )
    const a = filters.fetchFilters(THESIS_Q, SORT)
    const b = filters.fetchFilters(CHANGE_Q, SORT)
    await b
    expect(filtersState(filters)).toEqual(expectedB)
    expect(filters.isLoading).toBe(false)

    gates[THESIS_Q].release()
    await a
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0][0].status).toBe(500)
    // the failure changed nothing but the loading flag it clears
    expect(filtersState(filters)).toEqual(expectedB)
    expect(filters.isLoading).toBe(false)
  })

  test('T-211 @P1 SimilarWorks: the recommendation answer that arrives last wins', async () => {
    const outcome = (similar) => toJS(similar.similarOutputs)
    // an output page (3 outputs) and a works page (5 works, resultType work):
    // the recorded answers differ in count and ids. The template calls
    // fetchSimilar(id, params) with `params` false on an output page
    // (`useOtherVersions && {...}`), so the decorator's signal is always the
    // third argument
    const WORK = { resultType: 'work' }
    const alone = async (id, params) => {
      const similar = new SimilarWorks()
      await similar.fetchSimilar(id, params)
      return outcome(similar)
    }
    const expectedA = await alone(2001, false)
    const expectedB = await alone(1001, WORK)
    expect(expectedA).toHaveLength(3)
    expect(expectedB).toHaveLength(5)
    expect(expectedA.map((o) => o.id)).not.toEqual(expectedB.map((o) => o.id))

    arrivals.length = 0
    fetchSpy.mockClear()
    server.resetHandlers()
    hold(RECOMMEND_URL, (body) => body.identifier)
    gates['core:2001'] = gate()
    gates['core:1001'] = gate()

    const similar = new SimilarWorks()
    const a = similar.fetchSimilar(2001, false)
    const b = similar.fetchSimilar(1001, WORK)
    await waitFor(() => expect(arrivals).toEqual(['core:2001', 'core:1001']))
    // the second call reset the first one's state and started its own
    expect(similar.isLoading).toBe(true)
    expect(similar.similarOutputs).toBeNull()

    // 1001 (the later call) answers first
    gates['core:1001'].release()
    await b
    expect(similar.isLoading).toBe(false)
    expect(similar.error).toBe(false)
    expect(outcome(similar)).toEqual(expectedB)

    // 2001 (the earlier call) answers last and replaces it
    gates['core:2001'].release()
    await a
    expect(similar.isLoading).toBe(false)
    expect(outcome(similar)).toEqual(expectedA)

    // no signal went to fetch: nothing was cancelled
    const inits = initsOf(RECOMMEND_URL)
    expect(inits).toHaveLength(2)
    expect(inits.map((init) => init.signal)).toEqual([undefined, undefined])
    expect(inits.map((init) => JSON.parse(init.body))).toEqual([
      { identifier: 'core:2001', limit: 5 },
      { identifier: 'core:1001', limit: 5, resultType: 'work' },
    ])
  })

  test("T-211 @P1 SimilarWorks: an earlier call that fails last sets error next to the later call's outputs", async () => {
    const alone = new SimilarWorks()
    await alone.fetchSimilar(1001, { resultType: 'work' })
    const expectedB = toJS(alone.similarOutputs)
    expect(expectedB).toHaveLength(5)

    arrivals.length = 0
    server.resetHandlers()
    hold(RECOMMEND_URL, (body) => body.identifier)
    // outputs-2006 is the recorded 404 answer of the recommender
    gates['core:2006'] = gate()

    const similar = new SimilarWorks()
    const a = similar.fetchSimilar(2006, false)
    const b = similar.fetchSimilar(1001, { resultType: 'work' })
    await b
    expect(toJS(similar.similarOutputs)).toEqual(expectedB)
    expect(similar.error).toBe(false)

    gates['core:2006'].release()
    await a
    // the stale failure sets the flag; the later outputs stay
    expect(similar.error).toBe(true)
    expect(toJS(similar.similarOutputs)).toEqual(expectedB)
    expect(similar.isLoading).toBe(false)
  })

  test('T-211 @P1 only Claim.retrieve cancels: the first E16 request is aborted by the second call', async () => {
    const first = 'https://created.example.org/'
    const second = 'https://duplicate.example.org/'
    arrivals.length = 0
    server.resetHandlers()
    hold(E16_URL, (body) => body.uri)
    gates[first] = gate()
    gates[second] = gate()

    // through the store driver (T-212): the claim store is ported
    const claim = driverFor('claim').create()
    claim.write('query', first)
    const a = claim.call('retrieve')
    await waitFor(() => expect(arrivals).toEqual([first]))
    claim.write('query', second)
    const b = claim.call('retrieve')
    await waitFor(() => expect(arrivals).toEqual([first, second]))

    // both calls handed a signal to fetch, and the first one was aborted by
    // the second call
    const inits = initsOf(E16_URL)
    expect(inits).toHaveLength(2)
    expect(inits.every((init) => init.signal instanceof AbortSignal)).toBe(true)
    expect(inits[0].signal.aborted).toBe(true)
    expect(inits[1].signal.aborted).toBe(false)

    gates[second].release()
    gates[first].release()
    await Promise.all([a, b])
    // the aborted call ended on its AbortError, which sticks (T-205, Q-091);
    // the second call's 409 answer is `duplicated`
    expect(claim.get('error').name).toBe('AbortError')
    expect(claim.plain(claim.get('duplicated'))).toEqual({
      message: JSON.stringify({
        existingDataProviders: [
          { id: 86, name: 'Open Research Online (Open)' },
        ],
      }),
    })
    expect(claim.get('created')).toBeNull()
    expect(claim.get('isLoading')).toBe(false)
  })
})
