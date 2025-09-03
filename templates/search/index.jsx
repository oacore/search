import React, { useEffect, useState } from 'react'
import { Button, Icon, Link, LoadingBar } from '@oacore/design/lib/elements'
import { Popover } from '@oacore/design/lib/modules'
import classNames from '@oacore/design/lib/utils/class-names'
import { useRouter } from 'next/router'

import Pagination from './pagination'
import Results from './results'
import styles from './styles.module.css'
import QueryError from '../error/query'
import Notification from './notification'
import defaultImage from './images/defaultImage.png'
import coreImage from './images/core.png'
import DownloadResultModal from './modals/download-results'
import Sort from './sort'
import { fetchLogos } from '../../api/search'

import Search from 'modules/search-layout'
import FiltersBar from 'modules/filters'
import { observe, useStore } from 'store'
import useWindowSize from 'hooks/use-window-size'
import useCopyToClipboard from 'hooks/use-copy-to-clipboard'

const SearchTemplate = observe(({ data }) => {
  const router = useRouter()
  const { search } = useStore()
  const { width } = useWindowSize()
  const [banner, setBanner] = useState()
  const [loading, setLoading] = useState()

  const url =
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : 'https://core.ac.uk'

  const [copyUrlStatus, copyUrl] = useCopyToClipboard(url + router.asPath)

  React.useEffect(() => {
    search.setSortOptions(data.sort)
    search.setWorks(data.results)
    search.setQuery(data.query)
  }, [data])

  useEffect(() => {
    setLoading(true)
    fetchLogos()
      .then((bannerData) => {
        if (bannerData) setBanner(bannerData)
      })
      .finally(() => setLoading(false))
  }, [])

  const onHandleChangeSortOptions = (option) => {
    search.setActiveSortOption(option, '/search')
  }

  const getRedirectUrl = (dataProviderId) => {
    if (dataProviderId === 0) return 'https://core.ac.uk/sponsorship'

    if (dataProviderId)
      return `https://core.ac.uk/data-providers/${dataProviderId}`

    return 'https://core.ac.uk/membership'
  }

  return (
    <>
      <FiltersBar query={data.query} sortType={data.sort} pathName="/search" />
      <Search className={classNames.use(styles.layout, styles.search)}>
        {search.isLoading && <LoadingBar fixed />}
        <Search.Main>
          {data.results.length === 0 && <QueryError query={data.query} />}
          {data.results.length > 0 && (
            <>
              <div className={styles.header}>
                <p>
                  {data.totalHits.toLocaleString('en-GB')} research outputs
                  found
                </p>
                <div className={styles.actionButtons}>
                  <Popover
                    placement="top"
                    content="Download results in CSV"
                    className={styles.popover}
                  >
                    <Button
                      type="button"
                      variant="text"
                      onClick={() => search.setActiveDownloadModal(true)}
                      className={styles.actionButton}
                    >
                      <Icon
                        src="#download"
                        className={styles.actionIcon}
                        srcPrefix="/static"
                      />
                    </Button>
                  </Popover>
                  <Popover
                    placement="top"
                    content="Copy url"
                    className={styles.popover}
                  >
                    <Button
                      type="button"
                      onClick={copyUrl}
                      variant="text"
                      className={styles.actionButton}
                    >
                      <Icon
                        src="#share-variant"
                        className={styles.actionIcon}
                        srcPrefix="/static"
                      />
                    </Button>
                  </Popover>
                </div>
                <span className={styles.solid} />
                {search.sortOptions.length > 0 && (
                  <Sort
                    options={search.sortOptions}
                    onClick={onHandleChangeSortOptions}
                    className={styles.sort}
                  />
                )}
              </div>
              <Results works={data.results} searchId={data.searchId} />
              {data.currentPage === 1000 && (
                <div className={styles.more}>
                  Our search interface allows you to see only the first 10.000
                  articles, please consider restricting your search query or
                  using the{' '}
                  <Link href="https://core.ac.uk/services/api">API</Link>
                </div>
              )}
              <Pagination
                totalCount={data.totalHits}
                pageSize={data.limit}
                urlPage={data.currentPage}
                siblingCount={width > 500 ? 2 : 0}
              />
            </>
          )}
        </Search.Main>
        <Search.Sidebar tag="aside">
          <Link
            href={getRedirectUrl(banner?.dataprovider_id)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.logo}
          >
            <img
              src={
                loading
                  ? defaultImage
                  : `data:image/jpeg;base64,${banner?.base64Banner}`
              }
              alt="core"
              className={styles.sidebarImage}
            />
          </Link>
          <Link
            href="https://www.core.ac.uk"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.logo}
          >
            <img src={coreImage} alt="core" className={styles.sidebarImage} />
          </Link>
        </Search.Sidebar>
        {copyUrlStatus === 'copied' && <Notification />}
        {search.activeDownloadModal && <DownloadResultModal />}
      </Search>
    </>
  )
})

export default SearchTemplate
