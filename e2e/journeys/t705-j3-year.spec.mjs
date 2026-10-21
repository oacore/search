// T-705 (41 H, J3, J21, R-012): the year facet. findings/07 §3 J3 with the 41 §2.4 correction "+ single
// bucket; empty year -> J24" (the empty aggregation is T-730's) and the J21 variants: year by quick range, by
// Histoslider drag and by the two selects. The browser clock is fixed (`page.clock.setFixedTime`, 40 §5): the
// year module computes MAX_YEAR = new Date().getFullYear() at load, which bounds the Histoslider data
// (1950..MAX_YEAR) and the right end of a dragged range.
//   - Desktop (1280 px): the quick ranges, the drag of the left Histoslider handle (one push per mouse move;
//     the range ends at the clock's year, 2026) and a quick range afterwards replacing it (one yearPublished
//     fragment). The two selects exist but are hidden above 767 px (modules/filters/year/selects).
//   - 767 px: the selects. `from` pushes with the maximum year of the aggregation as the upper bound (10000,
//     live data holds such a year); `to` hands `selectedValue + 1` of a string to the push, so 2015 becomes
//     the upper bound 20150 (store/filters.js setActiveYearDate).
//   - Single bucket: a search whose year aggregation has one bucket renders no Histoslider.
// Per step the URL, the DOM view, the request log, the history log and the router events are asserted.
// Fixtures: scenario search-climate, req-P0-13 (test/fixtures/requests/P0-13.json).
import { test, expect } from '../lib/P0-13/harness-gaps.mjs'
import { setFixedTime } from '../fixtures/guard.mjs'
import { Journey } from '../lib/P0-13/journey.mjs'
import { pillHead, pill } from '../lib/P0-13/locators.mjs'
import {
  answer,
  activePills,
  openPills,
  searchUrl,
} from '../lib/P0-13/states.mjs'
import { yearView } from '../lib/P0-13/view.mjs'

const NEXT_DATA = '/search/_next/data/<buildId>/search.json'
const STATE_KEYS = ['__N', 'as', 'idx', 'options', 'url']
// the filters call while the year facet is active leaves yearPublished out (store/filters.js fetchFilters)
const AGGREGATIONS_WITHOUT_YEAR = [
  'fieldsOfStudy',
  'documentType',
  'authors',
  'language',
  'publisher',
]
const range = (from, to) =>
  `climate AND (yearPublished>=${from} AND yearPublished<=${to})`
const urlOf = (q) => searchUrl({ q, page: '1' })
const nav = (q) => ({
  documents: 0,
  nextData: [{ path: NEXT_DATA, query: { q, page: '1' } }],
  e2: [q],
  e2Aggregations: [AGGREGATIONS_WITHOUT_YEAR],
  apiOther: [],
})
const push = (url) => ({
  method: 'pushState',
  url,
  stateKeys: STATE_KEYS,
  scrollRestoration: 'auto',
  scrollY: 0,
})
// the quick ranges of the climate aggregation (counts of the values since the year, up to the maximum year)
const QUICK = [
  { text: 'Since 2018', count: '1,086,604' },
  { text: 'Since 2016', count: '1,263,697' },
  { text: 'Since 2014', count: '1,405,745' },
]
const quickOf = (year) => year.quick.map(({ text, count }) => ({ text, count }))
const fragments = (q) => (q.match(/yearPublished>=/g) || []).length

// a cookie consent is given so that the bottom-fixed consent popup (T-719, T-740) never covers the page
test.use({ cookieState: 'essential' })

test.describe('T-705 @P0 J3 year facet', () => {
  test.describe.configure({ timeout: 300000 })

  test('T-705 @P0 J3 year facet on a fixed clock: quick ranges, Histoslider drag, Since 2016 replaces the range', async ({
    page,
    p2Env,
    resolver,
  }) => {
    await setFixedTime(page)
    const j = await Journey.open(page, p2Env, '/search/?q=climate')
    const base = answer(resolver, { q: 'climate' })
    expect(j.first.view).toMatchObject({ hits: base.hits, ids: base.ids })

    // open the year facet: three quick ranges (the years are fixed in the code; the counts are the sums of the
    // aggregation up to its maximum year), an empty Custom range row, the Histoslider over 1951..2026 (the
    // aggregation values from 1950 to the clock's year; R-012: its markup has no NaN) and two hidden selects
    const opened = await j.act('open year', () =>
      pillHead(page, 'year').click()
    )
    expect(opened.requests).toEqual({
      documents: 0,
      nextData: [],
      e2: [],
      e2Aggregations: [],
      apiOther: [],
    })
    expect(opened.history).toEqual([])
    expect(openPills(opened.view)).toEqual(['year'])
    const year = await yearView(page)
    expect(quickOf(year)).toEqual(QUICK)
    expect(
      year.quick.every((q) => !q.checked && q.pointerEvents === 'auto')
    ).toBe(true)
    expect(year.custom).toEqual({ count: '', check: false, activeText: false })
    expect(year.slider).toEqual({
      labels: ['1951', '2026'],
      bars: 76,
      handles: 2,
      nan: false,
      svgs: ['258x140', '258x20'],
      width: '298px',
    })
    expect(year.selects.map((s) => s.visible)).toEqual([false, false])
    expect(
      year.selects.map((s) => [s.value, s.first, s.last, s.options])
    ).toEqual([
      ['1', '1', '10000', 100],
      ['10000', '10000', '1', 100],
    ])

    // drag the left handle 60 px to the right in one move: one push, the range from the histogram scale
    // (1969) to the clock's year (2026)
    const dragged = range(1969, 2026)
    const handle = pill(page, 'year').locator('g[tabindex="0"]').first()
    const box = await handle.boundingBox()
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    const afterDrag = await j.act(
      'drag left handle',
      async () => {
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.move(x + 60, y)
        await page.mouse.up()
      },
      { url: urlOf(dragged), e2: 1 }
    )
    const dragState = answer(resolver, { q: dragged })
    expect(new URL(page.url()).searchParams.get('q')).toBe(dragged)
    expect(new URL(page.url()).searchParams.get('page')).toBe('1')
    expect(afterDrag.view).toMatchObject({
      url: urlOf(dragged),
      hits: dragState.hits,
      ids: dragState.ids,
      clear: true,
    })
    expect(activePills(afterDrag.view)).toEqual(['year'])
    expect(openPills(afterDrag.view)).toEqual(['year'])
    expect(afterDrag.requests).toEqual(nav(dragged))
    expect(afterDrag.history).toEqual([push(urlOf(dragged))])
    expect(afterDrag.router).toEqual([
      ['routeChangeStart', urlOf(dragged)],
      ['routeChangeComplete', urlOf(dragged)],
    ])
    expect(afterDrag.bar).toEqual(['added', 'removed'])
    const dragYear = await yearView(page)
    // "Custom range" shows the count of the dragged range; no quick range is checked; the handle label moved
    expect(dragYear.custom).toEqual({
      count: '1,854,923',
      check: true,
      activeText: true,
    })
    expect(dragYear.quick.every((q) => !q.checked)).toBe(true)
    expect(dragYear.slider.labels).toEqual(['1969', '2026'])
    expect(dragYear.slider.nan).toBe(false)

    // a quick range replaces the year fragment (never two) and uses the maximum year of the aggregation
    const since = range(2016, 10000)
    const afterSince = await j.act(
      'since 2016',
      () => page.getByText('Since 2016', { exact: true }).click(),
      { url: urlOf(since), e2: 1 }
    )
    const sinceState = answer(resolver, { q: since })
    expect(fragments(new URL(page.url()).searchParams.get('q'))).toBe(1)
    expect(new URL(page.url()).searchParams.get('q')).toBe(since)
    expect(afterSince.view).toMatchObject({
      url: urlOf(since),
      hits: sinceState.hits,
      ids: sinceState.ids,
      clear: true,
    })
    expect(activePills(afterSince.view)).toEqual(['year'])
    expect(afterSince.requests).toEqual(nav(since))
    expect(afterSince.history).toEqual([push(urlOf(since))])
    const sinceYear = await yearView(page)
    // the checked quick range has pointer-events:none (Q-083), Custom range is empty again
    expect(
      sinceYear.quick.map((q) => [q.text, q.checked, q.pointerEvents])
    ).toEqual([
      ['Since 2018', false, 'auto'],
      ['Since 2016', true, 'none'],
      ['Since 2014', false, 'auto'],
    ])
    expect(sinceYear.custom).toEqual({
      count: '',
      check: false,
      activeText: false,
    })
    expect(sinceYear.slider.labels).toEqual(['2016', '10000'])
    expect(sinceYear.slider.nan).toBe(false)
    expect(afterSince.marker).toBe('kept')
  })

  test.describe('767 px', () => {
    test.use({ viewport: { width: 767, height: 900 } })

    test('T-705 @P0 J21 year selects at 767 px: from 2010, then to 2015 (the upper bound becomes 20150)', async ({
      page,
      p2Env,
      resolver,
    }) => {
      await setFixedTime(page)
      const j = await Journey.open(page, p2Env, '/search/?q=climate')
      // the filters bar is behind the "Filters" toggle below 768 px
      await page.getByRole('button', { name: 'Filters' }).click()
      const opened = await j.act('open year', () =>
        pillHead(page, 'year').click()
      )
      expect(openPills(opened.view)).toEqual(['year'])
      const year = await yearView(page)
      expect(year.selects.map((s) => s.visible)).toEqual([true, true])
      expect(year.selects.map((s) => s.value)).toEqual(['1', '10000'])
      const selects = pill(page, 'year').getByRole('combobox')
      await expect(selects).toHaveCount(2)

      // from = 2010: the upper bound is the maximum year of the aggregation, 10000
      const from = range(2010, 10000)
      const afterFrom = await j.act(
        'from 2010',
        () => selects.nth(0).selectOption('2010'),
        { url: urlOf(from), e2: 1 }
      )
      const fromState = answer(resolver, { q: from })
      expect(afterFrom.view).toMatchObject({
        url: urlOf(from),
        hits: fromState.hits,
        ids: fromState.ids,
        clear: true,
      })
      expect(activePills(afterFrom.view)).toEqual(['year'])
      expect(afterFrom.requests).toEqual(nav(from))
      expect(afterFrom.history).toEqual([push(urlOf(from))])
      const fromYear = await yearView(page)
      expect(fromYear.selects.map((s) => s.value)).toEqual(['2010', '10000'])
      expect(fromYear.custom).toEqual({
        count: '180',
        check: true,
        activeText: true,
      })

      // to = 2015: the previous fragment is replaced (one yearPublished fragment), the upper bound is
      // ("2015" + 1) - 1 = 20150 because the option value is a string
      const to = range(2010, 20150)
      const afterTo = await j.act(
        'to 2015',
        () => selects.nth(1).selectOption('2015'),
        { url: urlOf(to), e2: 1 }
      )
      const toState = answer(resolver, { q: to })
      expect(fragments(new URL(page.url()).searchParams.get('q'))).toBe(1)
      expect(new URL(page.url()).searchParams.get('q')).toBe(to)
      expect(afterTo.view).toMatchObject({
        url: urlOf(to),
        hits: toState.hits,
        ids: toState.ids,
      })
      expect(afterTo.requests).toEqual(nav(to))
      expect(afterTo.history).toEqual([push(urlOf(to))])
      const toYear = await yearView(page)
      expect(toYear.selects.map((s) => s.value)).toEqual(['2010', '2015'])
      expect(toYear.slider.labels).toEqual(['2010', '20150'])
      expect(toYear.slider.nan).toBe(false)
      // the range is no longer recognised as an active year filter (pill not highlighted, no Clear all)
      expect(activePills(afterTo.view)).toEqual([])
      expect(afterTo.view.clear).toBe(false)
      expect(toYear.custom).toEqual({
        count: '0',
        check: false,
        activeText: false,
      })
      expect(afterTo.marker).toBe('kept')
    })
  })

  test('T-705 @P0 J3 single year bucket: no Histoslider, Custom range shows the bucket, quick ranges are 0 and disabled', async ({
    page,
    p2Env,
    resolver,
  }) => {
    await setFixedTime(page)
    const q = range(1952, 1952)
    const j = await Journey.open(
      page,
      p2Env,
      '/search/?q=climate+AND+(yearPublished>=1952+AND+yearPublished<=1952)'
    )
    const state = answer(resolver, { q })
    expect(j.first.view).toMatchObject({ hits: state.hits, ids: state.ids })
    const opened = await j.act('open year', () =>
      pillHead(page, 'year').click()
    )
    expect(opened.requests.nextData).toEqual([])
    expect(openPills(opened.view)).toEqual(['year'])
    const year = await yearView(page)
    // one bucket: yearsAxis has one element, so the slider is not rendered and Custom range shows its count
    expect(year.slider).toBeNull()
    expect(year.custom).toEqual({ count: '85', check: true, activeText: true })
    // the quick ranges count nothing in the single bucket (1952 < 2014) and are disabled (Q-083)
    expect(
      year.quick.map((qr) => [qr.text, qr.count, qr.pointerEvents])
    ).toEqual([
      ['Since 2018', '0', 'none'],
      ['Since 2016', '0', 'none'],
      ['Since 2014', '0', 'none'],
    ])
    expect(year.selects.map((s) => [s.value, s.options])).toEqual([
      ['1952', 1],
      ['1952', 1],
    ])
  })
})
