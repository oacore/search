// T-305 (41 D, R-041): useAnalytics, findings/03 §4 and 30 Q-059 / Q-071.
// react-ga4 is the real module here (3.0.1 since W4c.2, ESM-only, loaded
// through test/esm-allow-list.json; 2.1.0 before), the harness spy replaced
// by jest.requireActual, so `send` and `initialize` behave as in production;
// the consent cookie goes through the real useCookie of @oacore/design.
// NODE_ENV and GA_TRACKING_CODE are read by the hook when its effect runs
// (webpack inlines them in the build), so the production branch is entered by
// setting them around the render and restoring them afterwards.
const React = require('react')
const ReactGA = require('react-ga4').default
const nextRouter = require('next/router')

const { act, render, renderHook } = require('../../utils/render')
const useAnalytics = require('../../../hooks/use-analytics').default

jest.mock('react-ga4', () => jest.requireActual('react-ga4'))

const { router } = nextRouter

const SEND_MISSING = "Send command doesn't exist: search"
const COOKIE = 'analytics_cookies_allowed'
const ESSENTIAL = 'essential_cookies_allowed'
const saved = {
  NODE_ENV: process.env.NODE_ENV,
  GA: process.env.GA_TRACKING_CODE,
}

const setEnv = (nodeEnv, gaCode) => {
  process.env.NODE_ENV = nodeEnv
  if (gaCode === undefined) delete process.env.GA_TRACKING_CODE
  else process.env.GA_TRACKING_CODE = gaCode
}
const setCookie = (name, value) => {
  document.cookie = `${name}=${value}; path=/`
}
const setConsent = (value) => setCookie(COOKIE, value)
const browserAt = (url) => window.history.replaceState(null, '', url)
const mount = (asPath = '/search?q=climate') => {
  nextRouter.setRouter({ asPath })
  return renderHook(() => useAnalytics())
}
const routeChanged = (url) =>
  act(() => {
    router.events.emit('routeChangeComplete', url)
  })

describe('T-305 @P0 useAnalytics', () => {
  beforeEach(() => {
    ReactGA.reset()
    browserAt('/search?q=climate')
  })
  afterEach(() => {
    process.env.NODE_ENV = saved.NODE_ENV
    if (saved.GA === undefined) delete process.env.GA_TRACKING_CODE
    else process.env.GA_TRACKING_CODE = saved.GA
    for (const name of [COOKIE, ESSENTIAL])
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    delete window.ga
    delete window.gtag
    delete window.dataLayer
    document
      .querySelectorAll('script[src*="googletagmanager"]')
      .forEach((s) => s.remove())
    browserAt('/')
    jest.restoreAllMocks()
  })

  test('T-305 c1 @P0 Q-059 consent gating: initialize only with consent in production, send always', () => {
    const initialize = jest
      .spyOn(ReactGA, 'initialize')
      .mockImplementation(() => {})
    const send = jest.spyOn(ReactGA, 'send').mockImplementation(() => {})
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    setEnv('production', 'G-TEST1234')

    // no cookie: nothing is initialised, the page view is still sent
    let view = mount()
    expect(initialize).not.toHaveBeenCalled()
    expect(typeof window.ga).not.toBe('function')
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith({
      hitType: 'search',
      page: '/search?q=climate',
      title: 'Search | q=climate',
    })
    view.unmount()
    // the clean-up nulls window.ga whatever happened
    expect(window.ga).toBeNull()

    // the cookie says false: same as no cookie
    send.mockClear()
    setConsent('false')
    view = mount()
    expect(initialize).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledTimes(1)
    view.unmount()

    // only the essential cookie accepted: still no analytics
    send.mockClear()
    setConsent('false')
    setCookie(ESSENTIAL, 'true')
    view = mount()
    expect(initialize).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledTimes(1)
    view.unmount()

    // accepted, production: ReactGA.initialize(GA_TRACKING_CODE), and the
    // leftover console.log("GA")
    send.mockClear()
    setConsent('true')
    view = mount()
    expect(initialize).toHaveBeenCalledTimes(1)
    expect(initialize).toHaveBeenCalledWith('G-TEST1234')
    expect(log).toHaveBeenCalledWith('GA')
    expect(typeof window.ga).not.toBe('function')
    expect(send).toHaveBeenCalledTimes(1)
    view.unmount()

    // accepted, not production: no initialize, window.ga logs its arguments
    initialize.mockClear()
    log.mockClear()
    setEnv('test', 'G-TEST1234')
    view = mount()
    expect(initialize).not.toHaveBeenCalled()
    expect(typeof window.ga).toBe('function')
    window.ga('send', 'pageview')
    expect(log).toHaveBeenCalledWith('ga("send","pageview")')
    view.unmount()
    expect(window.ga).toBeNull()
  })

  test('T-305 c1 @P0 Q-059 consent is read once at mount: a later cookie does not initialise', () => {
    const initialize = jest
      .spyOn(ReactGA, 'initialize')
      .mockImplementation(() => {})
    const send = jest.spyOn(ReactGA, 'send').mockImplementation(() => {})
    setEnv('production', 'G-TEST1234')

    const view = mount()
    setConsent('true')
    view.rerender()
    routeChanged('/search?q=next')
    expect(initialize).not.toHaveBeenCalled()
    // the route change still reports
    expect(send).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenLastCalledWith({
      hitType: 'search',
      page: '/search?q=next',
      title: 'Search | q=climate',
    })
    view.unmount()
  })

  test('T-305 c2 @P0 Q-071 send({hitType: "search"}) is a no-op with a warning, on load and on every route change', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    setConsent('true')
    setEnv('production', 'G-TEST1234')

    // real initialize: gtag is configured once, at load
    const view = mount()
    expect(log).toHaveBeenCalledWith('GA')
    expect(warn.mock.calls).toEqual([[SEND_MISSING]])
    const entries = () =>
      Array.from(window.dataLayer, (args) => Array.from(args))
    expect(entries()).toEqual([
      ['js', expect.any(Date)],
      ['config', 'G-TEST1234'],
    ])

    routeChanged('/search?q=next')
    routeChanged('/data-providers/')
    expect(warn.mock.calls).toEqual([
      [SEND_MISSING],
      [SEND_MISSING],
      [SEND_MISSING],
    ])
    // no page_view or any other event reached the data layer
    expect(entries()).toEqual([
      ['js', expect.any(Date)],
      ['config', 'G-TEST1234'],
    ])

    // unsubscribed on unmount
    view.unmount()
    routeChanged('/search?q=last')
    expect(warn).toHaveBeenCalledTimes(3)
  })

  test('T-305 c2 @P0 Q-071 the warning does not depend on consent', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    setEnv('production', 'G-TEST1234')
    const view = mount('/outputs/1/')
    routeChanged('/outputs/2/')
    expect(warn.mock.calls).toEqual([[SEND_MISSING], [SEND_MISSING]])
    expect(window.dataLayer).toBeUndefined()
    view.unmount()
  })

  test('T-305 c3 @P0 Q-059 accepted in production with GA_TRACKING_CODE unset: initialize throws and the page unmounts', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    const send = jest.spyOn(ReactGA, 'send')
    setConsent('true')
    setEnv('production', undefined)
    nextRouter.setRouter({ asPath: '/search?q=climate' })

    const Page = () => {
      useAnalytics()
      return React.createElement('main', null, 'page')
    }
    const container = document.body.appendChild(document.createElement('div'))
    expect(() => render(React.createElement(Page), { container })).toThrow(
      'Require GA_MEASUREMENT_ID'
    )

    // the error is thrown by the effect, after the leftover log and before
    // the first page view; no error boundary: the whole tree is gone
    expect(log).toHaveBeenCalledWith('GA')
    expect(send).not.toHaveBeenCalled()
    expect(container.innerHTML).toBe('')
    // React 19 under act rethrows the error to the caller without logging it
    expect(
      error.mock.calls.some((call) =>
        call.some((arg) => String(arg).includes('Require GA_MEASUREMENT_ID'))
      )
    ).toBe(false)
    container.remove()
  })
})
