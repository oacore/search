import React from 'react'
import { Button, Icon, Link, LoadingBar } from '@oacore/design/lib/elements'
import { Popover } from '@oacore/design/lib/modules'
import classNames from '@oacore/design/lib/utils/class-names'
import { useRouter } from 'next/router'

import Pagination from './pagination'
import Results from './results'
import styles from './styles.module.css'
import QueryError from './errors/query'
import Notification from './notification'
import DownloadResultModal from './modals/download-results'

import Search from 'modules/search-layout'
import Filters from 'modules/filters'
import { useStore, observe } from 'store'
import useWindowSize from 'hooks/use-window-size'
import useCopyToClipboard from 'hooks/use-copy-to-clipboard'

const SearchTemplate = observe(({ data }) => {
  const [isModalDownloadActive, setModalDownloadActive] = React.useState(true)
  const router = useRouter()
  const { search } = useStore()
  const { width } = useWindowSize()

  const url =
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : 'https://core.ac.uk/'

  const [copyUrlStatus, copyUrl] = useCopyToClipboard(url + router.asPath)

  React.useEffect(() => {
    search.setWorks(data.results)
    search.fetchDataProviders()
  }, [data])

  return (
    <>
      {data.results.length > 0 && (
        <Filters query={data.query} sortType={data.sort} />
      )}
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
                    content="Download results in csv"
                    className={styles.popover}
                  >
                    <Button
                      type="button"
                      variant="text"
                      onClick={() => setModalDownloadActive(true)}
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
              </div>
              <Results works={search.works} />
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
          <div>Content</div>
        </Search.Sidebar>
        {copyUrlStatus === 'copied' && <Notification />}
        {isModalDownloadActive && (
          <DownloadResultModal setModalActive={setModalDownloadActive} />
        )}
      </Search>
    </>
  )
})

export default SearchTemplate
