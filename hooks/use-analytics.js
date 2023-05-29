import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/router'
// eslint-disable-next-line import/no-extraneous-dependencies
import ReactGA from 'react-ga4'
import { useCookie } from '@oacore/design'

const useAnalytics = () => {
  const analyticsAllowed = useCookie('analytics_cookies_allowed')

  const router = useRouter()
  const reportPageview = useCallback((url, title, type = 'pageview') => {
    ReactGA.send({
      hitType: type,
      page: url,
      title: `Search page. ${window.location.search.substring(1)}`,
    })
  }, [])

  useEffect(() => {
    if (analyticsAllowed && process.env.NODE_ENV === 'production') {
      // Initialise production Google Analytics
      ReactGA.initialize(process.env.GA_TRACKING_CODE)
    } else if (analyticsAllowed) {
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
