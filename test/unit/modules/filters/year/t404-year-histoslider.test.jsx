// T-404 (41 E, R-012): the year filter and the design Histoslider with the real
// library, the real filters store and the recorded `climate` aggregation. c1
// height 200 and slider 20 come from `defaultProps` (the app passes neither),
// one bar per year in 1950..MAX_YEAR, no NaN; c2 the "Since" presets; c3 the
// same DOM from a classic `React.createElement` element (what the app's Babel
// config emits) and from an automatic-runtime `jsx()` element: on React 17 both
// resolve `defaultProps`, which React 19 stops doing for `jsx()`.
import React from 'react'
import { jsx } from 'react/jsx-runtime'
import { configure } from 'mobx'
import routerMock, { setRouter } from 'next/router'
import { Histoslider } from '@oacore/design/lib/elements'

import { setupMsw } from '../../../../utils/msw'
import { FIXED_NOW } from '../../../../utils/clock-constants'
import {
  render,
  screen,
  userEvent,
  withRouter,
  withStore,
} from '../../../../utils/render'
import RootStore from '../../../../../store/root'
import YearFilter from '../../../../../modules/filters/year'

// store writes after `await` outside an action raise a dev-only MobX warning
// that the production build of MobX does not print (findings/03 §2.3)
configure({ enforceActions: 'never' })

jest.setTimeout(30000)

const { resolver } = setupMsw()

const AGG_URL = 'https://api.core.ac.uk/v3/search/works/aggregate'
const ALL = [
  'fieldsOfStudy',
  'yearPublished',
  'documentType',
  'authors',
  'language',
  'publisher',
]

// modules/filters/year/hooks/use-year-filter-controller.js:6-7
const MIN_YEAR = 1950
const MAX_YEAR = new Date(FIXED_NOW).getUTCFullYear()

// the recorded year buckets of `climate`, as the API sent them
const RAW = JSON.parse(
  resolver
    .resolve(
      'POST',
      AGG_URL,
      JSON.stringify({ aggregations: ALL, q: 'climate' })
    )
    .body.toString()
).aggregations.yearPublished
const EVERY_YEAR = Object.keys(RAW).map(Number)
// the buckets the histogram draws: 1950 <= year <= MAX_YEAR, oldest first
const YEARS = Object.entries(RAW)
  .map(([year, count]) => [Number(year), count])
  .filter(([year]) => year >= MIN_YEAR && year <= MAX_YEAR)
  .sort((a, b) => a[0] - b[0])
const BIGGEST = Math.max(...YEARS.map(([, count]) => count))
const MAX_BUCKET = Math.max(...EVERY_YEAR)
const fmt = (n) => n.toLocaleString('en-GB')

// Histoslider geometry with the app's props (width 298, padding 20) and the
// defaults of the library (height 200, sliderHeight 20)
const WIDTH = 298 - 2 * 20
const HISTOGRAM_HEIGHT = 200 - 2 * 20 - 20
const SLIDER_HEIGHT = 20

// the store as FilterBarItem leaves it after a click on the "year" label
const yearStore = async () => {
  const store = new RootStore({ statistics: {} })
  await store.filters.fetchFilters('climate', 'relevance')
  const year = store.filters.data.find((f) => f.label === 'year')
  store.filters.setActiveFilter(year)
  store.filters.setActiveFilterSuggestions(year.items)
  return store
}

const mount = async () => {
  setRouter({ query: { q: 'climate', page: '1' } })
  const store = await yearStore()
  const view = render(<YearFilter />, {
    wrappers: [withRouter(), withStore(store)],
  })
  return { store, ...view }
}

const slider = (container) => container.querySelector('.slider')
const histogram = (container) => slider(container).querySelector('svg')
const bars = (container) => [
  ...histogram(container).querySelectorAll('g[transform="scale(1,-1)"] > g'),
]
const num = (el, name) => Number.parseFloat(el.getAttribute(name))

// the props the app hands to the library (modules/filters/year/index.jsx:43-51)
const appProps = () => ({
  data: YEARS.map(([year, count]) => ({ x0: year, x: year + 1, y: count })),
  selection: null,
  className: 'slider',
  padding: 20,
  width: 298,
  showLabels: true,
  selectFunc: () => {},
})

describe('T-404 @P0 year filter and Histoslider', () => {
  test('T-404 c1 @P0 height 200 and sliderHeight 20 come from defaultProps', () => {
    expect(Histoslider.defaultProps).toEqual({
      selectedBarColor: '#EF8237',
      rangeColor: '#b75400',
      unselectedColor: '#E0E0E0',
      showOnDrag: false,
      width: 300,
      height: 200,
      barBorderRadius: 2,
      barPadding: 2,
      padding: 20,
      sliderHeight: 20,
      handleLabelFormat: '0.5P',
      formatLabelFunction: undefined,
      showLabels: false,
    })
  })

  test('T-404 c1 @P0 the year box: histogram 258 x 140, slider 258 x 20, no NaN', async () => {
    const { container } = await mount()
    const root = slider(container)
    expect(root.style.width).toBe('298px')
    expect(root.style.padding).toBe('20px')
    const [hist, track] = root.querySelectorAll('svg')
    // 200 - 2 x 20 (padding) - 20 (sliderHeight) = 140
    expect(hist.getAttribute('width')).toBe(String(WIDTH))
    expect(hist.getAttribute('height')).toBe(String(HISTOGRAM_HEIGHT))
    expect(track.getAttribute('width')).toBe(String(WIDTH))
    expect(track.getAttribute('height')).toBe(String(SLIDER_HEIGHT))
    expect(track.style.overflow).toBe('visible')
    expect(track.style.marginBottom).toBe('4rem')
    expect(root.querySelectorAll('svg')).toHaveLength(2)
    expect(container.innerHTML).not.toMatch(/NaN|undefined|Infinity/)
    expect(root.innerHTML).not.toMatch(/NaN|undefined|Infinity/)
  })

  test('T-404 c1 @P0 bars = years: one pair of rects per year from 1950 to MAX_YEAR, sized by count', async () => {
    const { container } = await mount()
    const list = bars(container)
    expect(MAX_YEAR).toBe(2026)
    expect(YEARS.length).toBeGreaterThan(50)
    // years outside 1950..MAX_YEAR are not drawn
    expect(EVERY_YEAR.some((y) => y < MIN_YEAR)).toBe(true)
    expect(EVERY_YEAR.some((y) => y > MAX_YEAR)).toBe(true)
    expect(list).toHaveLength(YEARS.length)

    const first = YEARS[0][0]
    const last = YEARS[YEARS.length - 1][0]
    const step = WIDTH / (last + 1 - first)
    list.forEach((g, i) => {
      const [year, count] = YEARS[i]
      const rects = g.querySelectorAll('rect')
      expect(rects).toHaveLength(2)
      const x = Number.parseFloat(
        g.getAttribute('transform').match(/^translate\(([\d.]+) 0\)$/)[1]
      )
      expect(x).toBeCloseTo((year - first) * step + 1, 6)
      for (const rect of rects) {
        expect(num(rect, 'width')).toBeCloseTo(step - 2, 6)
        expect(num(rect, 'height')).toBeCloseTo(
          (count / BIGGEST) * HISTOGRAM_HEIGHT,
          6
        )
        expect(Number.isNaN(num(rect, 'height'))).toBe(false)
      }
      // background bar, then the clickable one (all selected: the whole range)
      expect(rects[0].getAttribute('fill')).toBe('#E0E0E0')
      expect(rects[0].getAttribute('rx')).toBe('2')
      expect(rects[1].getAttribute('fill')).toBe('#EF8237')
      expect(rects[1].getAttribute('x')).toBe('0')
    })
    // the tallest bar fills the histogram
    const tallest = list[YEARS.findIndex(([, c]) => c === BIGGEST)]
    expect(num(tallest.querySelector('rect'), 'height')).toBeCloseTo(140, 6)
  })

  test('T-404 c1 @P0 slider: labels are the first year and the last year, two handles at the ends', async () => {
    const { container } = await mount()
    const root = slider(container)
    const first = YEARS[0][0]
    const last = YEARS[YEARS.length - 1][0]
    const range = root.querySelectorAll('svg')[1].parentElement
    const labels = [...range.querySelectorAll(':scope > div')].map(
      (d) => d.textContent
    )
    expect(labels).toEqual([String(first), String(last)])
    const handles = [...range.querySelectorAll('g[tabindex="0"]')]
    expect(handles.map((g) => g.getAttribute('transform'))).toEqual([
      'translate(0, 0)',
      `translate(${WIDTH}, 0)`,
    ])
  })

  test('T-404 c1 @P0 the library defaults alone give the same sizes when the app passes no height, sliderHeight, padding or width', () => {
    const { container } = render(
      React.createElement(Histoslider, {
        data: appProps().data,
        selectFunc: () => {},
      })
    )
    const [hist, track] = container.querySelectorAll('svg')
    expect(container.firstElementChild.style.width).toBe('300px')
    expect(container.firstElementChild.style.padding).toBe('20px')
    expect(hist.getAttribute('width')).toBe('260')
    expect(hist.getAttribute('height')).toBe('140')
    expect(track.getAttribute('height')).toBe('20')
    expect(container.innerHTML).not.toMatch(/NaN|undefined|Infinity/)
  })

  test('T-404 c2 @P0 presets: Since 2018, 2016 and 2014 with the summed counts, none active, blank custom range', async () => {
    const { container } = await mount()
    const presets = [
      ...container.querySelectorAll(':scope > li.filter-box-item'),
    ]
    const since = (from) =>
      Object.entries(RAW)
        .filter(([y]) => Number(y) >= from && Number(y) <= MAX_BUCKET)
        .reduce((sum, [, count]) => sum + count, 0)
    expect(
      presets.map((li) => [
        li.querySelector('p').textContent,
        li.querySelector('span').textContent,
      ])
    ).toEqual([
      ['Since 2018', fmt(since(2018))],
      ['Since 2016', fmt(since(2016))],
      ['Since 2014', fmt(since(2014))],
    ])
    for (const li of presets) {
      expect(li.className).toBe('filter-box-item')
      expect(li.querySelector('svg')).toBeNull()
      // radio inputs without name and id (the preset has no `value`)
      const input = li.querySelector('input')
      expect(input.type).toBe('radio')
      expect(input.hasAttribute('name')).toBe(false)
      expect(input.hasAttribute('id')).toBe(false)
      expect(input.checked).toBe(false)
    }
    const custom = container.querySelector('li.custom-range-text')
    expect(custom.className).toBe('custom-range-text label')
    expect(custom.querySelector('p').textContent).toBe('Custom range')
    expect(custom.querySelector('span').textContent).toBe('')
    expect(custom.querySelector('svg')).toBeNull()
    // the order in the box: presets, custom range, histogram, selects
    const kinds = [...container.children].map(
      (e) => `${e.tagName.toLowerCase()}.${e.classList[e.classList.length - 1]}`
    )
    expect(kinds).toEqual([
      'li.filter-box-item',
      'li.filter-box-item',
      'li.filter-box-item',
      'li.label',
      'div.slider',
      'div.year-selects',
    ])
  })

  test('T-404 c2 @P0 presets: a preset pushes the range up to the largest bucket, activates itself and selects the bars', async () => {
    const user = userEvent.setup()
    const { container } = await mount()
    setRouter({ query: { q: 'climate', page: '4', sort: 'recent' } })

    await user.click(screen.getByText('Since 2016'))

    expect(routerMock.push.mock.calls).toStrictEqual([
      [
        {
          pathname: undefined,
          query: {
            q: `climate AND (yearPublished>=2016 AND yearPublished<=${MAX_BUCKET})`,
            page: 1,
            sort: 'recent',
          },
        },
      ],
    ])
    const presets = [
      ...container.querySelectorAll(':scope > li.filter-box-item'),
    ]
    expect(
      presets.map((li) =>
        li.className.split(' ').includes('filter-box-item-active')
      )
    ).toEqual([false, true, false])
    expect(presets[1].querySelector('svg use').getAttribute('href')).toBe(
      '/static/search/icons.svg#check'
    )
    expect(presets[0].querySelector('svg')).toBeNull()
    // the custom range stays blank: a preset matched
    expect(
      container.querySelector('li.custom-range-text span').textContent
    ).toBe('')

    // the histogram: bars from 2016 on selected, older ones not
    const colours = Object.fromEntries(
      bars(container).map((g, i) => [
        YEARS[i][0],
        g.querySelectorAll('rect')[1].getAttribute('fill'),
      ])
    )
    expect(
      YEARS.filter(([y]) => y >= 2016).every(([y]) => colours[y] === '#EF8237')
    ).toBe(true)
    expect(
      YEARS.filter(([y]) => y < 2016).every(([y]) => colours[y] === '#E0E0E0')
    ).toBe(true)
    // the labels follow the selection: from 2016 to the largest bucket
    const range = slider(container).querySelectorAll('svg')[1].parentElement
    expect(
      [...range.querySelectorAll(':scope > div')].map((d) => d.textContent)
    ).toEqual(['2016', String(MAX_BUCKET)])
  })

  test('T-404 c2 @P0 presets: an existing year clause of q is replaced, and the greedy match drops what follows up to the last bracket', async () => {
    const user = userEvent.setup()
    await mount()
    const yearClause = 'AND (yearPublished>=2000 AND yearPublished<=2001)'

    // nothing with a bracket after it: only the clause goes
    setRouter({
      query: {
        q: `climate ${yearClause} AND documentType:"thesis"`,
        page: '2',
      },
    })
    await user.click(screen.getByText('Since 2014'))
    // a bracket later in q: everything up to it goes with the clause
    setRouter({
      query: {
        q: `climate ${yearClause} AND fieldsOfStudy:"Bio(logy)"`,
        page: '2',
      },
    })
    await user.click(screen.getByText('Since 2018'))

    const range = (from) =>
      `AND (yearPublished>=${from} AND yearPublished<=${MAX_BUCKET})`
    expect(routerMock.push.mock.calls).toStrictEqual([
      [
        {
          pathname: undefined,
          query: {
            q: `climate AND documentType:"thesis" ${range(2014)}`,
            page: 1,
          },
        },
      ],
      [
        {
          pathname: undefined,
          // the greedy match ends inside `Bio(logy)`: its quote is left behind
          query: { q: `climate" ${range(2018)}`, page: 1 },
        },
      ],
    ])
  })

  test('T-404 c3 @P0 classic createElement and automatic jsx() elements both carry the defaults', () => {
    const props = appProps()
    const classic = React.createElement(Histoslider, props)
    const automatic = jsx(Histoslider, props)
    for (const element of [classic, automatic]) {
      expect(element.type).toBe(Histoslider)
      expect(element.props).toMatchObject({
        height: 200,
        sliderHeight: 20,
        barBorderRadius: 2,
        barPadding: 2,
        selectedBarColor: '#EF8237',
        unselectedColor: '#E0E0E0',
        rangeColor: '#b75400',
        handleLabelFormat: '0.5P',
        showOnDrag: false,
        // the app's own props win over the defaults
        width: 298,
        padding: 20,
        showLabels: true,
      })
    }
    // the bare element, as the minimal call sites would write it
    const bare = { data: props.data, selectFunc: props.selectFunc }
    expect(React.createElement(Histoslider, bare).props.height).toBe(200)
    expect(jsx(Histoslider, bare).props.height).toBe(200)
    expect(jsx(Histoslider, bare).props.width).toBe(300)
  })

  test('T-404 c3 @P0 classic and automatic runtime render the same DOM, the one the year box draws', async () => {
    const viaApp = await mount()
    const appHtml = slider(viaApp.container).outerHTML
    viaApp.unmount()

    const classic = render(React.createElement(Histoslider, appProps()))
    const classicHtml = classic.container.innerHTML
    classic.unmount()

    const automatic = render(jsx(Histoslider, appProps()))
    const automaticHtml = automatic.container.innerHTML
    automatic.unmount()

    expect(classicHtml).toBe(appHtml)
    expect(automaticHtml).toBe(appHtml)
    for (const html of [appHtml, classicHtml, automaticHtml]) {
      expect(html).not.toMatch(/NaN|undefined|Infinity/)
      expect(html).toContain(
        `<svg width="${WIDTH}" height="${HISTOGRAM_HEIGHT}"`
      )
      expect(html).toContain(`height="${SLIDER_HEIGHT}" width="${WIDTH}"`)
    }
  })

  test('T-404 c3 @P0 classic and automatic runtime give the same DOM with no size props at all', () => {
    const bare = () => ({ data: appProps().data, selectFunc: () => {} })
    const classic = render(React.createElement(Histoslider, bare()))
    const classicHtml = classic.container.innerHTML
    classic.unmount()
    const automatic = render(jsx(Histoslider, bare()))
    const automaticHtml = automatic.container.innerHTML
    automatic.unmount()
    // the same as passing every default explicitly
    const explicit = render(
      React.createElement(Histoslider, {
        ...bare(),
        width: 300,
        height: 200,
        padding: 20,
        sliderHeight: 20,
      })
    )
    expect(automaticHtml).toBe(classicHtml)
    expect(explicit.container.innerHTML).toBe(classicHtml)
    expect(classicHtml).not.toMatch(/NaN|undefined|Infinity/)
  })
})
