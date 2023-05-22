import React, { useState } from 'react'
import { classNames } from '@oacore/design/lib/utils'
import { DataProviderLogo } from '@oacore/design/lib/elements/logo'

import DataProviderOutputsSearch from './search'
import ClaimCard from './claim/claim-card'
import MapCard from './map-card'
import styles from './styles.module.css'
import Pagination from './pagination'
import MetaBox from './meta-box'
import { useStore } from '../../store'
import Sort from '../search/sort'
import Results from '../search/results'
import { checkUniversity } from '../../utils/data-providers-transform'

import Search from 'modules/search-layout'

// TODO: Look for polyfill
const countryName =
  typeof Intl.DisplayNames != 'undefined'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : { of: (v) => v }

const DataProviderTemplate = ({ data, onSearch, className, ...restProps }) => {
  const { outputs } = data

  const { search } = useStore()

  const [isDataProviderHasAccounts, setIsDataProviderHasAccounts] =
    useState(false)

  const contactData = {
    name: data.name,
    email: data.email,
  }

  React.useEffect(() => {
    search.setSortOptions(data.sort)
    search.setWorks(data.results)
    search.setQuery(data.query)
  }, [data.sort, data.results, data.query])

  const onHandleChangeSortOptions = (option) => {
    search.setActiveSortOptionData(option, `/data-providers/${data.id}`)
  }

  const renderName = () => {
    const universityName = checkUniversity(data.id)
    return universityName ?? ''
  }

  return (
    <Search
      className={classNames.use(styles.layout).join(className)}
      {...restProps}
    >
      <Search.Main>
        <header className={styles.header}>
          <DataProviderLogo alt={data.name} imageSrc={data.logo} size="lg" />
          <div className={styles.headerInfo}>
            <h1 className={styles.headerInfoTitle}>{renderName()}</h1>
            <span className={styles.subHeaderInfo}>{data.name}</span>
            <h5
              className={classNames.use(styles.headerInfoCaption, {
                [styles.headerInfoCaptionColor]: !isDataProviderHasAccounts,
              })}
            >
              <a
                href="https://core.ac.uk/membership"
                target="_blank"
                rel="noreferrer"
                className={classNames.use(styles.headerInfoCaptionLink, {
                  [styles.headerInfoCaptionLinkColor]:
                    !isDataProviderHasAccounts,
                })}
              >
                {isDataProviderHasAccounts
                  ? `${data.billingType} member`
                  : `Not a member yet`}
              </a>
            </h5>
          </div>
        </header>
        <DataProviderOutputsSearch
          initQuery={data.outputs.query}
          onQueryChanged={onSearch}
          className={styles.search}
          placeholder={`Search over ${data.outputs.total} research outputs in ${data.name}`}
        />
        {/* <FiltersBar */}
        {/*  query={data.query} */}
        {/*  sortType={data.sort} */}
        {/*  styleProp */}
        {/*  pathName={`/data-providers/${data.id}`} */}
        {/* /> */}
        <div className={styles.sortWrapper}>
          <span className={styles.searchTotal}>
            {data.outputs.totalHits} research outputs found
          </span>
          <Sort
            options={search.sortOptions}
            onClick={onHandleChangeSortOptions}
            className={styles.sort}
          />
        </div>
        <Results works={outputs.results} />
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
          latitude={data.location?.latitude}
          longitude={data.location?.longitude}
        >
          {data.name}
          {data.location?.countryCode ? (
            <>
              {' '}
              is based in{' '}
              {countryName.of(data.location.countryCode.toUpperCase())}
            </>
          ) : (
            ' '
          )}
        </MapCard>
        <ClaimCard
          nameDataProvider={data.name}
          dataProviderType={data.billingType}
          id={data.id}
          className={styles.card}
          contactData={contactData}
          setIsDataProviderHasAccounts={setIsDataProviderHasAccounts}
          isDataProviderHasAccounts={isDataProviderHasAccounts}
        />
      </Search.Sidebar>
    </Search>
  )
}

export default DataProviderTemplate
