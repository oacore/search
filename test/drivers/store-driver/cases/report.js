// T-212 report cases: T-206 (fetchOutput strips fullText; submit mutates its
// input; the error is one constant; the error stays until reset, so it
// survives a navigation, Q-094) and the report rows of T-203. submit and
// fetchOutput are not actions: each of their writes notifies on its own.
const E10_URL = 'https://api.core.ac.uk/internal/outputs/update'
const OUTPUT_URL = 'https://api.core.ac.uk/v3/outputs/:id'
const ERROR_MESSAGE =
  'We couldn’t perform the action. For any issue contact theteam@core.science'

const INITIAL = {
  output: {},
  updateOption: null,
  role: null,
  isLoading: false,
  error: null,
  isModalReportTypeActive: false,
  isModalReportFormActive: false,
  isModalReportSuccessActive: false,
}

module.exports = ({ driver, server, http, HttpResponse }) => {
  let requests
  beforeEach(() => {
    requests = []
    server.use(
      http.get(OUTPUT_URL, ({ params }) => {
        requests.push(['GET', params.id])
        if (params.id === '500')
          return HttpResponse.json({ message: 'no' }, { status: 500 })
        return HttpResponse.json({
          id: Number(params.id),
          title: `Output ${params.id}`,
          fullText: 'a long text',
          dataProvider: { id: 86, name: 'Open Research Online' },
        })
      }),
      http.post(E10_URL, async ({ request }) => {
        const body = JSON.parse(await request.text())
        requests.push(['POST', body])
        if (body.outputId === 500)
          return HttpResponse.json({ message: 'no' }, { status: 500 })
        return HttpResponse.json({}, { status: 200 })
      })
    )
  })

  const all = (t) => driver.spec.reactive.map((f) => t.get(f))

  test('T-206 c1 @P1 fetchOutput keeps the output without fullText and opens the type modal; every write notifies', async () => {
    const report = driver.create()
    expect(report.snapshot()).toEqual(INITIAL)
    const probe = report.observe(all)

    await report.call('fetchOutput', 7)
    expect(requests).toEqual([['GET', '7']])
    expect(report.plain(report.get('output'))).toEqual({
      id: 7,
      title: 'Output 7',
      dataProvider: { id: 86, name: 'Open Research Online' },
    })
    expect(report.get('isModalReportTypeActive')).toBe(true)
    expect(report.get('isLoading')).toBe(false)
    expect(report.get('error')).toBeNull()
    // isLoading on, output, type modal, isLoading off: four notifications
    expect(probe.values).toHaveLength(5)
    expect(probe.values.map((v) => [v[0] && v[0].id, v[3], v[5]])).toEqual([
      [undefined, false, false],
      [undefined, true, false],
      [7, true, false],
      [7, true, true],
      [7, false, true],
    ])
    probe.dispose()
  })

  test('T-206 c1 @P1 a failed fetchOutput sets the constant error and keeps the output', async () => {
    const report = driver.create()
    await report.call('fetchOutput', 7)
    report.write('isModalReportTypeActive', false)
    const probe = report.observe(all)
    await report.call('fetchOutput', 500)
    expect(report.get('error')).toBe(ERROR_MESSAGE)
    expect(report.get('output').id).toBe(7)
    expect(report.get('isModalReportTypeActive')).toBe(false)
    expect(report.get('isLoading')).toBe(false)
    // isLoading on, error, isLoading off
    expect(probe.values).toHaveLength(4)
    probe.dispose()
  })

  test('T-206 c1 @P1 submit writes updateOption and role into its argument and posts it', async () => {
    const report = driver.create()
    report.write('updateOption', 'takeDownFullText')
    report.write('role', 'author')
    const probe = report.observe(all)
    const data = { outputId: 7, name: 'N', email: 'e@x', message: 'm' }
    await report.call('submit', data)
    // the caller's object is mutated
    expect(data).toEqual({
      outputId: 7,
      name: 'N',
      email: 'e@x',
      message: 'm',
      updateOption: 'takeDownFullText',
      role: 'author',
    })
    expect(requests).toEqual([['POST', data]])
    expect(report.get('isModalReportSuccessActive')).toBe(true)
    expect(report.get('error')).toBeNull()
    expect(report.get('isLoading')).toBe(false)
    // isLoading on, success modal, isLoading off
    expect(probe.values).toHaveLength(4)
    probe.dispose()

    await report.call('submit', { outputId: 500 })
    expect(report.get('error')).toBe(ERROR_MESSAGE)
    expect(report.get('isLoading')).toBe(false)
  })

  test('T-206 c2 @P1 Q-094 the error stays until reset: a later success does not clear it', async () => {
    const report = driver.create()
    report.write('error', 'typed by the page')
    await report.call('fetchOutput', 7)
    expect(report.get('error')).toBe('typed by the page')
    await report.call('submit', { outputId: 7 })
    expect(report.get('error')).toBe('typed by the page')
    report.call('reset')
    expect(report.get('error')).toBeNull()
  })

  test('T-203 c2 @P0 report: reset is one notification back to the initial state', () => {
    const report = driver.create()
    report.write('output', { id: 1 })
    report.write('updateOption', 'takeDownFullText')
    report.write('role', 'author')
    report.write('isLoading', true)
    report.write('error', 'failed')
    report.write('isModalReportTypeActive', true)
    report.write('isModalReportFormActive', true)
    report.write('isModalReportSuccessActive', true)
    const probe = report.observe(all)
    report.call('reset')
    expect(probe.values).toHaveLength(2)
    expect(report.snapshot()).toEqual(INITIAL)
    probe.dispose()
  })

  test('T-203 c2 @P0 report: a reactive field notifies once per write', () => {
    const report = driver.create()
    for (const field of driver.spec.reactive) {
      const probe = report.observe((t) => t.get(field))
      const current = report.plain(report.get(field))
      let next = 'written'
      if (typeof current === 'boolean') next = !current
      else if (current && typeof current === 'object')
        next = { ...current, written: true }
      report.write(field, next)
      expect([field, probe.values.length]).toEqual([field, 2])
      if (typeof next !== 'object') {
        report.write(field, next)
        expect([field, probe.values.length]).toEqual([field, 2])
      }
      probe.dispose()
    }
  })
}
