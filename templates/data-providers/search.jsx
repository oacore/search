import React, { useCallback } from 'react'
import { throttle } from 'throttle-debounce'

import styles from './styles.module.css'

import AppBarItem from 'modules/app-bar-item'
import Select from 'modules/app-bar-select'

const DataProvidersSelect = ({
  initQuery,
  searchDataProviders,
  onQueryChanged,
}) => {
  const [suggestions, setSuggestions] = React.useState([])
  const [value, setValue] = React.useState(initQuery || '')

  const search = useCallback(
    throttle(500, false, (searchTerm) => {
      setSuggestions(searchDataProviders(searchTerm).slice(0, 10))
    }),
    []
  )

  const handleOnChange = (data) => {
    onQueryChanged(data.value)
    search(data.value)
  }

  const handleOnInput = (data) => {
    setValue(data.value)

    // if id doesn't exists it means user type own text
    // and didn't use suggestion
    if (!data.id) search(data.value)
  }

  return (
    <AppBarItem className={styles.item}>
      <Select
        id="data-providers-select"
        value={value}
        label="Search data providers"
        variant="pure"
        onChange={handleOnChange}
        onInput={handleOnInput}
        placeholder="e.g. repository or journal name"
        prependIcon="#magnify"
      >
        {suggestions.map((el) => (
          <Select.Option key={el.id} id={el.id} value={el.name} icon="#magnify">
            {el.name}
          </Select.Option>
        ))}
      </Select>
    </AppBarItem>
  )
}

export default DataProvidersSelect
