import React, { memo } from 'react'
import { classNames } from '@oacore/design/lib/utils'

import setFilterBox from './utils/set-filter-box'
import styles from './styles.module.css'

import { useStore, observe } from 'store'

const FilterBox = ({ label }) => {
  const { filters } = useStore()

  const onChangeFiltersWithCheckbox = (element) => {
    filters.toggleCheckboxFilter(element)
  }

  const isFiltersInitialLoading =
    filters.isLoading && Object.keys(filters.initialData).length === 0

  const component = setFilterBox(
    label,
    filters.activeFilterSuggestions,
    onChangeFiltersWithCheckbox,
    isFiltersInitialLoading
  )
  console.log(isFiltersInitialLoading)

  return (
    <ul
      className={classNames.use(styles.filterBox, {
        [styles.wideBox]: label === 'field' && !isFiltersInitialLoading,
        [styles.yearBox]: label === 'year' && !isFiltersInitialLoading,
      })}
    >
      {isFiltersInitialLoading ? <div>Loading</div> : <div> Loaded</div>}
    </ul>
  )
}

export default FilterBox
