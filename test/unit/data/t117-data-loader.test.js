// T-117 (41 B, R-017): data/data-loader.js, the first step of `npm run build`.
// The loader runs as a child process on the Node that runs Jest (the step's
// runtime Node, 40 §2.1), in a temporary copy of the real data/ files (it
// writes next to __dirname). A --require preload sends the three URLs it hands
// to its fetch (node-fetch, or the global fetch of Node from CS-N12-1) to a
// local stub (test/unit/data/lib/P0-04/t117-preload.cjs), so the real fetch,
// status handling and file writes run. Q-026 says what is
// pinned: API >= 400 or a network error -> exit 1 (unhandled rejection in a
// promise nobody awaits); one failing URL leaves a partial write; a 200 `[]`
// overwrites all three files with exit 0; no answer hangs the loader (no
// timeout before CS-N12-1; undici's 300 s since then, AD-055).
//
// "Same after W4a (OD-08)": CS-N12-1 changes the log text and adds a 300 s
// timeout, so only the log text assertions and the hang case change there.
const path = require('path')

const {
  URLS,
  FILES,
  createWorkdir,
  createStub,
  runLoader,
  pollUntil,
  delay,
} = require('./lib/P0-04/t117-harness')

jest.setTimeout(60000)

// pretty-printed on purpose: the loader writes JSON.stringify of the parsed
// answer, not the bytes it received
const STATS = JSON.stringify(
  { totalArticlesCount: 356000001, fullTextCount: 4200, requestTook: 3 },
  null,
  2
)
const FORMAP = JSON.stringify(
  [
    { id: 1, name: 'Stub Provider One', email: null },
    {
      id: 2,
      name: 'Stub Provider Two',
      dataProviderLocation: { countryCode: 'GB', latitude: 1, longitude: 2 },
    },
  ],
  null,
  2
)
const MEMBERS = JSON.stringify(
  [{ organisation_id: 1, billing_type: 'starting', repo_id: 1 }],
  null,
  2
)
const compact = (text) => JSON.stringify(JSON.parse(text))

const ok = (body) => () => ({ status: 200, body })
const failWith = (status) => () => ({
  status,
  body: JSON.stringify({ message: `status ${status}` }),
})

const FAIL_TEXT =
  'Fail. ==> Statistics retrieval failed due to API Core instability.'

describe('T-117 @P0 data/data-loader.js (child process, temp data/, stub)', () => {
  const cleanups = []
  let workdir

  beforeEach(() => {
    workdir = createWorkdir()
    cleanups.push(async () => workdir.remove())
  })

  afterEach(async () => {
    // last registered first: loader, stub, directory
    await cleanups
      .splice(0)
      .reverse()
      .reduce((done, cleanup) => done.then(cleanup), Promise.resolve())
  })

  // starts the stub and the loader; both are cleaned up after the test
  const run = async (routes) => {
    const stub = await createStub(routes)
    cleanups.push(() => stub.close())
    const loader = runLoader({ workdir, stubUrl: stub.url })
    cleanups.push(async () => {
      loader.child.kill('SIGKILL')
      await loader.exited
    })
    return { stub, ...loader }
  }

  const unchanged = (...keys) =>
    keys.forEach((key) =>
      expect([key, workdir.sha(FILES[key])]).toEqual([
        key,
        workdir.originals[FILES[key]],
      ])
    )

  test('T-117 c1 @P0 200 -> the three files hold the raw answers (compact JSON, no wrapper), exit 0', async () => {
    const { stub, exited } = await run({
      statistics: ok(STATS),
      formap: ok(FORMAP),
      members: ok(MEMBERS),
    })
    const result = await exited

    expect(result.code).toBe(0)
    expect(result.signal).toBeNull()
    expect(result.stderr).not.toContain('Fail.')

    // the three production URLs, GET, no credentials
    expect(stub.requests).toHaveLength(3)
    expect(stub.requests.map((r) => r.method)).toEqual(['GET', 'GET', 'GET'])
    expect(stub.requests.map((r) => r.original).sort()).toEqual(
      Object.values(URLS).sort()
    )
    expect(stub.requests.every((r) => r.authorization === undefined)).toBe(true)

    // raw format: the answer re-serialised, never {data, timestamp}
    expect(workdir.read(FILES.statistics)).toBe(compact(STATS))
    expect(workdir.read(FILES.formap)).toBe(compact(FORMAP))
    expect(workdir.read(FILES.members)).toBe(compact(MEMBERS))
    expect(JSON.parse(workdir.read(FILES.statistics))).toEqual(
      JSON.parse(STATS)
    )
    expect(JSON.parse(workdir.read(FILES.statistics))).not.toHaveProperty(
      'timestamp'
    )

    // what it logs
    const lines = result.stdout.split('\n')
    expect(lines.filter((l) => l.startsWith('Fetching URL: ')).sort()).toEqual(
      Object.values(URLS)
        .map((u) => `Fetching URL: ${u}`)
        .sort()
    )
    expect(
      lines.filter((l) => l.startsWith('Downloaded, now saving to ')).sort()
    ).toEqual(
      Object.values(FILES)
        .map(
          (f) => `Downloaded, now saving to ${path.join(workdir.dataDir, f)}`
        )
        .sort()
    )

    // every other file of data/ is left alone (languages.json has no API URL)
    expect(workdir.sha('languages.json')).toBe(
      workdir.originals['languages.json']
    )
    expect(workdir.sha('data-loader.js')).toBe(
      workdir.originals['data-loader.js']
    )
    expect(workdir.listing()).toEqual([
      '.formap.json',
      '.members.json',
      '.statistics.json',
      'data-loader.js',
      'languages.json',
    ])
  })

  test('T-117 c2 @P0 200 `[]` -> exit 0 and all three files overwritten with `[]`', async () => {
    const { exited } = await run({
      statistics: ok('[]'),
      formap: ok('[]'),
      members: ok('[]'),
    })
    const result = await exited

    expect(result.code).toBe(0)
    expect(result.stderr).not.toContain('Fail.')
    expect(workdir.read(FILES.statistics)).toBe('[]')
    expect(workdir.read(FILES.formap)).toBe('[]')
    expect(workdir.read(FILES.members)).toBe('[]')
    expect(workdir.sha('languages.json')).toBe(
      workdir.originals['languages.json']
    )
  })

  test('T-117 c3 @P0 Q-026 members 500 -> exit 1, the other two files are already written (partial write), members unchanged', async () => {
    const written = () =>
      workdir.read(FILES.statistics) === compact(STATS) &&
      workdir.read(FILES.formap) === compact(FORMAP)
    const { stub, exited } = await run({
      statistics: ok(STATS),
      formap: ok(FORMAP),
      // the failure is sent after the loader has written the two others, so the
      // partial write is not a race
      members: async () => {
        await pollUntil(written, { what: 'the two other files written' })
        return failWith(500)()
      },
    })
    const result = await exited

    expect(stub.requests).toHaveLength(3)
    expect(result.code).toBe(1)
    expect(result.signal).toBeNull()
    expect(result.stderr).toContain('Could not fetch actual statistics')
    expect(result.stderr).toContain(FAIL_TEXT)

    expect(workdir.read(FILES.statistics)).toBe(compact(STATS))
    expect(workdir.read(FILES.formap)).toBe(compact(FORMAP))
    unchanged('members')
  })

  test.each([400, 404, 503])(
    'T-117 c3 @P0 Q-026 any status >= 400 (%i) -> exit 1 and the failing file is not written',
    async (status) => {
      const { exited } = await run({
        statistics: ok(STATS),
        formap: failWith(status),
        members: ok(MEMBERS),
      })
      const result = await exited
      expect(result.code).toBe(1)
      expect(result.stderr).toContain('Could not fetch actual statistics')
      expect(result.stderr).toContain(FAIL_TEXT)
      unchanged('formap')
    }
  )

  test('T-117 c4 @P0 Q-026 an HTML answer with status 200 -> exit 1, file not written', async () => {
    const { exited } = await run({
      statistics: () => ({
        status: 200,
        type: 'text/html; charset=utf-8',
        body: '<!DOCTYPE html><html><body>Service temporarily unavailable</body></html>',
      }),
      formap: ok(FORMAP),
      members: ok(MEMBERS),
    })
    const result = await exited
    expect(result.code).toBe(1)
    expect(result.stderr).toContain(
      'SyntaxError: Unexpected token \'<\', "<!DOCTYPE "... is not valid JSON'
    ) // AD-133
    expect(result.stderr).toContain(FAIL_TEXT)
    unchanged('statistics')
  })

  test('T-117 c4 @P0 Q-026 a connection reset -> exit 1, file not written', async () => {
    const { exited } = await run({
      statistics: ok(STATS),
      formap: ok(FORMAP),
      members: () => 'reset',
    })
    const result = await exited
    expect(result.code).toBe(1)
    expect(result.stderr).toContain('TypeError: fetch failed') // AD-054
    expect(result.stderr).toContain(FAIL_TEXT)
    unchanged('members')
  })

  test('T-117 c5 @P0 Q-026 no answer -> the loader is still running at the timeout and wrote nothing (its own timeout is the 300 s of undici, AD-055)', async () => {
    const { stub, child, exited } = await run({
      statistics: () => 'hang',
      formap: () => 'hang',
      members: () => 'hang',
    })
    // all three requests are out and unanswered
    await stub.received(3)
    const state = await Promise.race([
      exited.then(() => 'exited'),
      delay(2000).then(() => 'running'),
    ])
    expect(state).toBe('running')
    expect(child.exitCode).toBeNull()
    expect(child.signalCode).toBeNull()
    expect(stub.requests).toHaveLength(3)
    unchanged('statistics', 'formap', 'members')

    // the test ends it
    child.kill('SIGKILL')
    const result = await exited
    expect(result.signal).toBe('SIGKILL')
    expect(result.code).toBeNull()
  })
})
