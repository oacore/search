import React, { useState } from 'react'
import { TextField } from '@oacore/design/lib'

import styles from './styles.module.css'

import { useStore, observe } from 'store'

const Search = observe(() => {
  const { filters } = useStore()

  const [value, setValue] = useState('')

  const filterItems = filters.activeFilter.items

  const handleOnInput = (e) => {
    const inputValue = e.target.value

    setValue(inputValue)
    const results = filterItems.filter((obj) =>
      obj.label.toLowerCase().includes(inputValue.toLowerCase())
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
