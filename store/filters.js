import { action, makeObservable, observable } from 'mobx'

import {
  setItemFirst,
  sortItemsByNumber,
  sortItemsByBoolean,
} from '../utils/sort'

class Filters {
  data = []

  activeFilter = {}

  activeFilterSuggestions = []

  groupedYearDates = []

  constructor() {
    makeObservable(this, {
      data: observable,
      activeFilter: observable,
      activeFilterSuggestions: observable,
      groupedYearDates: observable,
      setData: action,
      setActiveFilter: action,
      setActiveFilterSuggestions: action,
      toggleCheckboxFilter: action,
      setGroupedYearDates: action,
      reset: action,
    })
  }

  setActiveFilter(filter) {
    this.activeFilter = filter
  }

  setData(arr) {
    this.data = arr.map((filter) => {
      filter.items = filter.items.map((item) => {
        item.checked = false
        return item
      })
      sortItemsByNumber(filter.items, 'count')
      setItemFirst(filter.items)
      return filter
    })
  }

  toggleCheckboxFilter(element) {
    const foundedIndex = this.activeFilterSuggestions.findIndex(
      (i) => i.id === element.id
    )

    const foundedElement = this.activeFilterSuggestions[foundedIndex]

    foundedElement.checked = !foundedElement.checked

    this.setActiveFilterSuggestions(this.activeFilterSuggestions)

    // Here will be api call

    // if (element.checked) {
    // } else {
    // }
  }

  setActiveYearDate(selectedItem) {
    this.groupedYearDates = this.groupedYearDates.map((item) => ({
      ...item,
      checked: false,
    }))

    const foundedIndex = this.groupedYearDates.findIndex(
      (i) => i.yearFrom === selectedItem.yearFrom
    )

    const foundedElement = this.groupedYearDates[foundedIndex]

    foundedElement.checked = true

    return this.groupedYearDates
  }

  setGroupedYearDates(yearFrom, yearTo = 2021) {
    const groupedData = yearFrom.map((year) => {
      const filteredData = this.activeFilterSuggestions
        .filter((item) => item.label >= year && item.label <= yearTo)
        .reduce((prev, curr) => prev + curr.count, 0)

      return {
        yearFrom: year,
        count: filteredData,
        checked: false,
      }
    })
    const unclassified = this.activeFilterSuggestions.find(
      (item) => item.label === 'unclassified'
    )

    groupedData.unshift(unclassified)

    this.groupedYearDates = groupedData.sort((a, b) => b.yearFrom - a.yearFrom)
  }

  setActiveSortType(sortType) {
    const activeFilterSuggestions = this.activeFilterSuggestions.map(
      (item) => ({
        ...item,
        checked: false,
      })
    )
    const foundedIndex = activeFilterSuggestions.findIndex(
      (i) => i.id === sortType.id
    )

    const foundedElement = activeFilterSuggestions[foundedIndex]

    foundedElement.checked = true

    this.setActiveFilterSuggestions(activeFilterSuggestions)
  }

  setActiveFilterSuggestions(items) {
    let sortedArray = []

    sortItemsByNumber(items, 'count')

    setItemFirst(items)

    sortedArray = sortItemsByBoolean(items, 'checked')

    this.activeFilterSuggestions = sortedArray
  }

  reset() {
    this.data = []
    this.activeFilter = {}
  }
}

export default Filters
