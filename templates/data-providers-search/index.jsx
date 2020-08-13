import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@oacore/design'

import styles from './styles.module.css'
import DataProvidersSelect from './search'
import ResultCard from './result-card'

import Search from 'modules/search-layout'

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

const SearchResults = ({
  results,
  dataProvidersOffset,
  setDataProvidersOffset,
}) => {
  if (!results.length) {
    return (
      <Search.Results>
        <Search.Result>
          <b>No results found</b>
        </Search.Result>
      </Search.Results>
    )
  }

  return (
    <Search.Results>
      {results.slice(0, dataProvidersOffset).map((el) => (
        <ResultCard
          key={el.id}
          repoId={el.id}
          title={el.name}
          homePage={el.urlHomepage}
          country={el.repositoryLocation?.countryName || 'unknown location'}
        />
      ))}
      {dataProvidersOffset < results.length && (
        <Button
          onClick={() => setDataProvidersOffset(dataProvidersOffset + 10)}
          className={styles.loadMore}
        >
          Load more data providers
        </Button>
      )}
    </Search.Results>
  )
}

const DataProvidersSearchTemplate = ({
  dataProviders,
  queryParam,
  dataProvidersOffsetParam,
  setUrlParams,
}) => {
  const [query, setQuery] = useState(queryParam || '')
  const [dataProvidersOffset, setDataProvidersOffset] = useState(
    dataProvidersOffsetParam || 10
  )
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
  const [results, setResults] = useState(
    searchDataProviders(query).slice(0, 10)
  )

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
      <DataProvidersSelect
        onQueryChanged={setQuery}
        searchDataProviders={searchDataProviders}
        initQuery={query}
      />
      <Search className={styles.searchArea}>
        {Boolean(results.length) && (
          <Search.ResultStats
            from={1}
            to={Math.min(dataProvidersOffset, results.length)}
            total={results.length}
          />
        )}
        <SearchResults
          dataProvidersOffset={dataProvidersOffset}
          results={results}
          setDataProvidersOffset={setDataProvidersOffset}
        />

        <Search.Content>
          <p>
            We aggregate research papers from data providers all over the world
            including institutional and subject repositories and journal
            publishers. This process, which is also called harvesting, allows us
            to offer search, text mining and analytical capabilities over not
            only metadata, but also the full text of the research papers making
            CORE a unique service in the research community. Our dataset
            currently contains 182,918,912 open access articles, from over tons
            of thousands journals, collected from over {dataProviders.length}{' '}
            repositories and journals around the world.
          </p>
          <Button variant="outlined">Become data provider</Button>
        </Search.Content>
        <Search.Footer>
          <Button variant="contained">Add data provider</Button>
        </Search.Footer>
      </Search>
    </>
  )
}
export default DataProvidersSearchTemplate
