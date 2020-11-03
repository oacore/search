import { useEffect } from 'react'
import { useRouter } from 'next/router'

import useDebouncedEffect from 'hooks/use-debounced-effect'

export const useSyncUrlParamsWithStore = (paramsInstance) => {
  const router = useRouter()
  const setUrlParams = () => {
    const { schema, ...params } = paramsInstance

    const newParams = Object.entries(params).filter(
      ([, value]) => value != null
    )

    const { pathname: pathnameUrl } = new URL(
      router.asPath,
      window.location.origin
    )
    const { pathname: pathnameAs } = new URL(
      router.pathname,
      window.location.origin
    )

    const urlParams = new URLSearchParams(newParams)

    urlParams.sort()

    if (
      `${window.location.pathname}${window.location.search}` !==
      `${pathnameUrl}?${urlParams.toString()}`
    ) {
      const updateParams =
        window.location.search === '' ? router.replace : router.push

      updateParams(
        {
          pathname: `${pathnameAs}`,
          query: { ...router.query, ...urlParams },
        },
        `${pathnameUrl}?${urlParams.toString()}`,

        { shallow: true }
      )
    }
  }

  const handleRouteChange = (nextUrl) => {
    const { schema, ...params } = paramsInstance
    const { searchParams } = new URL(nextUrl, window.location.origin)

    const newParams = Array.from(searchParams.entries()).filter(
      ([key, value]) =>
        // We want to compare like it because URLSearch params doesn't
        // automatically convert param (e.g. size) to number.
        // eslint-disable-next-line eqeqeq
        params[key] != value
    )

    if (newParams.length)
      paramsInstance.changeParams(Object.fromEntries(newParams))
  }

  useEffect(() => {
    router.events.on('routeChangeComplete', handleRouteChange)
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [])

  // whenever any param changes in store reflect it to the URL
  useDebouncedEffect(
    () => {
      setUrlParams()
    },
    Object.keys(paramsInstance)
      .sort()
      .filter((key) => key !== 'schema')
      .map((key) => paramsInstance[key])
  )
}

export default useSyncUrlParamsWithStore
