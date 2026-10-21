// T-303 (41 D): usePagination, findings/06 §3.6 and findings/03 §4. c1 is the
// 06 table plus the grid computed from the current implementation (pageSize
// 10; totalCount 10, 100, 1000, 20000 = 1, 10, 100 and 2000 pages capped at
// 1000; pages 1, 4, 5, 50, 996, 1000; sibling counts 0 and 2). c2 is Q-039:
// a NaN page or an undefined size gives `undefined` (the Pagination component
// then reads `.length` of it, T-406). Strings below are the range joined by
// spaces; "..." is DOTS.
const { renderHook } = require('../../utils/render')
const { usePagination, DOTS } = require('../../../hooks/use-pagination')

const range = ({ totalCount, pageSize, siblingCount, currentPage }) => {
  const { result } = renderHook(usePagination, {
    initialProps: { totalCount, pageSize, siblingCount, currentPage },
  })
  return result.current
}
const text = (value) => (value === undefined ? 'undefined' : value.join(' '))

// "<totalCount>|<currentPage>|<siblingCount>|<range>"
const GRID = `
    10|1|0|1
    10|1|2|1
    10|4|0|1
    10|4|2|1
    10|5|0|1
    10|5|2|1
    10|50|0|1
    10|50|2|1
    10|996|0|1
    10|996|2|1
    10|1000|0|1
    10|1000|2|1
    100|1|0|1 2 3 ... 10
    100|1|2|1 2 3 4 5 6 7 ... 10
    100|4|0|1 ... 4 ... 10
    100|4|2|1 2 3 4 5 6 7 ... 10
    100|5|0|1 ... 5 ... 10
    100|5|2|1 ... 3 4 5 6 7 ... 10
    100|50|0|1 ... 8 9 10
    100|50|2|1 ... 4 5 6 7 8 9 10
    100|996|0|1 ... 8 9 10
    100|996|2|1 ... 4 5 6 7 8 9 10
    100|1000|0|1 ... 8 9 10
    100|1000|2|1 ... 4 5 6 7 8 9 10
    1000|1|0|1 2 3 ... 100
    1000|1|2|1 2 3 4 5 6 7 ... 100
    1000|4|0|1 ... 4 ... 100
    1000|4|2|1 2 3 4 5 6 7 ... 100
    1000|5|0|1 ... 5 ... 100
    1000|5|2|1 ... 3 4 5 6 7 ... 100
    1000|50|0|1 ... 50 ... 100
    1000|50|2|1 ... 48 49 50 51 52 ... 100
    1000|996|0|1 ... 98 99 100
    1000|996|2|1 ... 94 95 96 97 98 99 100
    1000|1000|0|1 ... 98 99 100
    1000|1000|2|1 ... 94 95 96 97 98 99 100
    20000|1|0|1 2 3 ... 1000
    20000|1|2|1 2 3 4 5 6 7 ... 1000
    20000|4|0|1 ... 4 ... 1000
    20000|4|2|1 2 3 4 5 6 7 ... 1000
    20000|5|0|1 ... 5 ... 1000
    20000|5|2|1 ... 3 4 5 6 7 ... 1000
    20000|50|0|1 ... 50 ... 1000
    20000|50|2|1 ... 48 49 50 51 52 ... 1000
    20000|996|0|1 ... 996 ... 1000
    20000|996|2|1 ... 994 995 996 997 998 ... 1000
    20000|1000|0|1 ... 998 999 1000
    20000|1000|2|1 ... 994 995 996 997 998 999 1000
`
  .trim()
  .split('\n')
  .map((line) => line.trim().split('|'))

describe('T-303 @P0 usePagination', () => {
  test('T-303 c1 @P0 the 06 §3.6 table', () => {
    expect(DOTS).toBe('...')
    const cases = [
      // [totalCount, pageSize, siblingCount, currentPage, range]
      [0, 10, 2, 1, '1'],
      [5, 10, 2, 1, '1'],
      [95, 10, 2, 1, '1 2 3 4 5 6 7 ... 10'],
      [1000, 10, 2, 5, '1 ... 3 4 5 6 7 ... 100'],
      [1000, 10, 2, 50, '1 ... 48 49 50 51 52 ... 100'],
      [1000, 10, 2, 98, '1 ... 94 95 96 97 98 99 100'],
      [1000, 10, 0, 50, '1 ... 50 ... 100'],
      // capped at 1000 pages
      [1e9, 10, 2, 1000, '1 ... 994 995 996 997 998 999 1000'],
      [1e9, 10, 2, 1001, '1 ... 994 995 996 997 998 999 1000'],
      // page size 0: Infinity pages, capped
      [1000, 0, 2, 1, '1 2 3 4 5 6 7 ... 1000'],
    ]
    for (const [
      totalCount,
      pageSize,
      siblingCount,
      currentPage,
      expected,
    ] of cases) {
      expect([
        totalCount,
        pageSize,
        siblingCount,
        currentPage,
        text(range({ totalCount, pageSize, siblingCount, currentPage })),
      ]).toEqual([totalCount, pageSize, siblingCount, currentPage, expected])
    }

    // the range is an array of numbers and the DOTS string
    const sample = range({
      totalCount: 1000,
      pageSize: 10,
      siblingCount: 2,
      currentPage: 50,
    })
    expect(sample).toEqual([1, DOTS, 48, 49, 50, 51, 52, DOTS, 100])
    // the dots can hide a single page: page 5 of 10 hides only page 2
    expect(
      range({ totalCount: 100, pageSize: 10, siblingCount: 2, currentPage: 5 })
    ).toEqual([1, DOTS, 3, 4, 5, 6, 7, DOTS, 10])

    // a numeric string for the current page gives the number's range; below 1
    // behaves like page 1, above the last page like the last
    const base = { totalCount: 1000, pageSize: 10, siblingCount: 2 }
    expect(range({ ...base, currentPage: '5' })).toEqual(
      range({ ...base, currentPage: 5 })
    )
    expect(text(range({ ...base, currentPage: 0 }))).toBe(
      '1 2 3 4 5 6 7 ... 100'
    )
    expect(text(range({ ...base, currentPage: -3 }))).toBe(
      '1 2 3 4 5 6 7 ... 100'
    )
    expect(text(range({ ...base, currentPage: 101 }))).toBe(
      '1 ... 94 95 96 97 98 99 100'
    )
    // siblingCount defaults to 2
    expect(
      range({ ...base, siblingCount: undefined, currentPage: 50 })
    ).toEqual(range({ ...base, currentPage: 50 }))
    // another sibling count: the same rules
    expect(
      text(
        range({ totalCount: 90, pageSize: 10, siblingCount: 1, currentPage: 4 })
      )
    ).toBe('1 ... 3 4 5 ... 9')
    expect(
      text(
        range({ totalCount: 70, pageSize: 10, siblingCount: 1, currentPage: 1 })
      )
    ).toBe('1 2 3 4 5 ... 7')

    // the same props give the same array (useMemo)
    const view = renderHook(usePagination, {
      initialProps: { ...base, currentPage: 50 },
    })
    const first = view.result.current
    view.rerender({ ...base, currentPage: 50 })
    expect(view.result.current).toBe(first)
    view.rerender({ ...base, currentPage: 51 })
    expect(view.result.current).not.toBe(first)

    // the grid
    expect(GRID).toHaveLength(48)
    for (const [totalCount, currentPage, siblingCount, expected] of GRID) {
      expect([
        totalCount,
        currentPage,
        siblingCount,
        text(
          range({
            totalCount: Number(totalCount),
            pageSize: 10,
            siblingCount: Number(siblingCount),
            currentPage: Number(currentPage),
          })
        ),
      ]).toEqual([totalCount, currentPage, siblingCount, expected])
    }
  })

  test('T-303 c2 @P0 Q-039 a NaN page or an undefined size gives undefined', () => {
    const base = {
      totalCount: 1000,
      pageSize: 10,
      siblingCount: 2,
      currentPage: 1,
    }
    expect(range(base)).toBeDefined()
    expect(range({ ...base, currentPage: NaN })).toBeUndefined()
    expect(range({ ...base, currentPage: undefined })).toBeUndefined()
    expect(range({ ...base, currentPage: 'abc' })).toBeUndefined()
    expect(range({ ...base, pageSize: undefined })).toBeUndefined()
    expect(range({ ...base, totalCount: undefined })).toBeUndefined()
    // no branch matches when both dots are hidden although there are more
    // pages than the window: reachable with a sibling count of 3
    expect(
      range({ totalCount: 90, pageSize: 10, siblingCount: 3, currentPage: 5 })
    ).toBeUndefined()
  })
})
