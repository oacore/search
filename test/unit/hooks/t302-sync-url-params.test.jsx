// T-302 (41 D, R-018): useSyncUrlParamsWithStore, findings/03 §3.3 and §4.
// The first sync of an empty search replaces, later syncs push, both shallow
// and with the params sorted by key; an equal URL does nothing;
// routeChangeComplete copies the URL's keys that differ into the store
// (size becomes a number). Q-048.U1: a URL without `q` leaves the old `q` in
// the store and the next store-to-URL sync pushes it again. The hook is run
// the way /data-providers runs it: the params of a data-providers store, the
// router mock, window.location moved with history.replaceState.
const nextRouter = require('next/router')

const { act, renderHook } = require('../../utils/render')
const { useFakeTimers, restoreClock } = require('../../utils/clock')
const { createDataProvidersStore } = require('../../../store/data-providers')
const {
  useSyncUrlParamsWithStore,
} = require('../../../hooks/use-sync-url-params-with-store')

const { router } = nextRouter

// the params object of a data-providers store (the page hands it to the hook)
const paramsOf = (params) =>
  createDataProvidersStore({ data: [], params }).params
const browserAt = (url) => window.history.replaceState(null, '', url)
const mount = (params) => renderHook(() => useSyncUrlParamsWithStore(params))
// the page is an observer: it re-renders when a param changes
const change = (view, params, patch) => {
  act(() => {
    params.changeParams(patch)
  })
  view.rerender()
}
const wait = (ms) =>
  act(() => {
    jest.advanceTimersByTime(ms)
  })

describe('T-302 @P0 useSyncUrlParamsWithStore', () => {
  beforeEach(() => {
    useFakeTimers()
    nextRouter.setRouter({
      asPath: '/data-providers/',
      pathname: '/data-providers',
      query: {},
    })
    browserAt('/')
  })
  afterEach(() => {
    browserAt('/')
    restoreClock()
  })

  test('T-302 c1 @P0 the first sync replaces with the sorted params, shallow', () => {
    // action sorts before q before size; null params are left out
    const params = paramsOf({ q: 'open univ', size: '20', action: 'ADD' })
    const view = mount(params)

    expect(router.push).not.toHaveBeenCalled()
    expect(router.replace).toHaveBeenCalledTimes(1)
    const [url, as, options] = router.replace.mock.calls[0]
    expect(url.pathname).toBe('/data-providers')
    // `...urlParams` spreads a URLSearchParams: no string key is added (jsdom
    // adds symbol keys of its own, so only string keys are compared)
    expect(Object.keys(url.query)).toEqual([])
    expect(as).toBe('/data-providers/?action=ADD&q=open+univ&size=20')
    expect(options).toEqual({ shallow: true })
    // the router query is carried over
    view.unmount()
    nextRouter.setRouter({ query: { source: 'nav' } })
    router.replace.mockClear()
    mount(paramsOf({}))
    expect(Object.keys(router.replace.mock.calls[0][0].query)).toEqual([
      'source',
    ])
    expect(router.replace.mock.calls[0][0].query.source).toBe('nav')
    expect(router.replace.mock.calls[0][1]).toBe('/data-providers/?q=&size=10')

    // a browser URL that already equals the computed one: no call
    router.replace.mockClear()
    browserAt('/data-providers/?q=&size=10')
    mount(paramsOf({}))
    expect(router.replace).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })

  test('T-302 c1 @P0 later syncs push after 250 ms, coalesced, and an equal URL does nothing', () => {
    browserAt('/data-providers/?q=&size=10')
    const params = paramsOf({})
    const view = mount(params)
    expect(router.replace).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()

    // two changes inside the delay: one push with the latest values
    change(view, params, { q: 'a', action: 'ADD' })
    wait(100)
    change(view, params, { q: 'ab' })
    wait(249)
    expect(router.push).not.toHaveBeenCalled()
    wait(1)
    expect(router.replace).not.toHaveBeenCalled()
    expect(router.push).toHaveBeenCalledTimes(1)
    const [url, as, options] = router.push.mock.calls[0]
    expect(url.pathname).toBe('/data-providers')
    expect(as).toBe('/data-providers/?action=ADD&q=ab&size=10')
    expect(options).toEqual({ shallow: true })

    // the browser follows the push; going away and back to the same values
    // inside the delay computes the URL the browser is on: nothing is pushed
    router.push.mockClear()
    browserAt('/data-providers/?action=ADD&q=ab&size=10')
    change(view, params, { q: 'abc' })
    wait(100)
    change(view, params, { q: 'ab' })
    wait(1000)
    expect(router.push).not.toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()
  })

  test('T-302 c1 @P0 routeChangeComplete copies the differing keys into the store (size becomes a number)', () => {
    browserAt('/data-providers/?q=x&size=10')
    nextRouter.setRouter({ asPath: '/data-providers/?q=x&size=10' })
    const params = paramsOf({ q: 'x' })
    const view = mount(params)
    expect(router.replace).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
    expect(router.events.all.routeChangeComplete).toHaveLength(1)

    browserAt('/data-providers/?q=x&size=20')
    act(() => {
      router.events.emit('routeChangeComplete', '/data-providers/?q=x&size=20')
    })
    expect(params.size).toBe(20)
    expect(params.q).toBe('x')
    view.rerender()
    // the loop ends: the URL equals the one the store computes
    wait(1000)
    expect(router.push).not.toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()

    // a value equal to the store's (loose compare of "20" and 20): nothing
    act(() => {
      router.events.emit('routeChangeComplete', '/data-providers/?q=x&size=20')
    })
    expect(params.size).toBe(20)

    // keys outside the schema are ignored, invalid values fall back to the
    // schema default
    act(() => {
      router.events.emit(
        'routeChangeComplete',
        '/data-providers/?foo=bar&size=abc&action=add'
      )
    })
    expect('foo' in params).toBe(false)
    expect(params.size).toBe(10)
    expect(params.action).toBeNull()
    expect(params.q).toBe('x')

    // unmount removes the subscription
    view.unmount()
    expect(router.events.all.routeChangeComplete).toEqual([])
  })

  test('T-302 c2 @P0 Q-048.U1 Back to a URL without q keeps the old q and the next sync pushes it again', () => {
    browserAt('/data-providers/?q=old&size=20')
    nextRouter.setRouter({ asPath: '/data-providers/?q=old&size=20' })
    const params = paramsOf({ q: 'old', size: 20 })
    const view = mount(params)
    expect(router.replace).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()

    // Back: the browser is on a URL with size only
    browserAt('/data-providers/?size=10')
    act(() => {
      router.events.emit('routeChangeComplete', '/data-providers/?size=10')
    })
    expect(params.size).toBe(10)
    // only the keys present in the URL are applied: q is not cleared
    expect(params.q).toBe('old')
    view.rerender()
    wait(250)

    // the store-to-URL sync writes q back with a new history entry
    expect(router.replace).not.toHaveBeenCalled()
    expect(router.push).toHaveBeenCalledTimes(1)
    expect(router.push.mock.calls[0][1]).toBe('/data-providers/?q=old&size=10')

    // and a URL without any param leaves the store as it is, nothing is
    // pushed until a value changes
    router.push.mockClear()
    browserAt('/data-providers/')
    act(() => {
      router.events.emit('routeChangeComplete', '/data-providers/')
    })
    view.rerender()
    wait(1000)
    expect(params.q).toBe('old')
    expect(params.size).toBe(10)
    expect(router.push).not.toHaveBeenCalled()
  })
})
