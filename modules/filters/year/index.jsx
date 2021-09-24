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
  }, [])

  const yearsAxis = filters.activeFilterSuggestions
    .filter((suggestion) => suggestion.value !== 'unclassified')
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
    // if (selectedItem.value === 'unclassified') onHistogramChange(null)
    onHistogramChange(yearsRange)
    if (yearsRange[0] === yearsRange[1]) yearsRange[0] = yearsRange[1] - 1

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
        selectedBarColor="#EF8237"
        rangeColor="#b75400"
        unselectedColor="#E0E0E0"
        handleLabelFormat="0.7P"
        width={298}
        showLabels
        barPadding={2}
        selectFunc={onSelectActiveFilterItem}
      />
      <YearSelects years={filters.activeFilterSuggestions} />
    </>
  )
})

export default YearFilter
