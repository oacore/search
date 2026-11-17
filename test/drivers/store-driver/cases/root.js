// T-212 root cases: T-209 (store isolation). `load({ client })` loads
// store/index.jsx in jest.isolateModules, with `window` defined while it
// loads for the client; the sub-stores are read through their drivers.
const { driverFor } = require('..')

const providers = [
  {
    id: 1,
    name: 'Alpha Repository',
    urlHomepage: 'https://alpha.example/',
    aliases: [],
  },
  {
    id: 2,
    name: 'Beta Archive',
    urlHomepage: 'https://beta.example/',
    aliases: [],
  },
]

module.exports = ({ load }) => {
  const dp = (root) => driverFor('dataProviders').of(root.dataProviders)
  const ids = (h) => h.get('results').map((p) => p.id)

  test('T-209 c1 @P0 server: a new store per call and concurrent states isolated', async () => {
    const { initStore } = load()
    const a = initStore({ statistics: { totalArticlesCount: 1 } })
    const b = initStore({ statistics: { totalArticlesCount: 2 } })
    expect(a).not.toBe(b)
    expect(a.statistics).toEqual({ totalArticlesCount: 1 })
    expect(b.statistics).toEqual({ totalArticlesCount: 2 })
    // two interleaved "requests" with different /data-providers params
    await Promise.all([
      Promise.resolve().then(() =>
        a.extend({ dataProviders: { data: providers, params: { q: 'alpha' } } })
      ),
      Promise.resolve().then(() =>
        b.extend({ dataProviders: { data: providers, params: { q: 'beta' } } })
      ),
    ])
    expect(dp(a).get('params.q')).toBe('alpha')
    expect(dp(b).get('params.q')).toBe('beta')
    expect(ids(dp(a))).toEqual([1])
    expect(ids(dp(b))).toEqual([2])
    for (const name of ['claim', 'report', 'similarWorks', 'search', 'filters'])
      expect([name, a[name] === b[name]]).toEqual([name, false])
  })

  test('T-209 c2 @P0 client: one singleton store, later initial data ignored', () => {
    const { initStore } = load({ client: true })
    const a = initStore({ statistics: { totalArticlesCount: 1 } })
    const b = initStore({ statistics: { totalArticlesCount: 2 } })
    expect(b).toBe(a)
    expect(b.statistics).toEqual({ totalArticlesCount: 1 })
  })

  test('T-209 c3 @P0 Q-048.U3: a client revisit keeps the old /data-providers params (extend acts once)', () => {
    const { initStore } = load({ client: true })
    const store = initStore({ statistics: {} })
    store.extend({ dataProviders: { data: providers, params: { q: 'alpha' } } })
    store.extend({ dataProviders: { data: providers, params: { q: 'beta' } } })
    expect(dp(store).get('params.q')).toBe('alpha')
    expect(ids(dp(store))).toEqual([1])
    // null never creates the sub-store
    const fresh = load({ client: true }).initStore({ statistics: {} })
    fresh.extend({ dataProviders: null })
    expect(fresh.dataProviders).toBeNull()
  })
}
