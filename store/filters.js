import { action, computed, makeObservable, observable } from 'mobx'
import Router from 'next/router'

import {
  setItemFirst,
  sortItemsByNumberDesc,
  sortItemsByBoolean,
} from '../utils/sort'
import { fetchAggregations } from '../api/search'
import { findMaxValueInArray, findMinValueInArray } from '../utils/helpers'

import transformFiltersData, { checkActiveItems } from 'utils/filters-transform'
import invalidatePreviousRequests from 'utils/invalidatePreviousRequests'

class Filters {
  @observable data = []

  @observable initialData = {}

  @observable activeFilter = {}

  @observable activeFilterSuggestions = []

  @observable aggregationsNames = [
    'fieldsOfStudy',
    'yearPublished',
    'documentType',
    'authors',
    'language',
    'publisher',
  ]

  @observable groupedYearDates = []

  @observable isLoading = false

  @observable yearWorksCount = null

  @observable isVisibleClearButton = false

  constructor() {
    makeObservable(this, null)
  }

  @action
  setActiveFilter(filter) {
    this.activeFilter = filter
  }

  @action
  setIsLoading(isLoading) {
    this.isLoading = isLoading
  }

  @action
  setIsVisibleClearButton(boolean) {
    this.isVisibleClearButton = boolean || checkActiveItems(this.data)
  }

  @action
  setInitialData(data) {
    this.initialData = data
  }

  @action
  @invalidatePreviousRequests
  async fetchFilters(query, sortType) {
    this.setIsLoading(true)

    const activeFilter = this.activeFilter.value

    try {
      const { aggregations } = await fetchAggregations({
        aggregations:
          activeFilter === 'yearPublished'
            ? this.filterNamesWithoutYear
            : this.aggregationsNames,
        q: query,
      })

      const fullQuery = `${query}?sort=${sortType}`
      const labelValues = this.aggregationsNames
      if (Object.keys(this.initialData).length === 0) {
        this.setInitialData(aggregations)

        const filters = transformFiltersData(
          aggregations,
          null,
          labelValues,
          fullQuery
        )
        this.setData(filters)
      } else {
        const filters = transformFiltersData(
          this.initialData,
          aggregations,
          labelValues,
          fullQuery
        )
        this.checkYearPublishedStatis(filters)
      }
      this.setIsVisibleClearButton()
    } catch (error) {
      console.error(error)
    } finally {
      this.setIsLoading(false)
    }
  }

  @action
  checkYearPublishedStatis(transformFilters) {
    let filters = []

    const currentYearPublished = this.getFilterByValue(
      transformFilters,
      'yearPublished'
    )

    if (currentYearPublished.items.every(({ count }) => count === 0)) {
      const prevYearPublishedValues = this.getFilterByValue(
        this.data,
        'yearPublished'
      )

      const newdata = transformFilters.map((item) =>
        item.value === 'yearPublished'
          ? { ...item, ...prevYearPublishedValues }
          : item
      )

      filters = [...newdata]

      this.setData(filters)
    } else {
      filters = [...transformFilters]
      this.setData(filters)
    }

    const activeFilterIndex = filters.findIndex(
      (item) => item.value === this.activeFilter.value
    )
    if (activeFilterIndex > -1) {
      const activeFilterItems = filters[activeFilterIndex].items
      this.setActiveFilterSuggestions(activeFilterItems)
    }
  }

  @action
  setData(newData) {
    this.data = newData.map((filter) => {
      sortItemsByNumberDesc(filter.items, 'count')
      setItemFirst(filter.items)
      return filter
    })
    this.setGroupedYearDates([2014, 2016, 2018])
  }


  @action
  toggleCheckboxFilter(element, pathName) {
    this.setIsLoading(true)
    const { activeFilterSuggestions } = this
    const foundedIndex = activeFilterSuggestions.findIndex(
      (i) => i.value === element.value
    )

    const foundedElement = activeFilterSuggestions[foundedIndex]
    foundedElement.checked = !foundedElement.checked

    this.setActiveFilterSuggestions(activeFilterSuggestions)
    this.setIsVisibleClearButton(foundedElement.checked)

    const filterKey = this.activeFilter.value
    const filterValue = filterKey === 'language' ? element.code : element.value
    const { q: query } = Router.query

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
  }

  @action
  setActiveYearDate(yearsRange, pathName) {
    const activeFilterSuggestions = this.activeFilterSuggestions.map((item) => {
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

    const groupedData = this.groupedYearDates.map((year) => ({
      ...year,
      checked:
        activeYears.length > 1 &&
        activeYearsMinValue === year.yearFrom &&
        activeYearsMaxValue === this.maxYear,
    }))

    if (groupedData.filter((year) => year.checked).length > 0)
      this.yearWorksCount = null
    else this.setYearWorksCount([activeYearsMinValue, activeYearsMaxValue + 1])

    this.activeFilterSuggestions = activeFilterSuggestions
    this.groupedYearDates = groupedData

    const filterKey = this.activeFilter.value
    const { q: query } = Router.query

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
    this.setIsVisibleClearButton(true)
  }

  @action
  setGroupedYearDates(yearFrom, yearTo = this.maxYear) {
    const datesFilter = this.data.find(
      (filter) => filter.label === 'year'
    ).items
    const activeYears = datesFilter.filter((item) => item.checked === true)

    const activeYearsMinValue = findMinValueInArray(activeYears, 'value')
    const activeYearsMaxValue = findMaxValueInArray(activeYears, 'value')

    const groupedData = yearFrom.map((year) => {
      const worksCount = datesFilter
        .filter((item) => item.value >= year && item.value <= yearTo)
        .reduce((prev, curr) => prev + curr.count, 0)

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
      datesFilter.map((item) => item.checked === true).length === 0
    )
      this.setYearWorksCount([activeYearsMinValue, activeYearsMaxValue + 1])

    this.groupedYearDates = groupedData.sort((a, b) => b.yearFrom - a.yearFrom)
  }

  @action
  setYearWorksCount(yearsRange) {
    if (yearsRange) {
      this.yearWorksCount = this.activeFilterSuggestions
        .filter(
          (item) => item.value >= yearsRange[0] && item.value < yearsRange[1]
        )
        .reduce((prev, curr) => prev + curr.count, 0)
    } else this.yearWorksCount = null
  }

  @action
  setActiveFilterSuggestions(items) {
    let sortedArray = []
    sortItemsByNumberDesc(items, 'count')
    sortedArray = sortItemsByBoolean(items, 'checked')
    this.activeFilterSuggestions = sortedArray
  }

  @computed
  get maxYear() {
    return Math.max.apply(
      null,
      this.data
        .find((item) => item.label === 'year')
        .items.map((item) => item.value)
    )
  }

  @computed
  get filterNamesWithoutYear() {
    return this.aggregationsNames.filter((item) => item !== 'yearPublished')
  }

  get filterNamesWithoutPublisher() {
    return this.aggregationsNames.filter((item) => item !== 'publisher')
  }

  @action
  getFilterByValue(array = this.data, key) {
    return array.find((item) => item.value === key)
  }

  @action
  reset(query, pathName) {
    this.initialData = {}
    this.activeFilter = {}
    this.groupedYearDates = []
    this.yearWorksCount = null
    this.isLoading = false
    this.isVisibleClearButton = false
    Router.push({
      pathname: pathName,
      query: {
        ...Router.query,
        q: query?.replace(/ .*/, ''),
        page: 1,
      },
    })
    this.fetchFilters(query.replace(/ .*/, ''))
  }

  @action
  routeChanged() {
    this.setActiveFilter({})
    this.setInitialData({})
    this.setYearWorksCount(null)
  }
}

export default Filters
