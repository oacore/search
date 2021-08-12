import { useState } from 'react'

const useInput = (element) => {
  const [value, setValue] = useState('')

  return {
    value,
    element,
    reset: () => setValue(''),
    bind: {
      value,
      onChange: (event) => {
        setValue(event.target.value)
      },
    },
  }
}

export default useInput
