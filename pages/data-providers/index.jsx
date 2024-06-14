import React, { useCallback, useEffect, useMemo } from 'react'
import Head from 'next/head'

import cachedData from 'data/.formap.json'
import { observe, useStore } from 'store'
import DataProvidersSearchTemplate from 'templates/data-providers'
import {
  generateMetadata,
  normalizeDataProviders,
} from 'templates/data-providers/utils'
import { useClaimController } from 'templates/data-providers/hooks'
import { useSyncUrlParamsWithStore } from 'hooks/use-sync-url-params-with-store'

export async function getServerSideProps({ query }) {
  const data = cachedData || []

  return {
    props: {
      initialState: {
        dataProviders: {
          data:
            normalizeDataProviders(data),
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

const SearchPage = observe(({ initialState }) => {
  const { dataProviders, statistics } = useStore(initialState)
  const {
    params: { action, query, size },
    results,
    data,
  } = dataProviders

  const { formRef, claim, handleSubmitForm, getFormMessage } =
    useClaimController()

  const initialAction = useMemo(() => dataProviders.params.action, [])

  useSyncUrlParamsWithStore(dataProviders.params)

  const searchDataProviders = useCallback(
    (q) => dataProviders.search(q),
    [dataProviders]
  )
  const setDataProvidersSize = useCallback(
    (s) => {
      dataProviders.params.size = s
    },
    [dataProviders.params.size]
  )
  const setQuery = useCallback(
    (q) => {
      dataProviders.params.q = q
    },
    [dataProviders.params.q]
  )
  const handleUrlChange = useCallback(
    (event) => {
      claim.query = event.target.value
    },
    [claim]
  )
  const setShowForm = useCallback(
    (isVisible) => {
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
