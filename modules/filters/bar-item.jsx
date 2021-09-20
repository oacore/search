import React, { useRef, useState } from 'react'
import { Icon } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'
import FilterItem from './filter-item'
import YearFilter from './year'
import Search from './search'

import useOutsideClick from 'hooks/use-outside-click'
import { observe, useStore } from 'store'

const FilterBarItem = observe(({ filter }) => {
  const [isComponentVisible, setIsComponentVisible] = useState(false)

  const node = useRef()

  const { filters } = useStore()

  const onToggleFilterBox = () => {
    setIsComponentVisible(!isComponentVisible)
    if (!isComponentVisible) {
      filters.setActiveFilter(filter)
      filters.setActiveFilterSuggestions(filter.items)
    }
  }

  const hideFilterBox = () => {
    setIsComponentVisible(false)
  }

  useOutsideClick(node, hideFilterBox)

  const onChangeFiltersWithCheckbox = (element) => {
    filters.toggleCheckboxFilter(element)
  }

  const onChangeSortFilter = (element) => {
    filters.setActiveSortType(element)
  }

  return (
    <li className={styles.barItemWrapper} ref={node}>
      <div
        onClick={onToggleFilterBox}
        role="presentation"
        className={classNames.use(styles.barItem, {
          [styles.barItemActive]:
            isComponentVisible && filter.label !== 'sort by',
          [styles.sortBarItem]: filter.label === 'sort by',
        })}
      >
        <p>{filter.label}</p>
        <Icon className={styles.barItemIcon} src="#menu-down" />
      </div>
      {isComponentVisible && (
        <ul
          className={classNames.use(styles.filterBox, {
            [styles.wideBox]: filter.label === 'field',
            [styles.yearBox]: filter.label === 'year',
          })}
        >
          {/* Disable Search for "field,year,sortBy" */}
          {filter.label !== 'field' &&
            filter.label !== 'year' &&
            filter.label !== 'sort by' && <Search />}
          {filter.label === 'year' && <YearFilter />}
          {filter.label === 'sort by' &&
            filters.activeFilterSuggestions.map((item) => (
              <FilterItem
                key={item.id}
                name={item.name}
                checkedIcon="#check"
                unCheckedIcon={null}
                item={item}
                onChangeFunction={onChangeSortFilter}
                activeLabelClassName={item.checked && [styles.labelTextActive]}
              />
            ))}

          {filter.label !== 'year' &&
            filter.label !== 'sort by' &&
            filters.activeFilterSuggestions.map((item) => (
              <FilterItem
                key={item.id}
                name={item.name}
                checkedIcon="#checkbox-marked"
                unCheckedIcon="#checkbox-blank-outline"
                item={item}
                onChangeFunction={onChangeFiltersWithCheckbox}
              />
            ))}
        </ul>
      )}
    </li>
  )
})

export default FilterBarItem
