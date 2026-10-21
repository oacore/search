// T-205 (41 C, R-028, R-030): the Claim store, findings/06 §5.1 ("Add a data
// provider", E16) on the hand-written answers of scenario e16-claim-form.
// Pinned as they are: the POST body is the raw JSON string, sent as
// text/plain (Q-019); an aborted call's AbortError sticks (Q-091);
// `duplicated` is not observable, so a 409 reaches an observer only through
// the `isLoading` flip.
const { autorun, toJS } = require('mobx')

const { setupMsw } = require('../../utils/msw')
const Claim = require('../../../store/claim').default

const { server, http } = setupMsw()

const E16_URL = 'https://api.core.ac.uk/internal/data-providers'
const CREATED = 'https://created.example.org/'
const DUPLICATE = 'https://duplicate.example.org/'
const DUPLICATE_TEXT = 'https://duplicate-text.example.org/'
const BROKEN = 'https://broken.example.org/'

const MOBX_STRICT =
  /^\[MobX\] Since strict-mode is enabled, changing \(observed\) observable values without using an action is not allowed\. Tried to modify: Claim@\d+\.isLoading$/

// logs the E16 requests; the answers come from the hand fixtures
let requests
const track = () => {
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
}

const abortError = (error) => [error.name, error.message]

describe('T-205 @P0 Claim store', () => {
  beforeEach(track)
  afterEach(() => jest.restoreAllMocks())

  test('T-205 c1 @P0 retrieve: 201 sets created, 409 sets duplicated, anything else sets error', async () => {
    const claim = new Claim()
    expect(toJS(claim)).toEqual({
      query: '',
      request: null,
      created: null,
      duplicated: null,
      error: null,
      isLoading: false,
    })

    // 201: created is the answer body; retrieve() starts with reset() (the
    // query stays) and sets isLoading before the request
    claim.query = CREATED
    claim.duplicated = { stale: true }
    claim.error = new Error('stale')
    const pending = claim.retrieve()
    expect(claim.isLoading).toBe(true)
    expect(claim.duplicated).toBeNull()
    expect(claim.error).toBeNull()
    expect(claim.query).toBe(CREATED)
    await pending
    expect(toJS(claim.created)).toEqual({
      id: 990001,
      name: 'Example Repository',
      email: '',
      uri: CREATED,
    })
    expect(claim.error).toBeNull()
    expect(claim.duplicated).toBeNull()
    expect(claim.isLoading).toBe(false)

    // 409: the error's body (parsed JSON) is `duplicated`, not an error
    claim.query = DUPLICATE
    await claim.retrieve()
    expect(claim.created).toBeNull()
    expect(claim.error).toBeNull()
    expect(claim.duplicated).toEqual({
      message:
        '{"existingDataProviders":[{"id":86,"name":"Open Research Online (Open)"}]}',
    })
    expect(claim.isLoading).toBe(false)

    claim.query = DUPLICATE_TEXT
    await claim.retrieve()
    expect(claim.duplicated).toEqual({
      message: 'Data provider already exists',
    })
    expect(claim.error).toBeNull()

    // 500: the thrown error object is `error`
    claim.query = BROKEN
    await claim.retrieve()
    expect(claim.duplicated).toBeNull()
    expect(claim.created).toBeNull()
    expect(claim.error).toBeInstanceOf(Error)
    expect(claim.error.status).toBe(500)
    expect(claim.error.message).toBe(`Request for ${E16_URL} failed on 500`)
    expect(claim.error.data).toEqual({ message: 'Internal Server Error' })
    expect(claim.isLoading).toBe(false)

    expect(requests.map((r) => JSON.parse(r.body).uri)).toEqual([
      CREATED,
      DUPLICATE,
      DUPLICATE_TEXT,
      BROKEN,
    ])

    // reset() keeps the query, reset({ query: true }) clears it
    claim.reset()
    expect(claim.query).toBe(BROKEN)
    expect(claim.error).toBeNull()
    claim.reset({ query: true })
    expect(claim.query).toBe('')
  })

  test('T-205 c2 @P0 the body is the raw JSON string sent as text/plain (Q-019)', async () => {
    const claim = new Claim()
    claim.query = CREATED
    await claim.retrieve()

    expect(requests).toEqual([
      {
        body: `{"uri":"${CREATED}"}`,
        contentType: 'text/plain;charset=UTF-8',
        accept: 'application/json',
      },
    ])
  })

  test('T-205 c2 @P0 overlapping retrieve ends on the AbortError, created set, isLoading false (Q-091)', async () => {
    const claim = new Claim()
    claim.query = DUPLICATE
    const first = claim.retrieve()
    claim.query = CREATED
    const second = claim.retrieve()
    expect(claim.isLoading).toBe(true)

    // the second call aborted the first request; its rejection lands after
    // the second call's reset() and its `finally` ends the loading state
    // while the second request is still in flight
    await first
    expect(abortError(claim.error)).toEqual([
      'AbortError',
      'This operation was aborted',
    ])
    expect(claim.error.status).toBeUndefined()
    expect(claim.duplicated).toBeNull()
    expect(claim.created).toBeNull()
    expect(claim.isLoading).toBe(false)

    await second
    expect(toJS(claim.created)).toEqual({
      id: 990001,
      name: 'Example Repository',
      email: '',
      uri: CREATED,
    })
    // the stale AbortError stays: error wins over created in the form message
    expect(abortError(claim.error)).toEqual([
      'AbortError',
      'This operation was aborted',
    ])
    expect(claim.isLoading).toBe(false)
  })

  test('T-205 c3 @P0 a 409 reaches an observer only through the isLoading flip', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const claim = new Claim()
    claim.query = DUPLICATE

    const withLoading = []
    const duplicatedOnly = []
    const stop = [
      autorun(() =>
        withLoading.push([
          claim.isLoading,
          claim.duplicated && claim.duplicated.message,
        ])
      ),
      autorun(() => duplicatedOnly.push(claim.duplicated)),
    ]
    await claim.retrieve()

    // `duplicated` is a plain field: assigning it notifies nobody
    expect(duplicatedOnly).toEqual([null])
    // the observer that reads isLoading re-runs when it goes false and finds
    // the duplicate in place
    expect(withLoading).toEqual([
      [false, null],
      [true, null],
      [
        false,
        '{"existingDataProviders":[{"id":86,"name":"Open Research Online (Open)"}]}',
      ],
    ])
    // the write after the await is outside an action: MobX warns (dev builds)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toMatch(MOBX_STRICT)
    stop.forEach((dispose) => dispose())

    // `created` is observable: its own write notifies
    warn.mockClear()
    const created = []
    const stopCreated = autorun(() => created.push(claim.created))
    claim.query = CREATED
    await claim.retrieve()
    expect(created).toHaveLength(2)
    expect(created[1]).toEqual(expect.objectContaining({ id: 990001 }))
    stopCreated()
  })
})
