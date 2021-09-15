import React, { useRef, useState } from 'react'
import { Icon } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'
import FilterItem from './filter-item'
import YearFilter from './year-filter'
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

  return (
    <li className={styles.barItemWrapper} ref={node}>
      <div
        onClick={onToggleFilterBox}
        role="presentation"
        className={classNames.use(styles.barItem, {
          [styles.barItemActive]: isComponentVisible,
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
          {filter.label !== 'field' && filter.label !== 'year' && <Search />}
          {filter.label !== 'year' &&
            filters.activeFilterSuggestions.map((item) => (
              <FilterItem key={item.id} item={item} />
            ))}
          {filter.label === 'year' && <YearFilter />}
        </ul>
      )}
    </li>
  )
})

export default FilterBarItem
