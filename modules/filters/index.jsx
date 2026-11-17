import React, { useEffect } from 'react'
import { Button } from '@oacore/design/lib/elements'
import { classNames } from '@oacore/design/lib/utils'
import { useStore as useStoreApi } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import styles from './styles.module.css'
import FilterBarItem from './bar-item'
import LoadingBlock from './loading-block'

import { observe, useStore } from 'store'

// the fields the bar renders (an observer read these)
const selectBar = (state) => ({
  isLoading: state.isLoading,
  initialData: state.initialData,
  data: state.data,
  isVisibleClearButton: state.isVisibleClearButton,
})

const FiltersBar = observe(
  ({ className, query: initialQuery, sortType, styleProp }) => {
    const [visibleFiltersBar, setVisibleFiltersBar] = React.useState(false)
    const [query, setQuery] = React.useState(initialQuery)
    const { filters: filtersStore } = useStore()
    const filters = {
      ...filtersStore.getState(),
      ...useStoreApi(filtersStore, useShallow(selectBar)),
    }

    useEffect(() => {
      if (!initialQuery?.includes(query)) {
        setQuery(initialQuery)
        filters.routeChanged()
      }

      filters.fetchFilters(initialQuery, sortType)
    }, [initialQuery])

    const onHandleClickClear = () => {
      filters.reset(query)
    }

    const onToggleFiltersBar = () => {
      setVisibleFiltersBar(!visibleFiltersBar)
    }
    return (
      <div
        className={classNames.use(styles.container, {
          [styles.searchContainer]: styleProp,
        })}
      >
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
              [styles.searchBar]: styleProp,
              [styles.expanded]: visibleFiltersBar,
            })
            .join(className)}
        >
          {filters.isLoading &&
          Object.keys(filters.initialData).length === 0 ? (
            <LoadingBlock />
          ) : (
            <>
              {filters.data.map((filter) => (
                <FilterBarItem key={filter.value} filter={filter} />
              ))}
              {filters.isVisibleClearButton && (
                <Button
                  type="button"
                  variant="text"
                  onClick={onHandleClickClear}
                  className={classNames.use(styles.clearButton, styles.button)}
                >
                  Clear all filters
                </Button>
              )}
            </>
          )}
        </ul>
      </div>
    )
  }
)

export default FiltersBar
