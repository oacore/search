// T-403 (41 E, R-001, R-030): the filters bar with the real design library, the
// real filters store and MSW answering the aggregation POSTs (E2) from the
// recorded `climate` fixtures. c1 LoadingBlock, c2 facet search, c3 the exact
// Router.push of a toggle, c4 "..." counts, c5 "Clear all filters" only when an
// item is checked, c6 no `undefined` class token, c7 Q-092 (clear-all sends two
// identical aggregation POSTs, a refined query keeps stale buckets with count
// 0).
import React from 'react'
import { configure } from 'mobx'
import routerMock, { setRouter } from 'next/router'

import { setupMsw } from '../../../utils/msw'
import {
  render,
  screen,
  waitFor as baseWaitFor,
  userEvent,
  withRouter,
  withStore,
} from '../../../utils/render'
import RootStore from '../../../../store/root'
import FiltersBar from '../../../../modules/filters'

// store writes after `await` outside an action raise a dev-only MobX warning
// that the production build of MobX does not print (findings/03 §2.3)
configure({ enforceActions: 'never' })

jest.setTimeout(30000)

const { server, http, resolver } = setupMsw()

// waits are generous: the suites of other packages run on the same machine
const waitFor = (callback, options) =>
  baseWaitFor(callback, { timeout: 8000, ...options })

const AGG_URL = 'https://api.core.ac.uk/v3/search/works/aggregate'
const ALL = [
  'fieldsOfStudy',
  'yearPublished',
  'documentType',
  'authors',
  'language',
  'publisher',
]
const LABELS = ['field', 'year', 'type', 'author', 'language', 'publisher']
const THESIS_QUERY = 'climate AND documentType:"thesis"'
const bodyOf = (q) => JSON.stringify({ aggregations: ALL, q })

// the recorded answer for a query, read straight from the fixture set
const aggregate = (q) =>
  JSON.parse(resolver.resolve('POST', AGG_URL, bodyOf(q)).body.toString())
    .aggregations

const fmt = (n) => n.toLocaleString('en-GB')
// quotes are stripped from the values (utils/filters-transform.js:76, T-105)
const shown = (value) => value.replace(/['"]+/g, '')

let posts

beforeEach(() => {
  posts = []
  // records the body, then lets the fixture resolver answer
  server.use(
    http.post(AGG_URL, async ({ request }) => {
      posts.push(await request.clone().text())
    })
  )
  setRouter({ query: { q: 'climate', page: '1' } })
})

const deferred = () => {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}

// holds every aggregation answer until `release()`
const hold = () => {
  const gate = deferred()
  server.use(
    http.post(AGG_URL, async () => {
      await gate.promise
    })
  )
  return gate.resolve
}

const mount = (query = 'climate', sortType = 'relevance') => {
  const store = new RootStore({ statistics: {} })
  const view = render(
    <FiltersBar query={query} sortType={sortType} styleProp />,
    {
      wrappers: [withRouter(), withStore(store)],
    }
  )
  const rerender = (q, s = sortType) =>
    view.rerender(<FiltersBar query={q} sortType={s} styleProp />)
  return { ...view, store, rerender }
}

const idle = (store) =>
  waitFor(() => expect(store.filters.getState().isLoading).toBe(false))

const bar = (container) => container.querySelector('ul.bar')

const facetLabels = (container) =>
  [...container.querySelectorAll('li.bar-item-wrapper > div > p')].map(
    (p) => p.textContent
  )

const facet = (container, label) =>
  [...container.querySelectorAll('li.bar-item-wrapper')].find(
    (li) => li.querySelector(':scope > div > p').textContent === label
  )

// the clickable label of a facet (the highlight class sits on it)
const head = (container, label) =>
  facet(container, label).querySelector(':scope > div')

const openFacet = async (user, container, label) => {
  await user.click(facet(container, label).querySelector(':scope > div'))
  return facet(container, label).querySelector(':scope > ul.filter-box')
}

// [{ label, count, tokens, icon }] of an open facet
const itemsOf = (box) =>
  [...box.querySelectorAll('li.filter-box-item')].map((li) => ({
    label: li.querySelector('p').textContent,
    count: li.querySelector('span').textContent,
    tokens: li.className.split(/\s+/),
    icon: li.querySelector('svg use').getAttribute('href').split('#')[1],
  }))

describe('T-403 @P0 filters bar', () => {
  test('T-403 c1 @P0 LoadingBlock: six labelled facets while the first answer is pending, a "Loading" box on click, replaced by the facets', async () => {
    const release = hold()
    const user = userEvent.setup()
    const { container, store } = mount()

    // pending: the block stands alone in the list
    const list = bar(container)
    expect(list.children).toHaveLength(1)
    const block = list.querySelector(':scope > div.loading-block')
    expect(block).not.toBeNull()
    expect(
      [...block.querySelectorAll('li.bar-item-wrapper > div > p')].map(
        (p) => p.textContent
      )
    ).toEqual(['Field', 'Year', 'Type', 'Author', 'Language', 'Publisher'])
    expect(screen.queryByText('Clear all filters')).toBeNull()
    expect(store.filters.getState().isLoading).toBe(true)
    expect(Object.keys(store.filters.getState().initialData)).toHaveLength(0)

    // a facet of the block opens a box with a spinner and "Loading", and closes
    // again on the second click
    const year = [...block.querySelectorAll('li.bar-item-wrapper')].find(
      (li) => li.querySelector('p').textContent === 'Year'
    )
    await user.click(year.querySelector('div'))
    const box = year.querySelector(':scope > div.filter-box.loading-box')
    expect(box).not.toBeNull()
    expect(box.textContent).toBe('Loading')
    await user.click(year.querySelector('div'))
    expect(year.querySelector('.loading-box')).toBeNull()

    // the answer replaces the block with the six facets, lowercase
    release()
    await idle(store)
    expect(container.querySelector('.loading-block')).toBeNull()
    expect(facetLabels(container)).toEqual(LABELS)
    expect(posts).toEqual([bodyOf('climate')])
  })

  test('T-403 c1 @P0 LoadingBlock: it shows again after a new query resets the store (route change)', async () => {
    const { container, store, rerender } = mount()
    await idle(store)
    expect(container.querySelector('.loading-block')).toBeNull()

    const release = hold()
    // 'x' does not contain 'climate': the bar drops its data first
    rerender('x')
    expect(container.querySelector('.loading-block')).not.toBeNull()
    expect(facetLabels(container)).toEqual([
      'Field',
      'Year',
      'Type',
      'Author',
      'Language',
      'Publisher',
    ])
    release()
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(posts[1]).toBe(bodyOf('x'))
  })

  test('T-403 c2 @P0 facet search: case-insensitive substring over the values, ordered by count, empty result leaves the field alone', async () => {
    const user = userEvent.setup()
    const { container, store } = mount()
    await idle(store)
    const box = await openFacet(user, container, 'type')

    // everything first, as recorded, by count descending
    const all = Object.entries(aggregate('climate').documentType).sort(
      (a, b) => b[1] - a[1]
    )
    expect(itemsOf(box).map((i) => [i.label, i.count])).toEqual(
      all.map(([k, v]) => [k, fmt(v)])
    )
    expect(box.firstElementChild.tagName).toBe('DIV')
    const field = screen.getByLabelText('Search')
    expect(field.value).toBe('')

    await user.type(field, 'ART')
    const hits = all.filter(([k]) => k.toLowerCase().includes('art'))
    expect(hits.length).toBeGreaterThan(1)
    expect(field.value).toBe('ART')
    expect(itemsOf(box).map((i) => [i.label, i.count])).toEqual(
      hits.map(([k, v]) => [k, fmt(v)])
    )

    await user.clear(field)
    expect(itemsOf(box)).toHaveLength(all.length)

    await user.type(field, 'zzzz')
    expect(itemsOf(box)).toEqual([])
    expect(field.value).toBe('zzzz')
    // the facet stays open and the search field stays in the box
    expect(box.querySelector('#search-filter')).not.toBeNull()
  })

  test('T-403 c2 @P0 the year facet has no search field: its box holds the presets, the histogram and the selects', async () => {
    const user = userEvent.setup()
    const { container, store } = mount()
    await idle(store)
    const box = await openFacet(user, container, 'year')
    expect(box.classList.contains('year-box')).toBe(true)
    expect(box.querySelector('#search-filter')).toBeNull()
    expect(box.querySelector('select')).not.toBeNull()
  })

  test('T-403 c3 @P0 exact push: a toggle pushes { pathname: undefined, query: {...Router.query, q, page: 1} } once', async () => {
    setRouter({ query: { q: 'climate', page: '3', sort: 'recent', t: 'abc' } })
    const user = userEvent.setup()
    const { container, store } = mount()
    await idle(store)
    const box = await openFacet(user, container, 'type')
    const before = itemsOf(box).map((i) => i.label)
    const picked = before.indexOf('journal article')
    expect(picked).toBeGreaterThan(1)
    expect(head(container, 'type').classList.contains('bar-item-active')).toBe(
      false
    )

    await user.click(box.querySelectorAll('li.filter-box-item')[picked])

    expect(routerMock.push).toHaveBeenCalledTimes(1)
    expect(routerMock.push.mock.calls[0]).toStrictEqual([
      {
        pathname: undefined,
        query: {
          q: 'climate AND documentType:"journal article"',
          page: 1,
          sort: 'recent',
          t: 'abc',
        },
      },
    ])
    // the item is flipped in the store before the route changes, the checked
    // item moves to the top, and the facet label is highlighted: the box and
    // the bar share the item objects (R-030)
    const after = itemsOf(box)
    expect(after.map((i) => i.label)).toEqual([
      'journal article',
      ...before.filter((l) => l !== 'journal article'),
    ])
    expect(after.map((i) => i.icon)).toEqual([
      'checkbox-marked',
      ...after.slice(1).map(() => 'checkbox-blank-outline'),
    ])
    expect(head(container, 'type').classList.contains('bar-item-active')).toBe(
      true
    )
    expect(
      store.filters.getState().data[2].items.filter((i) => i.checked)
    ).toHaveLength(1)
    // no aggregation request until the route changes
    expect(posts).toHaveLength(1)
  })

  test('T-403 c3 @P0 exact push: a checked value is removed from q again, and the highlight goes', async () => {
    setRouter({ query: { q: THESIS_QUERY, page: '2' } })
    const user = userEvent.setup()
    const { container, store } = mount(THESIS_QUERY)
    await idle(store)
    expect(head(container, 'type').classList.contains('bar-item-active')).toBe(
      true
    )
    const box = await openFacet(user, container, 'type')
    const items = itemsOf(box)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ label: 'thesis', icon: 'checkbox-marked' })

    await user.click(box.querySelector('li.filter-box-item'))

    expect(routerMock.push.mock.calls).toStrictEqual([
      [{ pathname: undefined, query: { q: 'climate', page: 1 } }],
    ])
    expect(itemsOf(box)[0].icon).toBe('checkbox-blank-outline')
    expect(head(container, 'type').classList.contains('bar-item-active')).toBe(
      false
    )
  })

  test('T-403 c4 @P0 "..." counts: after a toggle every count reads "..." and the items are disabled', async () => {
    const user = userEvent.setup()
    const { container, store } = mount()
    await idle(store)
    const box = await openFacet(user, container, 'type')
    expect(itemsOf(box).every((i) => /^[\d,]+$/.test(i.count))).toBe(true)
    expect(itemsOf(box).some((i) => i.tokens.includes('disabled'))).toBe(false)

    await user.click(box.querySelector('li.filter-box-item'))

    expect(store.filters.getState().isLoading).toBe(true)
    const after = itemsOf(box)
    expect(after.length).toBeGreaterThan(1)
    expect(after.map((i) => i.count)).toEqual(after.map(() => '...'))
    expect(after.every((i) => i.tokens.includes('disabled'))).toBe(true)
    // the labels are untouched
    expect(after.map((i) => i.label)).toEqual(
      Object.entries(aggregate('climate').documentType)
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k)
    )
  })

  test('T-403 c4 @P0 "..." counts: while a refined query is being fetched the open facet shows "..." and then the new counts', async () => {
    const user = userEvent.setup()
    const { container, store, rerender } = mount()
    await idle(store)
    const box = await openFacet(user, container, 'type')
    const before = itemsOf(box)

    const release = hold()
    rerender('climate change')
    expect(store.filters.getState().isLoading).toBe(true)
    expect(itemsOf(box).map((i) => i.count)).toEqual(before.map(() => '...'))

    release()
    await idle(store)
    const refined = aggregate('climate change').documentType
    const counts = Object.fromEntries(
      itemsOf(box).map((i) => [i.label, i.count])
    )
    expect(counts.thesis).toBe(fmt(refined.thesis))
    expect(Object.keys(counts).sort()).toEqual(Object.keys(refined).sort())
  })

  test('T-403 c5 @P0 Clear all filters is absent without a checked item and present with one', async () => {
    const plain = mount('climate')
    await idle(plain.store)
    expect(screen.queryByText('Clear all filters')).toBeNull()
    expect(plain.store.filters.getState().isVisibleClearButton).toBeFalsy()
    plain.unmount()

    setRouter({ query: { q: THESIS_QUERY, page: '1' } })
    const checked = mount(THESIS_QUERY)
    await idle(checked.store)
    const clear = screen.getByRole('button', { name: 'Clear all filters' })
    expect(clear.tagName).toBe('BUTTON')
    expect(clear.getAttribute('type')).toBe('button')
    expect(clear.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['clear-button', 'button'])
    )
    // the last child of the list, after the six facets
    expect(bar(checked.container).lastElementChild).toBe(clear)
    expect(facetLabels(checked.container)).toEqual(LABELS)
    expect(checked.store.filters.getState().isVisibleClearButton).toBeTruthy()
  })

  test('T-403 c5 @P0 Clear all filters appears as soon as an item is toggled on', async () => {
    const user = userEvent.setup()
    const { container, store } = mount()
    await idle(store)
    expect(screen.queryByText('Clear all filters')).toBeNull()
    const box = await openFacet(user, container, 'type')
    await user.click(box.querySelector('li.filter-box-item'))
    expect(screen.getByText('Clear all filters')).toBeTruthy()
  })

  test('T-403 c6 @P0 no class token is `undefined` or `null`, and the empty class attributes are the known ones', async () => {
    const user = userEvent.setup()
    setRouter({ query: { q: THESIS_QUERY, page: '1' } })
    const release = hold()
    const { container, store } = mount(THESIS_QUERY)
    const seen = new Set()
    const scan = () => {
      for (const el of container.querySelectorAll('[class]')) {
        const tokens = el.getAttribute('class').split(/\s+/)
        if (tokens.some((t) => t === 'undefined' || t === 'null'))
          throw new Error(`bad class on <${el.tagName}>: ${el.className}`)
        for (const t of tokens) if (t) seen.add(t)
      }
      return [...container.querySelectorAll('[class=""]')].map((e) => e.tagName)
    }

    // loading, with a facet opened
    expect(scan()).toEqual([])
    await user.click(container.querySelector('li.bar-item-wrapper > div'))
    expect(scan()).toEqual([])
    // loaded, several boxes, the toggle button
    release()
    await idle(store)
    expect(scan()).toEqual([])
    await openFacet(user, container, 'type')
    expect(scan()).toEqual([])
    await openFacet(user, container, 'field')
    expect(scan()).toEqual([])
    await openFacet(user, container, 'author')
    expect(scan()).toEqual([])
    await openFacet(user, container, 'year')
    // the one empty attribute of the bar: the "Custom range" text of the year
    // box when no range is chosen
    expect(scan()).toEqual(['P'])
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    expect(bar(container).classList.contains('expanded')).toBe(true)
    scan()

    // the module keys the bar relies on are all present
    expect([...seen]).toEqual(
      expect.arrayContaining([
        'container',
        'search-container',
        'toggle-button',
        'bar',
        'search-bar',
        'bar-item-wrapper',
        'bar-item',
        'bar-item-active',
        'filter-box',
        'wide-box',
        'year-box',
        'filter-box-item',
        'label',
        'label-text',
        'checkbox',
        'text-field',
        'clear-button',
        'expanded',
      ])
    )
  })

  test('T-403 c7 @P0 Q-092: Clear all sends two identical aggregation POSTs (its own, then the one of the new q)', async () => {
    setRouter({ query: { q: THESIS_QUERY, page: '1' } })
    const user = userEvent.setup()
    const { store, rerender } = mount(THESIS_QUERY)
    await idle(store)
    expect(posts).toEqual([bodyOf(THESIS_QUERY)])

    await user.click(screen.getByRole('button', { name: 'Clear all filters' }))
    await idle(store)
    // the click: the router push (mock, no navigation) and one POST from reset
    expect(routerMock.push.mock.calls).toStrictEqual([
      [{ pathname: undefined, query: { q: 'climate', page: 1 } }],
    ])
    expect(posts).toEqual([bodyOf(THESIS_QUERY), bodyOf('climate')])
    // the answer carries no checked item: the button is gone again
    expect(screen.queryByText('Clear all filters')).toBeNull()

    // the route change brings the new q back into the bar: the second POST
    rerender('climate')
    await waitFor(() => expect(posts).toHaveLength(3))
    await idle(store)
    expect(posts[2]).toBe(posts[1])
    expect(posts.slice(1)).toEqual([bodyOf('climate'), bodyOf('climate')])
  })

  test('T-403 c7 @P0 Q-092: a toggle or a new q sends one POST, a new page or sort sends none', async () => {
    const { store, rerender } = mount()
    await idle(store)
    expect(posts).toHaveLength(1)

    // page and sort change, q does not: no request
    rerender('climate', 'recent')
    rerender('climate', 'relevance')
    await idle(store)
    expect(posts).toHaveLength(1)

    // a toggle changes q: one request
    rerender(THESIS_QUERY)
    await waitFor(() => expect(posts).toHaveLength(2))
    await idle(store)
    expect(posts[1]).toBe(bodyOf(THESIS_QUERY))

    // a new q: one request
    rerender('x')
    await waitFor(() => expect(posts).toHaveLength(3))
    await idle(store)
    expect(posts[2]).toBe(bodyOf('x'))
  })

  test('T-403 c7 @P0 Q-092: a refined query containing the previous q keeps the stale buckets with count 0', async () => {
    const user = userEvent.setup()
    const { container, store, rerender } = mount('climate')
    await idle(store)
    const base = aggregate('climate')
    const refined = aggregate('climate change')

    rerender('climate change')
    await waitFor(() => expect(posts).toHaveLength(2))
    await idle(store)
    // no reset happened: the first answer is still the initial data
    expect(
      Object.keys(store.filters.getState().initialData.fieldsOfStudy)
    ).toHaveLength(Object.keys(base.fieldsOfStudy).length)

    const box = await openFacet(user, container, 'field')
    const items = itemsOf(box)
    const stale = Object.keys(base.fieldsOfStudy)
      .filter((k) => !(k in refined.fieldsOfStudy))
      .map(shown)
    const fresh = Object.keys(refined.fieldsOfStudy)
      .filter((k) => !(k in base.fieldsOfStudy))
      .map(shown)
    expect(stale.length).toBeGreaterThan(0)
    expect(fresh.length).toBeGreaterThan(0)
    // all buckets of both answers are listed
    expect(items).toHaveLength(
      new Set([
        ...Object.keys(base.fieldsOfStudy),
        ...Object.keys(refined.fieldsOfStudy),
      ]).size
    )
    for (const key of stale) {
      const item = items.find((i) => i.label === key)
      expect(item.count).toBe('0')
      expect(item.tokens).toContain('disabled')
    }
    // the others carry the new counts
    for (const [key, count] of Object.entries(refined.fieldsOfStudy)) {
      const item = items.find((i) => i.label === shown(key))
      expect(item.count).toBe(fmt(count))
      expect(item.tokens.includes('disabled')).toBe(false)
    }
    // the stale buckets sit at the end of the list (count descending)
    expect(items.slice(-stale.length).map((i) => i.count)).toEqual(
      stale.map(() => '0')
    )
  })
})
