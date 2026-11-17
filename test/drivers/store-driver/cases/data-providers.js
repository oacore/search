// T-212 data-providers cases: T-208 (findings/03 §5.1, findings/06 §3.7: the
// term is matched against six fields, both sides lower-cased; Q-028 the term
// goes through decodeURI once more, so a lone "%" throws a URIError from
// `results`), the params rows of T-107 (store/params.js) and the
// DataProviders and Params rows of T-203.
const {
  default: normalizeDataProviders,
} = require('../../../../templates/data-providers/utils/normalize-data-providers')

const only = (id, field, value) => ({ id, [field]: value })
const FIELDS = [
  ['name', 'AlphaName'],
  ['normalizedName', 'BetaNorm'],
  ['urlHomepage', 'https://gamma.example.org/Path'],
  ['normalizedInstitutionName', 'DeltaInstitution'],
  ['aliases', ['EpsilonOne', 'ZetaTwo']],
  ['rorId', 'https://ror.org/0ETA00ID'],
]
const ROWS = FIELDS.map(([field, value], i) => only(i + 1, field, value))
const ids = (results) => results.map((row) => row.id)

module.exports = ({ driver }) => {
  const store = (data, q) => driver.create({ data, params: { q } })
  const results = (data, q) => store(data, q).get('results')
  const params = (h) => ['q', 'size', 'action'].map((k) => h.get(`params.${k}`))

  test('T-208 c1 @P1 each of the six fields is searched, case-insensitively', () => {
    const terms = [
      ['alphaname', 1],
      ['BETANORM', 2],
      ['gamma.EXAMPLE.org/path', 3],
      ['dElTaInStItUtIoN', 4],
      ['epsilonone', 5],
      ['ZETATWO', 5],
      ['https://ROR.org/0eta00id', 6],
    ]
    for (const [term, id] of terms)
      expect(ids(results(ROWS, term))).toEqual([id])
    expect(ids(results(ROWS, 'aName'))).toEqual([1])
    expect(ids(results(ROWS, 'ample.org/P'))).toEqual([3])
    expect(results(ROWS, 'omega')).toEqual([])
    expect(ids(results(ROWS, 'a'))).toEqual([1, 2, 3, 4, 5, 6])
    const h = store(ROWS, 'alpha')
    expect(h.plain(h.get('results'))).toEqual([ROWS[0]])
  })

  test('T-208 c1 @P1 the aliases are joined with "|" before the search, so a term can span two aliases', () => {
    const rows = [
      { id: 1, aliases: ['Open University', 'The OU'] },
      { id: 2, aliases: ['Open', 'University'] },
      { id: 3, aliases: [] },
    ]
    expect(ids(results(rows, 'university|the'))).toEqual([1])
    expect(ids(results(rows, 'open|university'))).toEqual([2])
    expect(ids(results(rows, '|'))).toEqual([1, 2])
    expect(ids(results(rows, 'open univ'))).toEqual([1])
    expect(ids(results(rows, 'OU'))).toEqual([1])
  })

  test('T-208 c1 @P1 missing and null fields never throw; a row with none of the six fields matches nothing', () => {
    const rows = [
      { id: 1, name: 'Named' },
      { id: 2, name: null, normalizedName: null, aliases: null, rorId: null },
      { id: 3, name: undefined, urlHomepage: undefined },
      { id: 4 },
      { id: 5, name: '', aliases: [] },
      { id: 6, urlHomepage: 'https://x.example/' },
    ]
    expect(ids(results(rows, 'named'))).toEqual([1])
    expect(ids(results(rows, 'x.example'))).toEqual([6])
    expect(ids(results(rows, ''))).toEqual([1, 5, 6])
    // the default term of the schema is the empty string
    expect(ids(driver.create({ data: rows }).get('results'))).toEqual([1, 5, 6])
    // data null or undefined is an empty list
    expect(driver.create({ data: null }).get('data')).toEqual([])
    expect(driver.create({}).get('results')).toEqual([])
  })

  test('T-208 c1 @P1 on the rows the page builds (normalizeDataProviders) the diacritics are folded for the normalized fields only', () => {
    const rows = normalizeDataProviders([
      {
        id: 10,
        name: 'Poznańskie Spotkania Językoznawcze',
        institutionName: 'Uniwersytet im. Adama Mickiewicza',
        urlHomepage: 'http://pressto.amu.edu.pl',
        rorId: null,
        aliases: [],
      },
      { id: 11, name: 'Université de Genève', aliases: ['UNIGE'] },
      { id: 12, name: '', urlHomepage: 'https://dropped.example/' },
    ])
    expect(ids(rows)).toEqual([10, 11])
    expect(ids(results(rows, 'poznanskie'))).toEqual([10])
    expect(ids(results(rows, 'Poznańskie'))).toEqual([10])
    expect(ids(results(rows, 'universite'))).toEqual([11])
    expect(ids(results(rows, 'Université'))).toEqual([11])
    expect(ids(results(rows, 'geneve'))).toEqual([11])
    expect(ids(results(rows, 'adama mickiewicza'))).toEqual([10])
    expect(ids(results(rows, 'pressto.amu'))).toEqual([10])
    expect(ids(results(rows, 'unige'))).toEqual([11])
    expect(ids(results(rows, 'poznańskie spotkania'))).toEqual([10])
    expect(ids(results(rows, 'poznanskie spotkania'))).toEqual([10])
    expect(ids(results(rows, 'poznańskie'))).toEqual([])
  })

  test('T-208 c1 @P1 results follow params.q, nothing else of the term is edited', () => {
    const dp = store(ROWS, 'alpha')
    const seen = dp.observe((t) => ids(t.get('results')))

    expect(seen.values).toEqual([[1]])
    dp.call('params.changeParams', { q: 'beta' })
    expect(seen.values).toEqual([[1], [2]])
    // an unrelated param does not recompute the result
    dp.call('params.changeParams', { size: 20 })
    expect(seen.values).toEqual([[1], [2]])
    // the term is not trimmed and not lower-cased by the store
    dp.call('params.changeParams', { q: ' beta' })
    expect(dp.get('params.q')).toBe(' beta')
    expect(seen.values[seen.values.length - 1]).toEqual([])
    dp.call('params.changeParams', { q: '.*' })
    expect(seen.values[seen.values.length - 1]).toEqual([])
    dp.call('params.changeParams', { q: 'gamma.example' })
    expect(seen.values[seen.values.length - 1]).toEqual([3])
    seen.dispose()
    // search() is the same function, called directly with a raw term
    expect(ids(dp.call('search', 'GAMMA'))).toEqual([3])
  })

  test('T-208 c2 @P1 Q-028: the term is decodeURI-d once more, escapes decode and reserved escapes stay', () => {
    const rows = [
      { id: 1, name: 'Open University' },
      { id: 2, name: 'Alpha Repository' },
      { id: 3, name: 'Fifty 100% Repo' },
      { id: 4, name: 'Slash/Archive' },
      { id: 5, name: 'Slash%2FArchive' },
    ]
    expect(ids(results(rows, 'open%20univ'))).toEqual([1])
    expect(ids(results(rows, '%41lpha'))).toEqual([2])
    expect(ids(results(rows, '100%25'))).toEqual([3])
    expect(ids(results(rows, 'slash%2Farchive'))).toEqual([5])
    expect(ids(results(rows, 'slash/archive'))).toEqual([4])
  })

  test('T-208 c2 @P1 Q-028: a term with a lone "%" throws a URIError from results (the 500 of /data-providers/?q=100%25)', () => {
    const rows = [{ id: 1, name: '100% Repository' }]
    const dp = store(rows, '100%')
    expect(dp.get('params.q')).toBe('100%')
    const read = () => dp.get('results')
    const thrown = (() => {
      try {
        return read()
      } catch (error) {
        return error
      }
    })()
    expect(thrown).toBeInstanceOf(URIError)
    expect(thrown.message).toBe('URI malformed')
    expect(read).toThrow(URIError)
    expect(() => dp.call('search', '%')).toThrow('URI malformed')
    expect(() => dp.call('search', '%E0%A4%A')).toThrow(URIError)
    expect(() => dp.call('search', 'abc%zz')).toThrow(URIError)
    expect(ids(dp.call('search', '100%25'))).toEqual([1])
    expect(ids(results(rows, '100%25'))).toEqual([1])
    expect(() => results([], '%')).toThrow(URIError)
  })

  test('T-107 @P1 the params keep the schema and expose only the schema keys, converted', () => {
    const dp = driver.create({
      data: [],
      params: { q: 'abc', size: '20', action: 'ADD', extra: 1 },
    })
    const p = dp.params()
    expect(p.schema).toEqual({
      q: { default: '', convert: 'string', validation: 'string' },
      size: { default: 10, validation: 'number', convert: 'number' },
      action: { default: null, validation: ['ADD', null] },
    })
    expect(Object.keys(p)).toEqual(['schema', 'q', 'size', 'action'])
    expect(params(dp)).toEqual(['abc', 20, 'ADD'])
    expect('extra' in p).toBe(false)
    // the rest of the object (useSyncUrlParamsWithStore) is the three values
    const { schema, ...rest } = p
    expect(rest).toEqual({ q: 'abc', size: 20, action: 'ADD' })
    expect(params(driver.create({ data: [], params: {} }))).toEqual([
      '',
      10,
      null,
    ])
    // params null is a TypeError (the default only replaces undefined)
    expect(() => driver.create({ data: [], params: null })).toThrow(TypeError)
  })

  test('T-107 @P1 changeParams merges, validates, falls back to the default and applies all keys in one notification', () => {
    const dp = driver.create({
      data: [],
      params: { q: 'abc', size: '20', action: 'ADD' },
    })
    dp.call('params.changeParams', { size: '30' })
    expect(params(dp)).toEqual(['abc', 30, 'ADD'])
    dp.call('params.changeParams', { q: 'new', foo: 1 })
    expect(params(dp)).toEqual(['new', 30, 'ADD'])
    expect('foo' in dp.params()).toBe(false)
    expect(Object.keys(dp.params())).toEqual(['schema', 'q', 'size', 'action'])
    // an invalid value falls back to the schema default, not the previous one
    dp.call('params.changeParams', { size: 'abc' })
    expect(dp.get('params.size')).toBe(10)
    dp.call('params.changeParams', { action: 'x' })
    expect(dp.get('params.action')).toBeNull()
    expect(dp.get('params.q')).toBe('new')

    const seen = dp.observe((t) => params(t))
    dp.call('params.changeParams', { q: 'z', size: '33', action: 'ADD' })
    seen.dispose()
    expect(seen.values).toEqual([
      ['new', 10, null],
      ['z', 33, 'ADD'],
    ])
    expect(() => dp.call('params.changeParams')).toThrow(TypeError)
  })

  test('T-203 c2 @P0 dataProviders: a direct param write notifies once and is not converted', () => {
    const dp = driver.create({ data: [], params: {} })
    for (const [key, next] of [
      ['q', 'x'],
      ['size', '25'],
      ['action', 'ADD'],
    ]) {
      const probe = dp.observe((t) => t.get(`params.${key}`))
      dp.write(`params.${key}`, next)
      expect([key, probe.values]).toEqual([key, [probe.values[0], next]])
      dp.write(`params.${key}`, next)
      expect(probe.values).toHaveLength(2)
      probe.dispose()
    }
    // a write to one param does not notify an observer of another
    const probe = dp.observe((t) => t.get('params.size'))
    dp.write('params.q', 'y')
    expect(probe.values).toHaveLength(1)
    probe.dispose()
  })

  test('T-203 c2 @P0 dataProviders: results is computed once per change of data or q', () => {
    const providers = driver.create({
      data: [
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Beta' },
      ],
      params: { q: 'a' },
    })
    const search = providers.spy('search')
    const seen = providers.observe((t) => {
      const value = ids(t.get('results'))
      t.get('results') // read twice, computed once
      return value
    })
    expect(search).toHaveBeenCalledTimes(1)
    providers.write('params.q', 'be')
    expect(search).toHaveBeenCalledTimes(2)
    providers.write('data', [
      { id: 1, name: 'Alpha' },
      { id: 2, name: 'Beta' },
      { id: 3, name: 'Beryl' },
    ])
    expect(search).toHaveBeenCalledTimes(3)
    // a param that results does not read changes nothing
    providers.write('params.size', 30)
    expect(search).toHaveBeenCalledTimes(3)
    expect(seen.values).toEqual([[1, 2], [2], [2, 3]])
    seen.dispose()
  })
}
