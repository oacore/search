import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'

import useDebouncedEffect from '../use-debounced-effect'

export const useSyncUrlParamsWithStore = (params) => {
  const router = useRouter()
  const setUrlParams = () => {
    const newParams = Array.from(params.entries()).filter(
      ([, value]) => value != null
    )
    const query = Object.fromEntries(newParams)
    router.push(
      { pathname: router.pathname, query },
      {
        // asPath contains url params so we need to get rid of them
        // and replace them with the new ones.
        pathname: new URL(router.route, window.location.origin).pathname,
        query,
      },
      { shallow: true }
    )
  }

  const handleRouteChange = useCallback(
    (nextUrl) => {
      const { searchParams } = new URL(nextUrl, window.location.origin)
      Array.from(searchParams.entries()).forEach(([key, value]) => {
        // We want to compare like it because URLSearch params doesn't
        // automatically convert param (e.g. size) to number.
        // eslint-disable-next-line eqeqeq
        if (params.has(key) && params[key] != value) params[key] = value
      })
    },
    [params]
  )

  useEffect(() => {
    router.events.on('routeChangeComplete', handleRouteChange)
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [])

  // whenever any param changes in store reflect it to the URL
  useDebouncedEffect(() => {
    setUrlParams()
  }, Array.from(params.values()))
}

export default useSyncUrlParamsWithStore
