import React, { useCallback, useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

import DataProvidersSearchTemplate from 'templates/data-providers-search'
import apiRequest from 'api'

// TODO: Fuzzy search via Fuse.js would be better but it's too slow for that
//       amount of data providers. We should consider migrating to backend
//       search once apiv3 is released
const normalize = (string) =>
  string.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const normalizeDataProviders = (dataProviders) =>
  dataProviders
    .filter((el) => el.name)
    .map((el) => ({
      ...el,
      normalizedName: normalize(el.name || ''),
    }))

const generateMetadata = (results) =>
  JSON.stringify({
    '@context': 'http://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'item': {
              '@id': 'https://core.ac.uk',
              'name': 'CORE',
            },
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'item': {
              '@id': `https://core.ac.uk/data-providers/search`,
              'name': 'Data providers search',
            },
          },
        ],
      },
      {
        '@type': 'SearchResultsPage',
        'mainEntity': {
          '@type': 'ItemList',
          'itemListElement': results.map((el, index) => ({
            '@type': 'ListItem',
            'position': index,
            'item': {
              '@id': `https://core.ac.uk/search?q=repositories.id:(${el.id})`,
              'name': el.name,
            },
          })),
        },
      },
    ],
  })

export async function getServerSideProps({ query }) {
  const { data } = await apiRequest('/repositories/formap')
  return {
    props: {
      dataProviders: data,
      params: query,
    },
  }
}

const SearchPage = ({ dataProviders, params: { query: queryParam, size } }) => {
  const router = useRouter()
  const setUrlParams = useCallback(
    (params) => {
      const url = {
        pathname: '/data-providers/search',
        query: {
          ...params,
        },
      }
      router.push(url, url, { shallow: true })
    },
    [router]
  )
  const [query, setQuery] = useState(queryParam || '')
  const [dataProvidersOffset, setDataProvidersOffset] = useState(size || 10)
  const dataProvidersSearch = useMemo(
    () => normalizeDataProviders(dataProviders),
    [dataProviders]
  )
  const searchDataProviders = useCallback(
    (searchTerm) =>
      dataProvidersSearch.filter(
        (el) =>
          el.name?.toLowerCase().search(searchTerm.toLowerCase()) !== -1 ||
          el.normalizedName.toLowerCase().search(searchTerm.toLowerCase()) !==
            -1
      ),
    [dataProvidersSearch]
  )
  const [results, setResults] = useState(searchDataProviders(query))

  useEffect(() => {
    setDataProvidersOffset(10)
    if (query === '') setResults(normalizeDataProviders(dataProviders))
    else setResults(searchDataProviders(query))
  }, [query])

  useEffect(() => {
    setUrlParams({ query, size: dataProvidersOffset })
  }, [query, dataProvidersOffset])

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
      />
    </>
  )
}

export default SearchPage
