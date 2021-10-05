import React, { useEffect } from 'react'

import styles from '../styles.module.css'
import FilterItem from '../filter-item'
import CustomRange from './custom-range'
import YearSelects from './selects'
import useHistogram from './use-histogram'

import { useStore, observe } from 'store'
import Histoslider from 'modules/histoslider'

const YearFilter = observe(() => {
  const { filters } = useStore()

  const { selection, onHistogramChange } = useHistogram()

  useEffect(() => {
    filters.setGroupedYearDates([2014, 2016, 2018])
    const activeYears = filters.activeFilterSuggestions.filter(
      (item) => item.checked === true
    )
    if (activeYears.length === 1)
      onHistogramChange([activeYears[0].value, activeYears[0].value + 1])
    else if (activeYears.length > 1)
      onHistogramChange([activeYears[0].value, activeYears[1].value + 1])
  }, [])

  const yearsAxis = filters.activeFilterSuggestions.map((suggestion) => ({
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
    // if (yearsRange[0] === yearsRange[1]) yearsRange[0] = yearsRange[1] - 1

    filters.setActiveYearDate(yearsRange)
    return selectedItem
  }

  return (
    <>
      {filters.groupedYearDates.map((groupedYearDate) => (
        <FilterItem
          key={groupedYearDate.count}
          value={groupedYearDate.value}
          checkedIcon="#check"
          unCheckedIcon={null}
          item={groupedYearDate}
          onChangeFunction={onSelectActiveFilterItem}
          useActiveStyles
        />
      ))}
      <CustomRange count={filters.worksCount} />
      <Histoslider
        data={yearsAxis}
        selection={selection}
        className={styles.slider}
        padding={20}
        width={298}
        showLabels
        selectFunc={onSelectActiveFilterItem}
      />
      <YearSelects years={filters.activeFilterSuggestions} />
    </>
  )
})

export default YearFilter
