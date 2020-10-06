import React, { useCallback, useState } from 'react'
import { throttle } from 'throttle-debounce'
import { Select } from '@oacore/design'

const DataProviderOutputsSearch = ({
  initQuery,
  loadSuggestions,
  onQueryChanged,
  className,
}) => {
  const [suggestions, setSuggestions] = React.useState([])
  const [value, setValue] = React.useState(initQuery || '')
  const [isInitialised, setIsInitialised] = useState(false)

  const search = useCallback(
    throttle(500, false, async (searchTerm) => {
      const newSuggestions = await loadSuggestions(searchTerm)
      setSuggestions(newSuggestions)
    }),
    []
  )

  const handleOnChange = (data) => {
    // TODO: Consider this having in @oacore/design
    // prevent firing callback in initialisation (we have the data prefetched
    // on the server side already
    if (!isInitialised) {
      setIsInitialised(true)
      return
    }

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
        <Select.Option key={el.id} id={el.id} value={el.title} icon="#magnify">
          {el.title}
        </Select.Option>
      ))}
    </Select>
  )
}

export default DataProviderOutputsSearch
