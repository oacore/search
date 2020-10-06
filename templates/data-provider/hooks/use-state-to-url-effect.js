import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/router'

const useStateToUrlEffect = ({ id, q, from, size }) => {
  const router = useRouter()
  const setUrlParams = useCallback(
    (params) => {
      const url = {
        href: {
          pathname: '/data-providers/[data-provider-id]',
          query: {
            ...params,
          },
        },

        as: {
          pathname: `/data-providers/${id}`,
          query: {
            ...params,
          },
        },
        options: {
          shallow: true,
        },
      }
      router.push(url.href, url.as, url.options)
    },
    [router]
  )

  // reflect state to URL
  useEffect(() => {
    const params = {
      q,
      from,
      size,
    }

    setUrlParams(params)
  }, [q, from, size])
}

export default useStateToUrlEffect
