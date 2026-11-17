// T-505 (41 F, R-018): getServerSideProps of pages/data-providers/index.jsx
// (the directory page; findings/06 §3.7). F layer: the context ({ query }) is
// built by hand; the route and the query decoding of Next are pinned by T-601
// and the browser tiers (30 §1 rule 6).
//
// The page reads no API: its props come from the baked data/.formap.json,
// which the harness maps to the synthetic copy in test/fixtures/data (the
// first five real rows without a location, then providers 86, 4835, 8 and
// 3354 (TR), e-mails null). MSW is on only to make sure nothing can leave the
// process; the only fetch spy asserts that no request is made at all.
//
// c1 the props: every row normalised, the query forwarded as it is. c2 Q-080:
// the page reads `params.query` while the key of the query string, of the
// schema and of the results filter is `q` (pages/data-providers/index.jsx:36,
// 85), so the title is always "Data providers search"; the page is rendered to
// markup here, the way the server does it, with a stub head manager that
// collects the <title> and <meta> elements.
const React = require('react')
const { renderToString } = require('react-dom/server')
const {
  HeadManagerContext,
} = require('next/dist/shared/lib/head-manager-context.shared-runtime')
const { Header } = require('@oacore/design')

const { setupMsw } = require('../../utils/msw')
const {
  getServerSideProps,
  default: DataProvidersPage,
} = require('../../../pages/data-providers/index')
const { StoreProvider } = require('../../../store')
const RootStore = require('../../../store/root').default
const { createDataProvidersStore } = require('../../../store/data-providers')

setupMsw()

// the harness copy of data/.formap.json (jest.config.js moduleNameMapper)
const formap = require('data/.formap.json')

// [id, name, normalizedName, normalizedInstitutionName]: the diacritics are
// stripped by NFD + removal of the combining marks (a letter such as "ł" has
// no decomposition and stays)
const ROWS = [
  [
    22159,
    'Akademik Platform Helal Yaşam Dergisi',
    'Akademik Platform Helal Yasam Dergisi',
    '',
  ],
  [
    2474,
    'Kultury Wschodniosłowiańskie - Oblicza i Dialog',
    'Kultury Wschodniosłowianskie - Oblicza i Dialog',
    '',
  ],
  [
    2477,
    'Poznańskie Spotkania Językoznawcze',
    'Poznanskie Spotkania Jezykoznawcze',
    '',
  ],
  [
    2478,
    'Poznańskie Studia Polonistyczne. Seria Językoznawcza',
    'Poznanskie Studia Polonistyczne. Seria Jezykoznawcza',
    '',
  ],
  [
    2479,
    'Poznańskie Studia Polonistyczne. Seria Literacka',
    'Poznanskie Studia Polonistyczne. Seria Literacka',
    '',
  ],
  [
    86,
    'Open Research Online (Open University)',
    'Open Research Online (Open University)',
    'The Open University',
  ],
  [
    4835,
    'Aberystwyth Research Portal',
    'Aberystwyth Research Portal',
    'Aberystwyth University',
  ],
  [
    8,
    'Birkbeck Institutional Research Online',
    'Birkbeck Institutional Research Online',
    'Birkbeck, University of London',
  ],
  [3354, '9 Eylül University', '9 Eylul University', ''],
]

let fetchSpy
beforeEach(() => {
  fetchSpy = jest.spyOn(global, 'fetch')
})
afterEach(() => {
  jest.restoreAllMocks()
})

const run = (query = {}) => getServerSideProps({ query })

// the page as the server renders it: markup plus the head elements the page
// hands to next/head. The store is a new one per request (store/index.jsx).
const renderPage = async (query) => {
  const { props } = await run(query)
  const heads = []
  const headManager = {
    mountedInstances: new Set(),
    updateHead: (state) => heads.push(state),
  }
  const store = new RootStore({ statistics: { totalArticlesCount: 5 } })
  const h = React.createElement
  const html = renderToString(
    h(
      HeadManagerContext.Provider,
      { value: headManager },
      h(StoreProvider, { store }, h(DataProvidersPage, props))
    )
  )
  const head = heads[heads.length - 1]
  const element = (type) => head.find((el) => el.type === type)
  return { props, html, head, element, store }
}

// the <title> child: one string since CS-W0b-1 (AD-006; it was an array)
const titleOf = (head) => head.find((el) => el.type === 'title').props.children

describe('T-505 @P1 /data-providers getServerSideProps', () => {
  describe('T-505 c1 @P1 props, formap fixture', () => {
    test('T-505 c1 @P1 the harness copy of the formap holds the nine rows the props are built from', () => {
      expect(formap.map((row) => row.id)).toEqual(ROWS.map(([id]) => id))
      expect(formap.map((row) => row.name)).toEqual(ROWS.map(([, n]) => n))
    })

    test('T-505 c1 @P1 without a query: { props: { initialState: { dataProviders: { data, params } } } } and nothing else', async () => {
      const result = await run()
      expect(Object.keys(result)).toEqual(['props'])
      expect(Object.keys(result.props)).toEqual(['initialState'])
      expect(Object.keys(result.props.initialState)).toEqual(['dataProviders'])
      const { dataProviders } = result.props.initialState
      expect(Object.keys(dataProviders)).toEqual(['data', 'params'])
      // an empty query gives empty params (the schema defaults are the
      // store's, not the gSSP's)
      expect(dataProviders.params).toStrictEqual({})
      // no redirect, no notFound, no revalidate
      expect(result).not.toHaveProperty('redirect')
      expect(result).not.toHaveProperty('notFound')
    })

    test('T-505 c1 @P1 data: the nine rows in file order, each the row plus normalizedName and normalizedInstitutionName', async () => {
      const {
        props: {
          initialState: {
            dataProviders: { data },
          },
        },
      } = await run()
      expect(data).toHaveLength(9)
      data.forEach((row, i) => {
        const [id, name, normalizedName, normalizedInstitutionName] = ROWS[i]
        expect(row).toEqual({
          ...formap[i],
          normalizedName,
          normalizedInstitutionName,
        })
        expect(row.id).toBe(id)
        expect(row.name).toBe(name)
        // the added keys come last, name first (06 §3.7)
        expect(Object.keys(row).slice(-2)).toEqual([
          'normalizedName',
          'normalizedInstitutionName',
        ])
      })
      // the rows keep their own fields untouched: nulls stay null, the
      // institution of the first rows stays null or ''
      expect(data[0].institutionName).toBeNull()
      expect(data[1].institutionName).toBe('')
      expect(data[0].normalizedInstitutionName).toBe('')
      expect(data[8].dataProviderLocation.countryCode).toBe('TR')
    })

    test('T-505 c1 @P1 the e-mail of every row is null (the fixture holds no address) and no row has a location besides 86, 4835, 8 and 3354', async () => {
      const {
        props: {
          initialState: {
            dataProviders: { data },
          },
        },
      } = await run()
      expect(data.map((row) => row.email)).toEqual(Array(9).fill(null))
      expect(
        data.filter((row) => row.dataProviderLocation).map((row) => row.id)
      ).toEqual([86, 4835, 8, 3354])
    })

    test('T-505 c1 @P1 the query is forwarded as it is, minus null and undefined values; keys outside the schema pass through', async () => {
      const table = [
        [{ q: 'research' }, { q: 'research' }],
        [{ q: '' }, { q: '' }],
        [{ q: 'a b' }, { q: 'a b' }],
        [{ size: '20' }, { size: '20' }],
        [{ action: 'ADD' }, { action: 'ADD' }],
        [
          { q: 'x', size: '30', action: 'ADD' },
          { q: 'x', size: '30', action: 'ADD' },
        ],
        // no validation here: the store converts and validates (Params)
        [
          { size: 'abc', action: 'DROP' },
          { size: 'abc', action: 'DROP' },
        ],
        [{ q: ['a', 'b'] }, { q: ['a', 'b'] }],
        // keys the schema does not know are not removed by the gSSP
        [
          { query: 'x', dataProviderUrl: 'https://a.example.org/' },
          { query: 'x', dataProviderUrl: 'https://a.example.org/' },
        ],
        [{ q: undefined, size: null, action: 'ADD' }, { action: 'ADD' }],
        [{ q: null }, {}],
      ]
      for (const [query, expected] of table) {
        // eslint-disable-next-line no-await-in-loop
        const result = await run(query)
        const { params } = result.props.initialState.dataProviders
        expect(params).toStrictEqual(expected)
      }
    })

    test('T-505 c1 @P1 the props are plain JSON and a request makes no API call', async () => {
      const result = await run({ q: 'x' })
      expect(JSON.parse(JSON.stringify(result))).toEqual(result)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    test('T-505 c1 @P1 every call builds its own rows: nothing from one request is shared with the next', async () => {
      const a = (await run()).props.initialState.dataProviders
      const b = (await run()).props.initialState.dataProviders
      expect(a).toEqual(b)
      expect(a.data).not.toBe(b.data)
      expect(a.data[0]).not.toBe(b.data[0])
      expect(a.params).not.toBe(b.params)
      // mutating one answer does not reach the baked file or the next call
      a.data[0].name = 'changed'
      a.data.pop()
      const c = (await run()).props.initialState.dataProviders
      expect(c.data).toHaveLength(9)
      expect(c.data[0].name).toBe(ROWS[0][1])
      expect(formap[0].name).toBe(ROWS[0][1])
    })
  })

  describe('T-505 c2 @P1 Q-080 the page reads params.query, the key is q', () => {
    test('T-505 c2 @P1 Q-080 the store keeps q, size and action; query is not in its schema and never reaches the page', async () => {
      const { props } = await run({
        q: 'Eylul',
        query: 'Eylul',
        size: '20',
        action: 'ADD',
      })
      // the gSSP forwards both keys ...
      expect(props.initialState.dataProviders.params).toEqual({
        q: 'Eylul',
        query: 'Eylul',
        size: '20',
        action: 'ADD',
      })
      // ... the store keeps only the schema keys, converted
      const store = createDataProvidersStore(props.initialState.dataProviders)
      expect(store.params.q).toBe('Eylul')
      expect(store.params.size).toBe(20)
      expect(store.params.action).toBe('ADD')
      expect(store.params.query).toBeUndefined()
      expect(Object.keys(store.params).sort()).toEqual([
        'action',
        'q',
        'schema',
        'size',
      ])
      // q drives the results (normalized name, case-insensitive)
      expect(
        store.selectResults(store.getState()).map((row) => row.id)
      ).toEqual([3354])
    })

    test('T-505 c2 @P1 Q-080 ?query= alone leaves q empty: the store lists all nine rows', async () => {
      const { props } = await run({ query: 'Eylul' })
      const store = createDataProvidersStore(props.initialState.dataProviders)
      expect(store.params.q).toBe('')
      expect(store.params.query).toBeUndefined()
      expect(store.selectResults(store.getState())).toHaveLength(9)
    })

    test('T-505 c2 @P1 Q-080 the server-rendered title is "Data providers search" whatever the query, q included', async () => {
      const without = await renderPage({})
      const withQ = await renderPage({ q: 'Eylul' })
      const withNoMatch = await renderPage({ q: 'zzzzqqq' })
      const withQuery = await renderPage({ query: 'Eylul' })
      for (const page of [without, withQ, withNoMatch, withQuery]) {
        expect(titleOf(page.head)).toBe('Data providers search')
        // the title is rendered as the one string 'Data providers search'
        // (CS-W0b-1, AD-006; it was ['', 'Data providers search']): the
        // prefix is empty because `query` is undefined
        expect(
          page.head.find((el) => el.type === 'title').props.children
        ).toStrictEqual('Data providers search')
      }
    })

    test('T-505 c2 @P1 Q-080 q does filter what the page lists, so the missing title is the page, not the filter', async () => {
      const all = await renderPage({})
      const byQ = await renderPage({ q: 'Eylul' })
      const byQuery = await renderPage({ query: 'Eylul' })
      const none = await renderPage({ q: 'zzzzqqq' })

      expect(all.html).toContain('Aberystwyth Research Portal')
      expect(all.html).toContain('9 Eylül University')
      // q = Eylul: one row; the others are gone
      expect(byQ.html).toContain('9 Eylül University')
      expect(byQ.html).not.toContain('Aberystwyth Research Portal')
      // query = Eylul: ignored, the whole list
      expect(byQuery.html).toContain('Aberystwyth Research Portal')
      expect(byQuery.html).toContain('9 Eylül University')
      // q without a match: the "mistake" text and the form hint
      expect(none.html).toContain('Is there a mistake?')
      expect(none.html).not.toContain('9 Eylül University')
    })

    test('T-505 c2 @P1 Q-080 the header search is configured with no initial query, whatever q is: the header input starts empty', async () => {
      const spy = jest.spyOn(Header, 'useSearchBar')
      for (const query of [{}, { q: 'Eylul' }, { query: 'Eylul' }]) {
        spy.mockClear()
        // eslint-disable-next-line no-await-in-loop
        await renderPage(query)
        expect(spy).toHaveBeenCalledTimes(1)
        const [config, options] = spy.mock.calls[0]
        // the template hands `params.query` (never set) to the bar
        expect(config.initQuery).toBeUndefined()
        expect(Object.keys(config).sort()).toEqual([
          'getSuggestions',
          'initQuery',
          'onQueryChanged',
          'searchBarProps',
        ])
        expect(config.searchBarProps).toEqual({
          label: 'Search data providers',
          placeholder: 'e.g. repository or journal name',
          prependIcon: '#magnify',
        })
        expect(options).toEqual({ isHidden: false })
      }
    })

    test('T-505 c2 @P1 Q-080 the description counts all rows, not the results of q', async () => {
      for (const query of [{}, { q: 'Eylul' }, { q: 'zzzzqqq' }]) {
        // eslint-disable-next-line no-await-in-loop
        const page = await renderPage(query)
        const meta = page.head.find(
          (el) => el.type === 'meta' && el.props.name === 'description'
        )
        expect(meta.props.content).toBe(
          'Search over 9 repositories and journals around the world'
        )
      }
    })
  })
})
