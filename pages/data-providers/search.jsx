import React, { useCallback } from 'react'
import { useRouter } from 'next/router'

import DataProvidersSearchTemplate from 'templates/data-providers-search'
import apiRequest from 'api'

export async function getServerSideProps({ query }) {
  const { data } = await apiRequest('/repositories/formap')
  return {
    props: {
      dataProviders: data,
      params: query,
    },
  }
}

const SearchPage = ({ dataProviders, params: { query, size } }) => {
  const router = useRouter()
  const setUrlParams = useCallback(
    (params) => {
      const url = {
        pathname: '/data-providers/search',
        query: {
          ...params,
        },
      }
      router.push(url, url, { shallow: true })
    },
    [router]
  )
  return (
    <DataProvidersSearchTemplate
      dataProviders={dataProviders}
      queryParam={query}
      dataProvidersOffsetParam={size}
      setUrlParams={setUrlParams}
    />
  )
}

export default SearchPage
