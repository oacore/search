// T-415 (41 E, R-040, R-058): the app shell, pages/_app.jsx with the real
// Main, Layout, Header and design provider. c1 Q-010: the ErrorBoundary has no
// fallback (a render error blanks the page) and reports once to Sentry; the
// process handlers report too. c2 the LoadingBar of the route events. c3 Q-008:
// `isSearchPage` is a substring regex.
//
// Outside this file: the production-only parts of the shell (LogRocket.init,
// the `/search` prefix on `_next/data` URLs: NODE_ENV is "test" here, and React
// itself would have to load as production) are pinned by T-604 and T-730; the
// statistics fallback of getInitialProps is T-119.
//
// `@sentry/node` is the harness factory spy (utils/sentry.js requires it, the
// browser build swaps it for `@sentry/browser`, next.config.js:97).
import React from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import routerMock, { setRouter } from 'next/router'

import { render, screen, act, within } from '../../utils/render'
import { useStore } from '../../../store'

// the shell registers process handlers when it is loaded: remember them to
// call them, and remove them again afterwards (T-119 does the same)
const registered = []
let NextApp
let Sentry
beforeAll(() => {
  const on = jest.spyOn(process, 'on')
  NextApp = require('../../../pages/_app').default
  registered.push(...on.mock.calls)
  on.mockRestore()
  ;({ Sentry } = require('../../../utils/sentry'))
})
afterAll(() => {
  registered.forEach(([event, handler]) =>
    process.removeListener(event, handler)
  )
})

// the first render of the file creates the client store (store/index.jsx), so
// every test passes the same statistics
const STATISTICS = { totalArticlesCount: 1234567 }

const Page = ({ text = 'page content' }) => <p>{text}</p>
const Boom = () => {
  throw new Error('page render failed')
}

const shell = (Component = Page, pageProps = {}) => (
  <NextApp
    Component={Component}
    pageProps={pageProps}
    statistics={STATISTICS}
    router={routerMock}
  />
)

let errorSpy
// React and jsdom report an error thrown in render on the console
const quiet = () => {
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
}

beforeEach(() => {
  Sentry.captureException.mockClear()
  Sentry.withScope.mockClear()
  setRouter({ asPath: '/' })
})
afterEach(() => {
  if (errorSpy) errorSpy.mockRestore()
  errorSpy = undefined
})

const header = () => document.getElementById('header')
const loadingBar = (container) =>
  [...container.querySelectorAll('div')].find((d) =>
    [...d.classList].some((c) => c.startsWith('loading-bar-loading-bar'))
  )

describe('T-415 @P1 app shell', () => {
  describe('T-415 c1 @P1 Q-010 the ErrorBoundary has no fallback and reports once', () => {
    test('T-415 c1 @P1 the shell renders the page inside the header, the main area and the footer', () => {
      const view = render(shell(Page, { text: 'hello' }))
      expect(screen.getByText('hello')).toBeTruthy()
      expect(header()).not.toBeNull()
      const main = within(view.container).getByRole('main')
      expect(main.textContent).toBe('hello')
      expect(within(view.container).getByRole('contentinfo')).toBeTruthy()
      // no render error: nothing is reported
      expect(Sentry.captureException).not.toHaveBeenCalled()
      expect(Sentry.withScope).not.toHaveBeenCalled()
    })

    test('T-415 c1 @P1 the statistics prop reaches the store the pages read', () => {
      const Probe = () => {
        const { statistics } = useStore()
        return <p>{`count ${statistics.totalArticlesCount}`}</p>
      }
      render(shell(Probe))
      expect(screen.getByText('count 1234567')).toBeTruthy()
    })

    test('T-415 c1 @P1 Q-010 a render error of the page blanks everything under the boundary: no fallback, no header, no footer, and render() does not throw', () => {
      quiet()
      const view = render(shell(Boom))
      // the boundary renders nothing for its children (React 17 unmounts them
      // when a boundary without getDerivedStateFromError catches)
      expect(view.container.innerHTML).toBe('')
      expect(
        document.body.querySelectorAll('header, main, footer')
      ).toHaveLength(0)
      expect(document.body.textContent).toBe('')
      expect(header()).toBeNull()
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.queryByText('page render failed')).toBeNull()
    })

    test('T-415 c1 @P1 Q-010 development says so: React warns that the boundary should implement getDerivedStateFromError', () => {
      quiet()
      render(shell(Boom))
      const logged = errorSpy.mock.calls.map((c) => c.join(' '))
      expect(
        logged.some((line) =>
          line.includes(
            'Error boundaries should implement getDerivedStateFromError()'
          )
        )
      ).toBe(true)
      expect(logged.some((line) => line.includes('ErrorBoundary'))).toBe(true)
    })

    test('T-415 c1 @P1 Q-010 exactly one captureException, with the error, from one withScope', () => {
      quiet()
      render(shell(Boom))
      expect(Sentry.withScope).toHaveBeenCalledTimes(1)
      expect(Sentry.captureException).toHaveBeenCalledTimes(1)
      const [reported] = Sentry.captureException.mock.calls[0]
      expect(reported).toBeInstanceOf(Error)
      expect(reported.message).toBe('page render failed')
    })

    test('T-415 c1 @P1 Q-010 the scope gets the React error info and ssr=false, in that order, and nothing else', () => {
      quiet()
      // hand the boundary a scope of our own
      const scope = { setExtra: jest.fn(), setTag: jest.fn() }
      Sentry.withScope.mockImplementationOnce((callback) => callback(scope))
      render(shell(Boom))
      const { calls } = scope.setExtra.mock
      expect(calls.map(([key]) => key)).toEqual(['componentStack', 'ssr'])
      expect(typeof calls[0][1]).toBe('string')
      // the component stack names the page component under the boundary
      expect(calls[0][1]).toContain('Boom')
      expect(calls[1]).toEqual(['ssr', false])
      expect(scope.setTag).not.toHaveBeenCalled()
      expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    })

    test('T-415 c1 @P1 Q-010 an error after the first paint is reported once too, and the page content goes', () => {
      quiet()
      let fail
      const Later = () => {
        const [broken, setBroken] = React.useState(false)
        fail = () => setBroken(true)
        if (broken) throw new Error('later failure')
        return <p>works for now</p>
      }
      const view = render(shell(Later))
      expect(screen.getByText('works for now')).toBeTruthy()
      act(() => {
        fail()
      })
      expect(view.container.innerHTML).toBe('')
      expect(Sentry.captureException).toHaveBeenCalledTimes(1)
      expect(Sentry.captureException.mock.calls[0][0].message).toBe(
        'later failure'
      )
    })

    test('T-415 c1 @P1 Q-010 a second failing mount is reported again, once more', () => {
      quiet()
      render(shell(Boom))
      render(shell(Boom))
      expect(Sentry.captureException).toHaveBeenCalledTimes(2)
    })

    test('T-415 c1 @P1 Q-010 the boundary covers Main and the page only: an error in the shell itself (asPath missing) is thrown and not reported', () => {
      quiet()
      setRouter({ asPath: undefined })
      expect(() => render(shell(Page))).toThrow(TypeError)
      expect(Sentry.captureException).not.toHaveBeenCalled()
      expect(Sentry.withScope).not.toHaveBeenCalled()
    })

    test('T-415 c1 @P1 R-040 the process handlers of the shell report unhandled rejections and uncaught exceptions, once each', () => {
      expect(registered.map(([event]) => event)).toEqual([
        'unhandledRejection',
        'uncaughtException',
      ])
      for (const [, handler] of registered) {
        Sentry.captureException.mockClear()
        const error = new Error('outside React')
        handler(error)
        expect(Sentry.captureException).toHaveBeenCalledTimes(1)
        expect(Sentry.captureException).toHaveBeenCalledWith(error)
      }
    })
  })

  describe('T-415 c2 @P1 LoadingBar', () => {
    test('T-415 c2 @P1 no bar at rest; routeChangeStart shows a fixed bar as the first element of the page frame', () => {
      const view = render(shell())
      expect(loadingBar(view.container)).toBeUndefined()
      act(() => {
        routerMock.events.emit('routeChangeStart', '/works/1')
      })
      const bar = loadingBar(view.container)
      expect(bar).not.toBeUndefined()
      expect(bar.tagName).toBe('DIV')
      expect(
        [...bar.classList].some((c) => c.startsWith('loading-bar-fixed'))
      ).toBe(true)
      expect(bar.textContent).toBe('')
      // before the header, directly inside the page container
      expect(bar.parentElement.className).toBe('container')
      expect(bar.parentElement.firstElementChild).toBe(bar)
      expect(bar.nextElementSibling).toBe(header())
    })

    test.each(['routeChangeComplete', 'routeChangeError'])(
      'T-415 c2 @P1 %s removes the bar',
      (event) => {
        const view = render(shell())
        act(() => {
          routerMock.events.emit('routeChangeStart', '/works/1')
        })
        expect(loadingBar(view.container)).not.toBeUndefined()
        act(() => {
          routerMock.events.emit(event, '/works/1')
        })
        expect(loadingBar(view.container)).toBeUndefined()
      }
    )

    test('T-415 c2 @P1 a second start keeps one bar; a complete without a start changes nothing; the other events do not show it', () => {
      const view = render(shell())
      act(() => {
        routerMock.events.emit('routeChangeComplete', '/x')
      })
      expect(loadingBar(view.container)).toBeUndefined()
      for (const event of ['beforeHistoryChange', 'hashChangeStart']) {
        act(() => {
          routerMock.events.emit(event, '/x')
        })
        expect(loadingBar(view.container)).toBeUndefined()
      }
      act(() => {
        routerMock.events.emit('routeChangeStart', '/a')
        routerMock.events.emit('routeChangeStart', '/b')
      })
      expect(
        [...view.container.querySelectorAll('div')].filter((d) =>
          [...d.classList].some((c) => c.startsWith('loading-bar-loading-bar'))
        )
      ).toHaveLength(1)
    })

    test('T-415 c2 @P1 the shell subscribes once per event (the analytics hook adds its own routeChangeComplete) and unsubscribes on unmount', () => {
      const count = (event) => (routerMock.events.all[event] || []).length
      expect(count('routeChangeStart')).toBe(0)
      const view = render(shell())
      expect(count('routeChangeStart')).toBe(1)
      expect(count('routeChangeError')).toBe(1)
      // useLoading + the page-view reporter of use-analytics.js
      expect(count('routeChangeComplete')).toBe(2)
      // a re-render with new props does not subscribe again
      view.rerender(shell(Page, { text: 'again' }))
      expect(count('routeChangeStart')).toBe(1)
      expect(count('routeChangeComplete')).toBe(2)
      view.unmount()
      expect(count('routeChangeStart')).toBe(0)
      expect(count('routeChangeError')).toBe(0)
      expect(count('routeChangeComplete')).toBe(0)
    })

    test('T-415 c2 @P1 the bar does not unmount the page: its content and header stay while the bar is shown', () => {
      const view = render(shell(Page, { text: 'stays' }))
      act(() => {
        routerMock.events.emit('routeChangeStart', '/works/1')
      })
      expect(screen.getByText('stays')).toBeTruthy()
      expect(header()).not.toBeNull()
      expect(loadingBar(view.container)).not.toBeUndefined()
    })
  })

  describe('T-415 c3 @P1 Q-008 isSearchPage is a substring regex', () => {
    // [asPath, the header carries the search style]
    const PATHS = [
      ['/search/?q=climate', true],
      ['/search', true],
      ['/search?q=', true],
      ['/search/', true],
      // any path that contains the word
      ['/data-providers/?q=research', true],
      ['/data-providers/?q=searchable', true],
      ['/works/12?search=q%3Dx', true],
      ['/outputs/update/?utm=research', true],
      ['/static/search', true],
      ['/static/search/', true],
      ['/research', true],
      ['/xsearchx', true],
      // no match: other paths, and the regex is case-sensitive
      ['/', false],
      ['/data-providers/86/', false],
      ['/data-providers/', false],
      ['/outputs/2001/', false],
      ['/works/1001/', false],
      ['/about', false],
      ['/Search', false],
      ['/SEARCH/?q=x', false],
      ['/sea/rch', false],
    ]
    test.each(PATHS)(
      'T-415 c3 @P1 Q-008 asPath %p: the header has the search style %p',
      (asPath, expected) => {
        setRouter({ asPath })
        render(shell())
        expect(header().classList.contains('header')).toBe(expected)
      }
    )

    test('T-415 c3 @P1 Q-008 the style is the only difference: the same header markup without and with the match', () => {
      setRouter({ asPath: '/about' })
      const first = render(shell())
      const without = header().outerHTML
      first.unmount()
      setRouter({ asPath: '/search' })
      render(shell())
      const withMatch = header().outerHTML
      expect(withMatch).not.toBe(without)
      expect(withMatch.replace(' header"', '"')).toBe(without)
    })

    test('T-415 c3 @P1 Q-008 the value is evaluated on every render: a new asPath changes the style', () => {
      setRouter({ asPath: '/about' })
      const view = render(shell())
      expect(header().classList.contains('header')).toBe(false)
      setRouter({ asPath: '/search?q=a' })
      view.rerender(shell(Page, { text: 'again' }))
      expect(header().classList.contains('header')).toBe(true)
    })

    test('T-415 c3 @P1 Q-008 server and browser disagree on /static/search (the gateway strips the prefix): hydration keeps the server class', () => {
      // the server renders the path the gateway hands it, "/"; the browser
      // knows "/static/search"
      quiet()
      setRouter({ asPath: '/' })
      const html = renderToString(shell())
      const host = document.createElement('div')
      document.body.appendChild(host)
      host.innerHTML = html
      const serverHeader = host.querySelector('#header')
      expect(serverHeader.classList.contains('header')).toBe(false)

      setRouter({ asPath: '/static/search' })
      let root
      act(() => {
        root = hydrateRoot(host, shell())
      })
      // React 17 does not patch attributes: the server DOM stays
      expect(host.querySelector('#header')).toBe(serverHeader)
      expect(serverHeader.classList.contains('header')).toBe(false)
      // development warns about it (production does not, R-010)
      const warnings = errorSpy.mock.calls.map((c) => String(c[0]))
      expect(warnings.some((w) => w.includes('Prop `%s` did not match'))).toBe(
        true
      )
      act(() => root.unmount())
      host.remove()

      // a client-only render of the same path has the style
      const fresh = render(shell())
      expect(fresh.container.querySelector('#header')).toBe(header())
      expect(header().classList.contains('header')).toBe(true)
    })
  })
})
