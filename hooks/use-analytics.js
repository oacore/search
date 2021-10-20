import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/router'
import { pageview, initialize } from 'react-ga'

const useAnalytics = () => {
  const router = useRouter()
  const reportPageview = useCallback((url) => {
    pageview(url)
  }, [])

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      // Initialise production Google Analytics
      initialize(process.env.GA_TRACKING_CODE)
    } else {
      window.ga = (...args) =>
        // We want to have logging in the development environment
        // eslint-disable-next-line no-console
        console.log(`ga(${JSON.stringify(args).slice(1, -1)})`)
    }

    // Reporting first page view manually because the event doesn't fire
    reportPageview(router.asPath)

    // This clean-up is quite tricky
    return () => {
      window.ga = null
    }
  }, [])

  useEffect(() => {
    router.events.on('routeChangeComplete', reportPageview)

    return () => {
      router.events.off('routeChangeComplete', reportPageview)
    }
  }, [])
}

export default useAnalytics
