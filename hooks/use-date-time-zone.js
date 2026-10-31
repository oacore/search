import { useEffect, useState } from 'react'

import { formatDate } from 'utils/helpers'

let hydrated = false

// The `timeZone` option for formatDate. The server prints dates in its own
// zone, UTC (Q-029, Q-050), so the render that hydrates its HTML does the
// same. The text becomes browser-local after mount, and only a component
// whose text changes renders again for it. `dates` are the values the
// component prints, as it passes them to formatDate with `options`. Later
// renders and later mounts are browser-local from the start.
const useDateTimeZone = (dates, options) => {
  const [, setChanged] = useState(false)

  useEffect(() => {
    hydrated = true
    if (
      dates.some(
        (date) =>
          formatDate(date, { ...options, timeZone: 'UTC' }) !==
          formatDate(date, options)
      )
    )
      setChanged(true)
  }, [])

  return hydrated ? undefined : 'UTC'
}

export default useDateTimeZone
