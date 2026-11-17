import { useState } from 'react'

const useInput = (element?: any) => {
  const [value, setValue] = useState('')

  return {
    value,
    element,
    reset: () => setValue(''),
    bind: {
      value,
      onChange: (event?: any) => {
        setValue(event.target.value)
      },
    },
  }
}

export default useInput
