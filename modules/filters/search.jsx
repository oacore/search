import React, { useState } from 'react'
import { TextField } from '@oacore/design/lib'
import { useStore as useStoreApi } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import styles from './styles.module.css'

import { useStore, observe } from 'store'

const Search = observe(() => {
  const { filters: filtersStore } = useStore()
  const filters = filtersStore.getState()

  const [value, setValue] = useState('')

  const [, filterItems] = useStoreApi(
    filtersStore,
    useShallow((state) => [state.activeFilter, state.activeFilter.items])
  )

  const handleOnInput = (e) => {
    const inputValue = e.target.value
    setValue(inputValue)

    const results = filterItems.filter((obj) =>
      obj.value.toLowerCase().includes(inputValue.toLowerCase())
    )

    filters.setActiveFilterSuggestions(results)
  }

  return (
    <TextField
      type="text"
      variant="pure"
      id="search-filter"
      value={value}
      onChange={handleOnInput}
      name="search-filter"
      label="Search"
      size="small"
      className={styles.textField}
      statusIcon="#magnify"
    />
  )
})

export default Search
