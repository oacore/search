// T-212 claim cases: T-205 (findings/06 §5.1, E16 on the hand answers of
// scenario e16-claim-form) and the claim rows of T-203. Pinned as they are:
// the POST body is the raw JSON string sent as text/plain (Q-019); an aborted
// call's AbortError sticks (Q-091); `duplicated` is not reactive, so a 409
// reaches an observer only through the `isLoading` flip.
const E16_URL = 'https://api.core.ac.uk/internal/data-providers'
const CREATED = 'https://created.example.org/'
const DUPLICATE = 'https://duplicate.example.org/'
const DUPLICATE_TEXT = 'https://duplicate-text.example.org/'
const BROKEN = 'https://broken.example.org/'
const CREATED_BODY = {
  id: 990001,
  name: 'Example Repository',
  email: '',
  uri: CREATED,
}
const DUPLICATE_MESSAGE =
  '{"existingDataProviders":[{"id":86,"name":"Open Research Online (Open)"}]}'

const abortError = (error) => [error.name, error.message]

module.exports = ({ driver, server, http }) => {
  // logs the E16 requests; the answers come from the hand fixtures
  let requests
  beforeEach(() => {
    requests = []
    server.use(
      http.post(E16_URL, async ({ request }) => {
        requests.push({
          body: await request.clone().text(),
          contentType: request.headers.get('content-type'),
          accept: request.headers.get('accept'),
        })
        return undefined
      })
    )
  })

  test('T-205 c1 @P0 retrieve: 201 sets created, 409 sets duplicated, anything else sets error', async () => {
    const claim = driver.create()
    expect(claim.snapshot()).toEqual({
      query: '',
      request: null,
      created: null,
      duplicated: null,
      error: null,
      isLoading: false,
    })

    // 201: created is the answer body; retrieve() starts with reset() (the
    // query stays) and sets isLoading before the request
    claim.write('query', CREATED)
    claim.write('duplicated', { stale: true })
    claim.write('error', new Error('stale'))
    const pending = claim.call('retrieve')
    expect(claim.get('isLoading')).toBe(true)
    expect(claim.get('duplicated')).toBeNull()
    expect(claim.get('error')).toBeNull()
    expect(claim.get('query')).toBe(CREATED)
    await pending
    expect(claim.plain(claim.get('created'))).toEqual(CREATED_BODY)
    expect(claim.get('error')).toBeNull()
    expect(claim.get('duplicated')).toBeNull()
    expect(claim.get('isLoading')).toBe(false)

    // 409: the error's body (parsed JSON) is `duplicated`, not an error
    claim.write('query', DUPLICATE)
    await claim.call('retrieve')
    expect(claim.get('created')).toBeNull()
    expect(claim.get('error')).toBeNull()
    expect(claim.get('duplicated')).toEqual({ message: DUPLICATE_MESSAGE })
    expect(claim.get('isLoading')).toBe(false)

    claim.write('query', DUPLICATE_TEXT)
    await claim.call('retrieve')
    expect(claim.get('duplicated')).toEqual({
      message: 'Data provider already exists',
    })
    expect(claim.get('error')).toBeNull()

    // 500: the thrown error object is `error`
    claim.write('query', BROKEN)
    await claim.call('retrieve')
    expect(claim.get('duplicated')).toBeNull()
    expect(claim.get('created')).toBeNull()
    const error = claim.get('error')
    expect(error).toBeInstanceOf(Error)
    expect(error.status).toBe(500)
    expect(error.message).toBe(`Request for ${E16_URL} failed on 500`)
    expect(error.data).toEqual({ message: 'Internal Server Error' })
    expect(claim.get('isLoading')).toBe(false)

    expect(requests.map((r) => JSON.parse(r.body).uri)).toEqual([
      CREATED,
      DUPLICATE,
      DUPLICATE_TEXT,
      BROKEN,
    ])

    // reset() keeps the query, reset({ query: true }) clears it
    claim.call('reset')
    expect(claim.get('query')).toBe(BROKEN)
    expect(claim.get('error')).toBeNull()
    claim.call('reset', { query: true })
    expect(claim.get('query')).toBe('')
    // reset(null) throws (the default only replaces undefined)
    expect(() => claim.call('reset', null)).toThrow(TypeError)
  })

  test('T-205 c2 @P0 the body is the raw JSON string sent as text/plain (Q-019)', async () => {
    const claim = driver.create()
    claim.write('query', CREATED)
    await claim.call('retrieve')

    expect(requests).toEqual([
      {
        body: `{"uri":"${CREATED}"}`,
        contentType: 'text/plain;charset=UTF-8',
        accept: 'application/json',
      },
    ])
  })

  test('T-205 c2 @P0 overlapping retrieve ends on the AbortError, created set, isLoading false (Q-091)', async () => {
    const claim = driver.create()
    claim.write('query', DUPLICATE)
    const first = claim.call('retrieve')
    claim.write('query', CREATED)
    const second = claim.call('retrieve')
    expect(claim.get('isLoading')).toBe(true)

    // the second call aborted the first request; its rejection lands after
    // the second call's reset() and its `finally` ends the loading state
    // while the second request is still in flight
    await first
    expect(abortError(claim.get('error'))).toEqual([
      'AbortError',
      'This operation was aborted',
    ])
    expect(claim.get('error').status).toBeUndefined()
    expect(claim.get('duplicated')).toBeNull()
    expect(claim.get('created')).toBeNull()
    expect(claim.get('isLoading')).toBe(false)

    await second
    expect(claim.plain(claim.get('created'))).toEqual(CREATED_BODY)
    // the stale AbortError stays: error wins over created in the form message
    expect(abortError(claim.get('error'))).toEqual([
      'AbortError',
      'This operation was aborted',
    ])
    expect(claim.get('isLoading')).toBe(false)
    expect(requests.map((r) => JSON.parse(r.body).uri)).toEqual([
      DUPLICATE,
      CREATED,
    ])
  })

  test('T-205 c2 @P0 the abort controller is shared by every claim store (module scope, as the decorator closure)', async () => {
    const a = driver.create()
    const b = driver.create()
    a.write('query', DUPLICATE)
    b.write('query', CREATED)
    const first = a.call('retrieve')
    const second = b.call('retrieve')
    await first
    expect(abortError(a.get('error'))).toEqual([
      'AbortError',
      'This operation was aborted',
    ])
    await second
    expect(b.plain(b.get('created'))).toEqual(CREATED_BODY)
    expect(b.get('error')).toBeNull()
  })

  test('T-205 c3 @P0 a 409 reaches an observer only through the isLoading flip', async () => {
    const claim = driver.create()
    claim.write('query', DUPLICATE)

    const withLoading = claim.observe((t) => [
      t.get('isLoading'),
      t.get('duplicated') && t.get('duplicated').message,
    ])
    const duplicatedOnly = claim.observe((t) => t.get('duplicated'))
    await claim.call('retrieve')

    // `duplicated` is a plain field: assigning it notifies nobody
    expect(duplicatedOnly.values).toEqual([null])
    // the observer that reads isLoading re-runs when it goes false and finds
    // the duplicate in place
    expect(withLoading.values).toEqual([
      [false, null],
      [true, null],
      [false, DUPLICATE_MESSAGE],
    ])
    withLoading.dispose()
    duplicatedOnly.dispose()

    // `created` is reactive: its own write notifies
    const created = claim.observe((t) => t.get('created'))
    claim.write('query', CREATED)
    await claim.call('retrieve')
    expect(created.values).toHaveLength(2)
    expect(claim.plain(created.values[1])).toEqual(CREATED_BODY)
    created.dispose()
  })

  test('T-203 c2 @P0 claim: a reactive field notifies once per write, a plain one never', () => {
    const claim = driver.create()
    for (const field of driver.spec.reactive) {
      const probe = claim.observe((t) => t.get(field))
      const next = `${claim.get(field)}!`
      claim.write(field, next)
      expect([field, probe.values.length]).toEqual([field, 2])
      // the same value again is not a change
      claim.write(field, next)
      expect([field, probe.values.length]).toEqual([field, 2])
      probe.dispose()
    }
    const probe = claim.observe((t) => t.get('duplicated'))
    claim.write('duplicated', { message: '{}' })
    expect(probe.values).toHaveLength(1)
    expect(claim.get('duplicated')).toEqual({ message: '{}' })
    probe.dispose()
  })

  test('T-203 c2 @P0 claim: reset is one notification; without arguments it keeps the query', () => {
    const claim = driver.create()
    claim.write('query', 'q')
    claim.write('request', {})
    claim.write('created', {})
    claim.write('error', new Error('x'))
    claim.write('isLoading', true)
    const probe = claim.observe((t) =>
      ['query', 'request', 'created', 'error', 'isLoading'].map((f) => t.get(f))
    )
    claim.call('reset')
    expect(probe.values).toHaveLength(2)
    // isLoading is not reset
    expect(probe.values[1]).toEqual(['q', null, null, null, true])
    claim.call('reset', { query: true })
    expect(probe.values).toHaveLength(3)
    expect(probe.values[2]).toEqual(['', null, null, null, true])
    probe.dispose()
  })

  test('T-203 c2 @P0 claim: the synchronous part of retrieve is one notification', async () => {
    const claim = driver.create()
    claim.write('query', CREATED)
    claim.write('created', { id: 1 })
    const probe = claim.observe((t) => [t.get('created'), t.get('isLoading')])
    const pending = claim.call('retrieve')
    // reset() and isLoading=true land together
    expect(probe.values).toHaveLength(2)
    expect(probe.values[1]).toEqual([null, true])
    await pending
    // created, then isLoading false: one notification each
    expect(probe.values).toHaveLength(4)
    expect(claim.plain(probe.values[2])).toEqual([CREATED_BODY, true])
    expect(claim.plain(probe.values[3])).toEqual([CREATED_BODY, false])
    probe.dispose()
  })
}
