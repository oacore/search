import React, { useRef, useState } from 'react'
import { Icon } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'
import setFilterBox from './utils/set-filter-box'

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
    hideFilterBox()
  }

  const component = setFilterBox(
    filter.label,
    filters.activeFilterSuggestions,
    filter.label === 'sort by'
      ? onChangeSortFilter
      : onChangeFiltersWithCheckbox
  )

  return (
    <li className={styles.barItemWrapper} ref={node}>
      <div
        onClick={onToggleFilterBox}
        role="presentation"
        className={classNames.use(styles.barItem, {
          [styles.barItemActive]:
            filter.label !== 'sort by' &&
            filter.items.find((item) => item.checked === true),
          [styles.sortBarItem]: filter.label === 'sort by',
          [styles.disabled]: filter.items.length === 0,
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
          {component}
        </ul>
      )}
    </li>
  )
})

export default FilterBarItem
