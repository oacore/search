import { useEffect, useRef, useState } from 'react'

import { isAppHydrated } from 'hooks/use-app-hydrated'
import { formatDate } from 'utils/helpers'

// The `timeZone` option for formatDate. The server prints dates in its own
// zone, UTC (Q-029, Q-050), so the render that hydrates its HTML does the
// same. The text becomes browser-local after mount, and only a component
// whose text changes renders again for it. `dates` are the values the
// component prints, as it passes them to formatDate with `options`. A component
// mounted later, by a client navigation, is browser-local from its first render
// and does not render again for it.
const useDateTimeZone = (dates?: any, options?: any) => {
  const hydrating = useRef(!isAppHydrated())
  const [, setChanged] = useState(false)

  useEffect(() => {
    if (!hydrating.current) return
    hydrating.current = false
    if (
      dates.some(
        (date: any) =>
          date &&
          formatDate(date, { ...options, timeZone: 'UTC' }) !==
            formatDate(date, options)
      )
    )
      setChanged(true)
  }, [])

  return hydrating.current ? 'UTC' : undefined
}

export default useDateTimeZone
