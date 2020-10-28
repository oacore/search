import React, { useEffect, useRef, useLayoutEffect } from 'react'
import { Button } from '@oacore/design'

import styles from './styles.module.css'
import DataProvidersSelect from './search'
import ResultCard from './result-card'
import AddDataProviderForm from './form'

import { formatNumber } from 'utils/format-number'
import Search from 'modules/search-layout'
import RepositoriesMap from 'modules/repositories-map'

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

const SearchResults = ({
  results,
  dataProvidersSize,
  setDataProvidersOffset,
  children,
}) => {
  const scrollPosition = useRef(0)
  useIsomorphicLayoutEffect(() => {
    window.scroll(0, scrollPosition.current)
  }, [dataProvidersSize])

  if (!results.length) {
    return (
      <Search.Results>
        <Search.Result>
          <b>No results found</b>
        </Search.Result>
        {children}
      </Search.Results>
    )
  }

  return (
    <Search.Results>
      {results.slice(0, dataProvidersSize).map((el) => (
        <ResultCard
          key={el.id}
          repoId={el.id}
          title={el.name}
          homePage={el.urlHomepage}
          country={el.repositoryLocation?.countryName || 'unknown location'}
        />
      ))}
      {dataProvidersSize < results.length && (
        <Button
          onClick={() => {
            scrollPosition.current = window.scrollY
            setDataProvidersOffset(dataProvidersSize + 10)
          }}
          className={styles.loadMore}
        >
          Load more
        </Button>
      )}
      {children}
    </Search.Results>
  )
}

const DataProvidersSearchTemplate = React.memo(
  ({
    dataProviders,
    query,
    dataProvidersSize,
    results,
    setDataProvidersSize,
    searchDataProviders,
    setQuery,
    setShowForm,
    showAddDataProviderForm,
    formRef,
    totalArticlesCount,
    ...formProps
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
            to={Math.min(dataProvidersSize, results.length)}
            total={results.length}
          />
        )}
        <SearchResults
          dataProvidersSize={dataProvidersSize}
          results={results}
          setDataProvidersOffset={setDataProvidersSize}
        >
          <div id="add-new-data-provider" className={styles.addDataProvider}>
            {showAddDataProviderForm ? (
              <AddDataProviderForm
                ref={formRef}
                setShowForm={setShowForm}
                {...formProps}
              />
            ) : (
              <>
                <p>
                  Cannot find your repository or journal in our list? Become a
                  data provider now!
                </p>
                <Button onClick={() => setShowForm(true)} variant="contained">
                  Add data provider
                </Button>
              </>
            )}
          </div>
        </SearchResults>

        <Search.Content>
          <RepositoriesMap
            className={styles.map}
            dataProviders={
              query === '' ? results : results.slice(0, dataProvidersSize)
            }
          />
          <p>
            We aggregate research papers from data providers all over the world
            including institutional and subject repositories and journal
            publishers. This process, which is also called harvesting, allows us
            to offer search, text mining and analytical capabilities over not
            only metadata, but also the full text of the research papers making
            CORE a unique service in the research community.
          </p>
          <p>
            Our dataset currently contains {formatNumber(totalArticlesCount)}{' '}
            open access articles, from over tons of thousands journals,
            collected from over {formatNumber(dataProviders.length)}{' '}
            repositories and journals around the world.
          </p>
          <Button
            variant="outlined"
            onClick={() => {
              setShowForm(true)
              window.location.hash = 'add-new-data-provider'
            }}
          >
            Become data provider
          </Button>
        </Search.Content>
      </Search>
    </>
  )
)

export default DataProvidersSearchTemplate
