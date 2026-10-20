// T-301 (41 D, R-018): useDebouncedEffect, findings/03 §4: synchronous first run, 250 ms trailing
// coalesce with the latest closure, unmount cancels. No StrictMode case (41 Corr, 40 §7 rule 5).
const { renderHook } = require('../../utils/render')
const { useFakeTimers, restoreClock } = require('../../utils/clock')
const useDebouncedEffect = require('../../../hooks/use-debounced-effect').default

describe('T-301 @P0 useDebouncedEffect', () => {
  beforeEach(() => useFakeTimers())
  afterEach(() => restoreClock())

  test('T-301 @P0 first run is synchronous, changes coalesce after 250 ms, unmount cancels', () => {
    const calls = []
    const { rerender, unmount } = renderHook(({ q }) => useDebouncedEffect(() => calls.push(q), [q]), { initialProps: { q: 'a' } })
    // mount: called once, synchronously, with the first closure
    expect(calls).toEqual(['a'])

    // two changes within 250 ms: one trailing call with the latest closure
    rerender({ q: 'b' })
    jest.advanceTimersByTime(100)
    rerender({ q: 'c' })
    jest.advanceTimersByTime(249)
    expect(calls).toEqual(['a'])
    jest.advanceTimersByTime(1)
    expect(calls).toEqual(['a', 'c'])

    // same deps: no new run
    rerender({ q: 'c' })
    jest.advanceTimersByTime(1000)
    expect(calls).toEqual(['a', 'c'])

    // unmount before the delay: never called
    rerender({ q: 'd' })
    jest.advanceTimersByTime(200)
    unmount()
    jest.advanceTimersByTime(1000)
    expect(calls).toEqual(['a', 'c'])
  })

  test('T-301 @P0 a delay change re-arms the timer with the new delay', () => {
    const calls = []
    const { rerender } = renderHook(({ q, delay }) => useDebouncedEffect(() => calls.push(`${q}@${delay}`), [q], delay), { initialProps: { q: 'a', delay: 250 } })
    expect(calls).toEqual(['a@250'])
    rerender({ q: 'a', delay: 500 })
    jest.advanceTimersByTime(499)
    expect(calls).toEqual(['a@250'])
    jest.advanceTimersByTime(1)
    expect(calls).toEqual(['a@250', 'a@500'])
  })
})
