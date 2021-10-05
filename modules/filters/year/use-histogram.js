import React from 'react'

const useHistogram = () => {
  const [selection, setSelection] = React.useState(null)

  const onHistogramChange = (values) => {
    const selections = values.map((value) => Math.ceil(value))

    if (selections[0] === selections[1]) selections[0] = selections[1] - 1
    if (selections[0] > selections[1]) selections.reverse()
    setSelection(selections)
  }

  return {
    selection,
    setSelection,
    onHistogramChange,
  }
}
export default useHistogram
