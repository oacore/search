import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/router'

const useStateToUrlEffect = ({ query, size, showForm }: any) => {
  const router = useRouter()
  const setUrlParams = useCallback(
    (params: any) => {
      const url = {
        pathname: '/data-providers',
        query: {
          ...params,
        },
        options: {
          shallow: true,
        },
      }
      router.push(url, url, { shallow: true })
    },
    [router]
  )

  // reflect state to URL
  useEffect(() => {
    const params: any = {
      query,
      size,
    }

    if (showForm) params.action = 'add'

    setUrlParams(params)
  }, [query, size, showForm])
}

export default useStateToUrlEffect
