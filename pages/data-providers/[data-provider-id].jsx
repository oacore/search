import React, { useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

import { useSyncUrlParamsWithStore } from 'hooks/use-sync-url-params-with-store'
import { convertAndValidate } from 'utils/validation'
import DataProvider, { schema } from 'store/data-provider'
import { useStore, observe } from 'store'
import DataProviderTemplate from 'templates/data-provider'

export async function getServerSideProps({ query }) {
  const id = query['data-provider-id']
  const params = convertAndValidate({
    params: Object.fromEntries(
      Object.entries(query).filter(([, v]) => v != null)
    ),
    schema,
  })

  const { q, from, size } = params

  const outputsPromise = DataProvider.fetchOutputs({
    id,
    q,
    from,
    size,
  })
  const metadataPromise = DataProvider.fetchMetadata({
    id,
  })

  const [outputs, metadata] = await Promise.allSettled([
    outputsPromise,
    metadataPromise,
  ])

  return {
    props: {
      initialState: {
        dataProvider: {
          outputs: outputs.value,
          metadata: metadata.value,
          params,
          id,
        },
      },
    },
  }
}

const DataProviderPage = observe(({ initialState }) => {
  const router = useRouter()
  const store = useStore(
    initialState ?? {
      initialState: {
        dataProvider: {
          id: router.query['data-provider-id'],
        },
      },
    }
  )
  const { dataProvider } = store
  const previousQuery = useRef(dataProvider.params.q)
  const previousFrom = useRef(dataProvider.params.from)
  const previousSize = useRef(dataProvider.params.size)

  useSyncUrlParamsWithStore(dataProvider.params)

  useEffect(() => {
    // whenever query changes go back to first page
    if (previousQuery.current !== dataProvider.params.q) {
      dataProvider.params.changeParams({
        size: 10,
        from: 0,
      })
    }

    const isLoadMore =
      previousQuery.current === dataProvider.params.q &&
      previousFrom.current === dataProvider.params.from &&
      previousSize.current !== dataProvider.params.size

    const hasChanged =
      previousQuery.current !== dataProvider.params.q ||
      previousFrom.current !== dataProvider.params.from ||
      previousSize.current !== dataProvider.params.size

    previousQuery.current = dataProvider.params.q
    previousFrom.current = dataProvider.params.from
    previousSize.current = dataProvider.params.size

    if (hasChanged) dataProvider.loadOutputs({ loadMore: isLoadMore })
  }, [
    dataProvider.params.size,
    dataProvider.params.from,
    dataProvider.params.q,
  ])

  return (
    <>
      <Head>
        <title>
          {dataProvider.params.q
            ? `Search "${dataProvider.params.q}" in ${dataProvider.metadata.name}`
            : `${dataProvider.metadata.name}`}
          Data providers search
        </title>
        <meta
          name="description"
          content={`Search over TODO works in ${dataProvider.metadata.name}.`}
        />
      </Head>
      <DataProviderTemplate
        outputs={dataProvider.outputs}
        loadPage={dataProvider.loadPage}
        metadata={dataProvider.metadata}
        query={dataProvider.params.q}
        setQuery={(q) => {
          dataProvider.params.q = q
        }}
        from={dataProvider.params.from}
        size={dataProvider.params.size}
        // TODO: Get proper value from API
        total={50000}
        loading={dataProvider.loading}
        basePath={`/data-providers/${dataProvider.id}`}
        isLoadingMore={dataProvider.isLoadingMore}
      />
    </>
  )
})

export default DataProviderPage
