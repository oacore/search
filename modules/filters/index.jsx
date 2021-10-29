import React, { useEffect } from 'react'
import { Button, LoadingBar } from '@oacore/design/lib/elements'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'
import FilterBarItem from './bar-item'

import { observe, useStore } from 'store'

const FiltersBar = observe(({ className, query: initialQuery, sortType }) => {
  const [visibleFiltersBar, setVisibleFiltersBar] = React.useState(false)
  const [query, setQuery] = React.useState(initialQuery)
  const { filters } = useStore()

  useEffect(() => {
    if (!initialQuery.includes(query)) {
      setQuery(initialQuery)
      filters.fetchFilters(initialQuery, sortType)
    }
  }, [initialQuery])

  useEffect(() => {
    filters.fetchFilters(query, sortType)
  }, [])

  const onHandleClickClear = () => {
    filters.reset(query)
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
        {filters.isVisibleClearButton && (
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
