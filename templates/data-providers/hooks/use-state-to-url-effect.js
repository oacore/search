import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/router'

const useStateToUrlEffect = ({ query, dataProvidersOffset, showForm }) => {
  const router = useRouter()
  const setUrlParams = useCallback(
    (params) => {
      const url = {
        pathname: '/data-providers',
        query: {
          ...params,
        },
      }
      router.push(url, url, { shallow: true })
    },
    [router]
  )

  // reflect state to URL
  useEffect(() => {
    const params = {
      query,
      size: dataProvidersOffset,
    }

    if (showForm) params.action = 'add'

    setUrlParams(params)
  }, [query, dataProvidersOffset, showForm])
}

export default useStateToUrlEffect
