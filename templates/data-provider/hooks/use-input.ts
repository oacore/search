import { useState } from 'react'

const useInput = (initialValue?: any, initialElem?: any) => {
  const [value, setValue] = useState(initialValue)
  const [element] = useState(initialElem)

  return {
    value,
    element,
    setValue,
    reset: () => setValue(''),
    focus: () => {
      const elem: any = document.getElementById(element)
      elem.firstChild.focus()
      elem.firstChild.blur()
    },
    bind: {
      value,
      onChange: (event?: any) => {
        setValue(event.target.value)
      },
    },
  }
}

export default useInput
