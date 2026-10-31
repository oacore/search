import { useEffect, useState } from 'react'

let hydrated = false

// False during the render that hydrates the server's HTML, true from then on. A
// component mounted later, by a client navigation, starts with true, so only the
// hydrating render has to wait for the mount.
const useHydrated = () => {
  const [value, setValue] = useState(hydrated)

  useEffect(() => {
    hydrated = true
    setValue(true)
  }, [])

  return value
}

export default useHydrated
