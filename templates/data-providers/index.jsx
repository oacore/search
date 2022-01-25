import React, { useEffect, useRef, useLayoutEffect, useCallback } from 'react'
import { Button, Header } from '@oacore/design'
import { countries } from 'i18n-iso-countries/langs/en.json'

import styles from './styles.module.css'
import ResultCard from './result-card'
import AddDataProviderForm from './form'

import { formatNumber } from 'utils/format-number'
import Search from 'modules/search-layout'
import Map from 'modules/map'

const filterAndMapDataProviders = (dataProviders) =>
  dataProviders
    .filter(
      ({ name, dataProviderLocation }) =>
        dataProviderLocation?.latitude != null &&
        dataProviderLocation?.longitude != null &&
        name
    )
    .map(({ id, name, dataProviderLocation }) => ({
      name,
      href: `/data-providers/${id}`,
      latitude: dataProviderLocation?.latitude,
      longitude: dataProviderLocation?.longitude,
    }))

const getCountryName = (code) => {
  const countryName = countries[String(code).toUpperCase()]
  return Array.isArray(countryName) ? countryName[0] : countryName
}

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
      <Search.Main>
        <Search.Result>
          <h2>
            Is there a mistake?{' '}
            <span role="img" aria-label="">
              😔
            </span>
          </h2>
          <p>
            We could not find any data provider matching your query. If there is
            an open access repository or a journal you think should be added to
            CORE, use the form below{' '}
            <span role="img" aria-label="">
              👇
            </span>
          </p>
        </Search.Result>
        {children}
      </Search.Main>
    )
  }

  return (
    <Search.Main>
      {results.slice(0, dataProvidersSize).map((el) => (
        <ResultCard
          key={el.id}
          repoId={el.id}
          title={el.name}
          homePage={el.urlHomepage}
          country={getCountryName(el.dataProviderLocation?.countryCode)}
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
    </Search.Main>
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
  }) => {
    const getSuggestions = useCallback(
      (term) => {
        const matches = searchDataProviders(term)

        return matches.slice(0, 10).map((dataProvider) => ({
          id: dataProvider.id,
          value: dataProvider.name,
          icon: '#magnify',
        }))
      },
      [searchDataProviders]
    )

    Header.useSearchBar(
      {
        onQueryChanged: setQuery,
        getSuggestions,
        initQuery: query,
        searchBarProps: {
          label: 'Search data providers',
          placeholder: 'e.g. repository or journal name',
          prependIcon: '#magnify',
        },
      },
      { isHidden: false }
    )

    return (
      <Search className={styles.layout}>
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
        <Search.Sidebar>
          {results.length > 0 && (
            <Map
              className={styles.map}
              locations={filterAndMapDataProviders(results)}
            />
          )}
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
        </Search.Sidebar>
      </Search>
    )
  }
)

export default DataProvidersSearchTemplate
