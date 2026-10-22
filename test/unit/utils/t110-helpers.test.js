// T-110 (41 B, R-002, R-021): utils/helpers.js (getAssetsPath, rewriteDataPath,
// findUrlsByType; findings/06 §3.6) and utils/sort.js (findings/06 §3.1).
// Pins today's behaviour, quirks included: the target defaults are read at call
// time, findUrlsByType mutates its argument and the first link of a type wins,
// and the sort helpers mutate and return their input. sortItemsByNumberAsc
// (a comparator that is always positive: engine-dependent, unused) and the
// ICU-dependent accent cases of sortItemsByAlphabet are not pinned (06 §3.1).
const {
  getAssetsPath,
  rewriteDataPath,
  findUrlsByType,
} = require('../../../utils/helpers')
const sort = require('../../../utils/sort')

// undefined = variable absent
const withEnv = (vars, fn) => {
  const saved = {}
  Object.keys(vars).forEach((key) => {
    saved[key] = process.env[key]
    if (vars[key] === undefined) delete process.env[key]
    else process.env[key] = vars[key]
  })
  try {
    return fn()
  } finally {
    Object.keys(saved).forEach((key) => {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    })
  }
}

describe('T-110 @P1 helpers and sort (findings/06 §3.6, §3.1)', () => {
  describe('c1 getAssetsPath and rewriteDataPath (utils/helpers.js:1-25)', () => {
    test('T-110 c1 @P1 getAssetsPath without BUILD_TARGET returns the path unchanged, "/" by default', () => {
      withEnv({ BUILD_TARGET: undefined }, () => {
        expect(getAssetsPath()).toBe('/')
        expect(getAssetsPath('/x.png')).toBe('/x.png')
        expect(getAssetsPath('')).toBe('')
        expect(getAssetsPath('/_next/static/')).toBe('/_next/static/')
      })
    })

    test('T-110 c1 @P1 getAssetsPath with the azure target prefixes /static/search (explicit target)', () => {
      expect(getAssetsPath('/x', 'azure')).toBe('/static/search/x')
      // the default path is "/"; an explicit empty path stays empty
      expect(getAssetsPath(undefined, 'azure')).toBe('/static/search/')
      expect(getAssetsPath('', 'azure')).toBe('/static/search')
      expect(getAssetsPath('/images/a.png', 'azure')).toBe(
        '/static/search/images/a.png'
      )
    })

    test('T-110 c1 @P1 getAssetsPath treats every other target as "no prefix", case-sensitively', () => {
      expect(getAssetsPath('/x', '')).toBe('/x')
      expect(getAssetsPath('/x', 'Azure')).toBe('/x')
      expect(getAssetsPath('/x', 'AZURE')).toBe('/x')
      expect(getAssetsPath('/x', 'aws')).toBe('/x')
      expect(getAssetsPath('/x', 'local')).toBe('/x')
    })

    test('T-110 c1 @P1 getAssetsPath reads BUILD_TARGET at call time; an explicit target wins over it', () => {
      withEnv({ BUILD_TARGET: 'azure' }, () => {
        expect(getAssetsPath('/icons.svg')).toBe('/static/search/icons.svg')
        expect(getAssetsPath()).toBe('/static/search/')
        expect(getAssetsPath('/icons.svg', '')).toBe('/icons.svg')
        expect(getAssetsPath('/icons.svg', 'other')).toBe('/icons.svg')
      })
      withEnv({ BUILD_TARGET: 'other' }, () => {
        expect(getAssetsPath('/icons.svg')).toBe('/icons.svg')
        expect(getAssetsPath('/icons.svg', 'azure')).toBe(
          '/static/search/icons.svg'
        )
      })
      withEnv({ BUILD_TARGET: '' }, () => {
        expect(getAssetsPath('/icons.svg')).toBe('/icons.svg')
      })
    })

    test('T-110 c1 @P1 rewriteDataPath: production prefixes the source with /search, the destination stays', () => {
      const rewrite = rewriteDataPath(undefined, 'production')
      expect(rewrite).toEqual({
        source: '/search/_next/data/:path*',
        destination: '/_next/data/:path*',
      })
      // key order is part of the routes-manifest bytes (T-010)
      expect(Object.keys(rewrite)).toEqual(['destination', 'source'])
      expect(rewriteDataPath('/x/:y', 'production')).toEqual({
        source: '/search/x/:y',
        destination: '/x/:y',
      })
    })

    test('T-110 c1 @P1 rewriteDataPath: every other target maps the source to the destination', () => {
      ;[
        'development',
        'test',
        '',
        'staging',
        'Production',
        'PRODUCTION',
      ].forEach((target) => {
        const rewrite = rewriteDataPath(undefined, target)
        expect(rewrite).toEqual({
          source: '/_next/data/:path*',
          destination: '/_next/data/:path*',
        })
        expect(Object.keys(rewrite)).toEqual(['destination', 'source'])
      })
      expect(rewriteDataPath('/x/:y', 'development')).toEqual({
        source: '/x/:y',
        destination: '/x/:y',
      })
    })

    test('T-110 c1 @P1 rewriteDataPath reads NODE_ENV at call time (Jest runs with test)', () => {
      expect(process.env.NODE_ENV).toBe('test')
      expect(rewriteDataPath()).toEqual({
        source: '/_next/data/:path*',
        destination: '/_next/data/:path*',
      })
      withEnv({ NODE_ENV: 'production' }, () => {
        expect(rewriteDataPath()).toEqual({
          source: '/search/_next/data/:path*',
          destination: '/_next/data/:path*',
        })
      })
      withEnv({ NODE_ENV: undefined }, () => {
        expect(rewriteDataPath()).toEqual({
          source: '/_next/data/:path*',
          destination: '/_next/data/:path*',
        })
      })
      expect(process.env.NODE_ENV).toBe('test')
    })
  })

  describe('c2 findUrlsByType (utils/helpers.js:54-61)', () => {
    const links = () => [
      { type: 'download', url: 'https://d.example/1' },
      { type: 'reader', url: 'https://r.example/1' },
      { type: 'download', url: 'https://d.example/2' },
      { type: 'display', url: 'https://s.example/1' },
      { type: 'download', url: 'https://d.example/3' },
    ]

    test('T-110 c2 @P1 findUrlsByType sets one property per link type; the first link of a type wins', () => {
      const article = { id: 7, links: links() }
      findUrlsByType(article)
      expect(article.download).toBe('https://d.example/1')
      expect(article.reader).toBe('https://r.example/1')
      expect(article.display).toBe('https://s.example/1')
    })

    test('T-110 c2 @P1 findUrlsByType mutates and returns the same object; links and other fields are untouched', () => {
      const article = { id: 7, title: 'T', links: links() }
      const result = findUrlsByType(article)
      expect(result).toBe(article)
      expect(article.links).toEqual(links())
      expect(article.id).toBe(7)
      expect(article.title).toBe('T')
      expect(Object.keys(article)).toEqual([
        'id',
        'title',
        'links',
        'download',
        'reader',
        'display',
      ])
    })

    test('T-110 c2 @P1 findUrlsByType with no links changes nothing; a missing links array is a TypeError', () => {
      const article = { id: 1, links: [] }
      expect(findUrlsByType(article)).toBe(article)
      expect(article).toEqual({ id: 1, links: [] })
      expect(() => findUrlsByType({ id: 1 })).toThrow(TypeError)
      expect(() => findUrlsByType({ id: 1, links: null })).toThrow(TypeError)
    })

    test('T-110 c2 @P1 findUrlsByType overwrites an existing property of the same name as a link type', () => {
      const article = {
        reader: 'old',
        links: [{ type: 'reader', url: 'https://r.example/new' }],
      }
      findUrlsByType(article)
      expect(article.reader).toBe('https://r.example/new')
    })

    test('T-110 c2 @P1 findUrlsByType keeps an empty or missing url of the first link (no skipping)', () => {
      const article = {
        links: [
          { type: 'download', url: '' },
          { type: 'download', url: 'https://d.example/2' },
          { type: 'reader' },
        ],
      }
      findUrlsByType(article)
      expect(article.download).toBe('')
      expect(article).toHaveProperty('reader', undefined)
    })
  })

  describe('c3 utils/sort.js (findings/06 §3.1)', () => {
    const ids = (list) => list.map((item) => item.id)

    test('T-110 c3 @P1 changeIndex moves one element; the input is mutated and returned', () => {
      const input = [1, 2, 3, 4]
      const result = sort.changeIndex(input, 3, 0)
      expect(result).toBe(input)
      expect(input).toEqual([4, 1, 2, 3])
      expect(sort.changeIndex([1, 2, 3, 4], 0, 3)).toEqual([2, 3, 4, 1])
      expect(sort.changeIndex([1, 2, 3, 4], 1, 1)).toEqual([1, 2, 3, 4])
      expect(sort.changeIndex(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b'])
    })

    test('T-110 c3 @P1 sortItemsByNumberDesc sorts by b-a, stable for equal keys; mutates and returns the input', () => {
      const input = [
        { id: 'a', n: 1 },
        { id: 'b', n: 2 },
        { id: 'c', n: 1 },
      ]
      const result = sort.sortItemsByNumberDesc(input, 'n')
      expect(result).toBe(input)
      expect(ids(input)).toEqual(['b', 'a', 'c'])
      expect(
        ids(
          sort.sortItemsByNumberDesc(
            [
              { id: 1, n: 5 },
              { id: 2, n: 9 },
              { id: 3, n: 5 },
              { id: 4, n: 9 },
              { id: 5, n: 0 },
            ],
            'n'
          )
        )
      ).toEqual([2, 4, 1, 3, 5])
    })

    test('T-110 c3 @P1 sortItemsByBoolean puts truthy values first; false and a missing key stay behind', () => {
      const input = [
        { id: 1, flag: false },
        { id: 2, flag: true },
        { id: 3 },
        { id: 4, flag: true },
      ]
      const result = sort.sortItemsByBoolean(input, 'flag')
      expect(result).toBe(input)
      expect(ids(input)).toEqual([2, 4, 1, 3])
    })

    test('T-110 c3 @P1 sortItemsByAlphabet orders plain lower-case ASCII keys with localeCompare', () => {
      // accents and case mixes are ICU-dependent (06 §3.1): not pinned
      const input = [{ k: 'pear' }, { k: 'apple' }, { k: 'fig' }, { k: 'date' }]
      const result = sort.sortItemsByAlphabet(input, 'k')
      expect(result).toBe(input)
      expect(input.map((item) => item.k)).toEqual([
        'apple',
        'date',
        'fig',
        'pear',
      ])
    })

    test('T-110 c3 @P1 sortItemsByValueIndex sorts by the position in the order list; unknown keys (-1) sort first', () => {
      const input = [
        { id: 1, k: 'b' },
        { id: 2, k: 'x' },
        { id: 3, k: 'a' },
        { id: 4, k: 'c' },
      ]
      const result = sort.sortItemsByValueIndex(input, ['c', 'a', 'b'], 'k')
      expect(result).toBe(input)
      expect(ids(input)).toEqual([2, 4, 3, 1])
    })

    test('T-110 c3 @P1 setItemFirst moves the "unknown" filter value to index 0 and returns undefined', () => {
      const input = [{ value: 'x' }, { value: 'unknown' }, { value: 'y' }]
      expect(sort.setItemFirst(input)).toBeUndefined()
      expect(input.map((item) => item.value)).toEqual(['unknown', 'x', 'y'])

      const first = [{ value: 'unknown' }, { value: 'x' }]
      sort.setItemFirst(first)
      expect(first.map((item) => item.value)).toEqual(['unknown', 'x'])

      const none = [{ value: 'x' }, { value: 'Unknown' }, { value: 'y' }]
      sort.setItemFirst(none)
      expect(none.map((item) => item.value)).toEqual(['x', 'Unknown', 'y'])

      const empty = []
      expect(sort.setItemFirst(empty)).toBeUndefined()
      expect(empty).toEqual([])
    })
  })
})
