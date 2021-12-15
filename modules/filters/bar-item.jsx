import React, { memo, useRef, useState } from 'react'
import { Icon } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'
import FilterBox from './filter-box'

import useOutsideClick from 'hooks/use-outside-click'
import { observe, useStore } from 'store'

const FilterBarItem = ({ filter }) => {
  const [isComponentVisible, setIsComponentVisible] = useState(false)

  const node = useRef()
  const { filters } = useStore()

  const onToggleFilterBox = () => {
    setIsComponentVisible(!isComponentVisible)
    if (!isComponentVisible && filter.items) {
      filters.setActiveFilter(filter)
      filters.setActiveFilterSuggestions(filter.items)
    }
  }

  const hideFilterBox = () => {
    setIsComponentVisible(false)
  }

  useOutsideClick(node, hideFilterBox)

  return (
    <li className={styles.barItemWrapper} ref={node}>
      <div
        onClick={onToggleFilterBox}
        role="presentation"
        className={classNames.use(styles.barItem, {
          [styles.barItemActive]:
            filter.label !== 'sort by' &&
            filter.items &&
            filter.items.find((item) => item.checked === true),
          [styles.sortBarItem]: filter.label === 'sort by',
          [styles.disabled]: filter.items && filter.items.length === 0,
        })}
      >
        <p>{filter.label}</p>
        <Icon className={styles.barItemIcon} src="#menu-down" />
      </div>
      {isComponentVisible && (
        <FilterBox label={filter.label} filterItems={filter.items} />
      )}
    </li>
  )
}

export default FilterBarItem
