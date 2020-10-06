import React, { useCallback } from 'react'
import { throttle } from 'throttle-debounce'
import { Select } from '@oacore/design'

const DataProviderOutputsSearch = ({
  initQuery,
  searchOutputs,
  onQueryChanged,
  className,
}) => {
  const [suggestions, setSuggestions] = React.useState([])
  const [value, setValue] = React.useState(initQuery || '')

  const search = useCallback(
    throttle(500, false, (searchTerm) => {
      if (!searchOutputs) return
      setSuggestions(searchOutputs(searchTerm).slice(0, 10))
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
    <Select
      id="data-providers-outputs-select"
      value={value}
      label="Search"
      onChange={handleOnChange}
      onInput={handleOnInput}
      placeholder="Search over 11K research outputs in Open Research Online"
      prependIcon="#magnify"
      className={className}
    >
      {suggestions.map((el) => (
        <Select.Option key={el.id} id={el.id} value={el.name} icon="#magnify">
          {el.name}
        </Select.Option>
      ))}
    </Select>
  )
}

export default DataProviderOutputsSearch
