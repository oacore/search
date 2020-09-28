import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

import DataProvidersSearchPage from 'templates/data-providers/search'
import DataProviderPage from 'templates/data-providers/form'
import apiRequest from 'api'

export async function getServerSideProps({ query }) {
  if (query?.action === 'add') {
    return {
      props: {
        dataProviders: [],
        params: query,
      },
    }
  }

  const { data } = await apiRequest('/repositories/formap')
  return {
    props: {
      dataProviders:
        // TODO: Remove once https://github.com/vercel/next.js/issues/16122 is solved
        //       or once we migrate to backend search
        process.env.NODE_ENV === 'production' ? data : data.slice(0, 200),
      params: query,
    },
  }
}

const DataProvidersPage = ({ params, ...passProps }) => {
  const router = useRouter()
  const [showForm, setShowForm] = useState(Boolean(params?.action === 'add'))

  useEffect(() => {
    const handleRouteChangeStart = (url) => {
      const nextUrl = new URL(url, window.location.href)

      setShowForm(nextUrl.searchParams.get('action') === 'add')
    }
    router.events.on('routeChangeStart', handleRouteChangeStart)
    return () => router.events.off('routeChangeStart', handleRouteChangeStart)
  }, [])

  return showForm ? (
    <DataProviderPage params={params} {...passProps} />
  ) : (
    <DataProvidersSearchPage params={params} {...passProps} />
  )
}

export default DataProvidersPage
