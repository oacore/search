import React from 'react'
import { SearchResult } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'
import { DataProviderLogo } from '@oacore/design/lib/elements/logo'

import DataProviderOutputsSearch from './search'
import ClaimCard from './claim/claim-card'
import MapCard from './map-card'
import styles from './styles.module.css'
import Pagination from './pagination'
import MetaBox from './meta-box'

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
  const { outputs } = data

  const contactData = {
    name: data.name,
    email: data.email,
  }
  console.log(data)
  return (
    <Search
      className={classNames.use(styles.layout).join(className)}
      {...restProps}
    >
      <Search.Main>
        <header className={styles.header}>
          {/* <span>{data.institution}</span> */}
          <DataProviderLogo alt={data.name} imageSrc={data.logo} size="lg" />
          <div className={styles.headerInfo}>
            <h5 className={styles.headerInfoCaption}>
              {data.billingType} member
            </h5>
            <h1 className={styles.headerInfoTitle}>{data.name}</h1>
          </div>
        </header>

        <DataProviderOutputsSearch
          initQuery={data.outputs.query}
          onQueryChanged={onSearch}
          className={styles.search}
          placeholder={`Search over ${data.outputs.total} research outputs in ${data.name}`}
        />
        {(outputs.data ?? []).map(
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
                id={id.toString()}
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
        {outputs.data.length === 0 && outputs.error == null && (
          <div className={styles.noResultsFound}>
            This data provider has not articles yet.
          </div>
        )}
        {outputs.error != null && (
          <div className={styles.noResultsFound}>
            An error occured. Try to reload the page in a bit or contact us.
          </div>
        )}
        <Pagination total={data.outputs.totalHits} />
      </Search.Main>

      <Search.Sidebar tag="aside">
        {data?.metadata && (
          <MetaBox
            countMetadata={data.metadata.countMetadata}
            countFullText={data.metadata.countFulltext}
          />
        )}
        <MapCard
          name={data.name}
          latitude={data.location.latitude}
          longitude={data.location.longitude}
        >
          {data.name}
          {data.location.countryCode ? (
            <>
              is based in{' '}
              {countryName.of(data.location.countryCode.toUpperCase())}
            </>
          ) : (
            ' '
          )}
        </MapCard>
        <ClaimCard
          nameDataProvider={data.name}
          id={data.id}
          className={styles.card}
          contactData={contactData}
        />
      </Search.Sidebar>
    </Search>
  )
}

export default DataProviderTemplate
