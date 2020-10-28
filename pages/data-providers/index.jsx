import React, { useCallback } from 'react'
import Head from 'next/head'

import { observe, useStore } from 'store'
import DataProvidersSearchTemplate from 'templates/data-providers'
import apiRequest from 'api'
import {
  generateMetadata,
  normalizeDataProviders,
} from 'templates/data-providers/utils'
import { useClaimController } from 'templates/data-providers/hooks'
import { useSyncUrlParamsWithStore } from 'hooks/use-sync-url-params-with-store'

export async function getServerSideProps({ query }) {
  const { data } = await apiRequest('/repositories/formap')

  return {
    props: {
      initialState: {
        dataProviders: {
          data:
            // TODO: Remove once https://github.com/vercel/next.js/issues/16122 is solved
            //       or once we migrate to backend search
            normalizeDataProviders(
              process.env.NODE_ENV === 'production' ? data : data.slice(0, 200)
            ),
          params: {
            ...Object.fromEntries(
              Object.entries(query).filter(([, v]) => v != null)
            ),
          },
        },
      },
    },
  }
}

const SearchPage = observe(() => {
  const { dataProviders, statistics } = useStore()
  const {
    params: { action, query, size },
    results,
    data,
  } = dataProviders

  const {
    formRef,
    showForm,
    setShowForm,
    claim,
    handleSubmitForm,
    getFormMessage,
  } = useClaimController({ action })

  useSyncUrlParamsWithStore(dataProviders.params)

  const searchDataProviders = useCallback((q) => dataProviders.search(q), [
    dataProviders,
  ])
  const setDataProvidersSize = useCallback(
    (s) => {
      dataProviders.params.size = s
    },
    [dataProviders.params.size]
  )
  const setQuery = useCallback(
    (q) => {
      dataProviders.params.query = q
    },
    [dataProviders.params.query]
  )
  const handleUrlChange = useCallback(
    (event) => {
      claim.query = event.target.value
    },
    [claim]
  )

  return (
    <>
      <Head>
        <title>{query ? `${query} - ` : ''}Data providers search</title>
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
        showAddDataProviderForm={showForm}
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
