// T-408 (41 E, R-039): the Sort control (templates/search/sort.jsx) in the two
// places that use it, with the real design library, the real search store and
// MSW answering from the recorded fixtures. The props of both templates come
// from the real getServerSideProps of their pages.
// c1 search page: choosing an option pushes `/search` with the current query
//    object, the chosen `sort` and `page: 1`; the options are filled by the
//    observer template (R-039).
// c2 data-provider page: both options push `sort=relevance` (Q-043), the
//    router query loses `id` and keeps `offset`.
// c3 Q-049: the data-provider template is not an observer, so the options the
//    effect stores after the first render are not shown until something else
//    re-renders it: the menu is empty.
import React from 'react'
import { configure } from 'mobx'
import routerMock, { setRouter } from 'next/router'

import { setupMsw } from '../../utils/msw'
import {
  act,
  render,
  screen,
  waitFor as baseWaitFor,
  fireEvent,
  userEvent,
  withRouter,
  withStore,
} from '../../utils/render'
import RootStore from '../../../store/root'
import { getServerSideProps as searchProps } from '../../../pages/search'
import { getServerSideProps as providerProps } from '../../../pages/data-providers/[id]'
import SearchTemplate from '../../../templates/search'
import DataProviderTemplate from '../../../templates/data-provider'

// store writes after `await` outside an action raise a dev-only MobX warning
// that the production build of MobX does not print (findings/03 §2.3)
configure({ enforceActions: 'never' })

jest.setTimeout(30000)

const { server, resolver, http, HttpResponse } = setupMsw()

// waits are generous: the suites of other packages run on the same machine
const waitFor = (callback, options) =>
  baseWaitFor(callback, { timeout: 8000, ...options })

const router = routerMock
const E18_86 = 'https://api.core.ac.uk/internal/data-providers/86/account'

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

// every request of a mounted page has an answer and the page took it in
let started
let answered

const settle = async () => {
  await waitFor(() => expect(answered).toBe(started))
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 20)
    })
  })
  await waitFor(() => expect(answered).toBe(started))
}

beforeEach(() => {
  started = 0
  answered = 0
  server.events.on('request:start', () => {
    started += 1
  })
  server.events.on('response:mocked', () => {
    answered += 1
  })
  jest.spyOn(console, 'time').mockImplementation(() => {})
  jest.spyOn(console, 'timeEnd').mockImplementation(() => {})
  jest.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(async () => {
  // no answer may arrive after the test: the page would be unmounted
  await settle()
  server.events.removeAllListeners()
  jest.restoreAllMocks()
  expect(unmatched).toEqual([])
})

const gsspProps = async (run, context) => {
  const result = await run(context)
  return result.props
}

const sortBox = () => screen.getByText(/^Sort by/)
const activeLabel = () => sortBox().querySelector('span').textContent
// the sort menu (the filters bar above it is a <ul> too)
const menu = (container) => container.querySelector('ul.sort-box-menu')
const menuValues = (container) =>
  [...(menu(container)?.querySelectorAll('li') ?? [])].map((li) =>
    li.querySelector('p').textContent.trim()
  )
const radio = (value) => document.getElementById(value)

// the clickable text of a menu entry
const optionLabel = (container, value) =>
  [...menu(container).querySelectorAll('li p')].find(
    (p) => p.textContent.trim() === value
  )

describe('T-408 @P1 Sort', () => {
  describe('search page', () => {
    const mountSearch = async ({ sort, query }) => {
      const props = await gsspProps(searchProps, {
        query: { q: 'climate', ...(sort ? { sort } : {}) },
      })
      started = 0
      answered = 0
      setRouter({
        query,
        pathname: '/search',
        asPath: '/search?q=climate',
      })
      const store = new RootStore({ statistics: {} })
      const view = render(
        <SearchTemplate data={props.data} members={props.members} />,
        { wrappers: [withRouter(), withStore(store)] }
      )
      // the template fills the sort options in an effect, the observer shows
      // them
      await waitFor(() =>
        expect(screen.getByText(/^Sort by/)).toBeInTheDocument()
      )
      await settle()
      return { ...view, store, props }
    }

    test('T-408 c1 @P1 the active option follows data.sort and the menu lists recent and relevance', async () => {
      const { container, store } = await mountSearch({
        sort: 'recent',
        query: { q: 'climate', sort: 'recent', page: '1' },
      })
      // the box shows the active option; the menu is closed until it is clicked
      expect(activeLabel()).toBe('recent')
      expect(menu(container)).toBeNull()
      expect(store.search.sortOptions.map((o) => o.value)).toEqual([
        'recent',
        'relevance',
      ])

      await userEvent.setup().click(sortBox())
      expect(menuValues(container)).toEqual(['recent', 'relevance'])
      expect(radio('recent').checked).toBe(true)
      expect(radio('relevance').checked).toBe(false)
      // the radios carry the option value as name and id
      expect(radio('recent')).toHaveAttribute('type', 'radio')
      expect(radio('recent')).toHaveAttribute('name', 'recent')
      // a second click on the box closes the menu
      await userEvent.setup().click(sortBox())
      expect(menu(container)).toBeNull()
    })

    test('T-408 c1 @P1 without ?sort= the gSSP default is relevance, which is the active option', async () => {
      const { container, props } = await mountSearch({
        query: { q: 'climate', page: '1' },
      })
      expect(props.data.sort).toBe('relevance')
      expect(activeLabel()).toBe('relevance')
      await userEvent.setup().click(sortBox())
      expect(radio('relevance').checked).toBe(true)
      expect(radio('recent').checked).toBe(false)
      expect(menuValues(container)).toEqual(['recent', 'relevance'])
    })

    test('T-408 c1 @P1 choosing an option pushes /search with the query object, the new sort and page 1, once', async () => {
      const { container, store } = await mountSearch({
        sort: 'recent',
        query: { q: 'climate', sort: 'recent', page: '3', source: 'nav' },
      })
      const user = userEvent.setup()
      await user.click(sortBox())
      await user.click(optionLabel(container, 'relevance'))

      expect(router.push).toHaveBeenCalledTimes(1)
      // the router's query is spread, `sort` replaced, `page` is the number 1
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/search',
        query: { q: 'climate', sort: 'relevance', page: 1, source: 'nav' },
      })
      // the menu closes, the box shows the choice, the store marks it
      expect(menu(container)).toBeNull()
      expect(activeLabel()).toBe('relevance')
      expect(store.search.sortOptions.map((o) => [o.value, o.checked])).toEqual(
        [
          ['recent', false],
          ['relevance', true],
        ]
      )

      // the other way: the value is pushed as it is (no inversion here); the
      // reopened menu shows the choice made before
      await user.click(sortBox())
      expect(radio('relevance').checked).toBe(true)
      expect(radio('recent').checked).toBe(false)
      await user.click(optionLabel(container, 'recent'))
      expect(router.push).toHaveBeenCalledTimes(2)
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/search',
        query: { q: 'climate', sort: 'recent', page: 1, source: 'nav' },
      })
      expect(activeLabel()).toBe('recent')
    })

    test('T-408 c1 @P1 choosing the active option pushes it again, and clicking an entry row (not its text) works the same', async () => {
      const { container } = await mountSearch({
        sort: 'recent',
        query: { q: 'climate', sort: 'recent', page: '1' },
      })
      const user = userEvent.setup()
      await user.click(sortBox())
      await user.click(optionLabel(container, 'recent'))
      expect(router.push).toHaveBeenCalledTimes(1)
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/search',
        query: { q: 'climate', sort: 'recent', page: 1 },
      })

      await user.click(sortBox())
      fireEvent.click(menu(container).querySelectorAll('li')[1])
      expect(router.push).toHaveBeenCalledTimes(2)
      expect(router.push.mock.calls[1][0].query.sort).toBe('relevance')
    })

    test('T-408 c1 @P1 a mousedown outside the box closes the open menu without a push', async () => {
      const { container } = await mountSearch({
        sort: 'recent',
        query: { q: 'climate', page: '1' },
      })
      await userEvent.setup().click(sortBox())
      expect(menu(container)).not.toBeNull()
      fireEvent.mouseDown(document.body)
      expect(menu(container)).toBeNull()
      expect(router.push).not.toHaveBeenCalled()
    })
  })

  describe('data-provider page', () => {
    const PROVIDER_QUERY = { id: '86', q: '', offset: '20', sort: 'recency' }

    const mountProvider = async ({
      accounts,
      query = PROVIDER_QUERY,
      prepare,
    } = {}) => {
      if (accounts !== undefined)
        server.use(http.get(E18_86, () => HttpResponse.json(accounts)))

      const props = await gsspProps(providerProps, {
        params: { id: '86' },
        query: { q: '', offset: 0 },
      })
      started = 0
      answered = 0
      // Router.query is the object the store edits in place
      const routerQuery = { ...query }
      setRouter({
        query: routerQuery,
        pathname: '/data-providers/[id]',
        asPath: '/data-providers/86?q=&offset=20',
      })
      const store = new RootStore({ statistics: {} })
      // the state a visit to another page left in the store
      if (prepare) prepare(store)
      const view = render(
        <DataProviderTemplate data={props.data} onSearch={() => {}} />,
        { wrappers: [withRouter(), withStore(store)] }
      )
      await waitFor(() =>
        expect(screen.getByText(/^Sort by/)).toBeInTheDocument()
      )
      await settle()
      return { ...view, store, props, routerQuery }
    }

    test('T-408 c2 @P1 both options push sort=relevance (Q-043), id is removed from the router query, offset is kept', async () => {
      const { container, routerQuery, store } = await mountProvider()
      const user = userEvent.setup()

      // "recent" pushes relevance
      await user.click(sortBox())
      expect(menuValues(container)).toEqual(['recent', 'relevance'])
      await user.click(optionLabel(container, 'recent'))
      expect(router.push).toHaveBeenCalledTimes(1)
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/data-providers/86',
        query: { q: '', offset: '20', sort: 'relevance', page: 1 },
      })
      // the router's own query object lost `id` (it is edited in place)
      expect('id' in routerQuery).toBe(false)
      expect(router.query).toBe(routerQuery)
      // the option shown as chosen is the one that was clicked
      expect(store.search.sortOptions.map((o) => [o.value, o.checked])).toEqual(
        [
          ['recent', true],
          ['relevance', false],
        ]
      )

      // "relevance" pushes relevance as well, with the same offset
      await user.click(sortBox())
      await user.click(optionLabel(container, 'relevance'))
      expect(router.push).toHaveBeenCalledTimes(2)
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/data-providers/86',
        query: { q: '', offset: '20', sort: 'relevance', page: 1 },
      })
      expect(store.search.sortOptions.map((o) => [o.value, o.checked])).toEqual(
        [
          ['recent', false],
          ['relevance', true],
        ]
      )
    })

    test('T-408 c2 @P1 the pushed query keeps every other parameter, and offset is not reset by page: 1', async () => {
      const { container } = await mountProvider({
        query: { id: '86', q: 'open', offset: '40', limit: '10', t: 'x-1' },
      })
      const user = userEvent.setup()
      await user.click(sortBox())
      await user.click(optionLabel(container, 'recent'))
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/data-providers/86',
        query: {
          q: 'open',
          offset: '40',
          limit: '10',
          t: 'x-1',
          sort: 'relevance',
          page: 1,
        },
      })
    })

    test('T-408 c3 @P1 Q-049: nothing re-renders the non-observer template, so the menu is empty', async () => {
      // no account, so the claim card has nothing to report back
      const { container, store } = await mountProvider({ accounts: [] })

      // the effect stored the options ...
      expect(store.search.sortOptions.map((o) => o.value)).toEqual([
        'recent',
        'relevance',
      ])
      // ... but the template rendered before it ran and was not told: the box
      // has no active option and the opened menu has no entries
      expect(activeLabel()).toBe('')
      await userEvent.setup().click(sortBox())
      expect(menu(container)).not.toBeNull()
      expect(menuValues(container)).toEqual([])
      expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(0)
    })

    test('T-408 c3 @P1 Q-049 variant (R-039): arriving from /search?sort=recent the box keeps the option of the search page, though the store has none checked', async () => {
      const { container, store } = await mountProvider({
        accounts: [],
        // the search page stored its options with "recent" checked
        prepare: (fresh) => fresh.search.setSortOptions('recent'),
      })

      // the provider's effect stored options without a checked one ...
      expect(store.search.sortOptions.map((o) => [o.value, o.checked])).toEqual(
        [
          ['recent', false],
          ['relevance', false],
        ]
      )
      // ... but the template was not re-rendered, so the box still shows the
      // option that was checked when it rendered, and so does the menu
      expect(activeLabel()).toBe('recent')
      await userEvent.setup().click(sortBox())
      expect(menuValues(container)).toEqual(['recent', 'relevance'])
      expect(radio('recent').checked).toBe(true)
      expect(radio('relevance').checked).toBe(false)
    })

    test('T-408 c3 @P1 Q-049: any other re-render (here the claim card finding accounts) fills the menu', async () => {
      // the recorded answer lists 14 accounts of provider 86: the card sets a
      // state of the template, which re-renders it
      const { container } = await mountProvider()

      expect(activeLabel()).toBe('recent')
      await userEvent.setup().click(sortBox())
      expect(menuValues(container)).toEqual(['recent', 'relevance'])
      // data.sort does not exist on the provider props: no option is checked
      // and the box falls back to the first one
      expect(radio('recent').checked).toBe(false)
      expect(radio('relevance').checked).toBe(false)
    })
  })
})
