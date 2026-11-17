import React, { useRef, useState } from 'react'
import { Icon } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'
import { useStore as useStoreApi } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import styles from './styles.module.css'
import setFilterBox from './utils/set-filter-box'

import useOutsideClick from 'hooks/use-outside-click'
import { observe, useStore } from 'store'

// what an observer of this item read while rendering: the suggestions (with
// each one's value and count, unless the year box renders them) and the
// checked state of the facet's items; their in-place writes and sorts come
// with a notification, so the flat list changes with them
const selectItem = (filter) => (state) => {
  const suggestions = state.activeFilterSuggestions
  const read = [suggestions, filter.items]
  filter.items.forEach((item) => read.push(item, item.checked))
  if (filter.label !== 'year')
    suggestions.forEach((item) => read.push(item, item.value, item.count))
  return read
}

const FilterBarItem = observe(({ filter, pathName }) => {
  const [isComponentVisible, setIsComponentVisible] = useState(false)

  const node = useRef()
  const { filters: filtersStore } = useStore()
  const [activeFilterSuggestions] = useStoreApi(
    filtersStore,
    useShallow(selectItem(filter))
  )
  const filters = filtersStore.getState()

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
    filters.toggleCheckboxFilter(element, pathName)
  }

  const component = setFilterBox(
    filter.label,
    activeFilterSuggestions,
    onChangeFiltersWithCheckbox
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
