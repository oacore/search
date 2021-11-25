import React, { useEffect } from 'react'
import { Histoslider } from '@oacore/design/lib/elements'

import styles from '../styles.module.css'
import FilterItem from '../filter-item'
import CustomRange from './custom-range'
import YearSelects from './selects'
import useYearFilterController from './hooks/use-year-filter-controller'

import { observe } from 'store'

const YearFilter = observe(() => {
  const {
    filters,
    yearsAxis,
    onSelectActiveFilterItem,
    loadFilter,
    selection,
  } = useYearFilterController()

  useEffect(() => {
    loadFilter()
  }, [])

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
