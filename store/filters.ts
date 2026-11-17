import { createStore, type StoreApi } from 'zustand/vanilla'
import Router from 'next/router'

import {
  setItemFirst,
  sortItemsByNumberDesc,
  sortItemsByBoolean,
} from '../utils/sort'
import { fetchAggregations } from '../api/search'
import { findMaxValueInArray, findMinValueInArray } from '../utils/helpers'
import { batched, type Batch } from './batch'

import transformFiltersData, { checkActiveItems } from 'utils/filters-transform'
import invalidatePreviousRequests from 'utils/invalidatePreviousRequests'

// The filters store (E2 and the filter bar), ported from the MobX class with
// its 26 annotations (70 §2.4, CS-BAB-1). Every method was an action, so each
// runs in `act` and notifies once; fetchFilters' part before its `await`
// too, and after it each method it calls on its own. Assigned arrays and
// objects are copied as MobX copied them, the store's own ones kept: the
// suggestions alias the facet items the bar hands over (R-030), and the
// in-place `checked` writes and sorts reach every holder; `touch` notifies
// of them. The signal still lands in the sortType slot when reset fetches
// with the query alone (Q-020). maxYear and filterNamesWithoutYear were
// computeds: `select` derives them from a state.

export type FiltersState = {
  data: any[]
  initialData: any
  activeFilter: any
  activeFilterSuggestions: any[]
  aggregationsNames: string[]
  groupedYearDates: any[]
  isLoading: boolean
  yearWorksCount: any
  isVisibleClearButton: any
  setActiveFilter: (filter: any) => void
  setIsLoading: (isLoading: boolean) => void
  setIsVisibleClearButton: (value?: any) => void
  setInitialData: (data: any) => void
  fetchFilters: (...args: any[]) => Promise<void>
  checkYearPublishedStatis: (transformFilters: any[]) => void
  setData: (newData: any[]) => void
  toggleCheckboxFilter: (element: any, pathName: any) => void
  setActiveYearDate: (yearsRange: any[], pathName?: any) => void
  setGroupedYearDates: (yearFrom: any[], yearTo?: any) => void
  setYearWorksCount: (yearsRange: any) => void
  setActiveFilterSuggestions: (items: any[]) => void
  getFilterByValue: (array: any[] | undefined, key: any) => any
  reset: (query: any, pathName?: any) => void
  routeChanged: () => void
}

type Select = {
  maxYear: (state: FiltersState) => number
  filterNamesWithoutYear: (state: FiltersState) => string[]
  filterNamesWithoutPublisher: (state: FiltersState) => string[]
}

export type FiltersStore = StoreApi<FiltersState> & { select: Select }

type Context = { api: FiltersStore } & Batch<FiltersState>

export const select: Select = {
  maxYear: (state) =>
    Math.max.apply(
      null,
      state.data
        .find((item) => item.label === 'year')
        .items.map((item: any) => item.value)
    ),
  filterNamesWithoutYear: (state) =>
    state.aggregationsNames.filter((item) => item !== 'yearPublished'),
  filterNamesWithoutPublisher: (state) =>
    state.aggregationsNames.filter((item) => item !== 'publisher'),
}

const setYearWorksCount = ({ api, act, write }: Context, yearsRange: any) =>
  act(() => {
    if (yearsRange) {
      write({
        yearWorksCount: api
          .getState()
          .activeFilterSuggestions.filter(
            (item) => item.value >= yearsRange[0] && item.value < yearsRange[1]
          )
          .reduce((prev, curr) => prev + curr.count, 0),
      })
    } else write({ yearWorksCount: null })
  })

const setIsVisibleClearButton = ({ api, act, write }: Context, value?: any) =>
  act(() =>
    write({
      isVisibleClearButton: value || checkActiveItems(api.getState().data),
    })
  )

const setActiveFilterSuggestions = (
  { act, write, touch }: Context,
  items: any[]
) =>
  act(() => {
    let sortedArray = []
    sortItemsByNumberDesc(items, 'count')
    sortedArray = sortItemsByBoolean(items, 'checked')
    // the sorts above may have reordered the store's own array in place
    touch()
    write({ activeFilterSuggestions: sortedArray })
  })

const setGroupedYearDates = (
  ctx: Context,
  yearFrom: any[],
  yearTo = select.maxYear(ctx.api.getState())
) =>
  ctx.act(() => {
    const datesFilter = ctx.api
      .getState()
      .data.find((filter) => filter.label === 'year').items
    const activeYears = datesFilter.filter((item: any) => item.checked === true)

    const activeYearsMinValue = findMinValueInArray(activeYears, 'value')
    const activeYearsMaxValue = findMaxValueInArray(activeYears, 'value')

    const groupedData = yearFrom.map((year) => {
      const worksCount = datesFilter
        .filter((item: any) => item.value >= year && item.value <= yearTo)
        .reduce((prev: any, curr: any) => prev + curr.count, 0)

      return {
        yearFrom: year,
        count: worksCount,
        checked:
          activeYears.length > 1 &&
          activeYears[0].value === year &&
          activeYears[1].value === yearTo,
      }
    })
    if (
      !groupedData.find((year) => year.checked) &&
      datesFilter.map((item: any) => item.checked === true).length === 0
    )
      setYearWorksCount(ctx, [activeYearsMinValue, activeYearsMaxValue + 1])

    ctx.write({
      groupedYearDates: groupedData.sort((a, b) => b.yearFrom - a.yearFrom),
    })
  })

const setData = (ctx: Context, newData: any[]) =>
  ctx.act(() => {
    ctx.write({
      data: newData.map((filter) => {
        sortItemsByNumberDesc(filter.items, 'count')
        setItemFirst(filter.items)
        return filter
      }),
    })
    // the sorts above may have reordered the store's own arrays in place
    ctx.touch()
    setGroupedYearDates(ctx, [2014, 2016, 2018])
  })

const getFilterByValue = (
  { api, act }: Context,
  array: any[] | undefined,
  key: any
) =>
  act(() =>
    // a default parameter, as `array = this.data` was: only for undefined
    (array === undefined ? api.getState().data : array).find(
      (item) => item.value === key
    )
  )

const checkYearPublishedStatis = (ctx: Context, transformFilters: any[]) =>
  ctx.act(() => {
    let filters = []

    const currentYearPublished = getFilterByValue(
      ctx,
      transformFilters,
      'yearPublished'
    )

    if (currentYearPublished.items.every(({ count }: any) => count === 0)) {
      const prevYearPublishedValues = getFilterByValue(
        ctx,
        ctx.api.getState().data,
        'yearPublished'
      )

      const newdata = transformFilters.map((item) =>
        item.value === 'yearPublished'
          ? { ...item, ...prevYearPublishedValues }
          : item
      )

      filters = [...newdata]

      setData(ctx, filters)
    } else {
      filters = [...transformFilters]
      setData(ctx, filters)
    }

    const activeFilterIndex = filters.findIndex(
      (item) => item.value === ctx.api.getState().activeFilter.value
    )
    if (activeFilterIndex > -1) {
      const activeFilterItems = filters[activeFilterIndex].items
      setActiveFilterSuggestions(ctx, activeFilterItems)
    }
  })

// one controller for every filters store, as the decorator's closure was;
// the request does not take the signal, which a call with the query alone
// receives as sortType (Q-020)
const fetchFilters = invalidatePreviousRequests(
  async (ctx: Context, query: any, sortType: any) => {
    const { api, act, write } = ctx
    act(() => write({ isLoading: true }))

    const activeFilter = api.getState().activeFilter.value

    try {
      const { aggregations } = await fetchAggregations({
        aggregations:
          activeFilter === 'yearPublished'
            ? select.filterNamesWithoutYear(api.getState())
            : api.getState().aggregationsNames,
        q: query,
      })

      const fullQuery = `${query}?sort=${sortType}`
      const labelValues = api.getState().aggregationsNames
      if (Object.keys(api.getState().initialData).length === 0) {
        act(() => write({ initialData: aggregations }))

        const filters = transformFiltersData(
          aggregations,
          null,
          labelValues,
          fullQuery
        )
        setData(ctx, filters)
      } else {
        const filters = transformFiltersData(
          api.getState().initialData,
          aggregations,
          labelValues,
          fullQuery
        )
        checkYearPublishedStatis(ctx, filters)
      }
      setIsVisibleClearButton(ctx)
    } catch (error) {
      console.error(error)
    } finally {
      act(() => write({ isLoading: false }))
    }
  }
)

const toggleCheckboxFilter = (ctx: Context, element: any, pathName: any) =>
  ctx.act(() => {
    ctx.write({ isLoading: true })
    const { activeFilterSuggestions } = ctx.api.getState()
    const foundedIndex = activeFilterSuggestions.findIndex(
      (i) => i.value === element.value
    )

    const foundedElement = activeFilterSuggestions[foundedIndex]
    foundedElement.checked = !foundedElement.checked
    ctx.touch()

    setActiveFilterSuggestions(ctx, activeFilterSuggestions)
    setIsVisibleClearButton(ctx, foundedElement.checked)

    const filterKey = ctx.api.getState().activeFilter.value
    const filterValue = filterKey === 'language' ? element.code : element.value
    const { q: query } = Router.query as any

    if (query.includes(filterValue)) {
      Router.push({
        pathname: pathName,
        query: {
          ...Router.query,
          q: query.replace(` AND ${filterKey}:"${filterValue}"`, ''),
          page: 1,
        },
      })
    } else {
      Router.push({
        pathname: pathName,
        query: {
          ...Router.query,
          q: `${query} AND ${filterKey}:"${filterValue}"`,
          page: 1,
        },
      })
    }
  })

const setActiveYearDate = (ctx: Context, yearsRange: any[], pathName: any) =>
  ctx.act(() => {
    const { api, write } = ctx
    const activeFilterSuggestions = api
      .getState()
      .activeFilterSuggestions.map((item) => {
        item.checked = false
        return item
      })

    const activeYears = activeFilterSuggestions.filter(
      (i) => i.value === yearsRange[0] || i.value === yearsRange[1]
    )

    const activeYearsMinValue = findMinValueInArray(activeYears, 'value')
    const activeYearsMaxValue = findMaxValueInArray(activeYears, 'value')

    yearsRange.map((rangeItem) => {
      activeFilterSuggestions.map((suggestion) => {
        if (rangeItem === suggestion.value) suggestion.checked = true
        return suggestion
      })
      return yearsRange
    })
    ctx.touch()

    const groupedData = api.getState().groupedYearDates.map((year) => ({
      ...year,
      checked:
        activeYears.length > 1 &&
        activeYearsMinValue === year.yearFrom &&
        activeYearsMaxValue === select.maxYear(api.getState()),
    }))

    if (groupedData.filter((year) => year.checked).length > 0)
      write({ yearWorksCount: null })
    else setYearWorksCount(ctx, [activeYearsMinValue, activeYearsMaxValue + 1])

    write({ activeFilterSuggestions })
    write({ groupedYearDates: groupedData })

    const filterKey = api.getState().activeFilter.value
    const { q: query } = Router.query as any

    Router.push({
      pathname: pathName,
      query: {
        ...Router.query,
        q: `${query.replace(/ AND \(year(.*)\)/g, '')} AND (${filterKey}>=${
          yearsRange[0]
        } AND ${filterKey}<=${yearsRange[1]})`,
        page: 1,
      },
    })
    setIsVisibleClearButton(ctx, true)
  })

const reset = (ctx: Context, query: any, pathName: any) =>
  ctx.act(() => {
    ctx.write({
      initialData: {},
      activeFilter: {},
      groupedYearDates: [],
      yearWorksCount: null,
      isLoading: false,
      isVisibleClearButton: false,
    })
    Router.push({
      pathname: pathName,
      query: {
        ...Router.query,
        q: query?.replace(/ .*/, ''),
        page: 1,
      },
    })
    ctx.api.getState().fetchFilters(query.replace(/ .*/, ''))
  })

export const createFiltersStore = (): FiltersStore =>
  createStore<FiltersState>()((set, get, api) => {
    const store = api as FiltersStore
    store.select = select
    const ctx: Context = { api: store, ...batched(api) }
    const { act, write } = ctx

    return {
      data: [],
      initialData: {},
      activeFilter: {},
      activeFilterSuggestions: [],
      aggregationsNames: [
        'fieldsOfStudy',
        'yearPublished',
        'documentType',
        'authors',
        'language',
        'publisher',
      ],
      groupedYearDates: [],
      isLoading: false,
      yearWorksCount: null,
      isVisibleClearButton: false,
      setActiveFilter: (filter) => act(() => write({ activeFilter: filter })),
      setIsLoading: (isLoading) => act(() => write({ isLoading })),
      setIsVisibleClearButton: (value) => setIsVisibleClearButton(ctx, value),
      setInitialData: (data) => act(() => write({ initialData: data })),
      fetchFilters: (...args) => act(() => fetchFilters(ctx, ...args)),
      checkYearPublishedStatis: (transformFilters) =>
        checkYearPublishedStatis(ctx, transformFilters),
      setData: (newData) => setData(ctx, newData),
      toggleCheckboxFilter: (element, pathName) =>
        toggleCheckboxFilter(ctx, element, pathName),
      setActiveYearDate: (yearsRange, pathName) =>
        setActiveYearDate(ctx, yearsRange, pathName),
      setGroupedYearDates: (...args) =>
        setGroupedYearDates(ctx, ...(args as [any[], any?])),
      setYearWorksCount: (yearsRange) => setYearWorksCount(ctx, yearsRange),
      setActiveFilterSuggestions: (items) =>
        setActiveFilterSuggestions(ctx, items),
      getFilterByValue: (array, key) => getFilterByValue(ctx, array, key),
      reset: (query, pathName) => reset(ctx, query, pathName),
      routeChanged: () =>
        act(() => {
          write({ activeFilter: {} })
          write({ initialData: {} })
          setYearWorksCount(ctx, null)
        }),
    }
  }) as FiltersStore

export default createFiltersStore
