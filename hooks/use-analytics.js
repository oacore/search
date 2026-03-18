import { useEffect, useRef } from 'react'
import { init } from '@plausible-analytics/tracker'
import { useCookie } from '@oacore/design'

const PLAUSIBLE_DOMAIN = 'core.ac.uk'

const useAnalytics = () => {
  const analyticsAllowed = useCookie('analytics_cookies_allowed')
  const isInitialised = useRef(false)

  useEffect(() => {
    // if (
    //   !analyticsAllowed ||
    //   process.env.NODE_ENV !== 'production' ||
    //   isInitialised.current
    // )
    //   return

    init({
      domain: PLAUSIBLE_DOMAIN,
      outboundLinks: true,
      fileDownloads: true,
      formSubmissions: true,
    })

    isInitialised.current = true
  }, [analyticsAllowed])
}

export default useAnalytics
