import React, { useState } from 'react'
import { Select } from '@oacore/design'

const DataProviderOutputsSearch = ({
  initQuery,
  onQueryChanged,
  className,
}) => {
  const [value, setValue] = React.useState(initQuery || '')
  const [isInitialised, setIsInitialised] = useState(false)

  const handleOnChange = (data) => {
    // TODO: Consider this having in @oacore/design
    // prevent firing callback in initialisation (we have the data prefetched
    // on the server side already
    if (!isInitialised) {
      setIsInitialised(true)
      return
    }

    onQueryChanged(data.value)
  }

  const handleOnInput = (data) => {
    setValue(data.value)
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
    />
  )
}

export default DataProviderOutputsSearch
