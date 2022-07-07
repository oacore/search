import React, {
  Component as ReactComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { useRouter } from 'next/router'
import { CookiesProvider } from '@oacore/design'

// TODO: Move to map component once
//       https://github.com/vercel/next.js/issues/12079 is solved
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import '@oacore/design/lib/index.css'
import 'main/global.css'

import cachedStatistics from '../.statistics.json'

import getStatistics from 'lib/statistics-loader'
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

const useInterceptNextDataHref = ({ router, namespace }) => {
  useEffect(() => {
    if (router.pageLoader?.getDataHref) {
      const originalGetDataHref = router.pageLoader.getDataHref
      router.pageLoader.getDataHref = (args) => {
        const r = originalGetDataHref.call(router.pageLoader, args)
        return r && r.startsWith('/_next/data') ? `${namespace}${r}` : r
      }
    }
  }, [router, namespace])
}

const App = ({
  Component: PageComponent,
  pageProps,
  statistics,
  router: approuter,
}) => {
  const router = useRouter()

  if (process.env.NODE_ENV === 'production') {
    useInterceptNextDataHref({
      router: approuter,
      namespace: '/search',
    })
  }
  const loading = useLoading()
  const isSearchPage = router.asPath.match(/search/gm)

  return (
    <CookiesProvider>
      <ErrorBoundary>
        <Main
          isSearchPage={isSearchPage}
          initialState={{ statistics }}
          loading={loading}
        >
          <PageComponent {...pageProps} />
        </Main>
      </ErrorBoundary>
    </CookiesProvider>
  )
}

let statistics = {
  timestamp: Date.now(),
  data: null,
}

// TODO: Replace with getStaticProps once this is solved
//       https://github.com/vercel/next.js/discussions/10949
App.getInitialProps = async () => {
  await getStatistics()
  const data = cachedStatistics
  if (Object.keys(data).length > 0) statistics = data
  else statistics = { totalArticlesCount: 'more than 200 million' }

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
