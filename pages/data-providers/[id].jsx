import React, { useCallback } from 'react'
import { useRouter } from 'next/router'

import { fetchMetadata, fetchOutputs, fetchStats } from 'api/data-provider'
import Template from 'templates/data-provider'
import { checkLogo, checkMembership } from 'utils/data-providers-transform'

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

export async function getServerSideProps({
  params: routeParams,
  query: searchParams,
}) {
  const { id } = routeParams
  const { q = '', offset = 0, limit = 10, sort = 'recency' } = searchParams

  const data = {}
  try {
    const dataProvider = await fetchMetadata(id)
    const dataProviderStats = await fetchStats(id)

    Object.assign(data, {
      ...dataProvider,
      billingType: checkMembership(dataProvider.id)?.billing_type || null,
      metadata: {
        ...dataProviderStats,
      },

      logo: await checkLogo(dataProvider.id, dataProvider.logo),
    })
  } catch (errorWithDataProvider) {
    return {
      props: {
        error: errorWithDataProvider,
      },
      notFound: true,
    }
  }

  data.outputs = {
    offset,
    limit,
    query: q,
    sort,
  }

  try {
    const outputs = await fetchOutputs(id, { q, offset, limit, sort })
    Object.assign(data.outputs, {
      total: outputs.totalHits,
      data: outputs.results,
      ...outputs,
    })
  } catch (errorWithOutputs) {
    Object.assign(data.outputs, {
      error: errorWithOutputs,
    })
  }

  return {
    props: { data },
  }
}

const DataProviderPage = ({ data }) => {
  const handleSearch = useSearch()
  return <Template data={data} onSearch={handleSearch} />
}

export default DataProviderPage
