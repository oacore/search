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
  data = []

  activeFilter = {}

  activeFilterSuggestions = []

  aggregations = [
    'authors',
    'fieldsOfStudy',
    'language',
    'publisher',
    'documentType',
    'yearPublished',
  ]

  groupedYearDates = []

  isLoading = false

  worksCount = null

  isVisibleClearButton = false

  constructor() {
    makeObservable(this, {
      data: observable,
      activeFilter: observable,
      activeFilterSuggestions: observable,
      groupedYearDates: observable,
      isLoading: observable,
      worksCount: observable,
      isVisibleClearButton: observable,
      setData: action,
      setActiveFilter: action,
      setActiveFilterSuggestions: action,
      toggleCheckboxFilter: action,
      setGroupedYearDates: action,
      setWorksCount: action,
      setIsLoading: action,
      setIsVisibleClearButton: action,
      reset: action,
      maxYear: computed,
    })
  }

  setActiveFilter(filter) {
    this.activeFilter = filter
  }

  setIsLoading(isLoading) {
    this.isLoading = isLoading
  }

  setIsVisibleClearButton(boolean) {
    this.isVisibleClearButton = boolean || checkActiveItems(this.data)
  }

  @invalidatePreviousRequests
  async fetchFilters(query, sortType) {
    this.setIsLoading(true)
    try {
      const { aggregations } = await fetchAggregations({
        aggregations: this.aggregations,
        q: query,
      })

      const fullQuery = `${query}?sort=${sortType}`
      const labelValues = this.aggregations
      const filters = transformFiltersData(aggregations, labelValues, fullQuery)
      this.setData(filters)
      this.setIsVisibleClearButton()
    } catch (error) {
      console.error(error)
    } finally {
      this.setIsLoading(false)
    }
  }

  setData(arr) {
    this.data = arr.map((filter) => {
      sortItemsByNumberDesc(filter.items, 'count')
      setItemFirst(filter.items)
      return filter
    })
    this.setGroupedYearDates([2014, 2016, 2018])
  }

  toggleCheckboxFilter(element) {
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
    const { query } = Router.query

    if (query.includes(filterValue)) {
      Router.push({
        pathname: '/search/[query]',
        query: {
          ...Router.query,
          query: query.replace(` AND ${filterKey}:"${filterValue}"`, ''),
          page: 1,
        },
      })
    } else {
      Router.push({
        pathname: '/search/[query]',
        query: {
          ...Router.query,
          query: `${query} AND ${filterKey}:"${filterValue}"`,
          page: 1,
        },
      })
    }
  }

  setActiveYearDate(yearsRange) {
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
      this.worksCount = null
    else this.setWorksCount([activeYearsMinValue, activeYearsMaxValue + 1])

    this.activeFilterSuggestions = activeFilterSuggestions
    this.groupedYearDates = groupedData

    const filterKey = this.activeFilter.value
    const { query } = Router.query

    Router.push({
      pathname: '/search/[query]',
      query: {
        ...Router.query,
        query: `${query.replace(/ AND \(year(.*)\)/g, '')} AND (${filterKey}>=${
          yearsRange[0]
        } AND ${filterKey}<=${yearsRange[1]})`,
        page: 1,
      },
    })
    this.setIsVisibleClearButton(true)
  }

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
      this.setWorksCount([activeYearsMinValue, activeYearsMaxValue + 1])

    this.groupedYearDates = groupedData.sort((a, b) => b.yearFrom - a.yearFrom)
  }

  setWorksCount(yearsRange) {
    this.worksCount = this.activeFilterSuggestions
      .filter(
        (item) => item.value >= yearsRange[0] && item.value < yearsRange[1]
      )
      .reduce((prev, curr) => prev + curr.count, 0)
  }

  setActiveSortType(sortType) {
    const activeFilterSuggestions = this.activeFilterSuggestions.map((item) => {
      item.checked = false
      return item
    })
    const foundedIndex = activeFilterSuggestions.findIndex(
      (i) => i.value === sortType.value
    )
    const foundedElement = activeFilterSuggestions[foundedIndex]
    foundedElement.checked = true
    this.setActiveFilterSuggestions(activeFilterSuggestions)

    Router.push({
      pathname: '/search/[query]',
      query: {
        ...Router.query,
        sort: sortType.value,
        page: 1,
      },
    })
  }

  setActiveFilterSuggestions(items) {
    let sortedArray = []
    sortItemsByNumberDesc(items, 'count')
    sortedArray = sortItemsByBoolean(items, 'checked')
    this.activeFilterSuggestions = sortedArray
  }

  get maxYear() {
    return Math.max.apply(
      null,
      this.data
        .find((item) => item.label === 'year')
        .items.map((item) => item.value)
    )
  }

  reset(query) {
    this.data = this.data.map((filter) => {
      if (filter.label !== 'sort by')
        filter.items = filter.items.map((item) => ({ ...item, checked: false }))
      return filter
    })
    this.activeFilter = {}
    this.aggregations = [
      'authors',
      'language',
      'yearPublished',
      'documentType',
      'publisher',
      'fieldsOfStudy',
    ]
    this.isLoading = false
    this.isVisibleClearButton = false
    Router.push({
      pathname: '/search/[query]',
      query: {
        ...Router.query,
        query: query.replace(/ .*/, ''),
        page: 1,
      },
    })
  }
}

export default Filters
