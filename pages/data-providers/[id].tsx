import React, { useCallback } from 'react'
import { useRouter } from 'next/router'

import { fetchMetadata, fetchOutputs, fetchStats } from 'api/data-provider'
import Template from 'templates/data-provider'
import {
  checkLogo,
  checkMembership,
  findDataProvider,
} from 'utils/data-providers-transform'

const base64ImageMimeTypes: any = {
  '/9j/': 'image/jpeg',
  'iVBOR': 'image/png',
  'R0lG': 'image/gif',
  'PHN2': 'image/svg+xml',
  'UklG': 'image/webp',
}

const getBase64ImageSrc = (logoBase64?: any) => {
  if (!logoBase64) return null

  const logo = String(logoBase64).trim()
  if (logo.startsWith('data:image/')) return logo

  const normalizedLogo = logo.replace(/\s/g, '')
  const isBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(normalizedLogo)
  if (!isBase64 || normalizedLogo.length % 4 !== 0) return null

  const mimeType =
    base64ImageMimeTypes[
      Object.keys(base64ImageMimeTypes).find((signature: any) =>
        normalizedLogo.startsWith(signature)
      ) as any
    ] || 'image/png'

  return `data:${mimeType};base64,${normalizedLogo}`
}

const useSearch = () => {
  const router = useRouter()

  // TODO: Add debouncing when onBlur is not required any more to call this
  const handleSearch = useCallback((query: any) => {
    const url = new URL(router.asPath, 'http://unused.host')
    const q = query.trim()

    // Because of trimming, the event could unintentionally fire with the same
    // query if a space was entered
    if (q === url.searchParams.get('q')) return

    url.searchParams.set('q', q)
    url.searchParams.set('offset', 0 as any)
    router.push(url.href.slice(url.origin.length))
  })

  return handleSearch
}

export async function getServerSideProps({
  params: routeParams,
  query: searchParams,
}: any) {
  const { id } = routeParams
  const { q = '', offset = 0, limit = 10, sort = 'recency', t } = searchParams

  if (!findDataProvider(id)) {
    return {
      notFound: true,
    }
  }

  const data: any = {}
  try {
    const dataProvider = await fetchMetadata(id, t)
    const dataProviderStats = await fetchStats(id)
    const logo =
      getBase64ImageSrc(dataProvider.logo) ||
      (await checkLogo(dataProvider.id, dataProvider.logo))

    Object.assign(data, {
      ...dataProvider,
      billingType: checkMembership(dataProvider.id)?.billing_type || null,
      metadata: {
        ...dataProviderStats,
      },

      logo,
    })
  } catch (errorWithDataProvider: any) {
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
  } catch (errorWithOutputs: any) {
    Object.assign(data.outputs, {
      error: errorWithOutputs,
    })
  }

  return {
    props: { data },
  }
}

const DataProviderPage = ({ data }: any) => {
  const handleSearch = useSearch()
  return <Template data={data} onSearch={handleSearch} />
}

export default DataProviderPage
