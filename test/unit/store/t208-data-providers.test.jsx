// T-208 (41 C, R-018): the DataProviders store, findings/03 §5.1 and
// findings/06 §3.7 ("DataProviders search"). c1 the term is matched against six
// fields (name, normalizedName, urlHomepage, normalizedInstitutionName, the
// aliases joined with "|", rorId), both sides lower-cased. c2 Q-028: the term
// goes through `decodeURI` although the framework already decoded the query,
// so `100%` (the `?q=100%25` of the URL) throws a URIError from the computed
// `results` (SSR 500, Q-073 (d), pinned by T-601 c2).
const { autorun, toJS } = require('mobx')

const DataProviders = require('../../../store/data-providers').default
const {
  default: normalizeDataProviders,
} = require('../../../templates/data-providers/utils/normalize-data-providers')

// a row that carries one searchable field only: the term below is found in
// that field and nowhere else
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

const store = (data, q) => new DataProviders({ data, params: { q } })

describe('T-208 @P1 DataProviders store', () => {
  test('T-208 c1 @P1 each of the six fields is searched, case-insensitively', () => {
    // a term unique to one field finds that row, whatever its case
    const terms = [
      ['alphaname', 1],
      ['BETANORM', 2],
      ['gamma.EXAMPLE.org/path', 3],
      ['dElTaInStItUtIoN', 4],
      ['epsilonone', 5],
      ['ZETATWO', 5],
      ['https://ROR.org/0eta00id', 6],
    ]
    for (const [term, id] of terms) {
      const { results } = store(ROWS, term)
      expect(ids(results)).toEqual([id])
    }
    // a partial term is a substring match anywhere in the field
    expect(ids(store(ROWS, 'aName').results)).toEqual([1])
    expect(ids(store(ROWS, 'ample.org/P').results)).toEqual([3])
    // a term found in no field finds nothing
    expect(store(ROWS, 'omega').results).toEqual([])
    // the rows come back in data order and are the data's own rows
    expect(ids(store(ROWS, 'a').results)).toEqual([1, 2, 3, 4, 5, 6])
    expect(toJS(store(ROWS, 'alpha').results)).toEqual([ROWS[0]])
  })

  test('T-208 c1 @P1 the aliases are joined with "|" before the search, so a term can span two aliases', () => {
    const rows = [
      { id: 1, aliases: ['Open University', 'The OU'] },
      { id: 2, aliases: ['Open', 'University'] },
      { id: 3, aliases: [] },
    ]
    // the separator is searchable: ids 1 and 2 hold "…|…" in their joined text
    expect(ids(store(rows, 'university|the').results)).toEqual([1])
    expect(ids(store(rows, 'open|university').results)).toEqual([2])
    expect(ids(store(rows, '|').results)).toEqual([1, 2])
    // the alias texts themselves match as in any field
    expect(ids(store(rows, 'open univ').results)).toEqual([1])
    expect(ids(store(rows, 'OU').results)).toEqual([1])
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
    expect(ids(store(rows, 'named').results)).toEqual([1])
    expect(ids(store(rows, 'x.example').results)).toEqual([6])
    // the empty term matches every row that has at least one string (or an
    // array of aliases) to look into: ids 2, 3 and 4 have none
    expect(ids(store(rows, '').results)).toEqual([1, 5, 6])
    // the default term of the schema is the empty string
    expect(ids(new DataProviders({ data: rows }).results)).toEqual([1, 5, 6])
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
    // rows without a name are dropped by the normalizer, before the search
    expect(ids(rows)).toEqual([10, 11])
    // the folded name is searched, and so is the raw one
    expect(ids(store(rows, 'poznanskie').results)).toEqual([10])
    expect(ids(store(rows, 'Poznańskie').results)).toEqual([10])
    expect(ids(store(rows, 'universite').results)).toEqual([11])
    expect(ids(store(rows, 'Université').results)).toEqual([11])
    expect(ids(store(rows, 'geneve').results)).toEqual([11])
    // the institution is searched through its folded copy only
    expect(ids(store(rows, 'adama mickiewicza').results)).toEqual([10])
    expect(ids(store(rows, 'pressto.amu').results)).toEqual([10])
    expect(ids(store(rows, 'unige').results)).toEqual([11])
    // the raw name keeps its diacritics and is searched as typed, the folded
    // one is searched with the diacritics removed
    expect(ids(store(rows, 'pozna\u0144skie spotkania').results)).toEqual([10])
    expect(ids(store(rows, 'poznanskie spotkania').results)).toEqual([10])
    expect(ids(store(rows, 'poznan\u0301skie').results)).toEqual([])
  })

  test('T-208 c1 @P1 results follow params.q, nothing else of the term is edited', () => {
    const dp = store(ROWS, 'alpha')
    const seen = []
    const stop = autorun(() => seen.push(ids(dp.results)))

    expect(seen).toEqual([[1]])
    dp.params.changeParams({ q: 'beta' })
    expect(seen).toEqual([[1], [2]])
    // an unrelated param does not recompute the result
    dp.params.changeParams({ size: 20 })
    expect(seen).toEqual([[1], [2]])
    // the term is not trimmed and not lower-cased by the store
    dp.params.changeParams({ q: ' beta' })
    expect(dp.params.q).toBe(' beta')
    expect(seen[seen.length - 1]).toEqual([])
    // regular-expression characters are plain characters
    dp.params.changeParams({ q: '.*' })
    expect(seen[seen.length - 1]).toEqual([])
    dp.params.changeParams({ q: 'gamma.example' })
    expect(seen[seen.length - 1]).toEqual([3])
    stop()
    // search() is the same function, called directly with a raw term
    expect(ids(dp.search('GAMMA'))).toEqual([3])
  })

  test('T-208 c2 @P1 Q-028: the term is decodeURI-d once more, escapes decode and reserved escapes stay', () => {
    const rows = [
      { id: 1, name: 'Open University' },
      { id: 2, name: 'Alpha Repository' },
      { id: 3, name: 'Fifty 100% Repo' },
      { id: 4, name: 'Slash/Archive' },
      { id: 5, name: 'Slash%2FArchive' },
    ]
    // %20 and %41 are decoded: the page decodes `?q=open%2520univ` once, the
    // store a second time
    expect(ids(store(rows, 'open%20univ').results)).toEqual([1])
    expect(ids(store(rows, '%41lpha').results)).toEqual([2])
    // `%25` decodes to "%": the term the page hands over for `?q=100%2525`
    expect(ids(store(rows, '100%25').results)).toEqual([3])
    // reserved escapes (%2F) are not decoded by decodeURI: the term stays
    // "%2f" and is found only as literal text
    expect(ids(store(rows, 'slash%2Farchive').results)).toEqual([5])
    expect(ids(store(rows, 'slash/archive').results)).toEqual([4])
  })

  test('T-208 c2 @P1 Q-028: a term with a lone "%" throws a URIError from results (the 500 of /data-providers/?q=100%25)', () => {
    const rows = [{ id: 1, name: '100% Repository' }]
    // Next hands the store the decoded query: `?q=100%25` arrives as "100%"
    const dp = store(rows, '100%')
    expect(dp.params.q).toBe('100%')
    const read = () => dp.results
    const thrown = (() => {
      try {
        return read()
      } catch (error) {
        return error
      }
    })()
    expect(thrown).toBeInstanceOf(URIError)
    expect(thrown.message).toBe('URI malformed')
    // it throws on every read, not only the first
    expect(read).toThrow(URIError)
    // so does a direct search, and any malformed escape
    expect(() => dp.search('%')).toThrow('URI malformed')
    expect(() => dp.search('%E0%A4%A')).toThrow(URIError)
    expect(() => dp.search('abc%zz')).toThrow(URIError)
    // the same row is found as soon as the percent sign is escaped
    expect(ids(dp.search('100%25'))).toEqual([1])
    expect(ids(store(rows, '100%25').results)).toEqual([1])
    // with no rows the term is still decoded first: an empty list throws too
    expect(() => store([], '%').results).toThrow(URIError)
  })
})
