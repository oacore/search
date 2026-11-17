import React, { useState } from 'react'
import { Select } from '@oacore/design'

const DataProviderOutputsSearch = ({
  initQuery = '',
  onQueryChanged,
  ...restProps
}: any) => {
  const [value, setValue] = useState(initQuery)
  const [isInitialised, setIsInitialised] = useState(false)

  const handleOnChange = (data?: any) => {
    // TODO: Consider this having in @oacore/design
    // prevent firing callback in initialisation (we have the data prefetched
    // on the server side already
    if (!isInitialised) {
      setIsInitialised(true)
      return
    }

    if (onQueryChanged != null) onQueryChanged(data.value)
  }

  const handleOnInput = (data?: any) => {
    setValue(data.value)
  }

  return (
    <Select
      id="data-providers-outputs-select"
      value={value}
      label="Search"
      onChange={handleOnChange}
      onInput={handleOnInput}
      prependIcon="#magnify"
      {...restProps}
    />
  )
}

export default DataProviderOutputsSearch
