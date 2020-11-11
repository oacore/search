import React from 'react'
import { SearchResult } from '@oacore/design'

import DataProviderOutputsSearch from './search'
// import ClaimCard from './claim-card'
import MapCard from './map-card'
import styles from './styles.module.css'
import Pagination from './pagination'

import Search from 'modules/search-layout'

const DataProviderTemplate = ({
  basePath,
  outputs,
  metadata,
  query,
  setQuery,
  loading,
  isLoadingMore,
  from,
  size,
  total,
}) => {
  const placeholders = Array.from(Array(10).keys())

  return (
    <Search className={styles.layout}>
      <Search.Main>
        <span className={styles.titleBox}>
          <span>{metadata.institution}</span>
          <h1 className={styles.title}>{metadata.name}</h1>
        </span>

        <DataProviderOutputsSearch
          initQuery={query}
          onQueryChanged={(q) => {
            setQuery(q)
          }}
          className={styles.search}
        />
        {loading && !isLoadingMore
          ? placeholders.map((key) => (
              <SearchResult
                id={String(key)}
                key={String(key)}
                aria-busy="true"
                tag={Search.Result}
              >
                <p data-line-count="2" />
              </SearchResult>
            ))
          : outputs.map(({ id, abstract, title, author, year, link }) => {
              const fullTextLink = link.find((l) => l.type === 'download')?.url
              const metadataLink = link.find((l) => l.type === 'display')?.url
              return (
                <SearchResult
                  key={id}
                  id={id}
                  tag={Search.Result}
                  data={{
                    title,
                    author,
                    publicationDate: String(year),
                    thumbnailUrl: `//core.ac.uk/image/${id}/medium`,
                    metadataLink,
                    fullTextLink,
                  }}
                >
                  {abstract}
                </SearchResult>
              )
            })}
        {isLoadingMore &&
          placeholders.map((key) => (
            <SearchResult
              id={String(key)}
              key={String(key)}
              aria-busy="true"
              tag={Search.Result}
            >
              <p data-line-count="2" />
            </SearchResult>
          ))}
        {outputs.length === 0 && (
          <div className={styles.noResultsFind}>No results found</div>
        )}
        <Pagination
          basePath={basePath}
          from={from}
          size={size}
          total={total}
          q={query}
        />
      </Search.Main>
      <Search.Sidebar tag="aside">
        <MapCard metadata={metadata} />
        {/* <ClaimCard name={metadata.name} /> */}
      </Search.Sidebar>
    </Search>
  )
}

export default DataProviderTemplate
