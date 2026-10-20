// T-209 (41 C, R-004, R-018, R-073): store isolation in its own file, node
// project, jest.isolateModules (store/index.jsx computes isServer and calls
// enableStaticRendering at load, 40 §7 rule 6). client = `window` defined while
// the store modules load. React's scheduler (loaded through mobx-react-lite ->
// react-dom) then picks MessageChannel, whose port would keep the node process
// alive; hiding MessageChannel during the load makes it use its timer branch
// instead.
const loadStore = ({ client = false } = {}) => {
  const savedChannel = global.MessageChannel
  if (client) {
    global.window = {}
    global.MessageChannel = undefined
  }
  let mod
  try {
    jest.isolateModules(() => {
      mod = require('../../../store')
    })
  } finally {
    if (client) {
      delete global.window
      global.MessageChannel = savedChannel
    }
  }
  return mod
}

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

describe('T-209 @P0 store isolation', () => {
  test('T-209 c1 @P0 server: a new store per call and concurrent states isolated', async () => {
    const { initStore } = loadStore()
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
    expect(a.dataProviders.params.q).toBe('alpha')
    expect(b.dataProviders.params.q).toBe('beta')
    expect(a.dataProviders.results.map((p) => p.id)).toEqual([1])
    expect(b.dataProviders.results.map((p) => p.id)).toEqual([2])
    expect(a.search).not.toBe(b.search)
    expect(a.filters).not.toBe(b.filters)
  })

  test('T-209 c2 @P0 client: one singleton store, later initial data ignored', () => {
    const { initStore } = loadStore({ client: true })
    const a = initStore({ statistics: { totalArticlesCount: 1 } })
    const b = initStore({ statistics: { totalArticlesCount: 2 } })
    expect(b).toBe(a)
    expect(b.statistics).toEqual({ totalArticlesCount: 1 })
  })

  test('T-209 c3 @P0 Q-048.U3: a client revisit keeps the old /data-providers params (extend acts once)', () => {
    const { initStore } = loadStore({ client: true })
    const store = initStore({ statistics: {} })
    store.extend({ dataProviders: { data: providers, params: { q: 'alpha' } } })
    store.extend({ dataProviders: { data: providers, params: { q: 'beta' } } })
    expect(store.dataProviders.params.q).toBe('alpha')
    expect(store.dataProviders.results.map((p) => p.id)).toEqual([1])
    // null never creates the sub-store
    const fresh = loadStore({ client: true }).initStore({ statistics: {} })
    fresh.extend({ dataProviders: null })
    expect(fresh.dataProviders).toBeNull()
  })
})
