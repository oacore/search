import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/router'
import ReactGA from 'react-ga4'
import { useCookie } from '@oacore/design'

const useAnalytics = () => {
  const PLAUSIBLE_DOMAIN = 'core-frontend-stage-search.thankfulplant-67ea1df5.uksouth.azurecontainerapps.io'
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
    console.log('init useAnalytics plausible')
    if (typeof window === 'undefined') return undefined

    import('@plausible-analytics/tracker').then(({ init }) => {
      console.log('Init plausible-analytics/tracker')
      init({
        domain: PLAUSIBLE_DOMAIN,
        endpoint: 'https://tracker.core.ac.uk/api/event',
        outboundLinks: true,
        fileDownloads: true,
        formSubmissions: true,
        autoCapturePageviews: false,
      })
      console.log('Plausible initialized, window.plausible:', !!window.plausible)
      if (window.plausible) {
        window.plausible('pageview')
        console.log('Plausible pageview sent')
      }
    }).catch((error) => {
      console.log('Error plausible-analytics/tracker')
      console.log(error)
    })

    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    console.log('init useAnalytics GA')
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

    // Reporting first page view manually because the event doesn't fire
    reportPageview(router.asPath)

    // This clean-up is quite tricky
    return () => {
      window.ga = null
    }
  }, [analyticsAllowed, reportPageview, router.asPath])

  useEffect(() => {
    const handleRouteChange = (url) => {
      reportPageview(url)
      if (typeof window !== 'undefined' && window.plausible) {
        window.plausible('pageview')
        console.log('Plausible pageview on route change:', url)
      }
    }

    router.events.on('routeChangeComplete', handleRouteChange)

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [])
}

export default useAnalytics
