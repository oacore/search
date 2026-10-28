import { useState } from 'react'

const useSwitch = (val = false) => {
  const [value, setValue] = useState(val)
  return [value, (event) => setValue(event.target.checked)]
}

export default useSwitch
