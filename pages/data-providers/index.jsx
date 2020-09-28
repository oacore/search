import React from 'react'
import Head from 'next/head'

import { withGlobalStore } from 'store'
import DataProvidersSearchTemplate from 'templates/data-providers'
import apiRequest from 'api'
import { generateMetadata } from 'templates/data-providers/utils'
import {
  useDataProviderController,
  useDataProvidersSearch,
  useStateToUrlEffect,
} from 'templates/data-providers/hooks'

export async function getServerSideProps({ query }) {
  const { data } = await apiRequest('/repositories/formap')
  return {
    props: {
      dataProviders:
        // TODO: Remove once https://github.com/vercel/next.js/issues/16122 is solved
        //       or once we migrate to backend search
        process.env.NODE_ENV === 'production' ? data : data.slice(0, 200),
      params: query,
    },
  }
}

const SearchPage = ({
  dataProviders,
  params: { query: queryParam, size, action },
  statistics,
}) => {
  // custom hooks
  const {
    formRef,
    showForm,
    setShowForm,
    dataProvider,
    handleSubmitForm,
    getFormMessage,
  } = useDataProviderController({ action })

  const {
    query,
    setQuery,
    results,
    dataProvidersOffset,
    setDataProvidersOffset,
    searchDataProviders,
  } = useDataProvidersSearch({ queryParam, size, dataProviders })

  useStateToUrlEffect({ query, showForm, dataProvidersOffset })

  return (
    <>
      <Head>
        <title>{query ? `${query} - ` : ''}Data providers search</title>
        <meta
          name="description"
          content={`Search over ${dataProviders.length} repositories and journals around the world`}
        />
        {/* eslint-disable react/no-danger */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: generateMetadata(results.slice(0, dataProvidersOffset)),
          }}
        />
        {/* eslint-enable react/no-danger */}
      </Head>
      <DataProvidersSearchTemplate
        query={query}
        setQuery={setQuery}
        dataProviders={dataProviders}
        dataProvidersOffset={dataProvidersOffset}
        results={results}
        searchDataProviders={searchDataProviders}
        setDataProvidersOffset={setDataProvidersOffset}
        setShowForm={setShowForm}
        showAddDataProviderForm={showForm}
        formRef={formRef}
        url={dataProvider.query}
        onUrlChange={(event) => {
          dataProvider.query = event.target.value
        }}
        isFormValid={dataProvider.created}
        onSubmit={handleSubmitForm}
        message={
          dataProvider.isLoading ? { variant: 'progress' } : getFormMessage()
        }
        isLoading={dataProvider.isLoading}
        totalArticlesCount={statistics.totalArticlesCount}
      />
    </>
  )
}

export default withGlobalStore(SearchPage)
