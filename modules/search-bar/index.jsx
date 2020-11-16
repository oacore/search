import React, { useState, useCallback } from 'react'
import { Select as UISelect } from '@oacore/design'
import { throttle } from 'throttle-debounce'
import AppBar from '@oacore/design/lib/elements/app-bar'
import { classNames } from '@oacore/design/lib/utils'

import { useSearchBar } from './context'
import styles from './styles.module.css'

const SearchBar = () => {
  // At this moment we are sure search bar is enabled and configured
  const {
    searchBarConfig: {
      initQuery,
      search,
      onQueryChanged,
      searchBarProps: { className, ...restSearchBarProps },
    },
  } = useSearchBar()
  const [suggestions, setSuggestions] = useState([])
  const [value, setValue] = useState(initQuery || '')

  const searchData = useCallback(
    throttle(500, false, (searchTerm) => {
      setSuggestions(search(searchTerm).slice(0, 10))
    }),
    [search]
  )

  const handleOnChange = (data) => {
    onQueryChanged(data.value)
    search(data.value)
  }

  const handleOnInput = (data) => {
    setValue(data.value)

    // if id doesn't exist it means user type own text
    // and didn't use suggestion
    if (!data.id) searchData(data.value)
  }

  return (
    <AppBar.Item className={styles.item}>
      <UISelect
        id="app-bar-search"
        value={value}
        variant="pure"
        onChange={handleOnChange}
        onInput={handleOnInput}
        className={classNames.use(styles.select, className)}
        {...restSearchBarProps}
      >
        {suggestions.map((el) => (
          <UISelect.Option
            key={el.id}
            id={el.id}
            value={el.name}
            icon="#magnify"
          >
            {el.name}
          </UISelect.Option>
        ))}
      </UISelect>
    </AppBar.Item>
  )
}

const SearchBarOrEmpty = () => {
  const { isSearchBarEnabled } = useSearchBar()

  if (!isSearchBarEnabled) return null
  return <SearchBar />
}

export default SearchBarOrEmpty
