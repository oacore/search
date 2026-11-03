import { useEffect, useState } from 'react'

import { isAppHydrated } from 'hooks/use-app-hydrated'

// False during the render that hydrates the server's HTML, true from then on. A
// component mounted later, by a client navigation, starts with true: only the
// hydrating render has to wait for the mount.
const useHydrated = () => {
  const [value, setValue] = useState(isAppHydrated)

  useEffect(() => {
    setValue(true)
  }, [])

  return value
}

export default useHydrated
