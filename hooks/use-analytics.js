import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/router'
import ReactGA from 'react-ga4'
import { useCookie } from '@oacore/design'

const useAnalytics = () => {
  const PLAUSIBLE_DOMAIN = 'core-frontend-stage-search.thankfulplant-67ea1df5.uksouth.azurecontainerapps.io/'
  const analyticsAllowed = useCookie('analytics_cookies_allowed')

  const router = useRouter()
  const reportPageview = useCallback((url, title, type = 'search') => {
    const search = typeof window !== 'undefined' ? window.location.search.substring(1) : ''

    ReactGA.send({
      hitType: type,
      page: url,
      title: `Search | ${search}`,
    })
  }, [])

  useEffect(() => {
    console.log('init useAnalytics')
    if (typeof window === 'undefined') return undefined

    if (analyticsAllowed && process.env.NODE_ENV === 'production') {
      // Initialise production Google Analytics
      console.log(process.env.GA_TRACKING_CODE)
      console.log("init GA")

      ReactGA.initialize(process.env.GA_TRACKING_CODE)
    } else if (analyticsAllowed) {
      console.log(process.env.GA_TRACKING_CODE)
      console.log("init analyticsAllowed")

      window.ga = (...args) =>
        // We want to have logging in the development environment
        // eslint-disable-next-line no-console
        console.log(`ga(${JSON.stringify(args).slice(1, -1)})`)
    }

    import('@plausible-analytics/tracker').then(({ init }) => {
      console.log('Init plausible-analytics/tracker')
      init({
        domain: PLAUSIBLE_DOMAIN,
        apiHost: 'http://51.142.10.140/',
        outboundLinks: true,
        fileDownloads: true,
        formSubmissions: true,
      })
    }).catch((error) => {
      console.log('Error plausible-analytics/tracker')
      console.log(error)
    })

    // Reporting first page view manually because the event doesn't fire
    reportPageview(router.asPath)

    // This clean-up is quite tricky
    return () => {
      window.ga = null
    }
  }, [PLAUSIBLE_DOMAIN, analyticsAllowed, reportPageview, router.asPath])

  useEffect(() => {
    router.events.on('routeChangeComplete', reportPageview)

    return () => {
      router.events.off('routeChangeComplete', reportPageview)
    }
  }, [])
}

export default useAnalytics
