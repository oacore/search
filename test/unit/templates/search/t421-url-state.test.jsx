// T-421 (41 E, R-019, R-028): the URL-state actions of the search page started
// from a non-default state, where a router or query change loses parameters
// first: a filtered `q`, `sort=recent`, a `t` and a page above 1 are all in the
// router query. Real design library, real stores, MSW answering from the
// recorded fixtures (the filtered pages: "thesis" sorted by recent, a year
// range, "thesis" plus a publisher). The router mock is set on its own: the
// template reads only `data`, the pushes read only the router query. A facet
// toggle from such a state is T-403 c3.
// c1 pagination (templates/search/pagination.jsx): from a sorted list and from
//    a filtered and sorted one, Previous, Next, a number, "first" and "last"
//    push `/search` with the router query, only `page` replaced.
// c2 sort, "Clear all filters" and a year range keep every other key of the
//    router query; `q` is rewritten as T-202 pins it and `page` goes to 1.
// c3 CSV of a filtered page: the E3 body `q` is the whole query, filters
//    included (store/search.js:122), for each filter kind the bar writes.
// c4 "Copy url" copies `https://core.ac.uk` + `asPath`, every parameter kept.
import React from 'react'
import { configure } from 'mobx'
import routerMock, { setRouter } from 'next/router'
import FileDownload from 'js-file-download'

import { setupMsw } from '../../../utils/msw'
import {
  act,
  render,
  screen,
  waitFor as baseWaitFor,
  userEvent,
  withRouter,
  withStore,
} from '../../../utils/render'
import RootStore from '../../../../store/root'
import Filters from '../../../../store/filters'
import SearchStore from '../../../../store/search'
import { getServerSideProps } from '../../../../pages/search'
import SearchTemplate from '../../../../templates/search'
import Pagination from '../../../../templates/search/pagination'

// the stores write outside actions while the templates observe them, which
// MobX 6 reports with a dev-only console.warn that its production build does
// not print (findings/03 §2.3); switching the check off changes no transition
configure({ enforceActions: 'never' })

jest.setTimeout(30000)

const { server, resolver, http, HttpResponse } = setupMsw()

// waits are generous: the suites of other packages run on the same machine
const waitFor = (callback, options) =>
  baseWaitFor(callback, { timeout: 8000, ...options })

const router = routerMock
const E3 = 'https://api.core.ac.uk/v3/search/works'
const THESIS = 'climate AND documentType:"thesis"'
// every parameter the search page knows, none at its default
const FULL = { q: THESIS, sort: 'recent', t: 'abc', page: '3' }
const AS_PATH =
  '/search/?q=climate%20AND%20documentType%3A%22thesis%22&sort=recent&t=abc&page=3'
const pushedQuery = (page) => ({ ...FULL, page })
// recorded filtered pages (E1 and the full E2 of each query): a type facet
// sorted by recent, a year range, two facets
const FILTERED = [
  { name: 'type facet, sort recent', q: THESIS, sort: 'recent' },
  {
    name: 'year range',
    q: 'climate AND (yearPublished>=1952 AND yearPublished<=1952)',
  },
  {
    name: 'type and publisher facets',
    q: 'climate AND documentType:"thesis" AND publisher:"Oregon State University"',
  },
]

// the CSV answer of a filtered query is not recorded: the recorded answer of
// the same body for "climate" stands in for it; the bodies are kept
const captureCsvPosts = () => {
  const posts = []
  server.use(
    http.post(E3, async ({ request }) => {
      const body = JSON.parse(await request.clone().text())
      // the E1 search of the page is a POST to the same path
      if (body.accept !== 'text/csv') return undefined
      posts.push(body)
      const stand = resolver.resolve(
        'POST',
        E3,
        JSON.stringify({ ...body, q: 'climate' })
      )
      return new HttpResponse(stand.body, {
        status: stand.status,
        headers: stand.headers,
      })
    })
  )
  return posts
}

// a request the fixtures cannot answer is a 502 naming its triple: no test may
// depend on one by accident
let unmatched
let started
let answered
beforeEach(() => {
  unmatched = []
  const resolve = resolver.resolve.bind(resolver)
  jest.spyOn(resolver, 'resolve').mockImplementation((...args) => {
    const answerOf = resolve(...args)
    if (answerOf.unmatched) unmatched.push(answerOf.unmatched)
    return answerOf
  })
  started = 0
  answered = 0
  server.events.on('request:start', () => {
    started += 1
  })
  server.events.on('response:mocked', () => {
    answered += 1
  })
  document.body.style.overflow = ''
  FileDownload.mockClear()
  jest.spyOn(console, 'time').mockImplementation(() => {})
  jest.spyOn(console, 'timeEnd').mockImplementation(() => {})
  jest.spyOn(console, 'log').mockImplementation(() => {})
})

const settle = async () => {
  await waitFor(() => expect(answered).toBe(started))
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 20)
    })
  })
  await waitFor(() => expect(answered).toBe(started))
}

afterEach(async () => {
  // no answer may arrive after the test: the page would be unmounted
  await settle()
  server.events.removeAllListeners()
  jest.restoreAllMocks()
  expect(unmatched).toEqual([])
})

const pushes = () => router.push.mock.calls.map(([arg]) => arg)

describe('T-421 @P1 URL state from a non-default state', () => {
  describe('pagination', () => {
    // 132,192 hits at 10 per page (capped at 1000 pages), siblings 2, page 3:
    // [prev] 1 2 3 4 5 6 7 ... last [next]
    const mountPagination = ({
      query = FULL,
      asPath = AS_PATH,
      urlPage = 3,
    } = {}) => {
      setRouter({ query: { ...query }, pathname: '/search', asPath })
      return render(
        <Pagination
          totalCount={132192}
          pageSize={10}
          siblingCount={2}
          urlPage={urlPage}
        />,
        { wrappers: [withRouter()] }
      )
    }
    const controls = (container) =>
      [...container.querySelectorAll('ul > li')].map((li) =>
        li.querySelector('button')
      )
    const previous = (container) => controls(container)[0]
    const next = (container) => controls(container).at(-1)
    const page = (label) => screen.getByRole('button', { name: label })

    test('T-421 c1 @P1 from a filtered and sorted list on page 3, Previous, Next, a number, "first" and "last" push /search with every router query key, only page replaced', async () => {
      const user = userEvent.setup()
      const { container } = mountPagination()
      expect(previous(container)).toBeEnabled()

      await user.click(next(container))
      await user.click(previous(container))
      await user.click(page('7'))
      // from page 5 on, page 1 is labelled "first"
      await user.click(page('first'))
      await user.click(page('last'))

      expect(pushes()).toStrictEqual(
        [4, 3, 7, 1, 1000].map((n) => ({
          pathname: '/search',
          query: pushedQuery(n),
        }))
      )
      // the router's own query object is spread, never changed
      expect(router.query).toStrictEqual(FULL)
    })

    test('T-421 c1 @P1 from a sorted list (/search/?q=climate&sort=recent), page 2 and Next push /search with q and sort=recent kept', async () => {
      const user = userEvent.setup()
      const SORTED = { q: 'climate', sort: 'recent' }
      const { container } = mountPagination({
        query: SORTED,
        asPath: '/search/?q=climate&sort=recent',
        urlPage: 1,
      })
      // page 1: Previous is disabled
      expect(previous(container)).toBeDisabled()

      await user.click(page('2'))
      await user.click(next(container))

      expect(pushes()).toStrictEqual([
        {
          pathname: '/search',
          query: { q: 'climate', sort: 'recent', page: 2 },
        },
        {
          pathname: '/search',
          query: { q: 'climate', sort: 'recent', page: 3 },
        },
      ])
      expect(router.query).toStrictEqual(SORTED)
    })
  })

  describe('search page', () => {
    let store
    let view
    // a recorded filtered page (E1 of its query and sort, the full E2 of its
    // query); the router query and asPath are those of the page's URL state
    const mountPage = async ({
      q = THESIS,
      sort = 'recent',
      query = FULL,
      asPath = AS_PATH,
    } = {}) => {
      const { props } = await getServerSideProps({
        query: sort ? { q, sort } : { q },
      })
      expect(props.data.query).toBe(q)
      started = 0
      answered = 0
      setRouter({ query: { ...query }, pathname: '/search', asPath })
      store = new RootStore({ statistics: {} })
      view = render(
        <SearchTemplate data={props.data} members={props.members} />,
        { wrappers: [withRouter(), withStore(store)] }
      )
      await waitFor(() =>
        expect(screen.getByText(/research outputs found/)).toBeInTheDocument()
      )
      await waitFor(() => expect(store.filters.isLoading).toBe(false))
      await settle()
      return view
    }
    // the action buttons of the results header: CSV download, copy url
    const actionButtons = () =>
      view.container.querySelectorAll('button.action-button')
    const sortBox = () => screen.getByText(/^Sort by/)
    const sortOption = (value) =>
      [...view.container.querySelectorAll('ul.sort-box-menu li p')].find(
        (p) => p.textContent.trim() === value
      )

    test('T-421 c2 @P1 sort and "Clear all filters" keep every other router query key, page goes to 1', async () => {
      const user = userEvent.setup()
      await mountPage()

      await user.click(sortBox())
      await user.click(sortOption('relevance'))
      expect(pushes()).toStrictEqual([
        {
          pathname: '/search',
          query: { ...FULL, sort: 'relevance', page: 1 },
        },
      ])

      router.push.mockClear()
      await user.click(
        screen.getByRole('button', { name: 'Clear all filters' })
      )
      await waitFor(() => expect(store.filters.isLoading).toBe(false))
      // Q-042: the first word of q stays; the bar passes no pathname
      expect(pushes()).toStrictEqual([
        { pathname: undefined, query: { ...FULL, q: 'climate', page: 1 } },
      ])
    })

    FILTERED.forEach((state) => {
      test(`T-421 c3 @P1 the CSV download of a filtered page sends the whole query, filters included, as the E3 body q: ${state.name}`, async () => {
        const posts = captureCsvPosts()
        const user = userEvent.setup()
        await mountPage({
          q: state.q,
          // no sort in the URL: the page sorts by relevance
          sort: state.sort || null,
          query: { q: state.q, ...(state.sort ? { sort: state.sort } : {}) },
          asPath: `/search/?q=${encodeURIComponent(state.q)}${
            state.sort ? `&sort=${state.sort}` : ''
          }`,
        })
        expect(store.search.query).toBe(state.q)

        await user.click(actionButtons()[0])
        await user.click(screen.getByRole('button', { name: 'Download' }))
        await waitFor(() => expect(FileDownload).toHaveBeenCalledTimes(1))
        await settle()

        expect(posts).toStrictEqual([
          { q: state.q, accept: 'text/csv', limit: 10 },
        ])
        expect(FileDownload.mock.calls[0][1]).toBe('results.csv')
        expect(store.search.isLoading).toBe(false)
      })
    })

    test('T-421 c3 @P1 the CSV body q keeps every filter kind the bar writes (field, year range, type, author, language, publisher), at each size', async () => {
      // the clause shapes of store/filters.js:174-195 (a facet value; the
      // language facet writes its code) and :235-246 (a year range)
      const q = [
        'climate',
        'fieldsOfStudy:"Environmental science"',
        '(yearPublished>=2014 AND yearPublished<=2020)',
        'documentType:"thesis"',
        'authors:"Climate Council"',
        'language:"en"',
        'publisher:"Oregon State University"',
      ].join(' AND ')
      const posts = captureCsvPosts()
      const search = new SearchStore()
      search.setQuery(q)
      for (const limit of [10, 100]) {
        search.setActiveLimit(limit)
        // eslint-disable-next-line no-await-in-loop
        await search.downloadResults()
      }
      expect(posts).toStrictEqual([
        { q, accept: 'text/csv', limit: 10 },
        { q, accept: 'text/csv', limit: 100 },
      ])
      expect(FileDownload.mock.calls.map(([, name]) => name)).toStrictEqual([
        'results.csv',
        'results.csv',
      ])
      // the store's query is read, never rewritten
      expect(search.query).toBe(q)
    })

    test('T-421 c4 @P1 "Copy url" copies https://core.ac.uk + asPath with every parameter', async () => {
      const user = userEvent.setup()
      // replaces the clipboard stub that user-event installed in its setup
      const writeText = jest.fn(() => Promise.resolve())
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      })
      try {
        await mountPage()
        await user.click(actionButtons()[1])
        await waitFor(() =>
          expect(screen.getByText('Link copied')).toBeInTheDocument()
        )
        expect(writeText.mock.calls).toStrictEqual([
          [`https://core.ac.uk${AS_PATH}`],
        ])
        expect(router.push).not.toHaveBeenCalled()
      } finally {
        delete navigator.clipboard
      }
    })
  })

  describe('year range', () => {
    test('T-421 c2 @P1 a year range keeps every other router query key, its clause is appended to the filtered q, page goes to 1', async () => {
      // the year push reads the open facet of the filters store
      // (store/filters.js:198-246); its suggestions come from the recorded E2
      const filters = new Filters()
      await filters.fetchFilters('climate', 'relevance')
      const year = filters.data.find((f) => f.value === 'yearPublished')
      filters.setActiveFilter(year)
      filters.setActiveFilterSuggestions(year.items)
      setRouter({ query: { ...FULL }, pathname: '/search', asPath: AS_PATH })

      filters.setActiveYearDate([2000, 2001], '/search')

      expect(pushes()).toStrictEqual([
        {
          pathname: '/search',
          query: {
            ...FULL,
            q: `${THESIS} AND (yearPublished>=2000 AND yearPublished<=2001)`,
            page: 1,
          },
        },
      ])
      expect(router.query).toStrictEqual(FULL)
    })
  })
})
