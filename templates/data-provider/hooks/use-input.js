import { useState } from 'react'

const useInput = (initialValue) => {
  const [value, setValue] = useState(initialValue)

  return {
    value,
    setValue,
    reset: () => setValue(''),
    focus: (element) => {
      var elem = document.getElementById(element);
      elem.firstChild.focus();
      elem.firstChild.blur();
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
