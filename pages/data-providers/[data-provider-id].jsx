import React from 'react'

import DataProvider from 'store/data-provider'
import { useStore, observe } from 'store'
import DataProviderTemplate from 'templates/data-provider'

export async function getServerSideProps({ query }) {
  const id = query['data-provider-id']

  const outputs = await DataProvider.loadOutputs({
    id,
  })
  const metadata = await DataProvider.loadMetadata({
    id,
  })

  return {
    props: {
      initialState: {
        dataProvider: {
          outputs,
          id: query['data-provider-id'],
          metadata,
        },
      },
    },
  }
}

const DataProviderPage = observe(() => {
  const { dataProvider } = useStore()
  return (
    <DataProviderTemplate
      outputs={dataProvider.outputs}
      loadPage={dataProvider.loadPage}
      metadata={dataProvider.metadata}
    />
  )
})

export default DataProviderPage
