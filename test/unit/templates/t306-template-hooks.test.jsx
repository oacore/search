// T-306 (41 D, R-018): the template hooks that glue stores to pages,
// findings/03 §4. useClaimController (/data-providers: a 500 ms debounced
// `claim.retrieve()`, URL prefill, form message), useReportController
// (/outputs/update: setters that write the report store, E10 submit, E5
// metadata) and useYearFilterController (the year filter: a histogram axis
// bounded by MAX_YEAR, which is computed when the module loads,
// modules/filters/year/hooks/use-year-filter-controller.js:6, so the Jest
// clock is set before any import: test/setup/env-clock.js freezes Date at
// 2026-01-15, MAX_YEAR is 2026, and a module loaded later keeps the value it
// got). The stores are the real ones. The claim hook runs under fake timers
// with `claim.retrieve` replaced by a spy (the store itself is T-212's); the
// report and year hooks run against the recorded and hand fixtures through
// MSW.
import React from 'react'
import routerMock, { setRouter } from 'next/router'

import { setupMsw } from '../../utils/msw'
import {
  act,
  render,
  renderHook,
  waitFor as baseWaitFor,
  withRouter,
  withStore,
} from '../../utils/render'
import { useFakeTimers, restoreClock, FIXED_NOW } from '../../utils/clock'
import RootStore from '../../../store/root'
import live from '../../drivers/store-driver/live'
import { observe } from '../../../store'
import useClaimController from '../../../templates/data-providers/hooks/use-claim-controller'
import useReportController from '../../../templates/output/hooks/use-report-controller'
import useYearFilterController from '../../../modules/filters/year/hooks/use-year-filter-controller'

// The report store writes after `await` outside an action (findings/03 §2.3),
// which MobX 6 reports with a dev-only console.warn for observed values that
// the production build of MobX does not print. Switching the check off changes
// no state transition.

jest.setTimeout(30000)

const { server, resolver, http } = setupMsw()

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

afterEach(() => {
  // the spy is put back, or the next test would wrap it in itself
  jest.restoreAllMocks()
  expect(unmatched).toEqual([])
})

// waits are generous: the suites of other packages run on the same machine
const waitFor = (callback, options) =>
  baseWaitFor(callback, { timeout: 8000, ...options })

const router = routerMock

const newStore = () => new RootStore({ statistics: {} })

// the report fields a component can select
const REPORT_FIELDS = [
  'output',
  'updateOption',
  'role',
  'isLoading',
  'error',
  'isModalReportTypeActive',
  'isModalReportFormActive',
  'isModalReportSuccessActive',
]
const selectNone = () => ({})
const selectReport = (state) =>
  Object.fromEntries(REPORT_FIELDS.map((key) => [key, state[key]]))

describe('T-306 @P1 template hooks', () => {
  describe('useClaimController', () => {
    const URL_A = 'https://a.example.org/'
    const URL_B = 'https://b.example.org/'
    let store
    let page
    let retrieve
    let form

    // the page is an observer: it re-renders when `claim.query` changes
    const Page = observe(() => {
      const controller = useClaimController()
      // reading the query is what subscribes the observer to it
      page.query = controller.claim.query
      page.controller = controller
      return null
    })

    const mount = () => {
      store = newStore()
      page = {}
      retrieve = jest.fn()
      // the spy replaces the store's action
      store.claim.setState({ retrieve })
      form = {
        dataProviderUrl: {
          checkValidity: jest.fn(() => true),
          reportValidity: jest.fn(),
        },
      }
      const view = render(<Page />, {
        wrappers: [withRouter(), withStore(store)],
      })
      // the ref of the <form> element of the template
      page.controller.formRef.current = form
      return view
    }
    const type = (value) =>
      act(() => {
        store.claim.setState({ query: value })
      })
    const wait = (ms) =>
      act(() => {
        jest.advanceTimersByTime(ms)
      })

    beforeEach(() => useFakeTimers())
    afterEach(() => restoreClock())

    test('T-306 @P1 claim: retrieve() runs 500 ms after the last change of the query, once', () => {
      mount()
      // mount: the first run is synchronous and does nothing for an empty query
      expect(retrieve).not.toHaveBeenCalled()
      wait(5000)
      expect(retrieve).not.toHaveBeenCalled()

      type(URL_A)
      wait(499)
      expect(retrieve).not.toHaveBeenCalled()
      wait(1)
      expect(retrieve).toHaveBeenCalledTimes(1)
      expect(retrieve).toHaveBeenLastCalledWith()
      expect(form.dataProviderUrl.checkValidity).toHaveBeenCalledTimes(1)
      expect(form.dataProviderUrl.reportValidity).not.toHaveBeenCalled()

      // two changes inside the window: one call, 500 ms after the second
      type(URL_B)
      wait(300)
      type(`${URL_B}oai`)
      wait(499)
      expect(retrieve).toHaveBeenCalledTimes(1)
      wait(1)
      expect(retrieve).toHaveBeenCalledTimes(2)
      expect(store.claim.getState().query).toBe(`${URL_B}oai`)

      // the same value again is no change: nothing runs
      type(`${URL_B}oai`)
      wait(5000)
      expect(retrieve).toHaveBeenCalledTimes(2)

      // clearing the field: the timer fires, the empty query returns early
      type('')
      wait(500)
      expect(retrieve).toHaveBeenCalledTimes(2)
      expect(form.dataProviderUrl.checkValidity).toHaveBeenCalledTimes(2)
    })

    test('T-306 @P1 claim: an invalid address is reported to the form and not retrieved; no form means no call', () => {
      mount()
      form.dataProviderUrl.checkValidity.mockReturnValue(false)
      type('not a url')
      wait(500)
      expect(form.dataProviderUrl.checkValidity).toHaveBeenCalledTimes(1)
      expect(form.dataProviderUrl.reportValidity).toHaveBeenCalledTimes(1)
      expect(retrieve).not.toHaveBeenCalled()

      // the form element is gone: the callback returns before touching it
      page.controller.formRef.current = null
      type(URL_A)
      wait(500)
      expect(retrieve).not.toHaveBeenCalled()
      expect(form.dataProviderUrl.checkValidity).toHaveBeenCalledTimes(1)
    })

    test('T-306 @P1 claim: unmounting before the 500 ms cancels the call', () => {
      const view = mount()
      type(URL_A)
      wait(499)
      view.unmount()
      wait(5000)
      expect(retrieve).not.toHaveBeenCalled()
    })

    test('T-306 @P1 claim: ?dataProviderUrl= prefills the query, which then runs the debounced retrieve', () => {
      setRouter({ query: { dataProviderUrl: URL_A } })
      mount()
      // the effect copied the address into the store; the page re-rendered
      expect(store.claim.getState().query).toBe(URL_A)
      expect(page.query).toBe(URL_A)
      wait(499)
      expect(retrieve).not.toHaveBeenCalled()
      wait(1)
      expect(retrieve).toHaveBeenCalledTimes(1)

      // a query without the key leaves the store alone (no reset to empty)
      setRouter({ query: {} })
      type(URL_B)
      wait(500)
      expect(store.claim.getState().query).toBe(URL_B)
    })

    test('T-306 @P1 claim: submitting resets the query only after a created provider; the message follows the claim state', () => {
      mount()
      const { claim } = store
      const { handleSubmitForm, getFormMessage } = page.controller
      expect(page.controller.claimStore).toBe(claim)

      // Enter pressed before anything was created: nothing happens
      type(URL_A)
      handleSubmitForm()
      expect(claim.getState().query).toBe(URL_A)
      expect(getFormMessage().variant).toBe('normal')
      expect(getFormMessage().helper).toBe(
        'It can be any resource, home page or an OAI-PMH endpoint'
      )

      // the message variants of the claim state (data-providers/utils)
      act(() => {
        claim.setState({ error: new Error('no repository') })
      })
      expect(getFormMessage().variant).toBe('error')
      act(() => {
        claim.getState().reset()
        claim.setState({
          created: { id: 1, name: 'Example', email: 'a@localhost' },
        })
      })
      expect(getFormMessage().variant).toBe('success')
      act(() => {
        claim.getState().reset()
        claim.duplicated = {
          message: JSON.stringify({ existingDataProviders: [] }),
        }
      })
      expect(getFormMessage().variant).toBe('error')

      // a created provider: submit clears the claim and the query
      act(() => {
        claim.getState().reset()
        claim.setState({
          created: { id: 1, name: 'Example', email: 'a@localhost' },
        })
      })
      expect(page.controller.handleSubmitForm).toBe(handleSubmitForm)
      act(() => {
        page.controller.handleSubmitForm()
      })
      expect(claim.getState().created).toBeNull()
      expect(claim.getState().query).toBe('')
      // the cleared query cancels the call that the typed address had pending;
      // the empty query returns early
      wait(500)
      expect(retrieve).not.toHaveBeenCalled()
    })
  })

  describe('useReportController', () => {
    const E10 = 'https://api.core.ac.uk/internal/outputs/update'
    const OUTPUT_URL = 'https://api.core.ac.uk/v3/outputs/2001'
    // the hand fixtures of test/fixtures/hand/e10-report
    const FORM = {
      outputId: 2001,
      name: 'Test Reporter',
      email: 'reporter@localhost',
    }
    let posts

    const mount = () => {
      const store = newStore()
      const view = renderHook(() => useReportController(selectNone), {
        wrappers: [withRouter(), withStore(store)],
      })
      return { store, ...view }
    }
    const idle = (report) => waitFor(() => expect(report.isLoading).toBe(false))

    beforeEach(() => {
      posts = []
      server.use(
        http.post(E10, async ({ request }) => {
          posts.push(await request.clone().text())
          // the recorded hand answer follows
          return undefined
        })
      )
    })

    test('T-306 @P1 report: the setters write the report store and resetReport clears them', () => {
      const { store, result } = mount()
      const hook = result.current
      const report = live(store.report)
      // the probe selects nothing, so it never re-renders (it is not an
      // observer either)
      expect(hook.report).toEqual({})
      expect(Object.keys(hook).sort()).toEqual(
        [
          'getMetadata',
          'handleSubmitForm',
          'report',
          'resetReport',
          'setActiveOperation',
          'setActiveReporter',
          'setErrorMessage',
          'setIsModalReportFormActive',
          'setIsModalReportSuccessActive',
          'setIsModalReportTypeActive',
        ].sort()
      )

      hook.setActiveOperation('takeDownFullText')
      hook.setActiveReporter('author')
      hook.setIsModalReportTypeActive(true)
      hook.setIsModalReportFormActive(true)
      hook.setIsModalReportSuccessActive(true)
      hook.setErrorMessage('boom')
      expect(report.updateOption).toBe('takeDownFullText')
      expect(report.role).toBe('author')
      expect(report.isModalReportTypeActive).toBe(true)
      expect(report.isModalReportFormActive).toBe(true)
      expect(report.isModalReportSuccessActive).toBe(true)
      expect(report.error).toBe('boom')

      hook.setIsModalReportTypeActive(false)
      expect(report.isModalReportTypeActive).toBe(false)
      expect(report.isModalReportFormActive).toBe(true)

      hook.resetReport()
      expect(selectReport(store.report.getState())).toEqual({
        output: {},
        updateOption: null,
        role: null,
        isLoading: false,
        error: null,
        isModalReportTypeActive: false,
        isModalReportFormActive: false,
        isModalReportSuccessActive: false,
      })
    })

    test('T-306 @P1 report: handleSubmitForm posts the form with the chosen operation and role (E10) and opens the success modal', async () => {
      const { store, result } = mount()
      const report = live(store.report)
      result.current.setActiveOperation('takeDownFullText')
      result.current.setActiveReporter('author')

      const data = { ...FORM, message: 'report-ok' }
      expect(result.current.handleSubmitForm(data)).toBeUndefined()
      expect(report.isLoading).toBe(true)
      await idle(report)

      // the store writes the choice into the form object it was given
      expect(data.updateOption).toBe('takeDownFullText')
      expect(data.role).toBe('author')
      expect(posts).toEqual([
        '{"outputId":2001,"name":"Test Reporter","email":"reporter@localhost",' +
          '"message":"report-ok","updateOption":"takeDownFullText",' +
          '"role":"author"}',
      ])
      expect(report.isModalReportSuccessActive).toBe(true)
      expect(report.error).toBeNull()
    })

    test('T-306 @P1 report: a failed submit sets the error message and no success modal', async () => {
      const { store, result } = mount()
      const report = live(store.report)
      result.current.setActiveOperation('takeDownFullText')
      result.current.setActiveReporter('author')

      result.current.handleSubmitForm({ ...FORM, message: 'report-fail' })
      await idle(report)

      expect(report.error).toMatch(
        /^We couldn’t perform the action\. For any issue contact \w+@core\.science$/
      )
      expect(report.isModalReportSuccessActive).toBe(false)
    })

    test('T-306 @P1 report: getMetadata fetches the output (E5) without its fullText and opens the type modal', async () => {
      const { store, result } = mount()
      const report = live(store.report)
      const requests = []
      server.events.on('request:start', ({ request }) => {
        requests.push(`${request.method} ${request.url}`)
      })

      expect(result.current.getMetadata(2001)).toBeUndefined()
      expect(report.isLoading).toBe(true)
      await idle(report)
      server.events.removeAllListeners()

      expect(requests).toEqual([`GET ${OUTPUT_URL}`])
      expect(report.output.id).toBe(2001)
      expect('fullText' in report.output).toBe(false)
      expect(report.isModalReportTypeActive).toBe(true)
      expect(report.error).toBeNull()
    })
  })

  describe('useYearFilterController', () => {
    const AGG_URL = 'https://api.core.ac.uk/v3/search/works/aggregate'
    const ALL = [
      'fieldsOfStudy',
      'yearPublished',
      'documentType',
      'authors',
      'language',
      'publisher',
    ]

    // a store with the recorded `climate` facets and the year facet open
    const openYearFacet = async () => {
      const store = newStore()
      await store.filters.getState().fetchFilters('climate', 'relevance')
      const yearFacet = store.filters
        .getState()
        .data.find((facet) => facet.value === 'yearPublished')
      store.filters.getState().setActiveFilter(yearFacet)
      store.filters.getState().setActiveFilterSuggestions(yearFacet.items)
      return store
    }
    const mount = (store) =>
      renderHook(() => useYearFilterController(), {
        wrappers: [withRouter(), withStore(store)],
      })

    beforeEach(() => {
      setRouter({ query: { q: 'climate', page: '1' } })
    })

    test('T-306 @P1 year: MAX_YEAR comes from the clock at import (2026) and bounds the histogram axis to 1950..2026', async () => {
      // the clock was set before this file's imports
      expect(Date.now()).toBe(FIXED_NOW)
      expect(new Date().getFullYear()).toBe(2026)

      const store = await openYearFacet()
      const suggestions = store.filters.getState().activeFilterSuggestions
      // the recorded year facet has junk keys on both sides of the bounds
      const values = suggestions.map((s) => s.value)
      expect(Math.min(...values)).toBeLessThan(1950)
      expect(Math.max(...values)).toBeGreaterThan(2026)

      const { result } = mount(store)
      const axis = result.current.yearsAxis
      const kept = suggestions.filter((s) => s.value >= 1950 && s.value <= 2026)
      expect(axis).toEqual(
        kept.map((s) => ({ x0: s.value, x: s.value + 1, y: s.count }))
      )
      expect(axis.length).toBeGreaterThan(50)
      expect(axis.length).toBeLessThan(suggestions.length)
      expect(axis.every((b) => b.x0 >= 1950 && b.x0 <= 2026)).toBe(true)
      // the axis keeps the order of the suggestions (count descending)
      expect(axis.map((b) => b.x0)).toEqual(
        suggestions.map((s) => s.value).filter((v) => v >= 1950 && v <= 2026)
      )
      // the hook hands the store's current state (it was the MobX instance)
      expect(result.current.filters).toBe(store.filters.getState())
      expect(result.current.selection).toBeNull()
    })

    test('T-306 @P1 year: a module loaded after the clock moved gets the later bound, an earlier import keeps 2026', () => {
      const realReact = require('react')
      const realStore = require('../../../store')
      const store = newStore()
      store.filters.setState({
        activeFilterSuggestions: [1949, 1950, 2026, 2027, 2030, 2031].map(
          (value) => ({ value, count: 1, checked: false })
        ),
      })
      const years = (hook) => {
        const view = renderHook(() => hook(), {
          wrappers: [withRouter(), withStore(store)],
        })
        const axis = view.result.current.yearsAxis.map((bar) => bar.x0)
        view.unmount()
        return axis
      }

      // the controller imported at the top of this file saw the 2026 clock
      expect(years(useYearFilterController)).toEqual([1950, 2026])

      try {
        // a fresh load with the clock at 2030: MAX_YEAR is read at load time
        jest.setSystemTime(Date.parse('2030-06-01T00:00:00Z'))
        let later
        jest.isolateModules(() => {
          // the second copy of the hook shares this file's React and store
          jest.doMock('react', () => realReact)
          jest.doMock('store', () => realStore)
          later =
            require('../../../modules/filters/year/hooks/use-year-filter-controller').default
        })
        jest.dontMock('react')
        jest.dontMock('store')
        // time moves on; the loaded value does not
        jest.setSystemTime(Date.parse('2040-01-01T00:00:00Z'))
        expect(years(later)).toEqual([1950, 2026, 2027, 2030])
        expect(years(useYearFilterController)).toEqual([1950, 2026])
      } finally {
        jest.dontMock('react')
        jest.dontMock('store')
        jest.setSystemTime(FIXED_NOW)
      }
    })

    test('T-306 @P1 year: loadFilter turns the checked years into the histogram selection', async () => {
      const store = await openYearFacet()
      const filters = live(store.filters)
      const check = (...years) =>
        filters.activeFilterSuggestions.forEach((s) => {
          s.checked = years.includes(s.value)
        })
      const { result } = mount(store)

      // nothing checked: no selection
      act(() => result.current.loadFilter())
      expect(result.current.selection).toBeNull()

      // one year: [year, year + 1]
      check(2015)
      act(() => result.current.loadFilter())
      expect(result.current.selection).toEqual([2015, 2016])

      // several: [min, max + 1]
      check(2014, 2016, 2020)
      act(() => result.current.loadFilter())
      expect(result.current.selection).toEqual([2014, 2021])
    })

    test('T-306 @P1 year: selecting a range sets the selection and pushes the year query with page 1', async () => {
      const store = await openYearFacet()
      const { result } = mount(store)

      // a [from, to + 1] pair, as the slider and the selects hand it over
      act(() => result.current.onSelectActiveFilterItem([2014, 2021]))
      expect(result.current.selection).toEqual([2014, 2021])
      expect(router.push).toHaveBeenCalledTimes(1)
      // the store is called without a pathname, so the push has none
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: undefined,
        query: {
          q: 'climate AND (yearPublished>=2014 AND yearPublished<=2020)',
          page: 1,
        },
      })

      // a reversed pair is put in order for the selection, not for the query
      act(() => result.current.onSelectActiveFilterItem([2020, 2014]))
      expect(result.current.selection).toEqual([2014, 2020])
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: undefined,
        query: {
          q: 'climate AND (yearPublished>=2020 AND yearPublished<=2013)',
          page: 1,
        },
      })
    })

    test('T-306 @P1 year: a "since" preset runs to the highest year of the facet, junk keys included', async () => {
      const store = await openYearFacet()
      const filters = live(store.filters)
      const { result } = mount(store)
      const preset = filters.groupedYearDates.find((g) => g.yearFrom === 2018)
      const { maxYear } = filters
      // the recorded facet has junk keys: the highest "year" is in the future
      expect(maxYear).toBeGreaterThan(2026)

      act(() => result.current.onSelectActiveFilterItem(preset))
      expect(result.current.selection).toEqual([2018, maxYear + 1])
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: undefined,
        query: {
          q: `climate AND (yearPublished>=2018 AND yearPublished<=${maxYear})`,
          page: 1,
        },
      })
      // the call also marks the preset and the range as the active one
      expect(filters.isVisibleClearButton).toBe(true)
      expect(
        filters.activeFilterSuggestions
          .filter((s) => s.checked)
          .map((s) => s.value)
          .sort((a, b) => a - b)
      ).toEqual([2018, maxYear])
    })

    test('T-306 @P1 year: the aggregation request that opens the facet is the six-facet E2 body', async () => {
      const bodies = []
      server.use(
        http.post(AGG_URL, async ({ request }) => {
          bodies.push(JSON.parse(await request.clone().text()))
          return undefined
        })
      )
      await openYearFacet()
      expect(bodies).toEqual([{ aggregations: ALL, q: 'climate' }])
    })
  })
})
