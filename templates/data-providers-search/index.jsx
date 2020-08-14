import React, { useEffect, useRef, useLayoutEffect } from 'react'
import { Button } from '@oacore/design'

import styles from './styles.module.css'
import DataProvidersSelect from './search'
import ResultCard from './result-card'

import Search from 'modules/search-layout'
import RepositoriesMap from 'modules/repositories-map'

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

const SearchResults = ({
  results,
  dataProvidersOffset,
  setDataProvidersOffset,
}) => {
  const scrollPosition = useRef(0)
  useIsomorphicLayoutEffect(() => {
    window.scroll(0, scrollPosition.current)
  }, [dataProvidersOffset])

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
          onClick={() => {
            scrollPosition.current = window.scrollY
            setDataProvidersOffset(dataProvidersOffset + 10)
          }}
          className={styles.loadMore}
        >
          Load more
        </Button>
      )}
    </Search.Results>
  )
}

const DataProvidersSearchTemplate = React.memo(
  ({
    dataProviders,
    query,
    dataProvidersOffset,
    results,
    setDataProvidersOffset,
    searchDataProviders,
    setQuery,
  }) => (
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
          <RepositoriesMap
            dataProviders={
              query === '' ? results : results.slice(0, dataProvidersOffset)
            }
          />
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
)

export default DataProvidersSearchTemplate
