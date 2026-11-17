import { useStore as useStoreApi } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import useHistogram from './use-histogram'

import { useStore } from 'store'
import { findMaxValueInArray, findMinValueInArray } from 'utils/helpers'

const MAX_YEAR = new Date().getFullYear()
const MIN_YEAR = 1950

// what the year box's observer read while rendering: the suggestions with
// their values and counts, the grouped years with their counts and values,
// and the year count; in-place writes come with a notification
const selectYear = (state) => {
  const read = [
    state.activeFilterSuggestions,
    state.groupedYearDates,
    state.yearWorksCount,
  ]
  state.activeFilterSuggestions.forEach((item) =>
    read.push(item, item.value, item.count)
  )
  state.groupedYearDates.forEach((item) =>
    read.push(item, item.count, item.value)
  )
  return read
}

const useYearFilterController = () => {
  const { filters: filtersStore } = useStore()
  useStoreApi(filtersStore, useShallow(selectYear))
  const filters = filtersStore.getState()
  const { selection, onHistogramChange } = useHistogram()

  const loadFilter = () => {
    const activeYears = filters.activeFilterSuggestions.filter(
      (item) => item.checked === true
    )

    const activeYearsMinValue = findMinValueInArray(activeYears, 'value')
    const activeYearsMaxValue = findMaxValueInArray(activeYears, 'value')

    if (activeYears.length === 1)
      onHistogramChange([activeYearsMinValue, activeYearsMinValue + 1])
    else if (activeYears.length > 1)
      onHistogramChange([activeYearsMinValue, activeYearsMaxValue + 1])
  }

  const yearsAxis = filters.activeFilterSuggestions
    .filter(
      (suggestion) =>
        suggestion.value >= MIN_YEAR && suggestion.value <= MAX_YEAR
    )
    .map((suggestion) => ({
      x0: suggestion.value,
      x: suggestion.value + 1,
      y: suggestion.count,
    }))

  const onSelectActiveFilterItem = (selectedItem) => {
    let yearsRange
    if (selectedItem.yearFrom) {
      // the computed maxYear of the MobX store
      const maxYear = filtersStore.select.maxYear(filtersStore.getState())
      yearsRange = [selectedItem.yearFrom, maxYear + 1]
    } else yearsRange = selectedItem

    onHistogramChange(yearsRange)
    filters.setActiveYearDate([yearsRange[0], yearsRange[1] - 1])
  }

  return {
    filters,
    yearsAxis,
    onSelectActiveFilterItem,
    loadFilter,
    selection,
  }
}

export default useYearFilterController
