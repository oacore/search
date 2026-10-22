// T-420 (41 E, R-051): the header search as the three pages wire it
// (`Header.useSearchBar` in pages/search/index.jsx, pages/works/[id].jsx,
// pages/outputs/[id].jsx), with the real pages, the real Layout and Header and
// the real design Select. The pages are rendered in their error state (the
// search page without results, the work and output pages with `serverError`):
// the hook runs before those branches, and nothing else of the page matters
// here.
//
// c1 Q-057: the design hook dispatches the config once, at mount, so a search
// from the header reuses the query object, the initial text and the label of
// the first render (sort, t, limit of the mount-time URL); Q-012: the work page
// pushes `/search?q=<term>` as a string, unencoded. c2: the output page does
// the same with `/search/?q=<term>`.
//
// Next hands a page a new snapshot of the router on every route change
// (makePublicRouterInstance, next/dist/client/router.js: `query` is copied, the
// methods delegate to the live router). The router mock is one mutable object,
// so the tests that depend on the snapshot make `useRouter` return one.
import React from 'react'
import nextRouter, { setRouter } from 'next/router'
import { DesignProvider } from '@oacore/design'

import {
  render,
  screen,
  userEvent,
  withRouter,
  withStore,
} from '../../utils/render'
import RootStore from '../../../store/root'
import Layout from '../../../modules/layout'
import SearchPage from '../../../pages/search/index'
import WorkPage from '../../../pages/works/[id]'
import OutputPage from '../../../pages/outputs/[id]'

jest.setTimeout(30000)

const COUNT = 1234567
const LABEL = 'Search 1,234,567 from papers around the world'

const store = () => new RootStore({ statistics: { totalArticlesCount: COUNT } })

// the frame the app puts around a page: design provider, header, footer
const Frame = ({ children }) => (
  <DesignProvider>
    <Layout isSearchPage={false}>{children}</Layout>
  </DesignProvider>
)

const mount = (element) =>
  render(element, {
    wrappers: [withRouter(), withStore(store()), Frame],
  })

// Next's public router instance: a copy of the state with `query` copied, and
// methods that delegate to the live router
let snapshot
const publish = (state) => {
  const { push, replace } = nextRouter
  snapshot = {
    ...nextRouter,
    ...state,
    query: { ...state.query },
    push: (...args) => push(...args),
    replace: (...args) => replace(...args),
  }
  setRouter(state)
  return snapshot
}
beforeEach(() => {
  snapshot = undefined
  jest
    .spyOn(require('next/router'), 'useRouter')
    .mockImplementation(() => snapshot || nextRouter)
})
afterEach(() => {
  jest.restoreAllMocks()
})

const pushes = () => nextRouter.push.mock.calls

// types the term into the header search and confirms with Enter
const search = async (term) => {
  const user = userEvent.setup()
  const input = screen.getByRole('combobox', { name: LABEL })
  await user.click(input)
  await user.clear(input)
  if (term !== '') await user.type(input, term)
  await user.keyboard('{Enter}')
}

// the works and outputs pages register a search bar that starts hidden
const openHiddenSearch = async () => {
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Search icon' }))
}

const workError = { code: 404, message: 'not found', prevHistoryUrl: null }
const queryOf = (url) => {
  const { searchParams, hash } = new URL(url, 'http://localhost')
  return { params: Object.fromEntries(searchParams), hash }
}

describe('T-420 @P1 header search wiring', () => {
  describe('T-420 c1 @P1 Q-057 config captured at mount, Q-012 unencoded query', () => {
    const url = '/search?q=climate&sort=recent&limit=20&t=abc&page=3'
    const mountSearch = (data = { query: 'climate', results: [] }) => {
      publish({
        pathname: '/search',
        asPath: url,
        query: {
          q: 'climate',
          sort: 'recent',
          limit: '20',
          t: 'abc',
          page: '3',
        },
      })
      return mount(<SearchPage data={data} members={[]} />)
    }

    test('T-420 c1 @P1 the search page shows the bar open, with the initial query, the label and the advanced-search help', () => {
      mountSearch()
      const input = screen.getByRole('combobox', { name: LABEL })
      expect(input.value).toBe('climate')
      expect(input.getAttribute('placeholder')).toBe(LABEL)
      expect(screen.getByText('How to search?')).toBeTruthy()
      // open from the start: no toggle button for the hidden variant
      expect(screen.queryByRole('button', { name: 'Search icon' })).toBeNull()
      expect(pushes()).toEqual([])
    })

    test('T-420 c1 @P1 Q-057 a search pushes { pathname: undefined, query } with the URL query of the first render, q replaced and page 1', async () => {
      mountSearch()
      await search('solar energy')
      expect(pushes()).toHaveLength(1)
      const [arg] = pushes()[0]
      expect(pushes()[0]).toHaveLength(1)
      // the header calls back with the term only; pathName is undefined
      expect(arg).toStrictEqual({
        pathname: undefined,
        query: {
          q: 'solar energy',
          sort: 'recent',
          limit: '20',
          t: 'abc',
          page: 1,
        },
      })
    })

    test('T-420 c1 @P1 Q-057 after a route change the next search still carries the sort, limit, t and page of the first render', async () => {
      const view = mountSearch()
      // the visitor switches to relevance order and page 1, without a limit
      // or a t: Next publishes a new snapshot and re-renders the page
      publish({
        pathname: '/search',
        asPath: '/search?q=climate&sort=relevance&page=1',
        query: { q: 'climate', sort: 'relevance', page: '1' },
      })
      view.rerender(
        <SearchPage data={{ query: 'climate', results: [] }} members={[]} />
      )
      await search('wind')
      const [arg] = pushes()[0]
      // stale: sort=recent, limit=20, t=abc, from the mount-time snapshot
      expect(arg.query).toEqual({
        q: 'wind',
        sort: 'recent',
        limit: '20',
        t: 'abc',
        page: 1,
      })
      expect(arg.query.sort).not.toBe(snapshot.query.sort)
      expect(snapshot.query).toEqual({
        q: 'climate',
        sort: 'relevance',
        page: '1',
      })
    })

    test('T-420 c1 @P1 Q-057 the second search of the same mount reuses it again, whatever the first one pushed', async () => {
      const view = mountSearch()
      await search('first')
      publish({
        pathname: '/search',
        asPath: '/search?q=first&page=1',
        query: { q: 'first', page: '1' },
      })
      view.rerender(
        <SearchPage data={{ query: 'first', results: [] }} members={[]} />
      )
      await search('second')
      expect(pushes()).toHaveLength(2)
      expect(pushes()[0][0].query.q).toBe('first')
      expect(pushes()[1][0]).toStrictEqual({
        pathname: undefined,
        query: {
          q: 'second',
          sort: 'recent',
          limit: '20',
          t: 'abc',
          page: 1,
        },
      })
    })

    test('T-420 c1 @P1 Q-057 the initial text is the one of the first render: a page re-rendered with another query keeps the old text in the bar', () => {
      const view = mountSearch({ query: 'climate', results: [] })
      expect(screen.getByRole('combobox', { name: LABEL }).value).toBe(
        'climate'
      )
      publish({
        pathname: '/search',
        asPath: '/search?q=solar',
        query: { q: 'solar' },
      })
      view.rerender(
        <SearchPage data={{ query: 'solar', results: [] }} members={[]} />
      )
      // the page itself shows the new query ...
      expect(
        screen.getByText('Sorry, we couldn’t find any results for “solar”.')
      ).toBeTruthy()
      // ... the bar does not
      expect(screen.getByRole('combobox', { name: LABEL }).value).toBe(
        'climate'
      )
    })

    test('T-420 c1 @P1 Q-057 the label is the one of the first render too', () => {
      const view = mountSearch()
      const first = screen.getByRole('combobox', { name: LABEL })
      view.rerender(
        <SearchPage data={{ query: 'climate', results: [] }} members={[]} />
      )
      expect(screen.getByRole('combobox', { name: LABEL })).toBe(first)
    })

    test('T-420 c1 @P1 the bar is removed with the page: the header has no search after unmount', () => {
      const view = mountSearch()
      expect(screen.queryByRole('combobox')).not.toBeNull()
      view.unmount()
      expect(screen.queryByRole('combobox')).toBeNull()
    })

    test('T-420 c1 @P1 Q-012 the work page pushes the term into the URL as a string, unencoded', async () => {
      publish({ pathname: '/works/[id]', asPath: '/works/1001/', query: {} })
      mount(<WorkPage serverError={workError} data={null} />)
      await openHiddenSearch()
      await search('machine learning')
      expect(pushes()).toEqual([['/search?q=machine learning']])
    })

    test.each([
      // [typed, the string handed to router.push, q Next parses from it]
      ['C# & C++', '/search?q=C# & C++', 'C'],
      ['a&page=5', '/search?q=a&page=5', 'a'],
      ['tea&coffee', '/search?q=tea&coffee', 'tea'],
      ['100%', '/search?q=100%', '100%'],
      ['x=y', '/search?q=x=y', 'x=y'],
    ])(
      'T-420 c1 @P1 Q-012 work page: %p is pushed as %p and Next reads q=%p',
      async (typed, pushed, q) => {
        publish({ pathname: '/works/[id]', asPath: '/works/1001/', query: {} })
        mount(<WorkPage serverError={workError} data={null} />)
        await openHiddenSearch()
        await search(typed)
        expect(pushes()).toEqual([[pushed]])
        expect(queryOf(pushed).params.q).toBe(q)
      }
    )

    test('T-420 c1 @P1 Q-012 "a&page=5" injects a parameter: page=5 beside q=a; "C# & C++" is cut at the hash', async () => {
      publish({ pathname: '/works/[id]', asPath: '/works/1001/', query: {} })
      mount(<WorkPage serverError={workError} data={null} />)
      await openHiddenSearch()
      await search('a&page=5')
      expect(queryOf(pushes()[0][0])).toEqual({
        params: { q: 'a', page: '5' },
        hash: '',
      })
      await search('C# & C++')
      expect(queryOf(pushes()[1][0])).toEqual({
        params: { q: 'C' },
        hash: '#%20&%20C++',
      })
    })

    test('T-420 c1 @P1 the work page bar starts hidden behind the magnifier button and labels itself with the count', async () => {
      publish({ pathname: '/works/[id]', asPath: '/works/1001/', query: {} })
      mount(<WorkPage serverError={workError} data={null} />)
      expect(screen.queryByRole('combobox')).toBeNull()
      expect(screen.getByRole('button', { name: 'Search icon' })).toBeTruthy()
      await openHiddenSearch()
      const input = screen.getByRole('combobox', { name: LABEL })
      // initQuery '' on the work page
      expect(input.value).toBe('')
      expect(input.getAttribute('placeholder')).toBe(LABEL)
      // no advanced-search help on this page
      expect(screen.queryByText('How to search?')).toBeNull()
    })

    test('T-420 c1 @P1 an empty search pushes /search?q= (no guard on the term)', async () => {
      publish({ pathname: '/works/[id]', asPath: '/works/1001/', query: {} })
      mount(<WorkPage serverError={workError} data={null} />)
      await openHiddenSearch()
      await search('')
      expect(pushes()).toEqual([['/search?q=']])
    })
  })

  describe('T-420 c2 @P1 the output page pushes /search/?q=', () => {
    test('T-420 c2 @P1 outputs push the term with the trailing slash: /search/?q=<term>', async () => {
      publish({
        pathname: '/outputs/[id]',
        asPath: '/outputs/2001/',
        query: {},
      })
      mount(<OutputPage serverError={workError} data={null} />)
      await openHiddenSearch()
      await search('machine learning')
      expect(pushes()).toEqual([['/search/?q=machine learning']])
    })

    test.each([
      ['C# & C++', '/search/?q=C# & C++', 'C'],
      ['a&page=5', '/search/?q=a&page=5', 'a'],
      ['100%', '/search/?q=100%', '100%'],
    ])(
      'T-420 c2 @P1 Q-012 output page: %p is pushed as %p, unencoded (Next reads q=%p)',
      async (typed, pushed, q) => {
        publish({
          pathname: '/outputs/[id]',
          asPath: '/outputs/2001/',
          query: {},
        })
        mount(<OutputPage serverError={workError} data={null} />)
        await openHiddenSearch()
        await search(typed)
        expect(pushes()).toEqual([[pushed]])
        expect(queryOf(pushed).params.q).toBe(q)
      }
    )

    test('T-420 c2 @P1 the work and output pages differ only by the slash after /search', async () => {
      publish({ pathname: '/works/[id]', asPath: '/works/1/', query: {} })
      const work = mount(<WorkPage serverError={workError} data={null} />)
      await openHiddenSearch()
      await search('same term')
      work.unmount()
      publish({ pathname: '/outputs/[id]', asPath: '/outputs/1/', query: {} })
      mount(<OutputPage serverError={workError} data={null} />)
      await openHiddenSearch()
      await search('same term')
      const [[fromWork], [fromOutput]] = pushes()
      expect(fromWork).toBe('/search?q=same term')
      expect(fromOutput).toBe('/search/?q=same term')
      expect(fromOutput.replace('/search/?', '/search?')).toBe(fromWork)
    })

    test('T-420 c2 @P1 the output page bar is the same hidden bar: magnifier first, the count in the label, no help text', async () => {
      publish({
        pathname: '/outputs/[id]',
        asPath: '/outputs/2001/',
        query: {},
      })
      mount(<OutputPage serverError={workError} data={null} />)
      expect(screen.queryByRole('combobox')).toBeNull()
      await openHiddenSearch()
      expect(screen.getByRole('combobox', { name: LABEL }).value).toBe('')
      expect(screen.queryByText('How to search?')).toBeNull()
    })
  })
})
