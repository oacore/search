// T-212 similar-works cases: T-207 (E8 body with and without
// resultType:'work'; dataProviders || [dataProvider] through the cached
// providers; error is `true`) and the similar-works rows of T-203:
// fetchSimilar's synchronous part is one notification, reset() on its own is
// one notification per field.
const E8_URL = 'https://api.core.ac.uk/v3/recommend'

module.exports = ({ driver, server, http, HttpResponse }) => {
  let bodies
  beforeEach(() => {
    bodies = []
    server.use(
      http.post(E8_URL, async ({ request }) => {
        const body = JSON.parse(await request.text())
        bodies.push(body)
        if (body.identifier === 'core:500')
          return HttpResponse.json({ message: 'no' }, { status: 500 })
        return HttpResponse.json([
          {
            id: 1,
            title: 'With providers',
            dataProviders: [{ id: 86, url: 'https://api/86' }],
          },
          {
            id: 2,
            title: 'With one provider',
            dataProvider: { id: 8, url: 'https://api/8' },
          },
        ])
      })
    )
  })

  const all = (t) => driver.spec.reactive.map((f) => t.get(f))

  test('T-207 c1 @P1 fetchSimilar posts the identifier and limit 5, plus resultType work for other versions', async () => {
    const similar = driver.create()
    expect(similar.snapshot()).toEqual({
      error: false,
      similarOutputs: null,
      isLoading: false,
    })
    await similar.call('fetchSimilar', 42, undefined)
    await similar.call('fetchSimilar', 43, false)
    await similar.call('fetchSimilar', 44, { resultType: 'work' })
    expect(bodies).toEqual([
      { identifier: 'core:42', limit: 5 },
      { identifier: 'core:43', limit: 5 },
      { identifier: 'core:44', limit: 5, resultType: 'work' },
    ])
  })

  test('T-207 c1 @P1 each output gets its providers from the cache, dataProviders or else [dataProvider]', async () => {
    const similar = driver.create()
    await similar.call('fetchSimilar', 42)
    const outputs = similar.plain(similar.get('similarOutputs'))
    expect(
      outputs.map((o) => [
        o.id,
        o.dataProviders.map((p) => [p.id, p.url, p.name]),
      ])
    ).toEqual([
      [1, [[86, 'https://api/86', 'Open Research Online (Open University)']]],
      [2, [[8, 'https://api/8', 'Birkbeck Institutional Research Online']]],
    ])
    expect(outputs[1].dataProvider).toEqual({ id: 8, url: 'https://api/8' })
    expect(similar.get('error')).toBe(false)
    expect(similar.get('isLoading')).toBe(false)
  })

  test('T-207 c1 @P1 a failed request sets error true and leaves similarOutputs null', async () => {
    const similar = driver.create()
    await similar.call('fetchSimilar', 42)
    await similar.call('fetchSimilar', 500)
    expect(similar.snapshot()).toEqual({
      error: true,
      similarOutputs: null,
      isLoading: false,
    })
  })

  test('T-203 c2 @P0 similarWorks: the synchronous part of fetchSimilar is one notification', async () => {
    const similar = driver.create()
    await similar.call('fetchSimilar', 500)
    const probe = similar.observe(all)
    const pending = similar.call('fetchSimilar', 42)
    // reset and isLoading on land together
    expect(probe.values).toHaveLength(2)
    expect(probe.values[1]).toEqual([false, null, true])
    await pending
    // similarOutputs, then isLoading off
    expect(probe.values).toHaveLength(4)
    expect(probe.values.map(([e, o, l]) => [e, o && o.length, l])).toEqual([
      [true, null, false],
      [false, null, true],
      [false, 2, true],
      [false, 2, false],
    ])
    probe.dispose()
  })

  test('T-203 c2 @P0 similarWorks: reset() alone notifies once per field', () => {
    const similar = driver.create()
    similar.write('similarOutputs', [{ id: 1 }])
    similar.write('isLoading', true)
    similar.write('error', true)
    const probe = similar.observe(all)
    similar.call('reset')
    expect(probe.values).toHaveLength(4)
    expect(probe.values[3]).toEqual([false, null, false])
    probe.dispose()
  })

  test('T-203 c2 @P0 similarWorks: a reactive field notifies once per write', () => {
    const similar = driver.create()
    for (const [field, next] of [
      ['error', true],
      ['similarOutputs', [{ id: 1 }]],
      ['isLoading', true],
    ]) {
      const probe = similar.observe((t) => t.get(field))
      similar.write(field, next)
      expect([field, probe.values.length]).toEqual([field, 2])
      if (typeof next !== 'object') {
        similar.write(field, next)
        expect([field, probe.values.length]).toEqual([field, 2])
      }
      probe.dispose()
    }
  })
}
