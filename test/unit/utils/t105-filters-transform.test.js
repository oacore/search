// T-105 (41 B, R-030): utils/filters-transform.js, findings/06 §3.2. Pins
// today's behaviour, quirks included: Q-033 (no `language` aggregation ->
// TypeError), Q-034 (`checked` is a substring test on the whole query), the
// duplicate `English` display values for `en` and `EN`, and the quote stripping
// of the item values.
const transformFiltersData = require('../../../utils/filters-transform').default
const { checkActiveItems } = require('../../../utils/filters-transform')

// store/filters.js:30-37, the order the store passes as `labelValues`
const LABEL_ORDER = [
  'fieldsOfStudy',
  'yearPublished',
  'documentType',
  'authors',
  'language',
  'publisher',
]

// the findings/06 §3.2 fixture
const agg = () => ({
  fieldsOfStudy: { 'Medicine': 5, '"Biology"': 2 },
  yearPublished: { 2019: 3, 2020: 0 },
  documentType: { research: 4 },
  authors: { 'Smith, J': 1 },
  language: { en: 7, xx: 1, EN: 1 },
  publisher: { '': 2, 'Elsevier': 1 },
})

const QUERY = 'cancer AND language:"en" AND yearPublished>=2019?sort=relevance'

const byValue = (filters, value) => filters.find((f) => f.value === value)

describe('T-105 @P0 filters-transform (findings/06 §3.2)', () => {
  test('T-105 c1 @P0 checkActiveItems returns the first filter with a checked item, never a boolean', () => {
    const filters = [
      { value: 'a', label: 'a', items: [{ value: 'x', checked: false }] },
      { value: 'b', label: 'b', items: [{ value: 'y', checked: true }] },
      { value: 'c', label: 'c', items: [{ value: 'z', checked: true }] },
    ]
    const found = checkActiveItems(filters)
    expect(found).toBe(filters[1])
    expect(typeof found).toBe('object')
  })

  test('T-105 c1 @P0 checkActiveItems skips the "sort by" filter and answers undefined when nothing is checked', () => {
    const sortOnly = [
      { value: 'sort', label: 'sort by', items: [{ checked: true }] },
      { value: 'b', label: 'b', items: [{ checked: false }] },
      { value: 'c', label: 'c', items: [{ checked: 'yes' }] },
      { value: 'd', label: 'd', items: [] },
    ]
    // `checked === true` only: a truthy string does not count
    expect(checkActiveItems(sortOnly)).toBeUndefined()
    expect(checkActiveItems([])).toBeUndefined()
    expect(
      checkActiveItems([
        ...sortOnly,
        { value: 'e', label: 'e', items: [{ checked: true }] },
      ]).value
    ).toBe('e')
  })

  test('T-105 c1 @P0 first call (next = null): labels, order, items, counts and checked flags of the §3.2 fixture', () => {
    const filters = transformFiltersData(agg(), null, LABEL_ORDER, QUERY)
    expect(filters.map((f) => [f.value, f.label])).toEqual([
      ['fieldsOfStudy', 'field'],
      ['yearPublished', 'year'],
      ['documentType', 'type'],
      ['authors', 'author'],
      ['language', 'language'],
      ['publisher', 'publisher'],
    ])
    expect(byValue(filters, 'fieldsOfStudy').items).toEqual([
      { value: 'Medicine', count: 5, checked: false },
      { value: 'Biology', count: 2, checked: false },
    ])
    // years go through parseInt and become numbers; 2019 is in the query
    expect(byValue(filters, 'yearPublished').items).toEqual([
      { value: 2019, count: 3, checked: true },
      { value: 2020, count: 0, checked: false },
    ])
    expect(byValue(filters, 'documentType').items).toEqual([
      { value: 'research', count: 4, checked: false },
    ])
    expect(byValue(filters, 'authors').items).toEqual([
      { value: 'Smith, J', count: 1, checked: false },
    ])
    // the empty value is never checked
    expect(byValue(filters, 'publisher').items).toEqual([
      { value: '', count: 2, checked: false },
      { value: 'Elsevier', count: 1, checked: false },
    ])
  })

  test('T-105 c1 @P0 the filters are sorted by the label order; unknown aggregation names sort first', () => {
    const shuffled = {
      publisher: { P: 1 },
      language: { en: 1 },
      authors: { A: 1 },
      zzz: { Z: 1 },
      documentType: { research: 1 },
    }
    const filters = transformFiltersData(shuffled, null, LABEL_ORDER, '')
    expect(filters.map((f) => f.value)).toEqual([
      'zzz',
      'documentType',
      'authors',
      'language',
      'publisher',
    ])
    // names without a mapping keep their value as the label
    expect(byValue(filters, 'zzz').label).toBe('zzz')
  })

  test('T-105 c1 @P0 diff call: keys missing from the new aggregations keep their entry with count 0, new keys are added', () => {
    const next = {
      fieldsOfStudy: { Medicine: 1 },
      language: { en: 1 },
    }
    const filters = transformFiltersData(agg(), next, LABEL_ORDER, QUERY)
    expect(byValue(filters, 'fieldsOfStudy').items).toEqual([
      { value: 'Medicine', count: 1, checked: false },
      { value: 'Biology', count: 0, checked: false },
    ])
    expect(byValue(filters, 'yearPublished').items).toEqual([
      { value: 2019, count: 0, checked: true },
      { value: 2020, count: 0, checked: false },
    ])
    expect(byValue(filters, 'documentType').items).toEqual([
      { value: 'research', count: 0, checked: false },
    ])
    expect(byValue(filters, 'language').items).toEqual([
      { value: 'English', code: 'en', count: 1, checked: true },
      { value: 'xx', code: 'xx', count: 0, checked: false },
      { value: 'English', code: 'EN', count: 0, checked: false },
    ])

    // a key that only the new aggregations carry is added with its count
    const withNew = transformFiltersData(
      { language: { en: 3 } },
      { language: { en: 1, fr: 2 } },
      LABEL_ORDER,
      ''
    )
    expect(byValue(withNew, 'language').items).toEqual([
      { value: 'English', code: 'en', count: 1, checked: false },
      { value: 'French', code: 'fr', count: 2, checked: false },
    ])
  })

  test('T-105 c1 @P0 diff call: the items keep the order of the initial aggregation, keys only the new one has come last', () => {
    const filters = transformFiltersData(
      { documentType: { a: 1, b: 2 }, language: {} },
      { documentType: { c: 3, b: 4 }, language: {} },
      LABEL_ORDER,
      ''
    )
    expect(byValue(filters, 'documentType').items).toEqual([
      { value: 'a', count: 0, checked: false },
      { value: 'b', count: 4, checked: false },
      { value: 'c', count: 3, checked: false },
    ])
  })

  test('T-105 c1 @P0 a null count is a leaf and becomes 0', () => {
    const filters = transformFiltersData(
      { publisher: { P: null, Q: 2 }, language: { en: null } },
      null,
      LABEL_ORDER,
      ''
    )
    expect(byValue(filters, 'publisher').items).toEqual([
      { value: 'P', count: 0, checked: false },
      { value: 'Q', count: 2, checked: false },
    ])
    expect(byValue(filters, 'language').items).toEqual([
      { value: 'English', code: 'en', count: 0, checked: false },
    ])
  })

  test('T-105 c1 @P0 neither input is mutated and a missing yearPublished aggregation is fine', () => {
    const initial = { language: { en: 1 }, publisher: { P: 2 } }
    const next = { language: { en: 4 } }
    const before = JSON.stringify([initial, next])
    const filters = transformFiltersData(initial, next, LABEL_ORDER, '')
    expect(JSON.stringify([initial, next])).toBe(before)
    expect(filters.map((f) => f.value)).toEqual(['language', 'publisher'])
    expect(byValue(filters, 'publisher').items).toEqual([
      { value: 'P', count: 0, checked: false },
    ])
  })

  test('T-105 c1 @P0 R-030 the result is built from new objects: a second call and the inputs are unaffected by changes to the first result', () => {
    const input = agg()
    const first = transformFiltersData(input, null, LABEL_ORDER, QUERY)
    const second = transformFiltersData(input, null, LABEL_ORDER, QUERY)
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(second[0]).not.toBe(first[0])
    expect(second[0].items).not.toBe(first[0].items)
    expect(second[0].items[0]).not.toBe(first[0].items[0])

    // the store flips `checked` in place on what it received
    first[0].items[0].checked = true
    first[0].items.push({ value: 'extra', count: 9, checked: true })
    first[4].items[0].value = 'changed'
    expect(second).toEqual(
      transformFiltersData(agg(), null, LABEL_ORDER, QUERY)
    )
    expect(input).toEqual(agg())
  })

  test('T-105 c2 @P0 Q-033 an aggregation response without `language` throws a TypeError', () => {
    const { language, ...withoutLanguage } = agg()
    expect(language).toBeDefined()
    expect(() =>
      transformFiltersData(withoutLanguage, null, LABEL_ORDER, QUERY)
    ).toThrow(TypeError)
    // also when only the initial aggregations lack it
    expect(() =>
      transformFiltersData(withoutLanguage, {}, LABEL_ORDER, QUERY)
    ).toThrow(TypeError)
    // the diff call keeps `language` alive when the initial ones have it
    expect(() =>
      transformFiltersData(agg(), { fieldsOfStudy: {} }, LABEL_ORDER, QUERY)
    ).not.toThrow()
  })

  test('T-105 c2 @P0 Q-034 `checked` is a substring test on the whole query: a year inside a free-text title', () => {
    const filters = transformFiltersData(
      { yearPublished: { 2019: 1, 2018: 1 }, language: {} },
      null,
      LABEL_ORDER,
      'the 2019 report on cats?sort=relevance'
    )
    // integer-like keys come out in ascending order
    expect(byValue(filters, 'yearPublished').items).toEqual([
      { value: 2018, count: 1, checked: false },
      { value: 2019, count: 1, checked: true },
    ])
  })

  test('T-105 c2 @P0 Q-034 `Art` is checked by the query "Article about cats"', () => {
    const filters = transformFiltersData(
      { documentType: { Art: 3, Book: 1 }, language: {} },
      null,
      LABEL_ORDER,
      'Article about cats?sort=relevance'
    )
    expect(byValue(filters, 'documentType').items).toEqual([
      { value: 'Art', count: 3, checked: true },
      { value: 'Book', count: 1, checked: false },
    ])
  })

  test('T-105 c2 @P0 Q-034 the query is the query plus ?sort=..., so a sort name checks an item too', () => {
    const filters = transformFiltersData(
      { publisher: { relevance: 1, recent: 1 }, language: {} },
      null,
      LABEL_ORDER,
      'cats?sort=relevance'
    )
    expect(byValue(filters, 'publisher').items).toEqual([
      { value: 'relevance', count: 1, checked: true },
      { value: 'recent', count: 1, checked: false },
    ])
  })

  test('T-105 c2 @P0 Q-034 non-language items have no code: the text "undefined" in the query checks all of them', () => {
    const filters = transformFiltersData(
      { fieldsOfStudy: { Medicine: 1, Biology: 1 }, language: { en: 1 } },
      null,
      LABEL_ORDER,
      'x"undefined"y?sort=relevance'
    )
    expect(
      byValue(filters, 'fieldsOfStudy').items.map((i) => i.checked)
    ).toEqual([true, true])
    // the language item has a code, so it is not caught by "undefined"
    expect(byValue(filters, 'language').items[0].checked).toBe(false)
  })

  test('T-105 c3 @P0 `en` and `EN` both display as English (duplicate display values); the code is kept; unknown codes stay', () => {
    const filters = transformFiltersData(agg(), null, LABEL_ORDER, QUERY)
    const { items } = byValue(filters, 'language')
    expect(items).toEqual([
      { value: 'English', code: 'en', count: 7, checked: true },
      { value: 'xx', code: 'xx', count: 1, checked: false },
      { value: 'English', code: 'EN', count: 1, checked: false },
    ])
    expect(items.filter((i) => i.value === 'English')).toHaveLength(2)
  })

  test('T-105 c3 @P0 the language lookup lower-cases the code; the checked test uses the code as sent ("en" vs "EN")', () => {
    const filters = transformFiltersData(
      { language: { EN: 1, Tr: 2 } },
      null,
      LABEL_ORDER,
      'q language:"EN"?sort=relevance'
    )
    expect(byValue(filters, 'language').items).toEqual([
      { value: 'English', code: 'EN', count: 1, checked: true },
      { value: 'Turkish', code: 'Tr', count: 2, checked: false },
    ])
  })

  test('T-105 c4 @P0 single and double quotes are stripped from the item values', () => {
    const filters = transformFiltersData(
      {
        fieldsOfStudy: {
          '"Biology"': 2,
          "'Physics'": 1,
          'Nurse "Jr" O\'Brien': 3,
          '""': 1,
        },
        language: {},
      },
      null,
      LABEL_ORDER,
      ''
    )
    expect(byValue(filters, 'fieldsOfStudy').items.map((i) => i.value)).toEqual(
      ['Biology', 'Physics', 'Nurse Jr OBrien', '']
    )
  })

  test('T-105 c4 @P0 the stripped value, not the quoted key, is what the query is matched against', () => {
    const filters = transformFiltersData(
      { fieldsOfStudy: { '"Biology"': 2, '"Chemistry"': 1 }, language: {} },
      null,
      LABEL_ORDER,
      'fieldsOfStudy:"Biology"?sort=relevance'
    )
    expect(byValue(filters, 'fieldsOfStudy').items).toEqual([
      { value: 'Biology', count: 2, checked: true },
      { value: 'Chemistry', count: 1, checked: false },
    ])
  })
})
