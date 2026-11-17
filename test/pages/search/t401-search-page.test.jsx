// T-401 (41 E, R-033): the page component of pages/search/index.jsx with the
// real design library and the real stores, fed with the props the real
// getServerSideProps produces from the recorded and magic-query answers
// (MSW). c1 Q-003: an upstream error with a status renders the ErrorCard, a
// network error (status null) and an empty result both render the "no
// results" QueryError. c2 Q-047 (WATCH): the component returns the ErrorCard
// before it calls `useStore()` and `Header.useSearchBar()`, so a mounted
// instance whose props flip between `queryError` and `data` changes how many
// hooks it calls. On React 17.0.2 that does not raise "Rendered more hooks
// than during the previous render" in this component: its only hook before the
// early return is `useRouter()` (a context read, no hook slot), and React
// mounts or drops a component's hooks without a check when the count goes from
// or to zero (note P1-02-1 in the Phase 2 issue list). What the flip does
// change is pinned through the real app shell (main/, the design header): the
// header search bar exists only while the hooks run, and it stays after the
// data -> queryError flip because the dropped hooks never run their cleanup.
// The browser-level crash of T-716 is not reproduced by this component.
import React from 'react'
import { setRouter } from 'next/router'

import { setupMsw } from '../../utils/msw'
import {
  render,
  screen,
  waitFor as baseWaitFor,
  act,
  withRouter,
  withStore,
} from '../../utils/render'
import RootStore from '../../../store/root'
import Main from '../../../main'
import Search, { getServerSideProps } from '../../../pages/search'

jest.setTimeout(30000)

const { server, resolver } = setupMsw()

// waits are generous: the suites of other packages run on the same machine
const waitFor = (callback, options) =>
  baseWaitFor(callback, { timeout: 8000, ...options })

const ERROR_CARD = 'This page is not available now. Try again in a few minutes.'
const noResults = (query) =>
  `Sorry, we couldn’t find any results for “${query}”.`

const gssp = async (query) => {
  const result = await getServerSideProps({ query })
  return result.props
}

// a request the fixtures cannot answer is a 502 naming its triple: no test may
// depend on one by accident
let unmatched
beforeEach(() => {
  unmatched = []
  const resolve = resolver.resolve.bind(resolver)
  jest.spyOn(resolver, 'resolve').mockImplementation((...args) => {
    const answerOf = resolve(...args)
    if (answerOf.unmatched) unmatched.push(answerOf.unmatched)
    return answerOf
  })
})

// every request the page makes is answered by the fixtures; a counter tells
// when all answers have been taken in
let started
let answered
beforeEach(() => {
  started = 0
  answered = 0
  server.events.on('request:start', () => {
    started += 1
  })
  server.events.on('response:mocked', () => {
    answered += 1
  })
  // the gSSP prints its timers and a log line per error
  jest.spyOn(console, 'time').mockImplementation(() => {})
  jest.spyOn(console, 'timeEnd').mockImplementation(() => {})
  jest.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => {
  server.events.removeAllListeners()
  jest.restoreAllMocks()
  expect(unmatched).toEqual([])
})

// waits until every request has an answer and the page took it in
const settle = async () => {
  await waitFor(() => expect(answered).toBe(started))
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  })
}

const mount = (props, query) => {
  // the answers of the gSSP call that made the props are not the page's
  started = 0
  answered = 0
  setRouter({ query })
  const store = new RootStore({ statistics: { totalArticlesCount: 1234567 } })
  const view = render(<Search {...props} />, {
    wrappers: [withRouter(), withStore(store)],
  })
  return { store, ...view }
}

const hasErrorCard = () => screen.queryByText(ERROR_CARD) !== null

describe('T-401 @P1 pages/search/index.jsx', () => {
  describe('T-401 c1 @P1 ErrorCard vs QueryError (Q-003)', () => {
    test('T-401 c1 @P1 an upstream error with a status renders the ErrorCard, whatever the status', async () => {
      // the real gSSP: the magic query is answered 500; page=1000 and page=0
      // are the recorded 400 and 500 answers of the live API
      const cases = [
        [{ q: '__status500' }, 500],
        [{ q: 'climate', page: '1000' }, 400],
        [{ q: 'x', page: '0' }, 500],
      ]
      for (const [query, status] of cases) {
        // eslint-disable-next-line no-await-in-loop
        const props = await gssp(query)
        expect(props).toEqual({
          queryError: { query: query.q, status },
        })

        const { container, unmount } = mount(props, query)
        expect(hasErrorCard()).toBe(true)
        expect(
          screen.getByText(
            'Our team is already working to resolve this issue as soon as possible.'
          )
        ).toBeInTheDocument()
        // the card is a bare link to the home page
        expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute(
          'href',
          '/'
        )
        expect(screen.getByAltText('img')).toBeInTheDocument()
        // not the "no results" page, no search page chrome
        expect(container.textContent).not.toContain('find any results')
        expect(container.textContent).not.toContain('research outputs found')
        expect(started).toBe(0)
        unmount()
      }
    })

    test('T-401 c1 @P1 a network error (status null) renders "no results" for the term in the URL, not the ErrorCard', async () => {
      const props = await gssp({ q: '__neterror' })
      // the gSSP turns an error without a response into status null
      expect(props).toEqual({
        queryError: { query: '__neterror', status: null },
      })

      const { container } = mount(props, { q: '__neterror' })
      expect(hasErrorCard()).toBe(false)
      expect(
        screen.getByRole('heading', { level: 2, name: noResults('__neterror') })
      ).toBeInTheDocument()
      expect(screen.getByAltText('No results found')).toBeInTheDocument()
      expect(container.textContent).toContain(
        'Double check your search request for any spelling errors or try a different search term.'
      )
    })

    test('T-401 c1 @P1 the "no results" term is the router\'s q, not the one in the props', () => {
      const first = mount(
        { queryError: { query: 'from-props', status: null } },
        { q: 'from-router' }
      )
      expect(hasErrorCard()).toBe(false)
      expect(screen.getByText(noResults('from-router'))).toBeInTheDocument()
      expect(screen.queryByText(noResults('from-props'))).toBeNull()
      first.unmount()

      // no q in the URL: the term is empty
      mount({ queryError: { query: 'x', status: null } }, {})
      expect(screen.getByText(noResults(''))).toBeInTheDocument()
    })

    test('T-401 c1 @P1 any falsy status falls through to "no results"; only a truthy status is the ErrorCard', () => {
      const asView = (status) =>
        mount({ queryError: { query: 'climate', status } }, { q: 'climate' })

      for (const status of [null, undefined, 0]) {
        const { unmount } = asView(status)
        expect(hasErrorCard()).toBe(false)
        expect(screen.getByText(noResults('climate'))).toBeInTheDocument()
        unmount()
      }
      for (const status of [400, 404, 500, 503]) {
        const { unmount } = asView(status)
        expect(hasErrorCard()).toBe(true)
        unmount()
      }
    })

    test('T-401 c1 @P1 an empty result (200, 0 hits) renders "no results" for the query', async () => {
      const props = await gssp({ q: 'zzzzqqq' })
      expect(props.queryError).toBeUndefined()
      expect(props.data.results).toEqual([])

      const { container } = mount(props, { q: 'zzzzqqq' })
      await settle()
      expect(hasErrorCard()).toBe(false)
      expect(screen.getByText(noResults('zzzzqqq'))).toBeInTheDocument()
      // the page shell is the single div the component renders
      expect(container.firstChild.tagName).toBe('DIV')
      expect(container.textContent).not.toContain('research outputs found')
    })

    test('T-401 c1 @P1 a page of results renders the search template, neither card', async () => {
      const props = await gssp({ q: 'climate' })
      expect(props.data.results.length).toBeGreaterThan(0)

      const { container, store } = mount(props, { q: 'climate', page: '1' })
      await settle()
      expect(hasErrorCard()).toBe(false)
      expect(screen.queryByText(/find any results/)).toBeNull()
      expect(
        screen.getByText(
          `${props.data.totalHits.toLocaleString(
            'en-GB'
          )} research outputs found`
        )
      ).toBeInTheDocument()
      // one card per result, the sort box, and the store filled by the template
      expect(
        container.querySelectorAll('[id^="work-search-output-"]')
      ).toHaveLength(props.data.results.length)
      expect(store.search.getState().query).toBe('climate')
      expect(store.search.getState().works).toHaveLength(
        props.data.results.length
      )
    })

    test('T-401 c1 @P1 one result is a page of results: the template shows it, not "no results"', async () => {
      const props = await gssp({ q: 'climate' })
      // the recorded page cut to its first result
      const single = {
        ...props,
        data: { ...props.data, results: props.data.results.slice(0, 1) },
      }

      const { container } = mount(single, { q: 'climate', page: '1' })
      await settle()
      expect(hasErrorCard()).toBe(false)
      expect(screen.queryByText(/find any results/)).toBeNull()
      expect(
        container.querySelectorAll('[id^="work-search-output-"]')
      ).toHaveLength(1)
    })
  })

  describe('T-401 c2 @P1 queryError -> data re-render (Q-047)', () => {
    let consoleError
    const STATISTICS = { totalArticlesCount: 1234567 }
    const PLACEHOLDER = 'Search 1,234,567 from papers around the world'

    beforeEach(() => {
      // a hooks-order error would be printed by React and by jsdom
      consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    const flush = () =>
      act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 20)
        })
      })

    // the page inside the app shell: the design header, layout and footer
    const shell = (props) => (
      <Main
        isSearchPage
        initialState={{ statistics: STATISTICS }}
        loading={false}
      >
        <Search {...props} />
      </Main>
    )
    const mountShell = async (props, query) => {
      setRouter({ query, asPath: `/search?q=${query.q}` })
      const view = render(shell(props), { wrappers: [withRouter()] })
      await flush()
      return view
    }
    const flipTo = async (view, props, query) => {
      setRouter({ query, asPath: `/search?q=${query.q}` })
      view.rerender(shell(props))
      await flush()
    }
    const headerSearchBox = () => screen.queryByPlaceholderText(PLACEHOLDER)

    test('T-401 c2 @P1 the early return skips the hooks: the ErrorCard page has no header search bar, the other states have one', async () => {
      const errorProps = await gssp({ q: '__status500' })
      const view = await mountShell(errorProps, { q: '__status500' })
      expect(hasErrorCard()).toBe(true)
      expect(headerSearchBox()).toBeNull()
      view.unmount()

      // no status (network error) and no results run the hooks
      const netProps = await gssp({ q: '__neterror' })
      const net = await mountShell(netProps, { q: '__neterror' })
      expect(headerSearchBox()).not.toBeNull()
      expect(headerSearchBox()).toHaveValue('')
      net.unmount()

      const emptyProps = await gssp({ q: 'zzzzqqq' })
      await mountShell(emptyProps, { q: 'zzzzqqq' })
      // useSearchBar got `initQuery: data.query` and the statistics label
      expect(headerSearchBox()).toHaveValue('zzzzqqq')
      expect(screen.getByText(noResults('zzzzqqq'))).toBeInTheDocument()
      expect(consoleError).not.toHaveBeenCalled()
    })

    test('T-401 c2 @P1 queryError -> data on the mounted instance: the hooks start, nothing is thrown, React 18 development logs one static-flag warning, the search bar appears', async () => {
      const errorProps = await gssp({ q: '__status500' })
      const dataProps = await gssp({ q: 'zzzzqqq' })
      const view = await mountShell(errorProps, { q: '__status500' })
      expect(hasErrorCard()).toBe(true)
      expect(headerSearchBox()).toBeNull()

      // the client navigation re-renders the same instance with the new props
      await flipTo(view, dataProps, { q: 'zzzzqqq' })
      expect(hasErrorCard()).toBe(false)
      expect(screen.getByText(noResults('zzzzqqq'))).toBeInTheDocument()
      expect(headerSearchBox()).toHaveValue('zzzzqqq')
      expect(view.container.innerHTML).not.toBe('')
      expect(consoleError.mock.calls.map((c) => c[0])).toEqual([
        // React 19 drops the "Warning: " prefix and the stack placeholder
        'Internal React error: Expected static flag was missing. Please notify the React team.',
      ]) // AD-169
    })

    test('T-401 c2 @P1 data -> queryError: the ErrorCard replaces the page, the search bar the dropped hooks configured stays', async () => {
      const dataProps = await gssp({ q: 'zzzzqqq' })
      const errorProps = await gssp({ q: '__status500' })
      const view = await mountShell(dataProps, { q: 'zzzzqqq' })
      expect(hasErrorCard()).toBe(false)
      expect(headerSearchBox()).toHaveValue('zzzzqqq')

      await flipTo(view, errorProps, { q: '__status500' })
      expect(hasErrorCard()).toBe(true)
      expect(screen.queryByText(/find any results/)).toBeNull()
      // the hooks are not called any more, so useSearchBar's cleanup (which
      // would disable the bar) does not run: the header keeps the old bar
      expect(headerSearchBox()).not.toBeNull()
      expect(headerSearchBox()).toHaveValue('zzzzqqq')
      expect(consoleError).not.toHaveBeenCalled()

      // and back: the hooks mount again with the new data
      await flipTo(view, dataProps, { q: 'zzzzqqq' })
      expect(hasErrorCard()).toBe(false)
      expect(headerSearchBox()).toHaveValue('zzzzqqq')
      expect(consoleError).not.toHaveBeenCalled()
    })

    test('T-401 c2 @P1 a status-less queryError and data call the same hooks: the flip between them keeps the page and the bar', async () => {
      const netProps = await gssp({ q: '__neterror' })
      const dataProps = await gssp({ q: 'zzzzqqq' })
      const view = await mountShell(netProps, { q: '__neterror' })
      expect(screen.getByText(noResults('__neterror'))).toBeInTheDocument()
      expect(headerSearchBox()).toHaveValue('')

      await flipTo(view, dataProps, { q: 'zzzzqqq' })
      expect(screen.getByText(noResults('zzzzqqq'))).toBeInTheDocument()
      expect(headerSearchBox()).not.toBeNull()
      expect(consoleError).not.toHaveBeenCalled()
    })

    test('T-401 c2 @P1 the page alone, without the shell, behaves the same: nothing is thrown in either direction, and React 18 development logs one static-flag warning', async () => {
      const errorProps = await gssp({ q: '__status500' })
      const dataProps = await gssp({ q: 'zzzzqqq' })
      const { container, rerender } = mount(errorProps, { q: '__status500' })
      expect(hasErrorCard()).toBe(true)

      setRouter({ query: { q: 'zzzzqqq' } })
      rerender(<Search {...dataProps} />)
      expect(screen.getByText(noResults('zzzzqqq'))).toBeInTheDocument()

      setRouter({ query: { q: '__status500' } })
      rerender(<Search {...errorProps} />)
      expect(hasErrorCard()).toBe(true)
      expect(container.innerHTML).not.toBe('')
      expect(consoleError.mock.calls.map((c) => c[0])).toEqual([
        // React 19 drops the "Warning: " prefix and the stack placeholder
        'Internal React error: Expected static flag was missing. Please notify the React team.',
      ]) // AD-169
    })
  })
})
