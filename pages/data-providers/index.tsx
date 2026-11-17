import React, { useCallback, useEffect, useMemo } from 'react'
import Head from 'next/head'
import { useStore as useStoreApi } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import cachedData from 'data/.formap.json'
import { observe, useStore } from 'store'
import DataProvidersSearchTemplate from 'templates/data-providers'
import {
  generateMetadata,
  normalizeDataProviders,
} from 'templates/data-providers/utils'
import { useClaimController } from 'templates/data-providers/hooks'
import { useSyncUrlParamsWithStore } from 'hooks/use-sync-url-params-with-store'

export async function getServerSideProps({ query }: any) {
  const data = cachedData || []

  return {
    props: {
      initialState: {
        dataProviders: {
          data: normalizeDataProviders(data),
          params: {
            ...Object.fromEntries(
              Object.entries(query).filter(([, v]: any) => v != null)
            ),
          },
        },
      },
    },
  }
}

// what the page renders from the store, `q` through `results` and the URL
// sync (`query` is not a param: always undefined)
const selectPage = (state?: any) => ({
  action: state.params.action,
  query: state.params.query,
  size: state.params.size,
  q: state.params.q,
  data: state.data,
})

const SearchPage = observe(({ initialState }: any) => {
  const { dataProviders, statistics } = useStore(initialState)
  const { action, query, size, data } = useStoreApi(
    dataProviders,
    useShallow(selectPage)
  )
  const results: any = useStoreApi(dataProviders, dataProviders.selectResults)

  const { formRef, claim, claimStore, handleSubmitForm, getFormMessage } =
    useClaimController()

  const initialAction = useMemo(() => dataProviders.params.action, [])

  useSyncUrlParamsWithStore(dataProviders.params)

  const searchDataProviders = useCallback(
    (q: any) => dataProviders.search(q),
    [dataProviders]
  )
  const setDataProvidersSize = useCallback(
    (s: any) => {
      dataProviders.params.size = s
    },
    [dataProviders.params.size]
  )
  const setQuery = useCallback(
    (q: any) => {
      dataProviders.params.q = q
    },
    [dataProviders.params.q]
  )
  const handleUrlChange = useCallback(
    (event: any) => {
      claimStore.setState({ query: event.target.value })
    },
    [claimStore]
  )
  const setShowForm = useCallback(
    (isVisible: any) => {
      dataProviders.params.action = isVisible ? 'ADD' : null
    },
    [dataProviders.params.action]
  )

  useEffect(() => {
    if (!results.length) dataProviders.params.action = 'ADD'
    else dataProviders.params.action = initialAction
  }, [results])

  return (
    <>
      <Head>
        <title>{`${query ? `${query} - ` : ''}Data providers search`}</title>
        <meta
          name="description"
          content={`Search over ${data.length} repositories and journals around the world`}
        />
        {/* eslint-disable react/no-danger */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: generateMetadata(results.slice(0, size)),
          }}
        />
        {/* eslint-enable react/no-danger */}
      </Head>
      <DataProvidersSearchTemplate
        query={query}
        setQuery={setQuery}
        dataProviders={data}
        results={results}
        searchDataProviders={searchDataProviders}
        dataProvidersSize={size}
        setDataProvidersSize={setDataProvidersSize}
        setShowForm={setShowForm}
        showAddDataProviderForm={Boolean(action === 'ADD')}
        formRef={formRef}
        url={claim.query}
        onUrlChange={handleUrlChange}
        isFormValid={claim.created}
        onSubmit={handleSubmitForm}
        message={claim.isLoading ? { variant: 'progress' } : getFormMessage()}
        isLoading={claim.isLoading}
        totalArticlesCount={statistics.totalArticlesCount}
      />
    </>
  )
})

export default SearchPage
