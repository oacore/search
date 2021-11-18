import useHistogram from './use-histogram'

import { useStore } from 'store'
import { findMaxValueInArray, findMinValueInArray } from 'utils/helpers'

const MAX_YEAR = 2021
const MIN_YEAR = 1950

const useYearFilterController = () => {
  const { filters } = useStore()
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
    if (selectedItem.yearFrom)
      yearsRange = [selectedItem.yearFrom, filters.maxYear + 1]
    else yearsRange = selectedItem

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
