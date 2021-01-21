import React, { useCallback } from 'react'
import { useRouter } from 'next/router'

import apiRequest from 'api'
import { fetchMetadata, fetchOutputs } from 'api/data-provider'
import Template from 'templates/data-provider'

const useSearch = () => {
  const router = useRouter()

  // TODO: Add debouncing when onBlur is not required any more to call this
  const handleSearch = useCallback((query) => {
    const url = new URL(router.asPath, 'http://unused.host')
    const q = query.trim()

    // Because of trimming, the event could unintentionally fire with the same
    // query if a space was entered
    if (q === url.searchParams.get('q')) return

    url.searchParams.set('q', q)
    url.searchParams.set('offset', 0)
    router.push(url.href.slice(url.origin.length))
  })

  return handleSearch
}

export async function getStaticProps({
  params: routeParams,
  query: searchParams = {},
}) {
  const { id } = routeParams
  const { q = '', offset = 0, limit = 10 } = searchParams

  try {
    const dataProvider = await fetchMetadata(id)
    const outputs = await fetchOutputs(id, { q, offset, limit })

    return {
      props: {
        data: {
          ...dataProvider,
          outputs: {
            offset,
            limit,
            query: q,
            total: outputs.totalHits,
            data: outputs.results,
            ...outputs,
          },
        },
      },
    }
  } catch (error) {
    return {
      props: { error },
      notFound: true,
    }
  }
}

export async function getStaticPaths() {
  const { data: dataProviders } = await apiRequest('/repositories/formap')
  const paths = dataProviders
    .slice(0, 10)
    .map(({ id }) => ({ params: { id: id.toString() } }))

  return {
    paths,
    fallback: 'blocking',
  }
}

const DataProviderPage = ({ data }) => {
  const handleSearch = useSearch()

  return <Template data={data} onSearch={handleSearch} />
}

export default DataProviderPage
