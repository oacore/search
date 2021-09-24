import React, { useEffect } from 'react'
import { Button, LoadingBar } from '@oacore/design/lib/elements'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'
import FilterBarItem from './bar-item'
import sortFilterValues from './utils/sort-filter-values'

import { observe, useStore } from 'store'

const FiltersBar = observe(({ className, query }) => {
  const [visibleClearButton, setVisibleClearButton] = React.useState(false)
  const [visibleFiltersBar, setVisibleFiltersBar] = React.useState(false)

  const { filters } = useStore()

  useEffect(() => {
    filters.fetchFilters(query)

    filters.data.map((filter) => {
      const checkedItems = filter.items.find((item) => item.checked === true)
      if (checkedItems) setVisibleClearButton(true)
      return filter
    })
  }, [query])

  const onHandleClickClear = () => {
    // Set all checkbox  - false
  }

  const onToggleFiltersBar = () => {
    setVisibleFiltersBar(!visibleFiltersBar)
  }

  if (filters.isLoading) return <LoadingBar fixed />
  return (
    <>
      <Button
        type="button"
        className={classNames.use(styles.button, styles.toggleButton)}
        onClick={onToggleFiltersBar}
      >
        Filters
      </Button>
      <ul
        className={classNames
          .use(styles.bar, {
            [styles.expanded]: visibleFiltersBar,
          })
          .join(className)}
      >
        {filters.data.map((filter) => (
          <FilterBarItem key={filter.value} filter={filter} />
        ))}
        <FilterBarItem filter={sortFilterValues} />
        {visibleClearButton && (
          <Button
            type="button"
            variant="text"
            onClick={onHandleClickClear}
            className={styles.button}
          >
            Clear all filters
          </Button>
        )}
      </ul>
    </>
  )
})

export default FiltersBar
