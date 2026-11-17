import { useState } from 'react'

const useInput = (initialValue, initialElem) => {
  const [value, setValue] = useState(initialValue)
  const [element] = useState(initialElem)

  return {
    value,
    element,
    setValue,
    reset: () => setValue(''),
    focus: () => {
      const elem = document.getElementById(element)
      elem.firstChild.focus()
      elem.firstChild.blur()
    },
    bind: {
      value,
      onChange: (event) => {
        setValue(event.target.value)
      },
    },
  }
}

export default useInput
