import React, { useEffect } from 'react'
import { Button, Icon, Link, LoadingBar } from '@oacore/design/lib/elements'
import { Popover } from '@oacore/design/lib/modules'
import classNames from '@oacore/design/lib/utils/class-names'
import { useRouter } from 'next/router'

import Pagination from './pagination'
import Results from './results'
import styles from './styles.module.css'
import QueryError from '../error/query'
import Notification from './notification'
import coreImage from './images/core.png'
import DownloadResultModal from './modals/download-results'
import Sort from './sort'
import imagePlaceholder from '../data-provider/images/Default.svg'
import repoPlaceholder from '../data-provider/images/repoPlaceholder.svg'

import Search from 'modules/search-layout'
import FiltersBar from 'modules/filters'
import { observe, useStore } from 'store'
import useWindowSize from 'hooks/use-window-size'
import useCopyToClipboard from 'hooks/use-copy-to-clipboard'
import { capitalizeFirstLetter } from 'utils/titleCase'
import {
  getDataProviderLogoUrl,
  getMemberRepoId,
} from 'templates/search/utils/featured-member'

const SearchTemplate = observe(({ data, members = [] }) => {
  const router = useRouter()
  const { search } = useStore()
  const { width } = useWindowSize()
  const member = members[0] || null
  const dataProviderId = getMemberRepoId(member)
  const repositoryLogo = dataProviderId
    ? getDataProviderLogoUrl(dataProviderId)
    : null

  const url =
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : 'https://core.ac.uk'

  const [copyUrlStatus, copyUrl] = useCopyToClipboard(url + router.asPath)

  useEffect(() => {
    search.setSortOptions(data.sort)
    search.setWorks(data.results)
    search.setQuery(data.query)
  }, [data])

  const onHandleChangeSortOptions = (option) => {
    search.setActiveSortOption(option, '/search')
  }

  const getRedirectUrl = (providerId) => {
    if (providerId === 0) return 'https://core.ac.uk/sponsorship'

    if (providerId) return `https://core.ac.uk/data-providers/${providerId}`

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
                      <Icon src="#download" className={styles.actionIcon} />
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
            href={getRedirectUrl(dataProviderId)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.logo}
          >
            {member ? (
              <div className={styles.memberInfo}>
                <span className={styles.memberBadge}>CORE Member</span>
                <div className={styles.memberBody}>
                  <div className={styles.repositoryLogoWrap}>
                    <img
                      className={styles.repositoryLogo}
                      src={repositoryLogo || imagePlaceholder}
                      onError={(e) => {
                        e.target.src = imagePlaceholder
                      }}
                      alt={member.organisation_name || 'repository logo'}
                    />
                  </div>
                  <div className={styles.memberMeta}>
                    {member.billing_type && (
                      <p className={styles.memberBillingType}>
                        {capitalizeFirstLetter(member.billing_type)} member
                      </p>
                    )}
                    {member.organisation_name && (
                      <p className={styles.organisationName}>
                        {member.organisation_name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.memberInfo}>
                <span className={styles.memberBadge}>CORE Member</span>
                <div className={styles.memberBody}>
                  <div className={styles.repositoryLogoWrap}>
                    <img
                      className={styles.repositoryLogo}
                      src={repoPlaceholder}
                      onError={(e) => {
                        e.target.src = imagePlaceholder
                      }}
                      alt="repository logo"
                    />
                  </div>
                  <div className={styles.memberMeta}>
                    <p className={styles.memberBillingType}>
                      Type of membership
                    </p>
                    <p className={styles.organisationName}>Organisation name</p>
                  </div>
                </div>
              </div>
            )}
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
