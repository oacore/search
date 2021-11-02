import React, {
  Component as ReactComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { useRouter } from 'next/router'

// TODO: Move to map component once
//       https://github.com/vercel/next.js/issues/12079 is solved
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import '@oacore/design/lib/index.css'
import 'main/global.css'
import apiRequest from '../api'

import useAnalytics from 'hooks/use-analytics'
import Main from 'main'
import { Sentry } from 'utils/sentry'

process.on('unhandledRejection', (err) => {
  Sentry.captureException(err)
})

process.on('uncaughtException', (err) => {
  Sentry.captureException(err)
})

class ErrorBoundary extends ReactComponent {
  // eslint-disable-next-line class-methods-use-this
  componentDidCatch(error, errorInfo) {
    Sentry.withScope((scope) => {
      Object.keys(errorInfo).forEach((key) => {
        scope.setExtra(key, errorInfo[key])
        scope.setExtra('ssr', false)
      })
      Sentry.captureException(error)
    })
  }

  render() {
    const { children } = this.props
    return children
  }
}

const useLoading = (initialState = false) => {
  const router = useRouter()

  const [isLoading, setLoading] = useState(initialState)

  const enableLoading = useCallback(() => setLoading(true), [setLoading])
  const disableLoading = useCallback(() => setLoading(false), [setLoading])

  useEffect(() => {
    router.events.on('routeChangeStart', enableLoading)
    router.events.on('routeChangeComplete', disableLoading)
    router.events.on('routeChangeError', disableLoading)

    return () => {
      router.events.off('routeChangeStart', enableLoading)
      router.events.off('routeChangeComplete', disableLoading)
      router.events.off('routeChangeError', disableLoading)
    }
  }, [enableLoading, disableLoading])

  return isLoading
}

const App = ({ Component: PageComponent, pageProps, statistics }) => {
  const loading = useLoading()
  useAnalytics()

  const router = useRouter()
  const isSearchPage = router.asPath.match(/search/gm)

  return (
    <ErrorBoundary>
      <Main
        isSearchPage={isSearchPage}
        initialState={{ statistics }}
        loading={loading}
      >
        <PageComponent {...pageProps} />
      </Main>
    </ErrorBoundary>
  )
}

let statistics = {
  timestamp: Date.now(),
  data: null,
}

// TODO: Replace with getStaticProps once this is solved
//       https://github.com/vercel/next.js/discussions/10949
App.getInitialProps = async () => {
  if (
    !statistics.data ||
    // fetch new stats if they are 1 day old
    (Date.now() - statistics.timestamp) / (1000 * 3600 * 24) > 1
  ) {
    // const { data } = await apiRequest('/statistics')
    statistics = {
      totalArticlesCount: 214800059,
      fullTextCount: 26587504,
      repositoriesCount: 10264,
      countriesCount: 149,
      lastMonthDataprovidersCount: 6,
      lastYearDataprovidersCount: 735,
      openAccessLinksCount: 93628799,
    }
  }

  return {
    statistics,
  }
}

// Dangerously disabling Next.js SSR on development environment to speed-up
// development with linked packages (to outside the project directory)
//
// Related issues on GitHub:
// - https://github.com/vercel/next.js/issues/5463
// - https://github.com/vercel/next.js/issues/5638
// - https://github.com/vercel/next.js/issues/706
//
// eslint-disable-next-line import/no-mutable-exports
let NextApp = App
if (process.env.NODE_ENV !== 'production') {
  NextApp = (...args) => {
    if (typeof window == 'undefined') return null
    return App.apply(this, args)
  }
  NextApp.getInitialProps = App.getInitialProps
}

export default NextApp
