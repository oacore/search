import React from 'react'

import { useStateToUrlEffect } from 'templates/data-provider/hooks'
import DataProvider from 'store/data-provider'
import { useStore, observe } from 'store'
import DataProviderTemplate from 'templates/data-provider'

export async function getServerSideProps({ query }) {
  const id = query['data-provider-id']
  const { q = '', from = 0, size = 10 } = query

  const outputs = await DataProvider.fetchOutputs({
    id,
    q,
    from,
    size,
  })
  const metadata = await DataProvider.loadMetadata({
    id,
  })

  return {
    props: {
      initialState: {
        dataProvider: {
          outputs,
          metadata,
          id,
          q,
          from,
          size,
        },
      },
    },
  }
}

const DataProviderPage = observe(() => {
  const { dataProvider } = useStore()

  useStateToUrlEffect({
    id: dataProvider.id,
    q: dataProvider.query,
    from: dataProvider.from,
    size: dataProvider.size,
  })

  return (
    <DataProviderTemplate
      outputs={dataProvider.outputs}
      loadPage={dataProvider.loadPage}
      metadata={dataProvider.metadata}
      loadSuggestions={dataProvider.loadSuggestions}
      query={dataProvider.query}
      setQuery={(q) => {
        dataProvider.query = q
      }}
      loadOutputs={dataProvider.loadOutputs}
      from={dataProvider.from}
      size={dataProvider.size}
      loading={dataProvider.loading}
    />
  )
})

export default DataProviderPage
