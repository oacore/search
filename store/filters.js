import { action, computed, makeObservable, observable } from 'mobx'

import {
  setItemFirst,
  sortItemsByNumberDesc,
  sortItemsByBoolean,
} from '../utils/sort'
import { fetchAggregations } from '../api/search'

import transformFiltersData from 'utils/filters-transform'
import invalidatePreviousRequests from 'utils/invalidatePreviousRequests'

class Filters {
  data = []

  activeFilter = {}

  activeFilterSuggestions = []

  aggregations = [
    'authors',
    'language',
    'yearPublished',
    'documentType',
    'publisher',
    'fieldsOfStudy',
  ]

  groupedYearDates = []

  isLoading = false

  worksCount = null

  constructor() {
    makeObservable(this, {
      data: observable,
      activeFilter: observable,
      activeFilterSuggestions: observable,
      groupedYearDates: observable,
      isLoading: observable,
      worksCount: observable,
      setData: action,
      setActiveFilter: action,
      setActiveFilterSuggestions: action,
      toggleCheckboxFilter: action,
      setGroupedYearDates: action,
      setWorksCount: action,
      setIsLoading: action,
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

  @invalidatePreviousRequests
  async fetchFilters(query) {
    this.reset()
    this.setIsLoading(true)
    try {
      const { aggregations } = await fetchAggregations({
        aggregations: this.aggregations,
        q: query,
      })

      const filters = transformFiltersData(aggregations)
      this.setData(filters)
    } catch (error) {
      console.error(error)
    } finally {
      this.setIsLoading(false)
    }
  }

  setData(arr) {
    this.data = arr.map((filter) => {
      filter.items = filter.items.map((item) => {
        item.checked = false
        if (item.label === 'english') item.checked = true
        return item
      })
      sortItemsByNumberDesc(filter.items, 'count')
      setItemFirst(filter.items)
      return filter
    })
  }

  toggleCheckboxFilter(element) {
    const foundedIndex = this.activeFilterSuggestions.findIndex(
      (i) => i.value === element.value
    )

    const foundedElement = this.activeFilterSuggestions[foundedIndex]

    foundedElement.checked = !foundedElement.checked

    this.setActiveFilterSuggestions(this.activeFilterSuggestions)

    // Here will be api call

    // if (element.checked) {
    // } else {
    // }
  }

  setActiveYearDate(yearsRange) {
    this.groupedYearDates = this.groupedYearDates.map((item) => ({
      ...item,
      checked: false,
    }))
    const foundedIndex = this.groupedYearDates.findIndex(
      (i) => i.yearFrom === yearsRange[0] && yearsRange[1] === this.maxYear + 1
    )
    const foundedElement = this.groupedYearDates[foundedIndex]

    if (foundedIndex >= 0) {
      foundedElement.checked = true
      this.worksCount = null
    } else this.setWorksCount(yearsRange)

    return this.groupedYearDates
  }

  setGroupedYearDates(yearFrom, yearTo = 2021) {
    const groupedData = yearFrom.map((year) => {
      const worksCount = this.activeFilterSuggestions
        .filter((item) => item.value >= year && item.value <= yearTo)
        .reduce((prev, curr) => prev + curr.count, 0)

      return {
        yearFrom: year,
        count: worksCount,
        checked: false,
      }
    })

    const unknown = this.activeFilterSuggestions.find(
      (item) => item.value === 'unknown'
    )
    if (unknown) groupedData.unshift(unknown)
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
    const activeFilterSuggestions = this.activeFilterSuggestions.map(
      (item) => ({
        ...item,
        checked: false,
      })
    )
    const foundedIndex = activeFilterSuggestions.findIndex(
      (i) => i.value === sortType.value
    )
    const foundedElement = activeFilterSuggestions[foundedIndex]
    foundedElement.checked = true
    this.setActiveFilterSuggestions(activeFilterSuggestions)
  }

  setActiveFilterSuggestions(items) {
    let sortedArray = []
    sortItemsByNumberDesc(items, 'count')
    setItemFirst(items)
    sortedArray = sortItemsByBoolean(items, 'checked')
    this.activeFilterSuggestions = sortedArray
  }

  get maxYear() {
    return this.activeFilterSuggestions.reduce((prev, current) =>
      prev.value > current.value ? prev : current
    ).value
  }

  reset() {
    this.data = []
    this.activeFilter = {}
    this.activeFilterSuggestions = []
    this.aggregations = [
      'authors',
      'language',
      'yearPublished',
      'documentType',
      'publisher',
      'fieldsOfStudy',
    ]
    this.groupedYearDates = []
    this.isLoading = false
  }
}

export default Filters
