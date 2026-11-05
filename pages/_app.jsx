import React, {
  Component as ReactComponent,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { flushSync } from 'react-dom'
import { useRouter } from 'next/router'
import { HeadManagerContext } from 'next/dist/shared/lib/head-manager-context.shared-runtime'
import { CookiesProvider } from '@oacore/design'
import LogRocket from 'logrocket'

import useMarkAppHydrated from 'hooks/use-app-hydrated'
import { getDataProviders, getMembers, getStatistics } from 'lib'
import cachedStatistics from 'data/.statistics.json'
import Main from 'main'
import { Sentry } from 'utils/sentry'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import '@oacore/design/lib/index.css'
import 'main/global.css'

process.on('unhandledRejection', (err) => {
  Sentry.captureException(err)
})

process.on('uncaughtException', (err) => {
  Sentry.captureException(err)
})

class ErrorBoundary extends ReactComponent {
  componentDidUpdate(prevProps) {
    const { loading } = this.props
    // componentDidCatch of the same commit reads it
    this.loadingEnded = prevProps.loading && !loading
    Promise.resolve().then(() => {
      this.loadingEnded = false
    })
  }

  componentDidCatch(error, errorInfo) {
    Sentry.withScope((scope) => {
      Object.keys(errorInfo).forEach((key) => {
        scope.setExtra(key, errorInfo[key])
        scope.setExtra('ssr', false)
      })
      Sentry.captureException(error)
    })

    // A client navigation that crashes (Q-047, Q-100) comes back with the next
    // render of App, the end of its loading state, which mounts the page anew.
    // React 18 batches that update into the render that crashes, so nothing
    // renders after it: do it here, once the emptied tree is committed.
    if (this.loadingEnded)
      Promise.resolve().then(() => flushSync(() => this.forceUpdate()))
  }

  render() {
    const { children } = this.props
    return children
  }
}

// Next 12.3 applies the head elements synchronously inside a React effect
// (next/dist/shared/lib/side-effect.js), so an error of the head manager
// reaches ErrorBoundary above, which then renders nothing: a page whose JSON-LD
// drops the next-head-count meta (S-4) went blank. Next 10.2.3 applied them in
// a promise, outside React, and the page stayed. Keep that: the error leaves
// the effect as a rejected promise, as it did then (CS-N12-12).
let guardedHeadManager = null
const useHeadErrorsOutsideReact = () => {
  const headManager = useContext(HeadManagerContext)
  if (
    typeof window === 'undefined' ||
    typeof headManager?.updateHead !== 'function' ||
    headManager === guardedHeadManager
  )
    return
  guardedHeadManager = headManager
  const { updateHead } = headManager
  headManager.updateHead = (head) => {
    try {
      updateHead.call(headManager, head)
    } catch (error) {
      Promise.reject(error)
    }
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
  useHeadErrorsOutsideReact()
  useMarkAppHydrated()

  if (process.env.NODE_ENV === 'production')
    LogRocket.init('cab1al/search-gfe6o')

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
      <ErrorBoundary loading={loading}>
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

// Next 12.3 runs App.getInitialProps again in the browser when it hydrates a
// page the server rendered with an error (next/dist/client/index.js,
// renderError: it reuses the server's props only when they carry `err`), and
// the loaders then call the API from the browser. Next 10.2.3 and 12.1.6
// reused the server's props there: give that first browser call the server's
// props back (CS-N12-13). Every other call is unchanged.
let firstBrowserCall = true

// TODO: Replace with getStaticProps once this is solved
//       https://github.com/vercel/next.js/discussions/10949
App.getInitialProps = async (appContext) => {
  if (typeof window !== 'undefined' && firstBrowserCall) {
    firstBrowserCall = false
    const { __NEXT_DATA__: nextData } = window
    if (appContext?.ctx?.err && nextData?.err) return nextData.props
  }

  await getStatistics()
  await getDataProviders()
  await getMembers()

  const { data } = cachedStatistics
  if (data && Object.keys(data).length > 0) statistics = data
  else statistics = { totalArticlesCount: 'more than 356 million' }

  return {
    statistics,
  }
}

export default App
