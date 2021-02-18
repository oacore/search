import React from 'react'
import { SearchResult } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import DataProviderOutputsSearch from './search'
// import ClaimCard from './claim-card'
import MapCard from './map-card'
import styles from './styles.module.css'
import Pagination from './pagination'

import Search from 'modules/search-layout'
import formatDate from 'utils/format-date'

// TODO: Look for polyfill
const countryName =
  typeof Intl.DisplayNames != 'undefined'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : { of: (v) => v }

const DataProviderTemplate = ({
  data,
  onSearch,
  loading = false,
  className,
  ...restProps
}) => {
  const outputs = data.outputs.results

  return (
    <Search
      className={classNames.use(styles.layout).join(className)}
      {...restProps}
    >
      <Search.Main>
        <header
          className={styles.header}
          style={{
            '--cover-url': `url('/api/cover?scope=data-providers/${data.id}')`,
          }}
        >
          {/* <span>{data.institution}</span> */}
          <h1 className={styles.title}>{data.name}</h1>
        </header>

        <DataProviderOutputsSearch
          initQuery={data.outputs.query}
          onQueryChanged={onSearch}
          className={styles.search}
          placeholder={`Search research outputs in ${data.name}`}
        />
        {outputs.map(
          ({
            id,
            abstract,
            title,
            authors,
            publishedDate: publicationDate,
            links,
          }) => {
            const fullTextLink = links.find((l) => l.type === 'download')?.url
            const metadataLink = links.find((l) => l.type === 'display')?.url

            return (
              <SearchResult
                key={id}
                id={id}
                className={styles.resultItem}
                tag={Search.Result}
                data={{
                  title,
                  author: authors,
                  publicationDate: publicationDate
                    ? formatDate(new Date(publicationDate))
                    : null,
                  thumbnailUrl: `//core.ac.uk/image/${id}/medium`,
                  metadataLink,
                  fullTextLink,
                }}
                aria-busy={loading}
              >
                {abstract}
              </SearchResult>
            )
          }
        )}
        {outputs.length === 0 && (
          <div className={styles.noResultsFind}>No results found</div>
        )}
        <Pagination total={data.outputs.totalHits} />
      </Search.Main>

      <Search.Sidebar tag="aside">
        <MapCard
          name={data.name}
          latitude={data.location.latitude}
          longitude={data.location.longitude}
        >
          {data.name} is based in{' '}
          {countryName.of(data.location.countryCode.toUpperCase())}
        </MapCard>
        {/* <ClaimCard name={data.name} /> */}
      </Search.Sidebar>
    </Search>
  )
}

export default DataProviderTemplate
