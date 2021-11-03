import React from 'react'
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

import Search from 'modules/search-layout'
import Filters from 'modules/filters'
import { useStore, observe } from 'store'
import useWindowSize from 'hooks/use-window-size'
import useCopyToClipboard from 'hooks/use-copy-to-clipboard'

const SearchTemplate = observe(({ data }) => {
  const router = useRouter()
  const { search } = useStore()
  const { width } = useWindowSize()

  const url =
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : 'https://core.ac.uk/'

  const [copyUrlStatus, copyUrl] = useCopyToClipboard(url + router.asPath)

  React.useEffect(() => {
    search.fetchDataProviders()
  }, [])

  React.useEffect(() => {
    search.setWorks(data.results)
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

                <Popover placement="top" content="Copy url">
                  <Button
                    type="button"
                    onClick={copyUrl}
                    variant="text"
                    className={styles.buttonShare}
                  >
                    <Icon src="#share-variant" className={styles.iconShare} />
                  </Button>
                </Popover>
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
          <img src={coreImage} alt="core" className={styles.sidebarImage} />
        </Search.Sidebar>
        {copyUrlStatus === 'copied' && <Notification />}
      </Search>
    </>
  )
})

export default SearchTemplate
