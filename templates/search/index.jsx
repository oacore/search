import React from 'react'
import { Link, LoadingBar } from '@oacore/design/lib/elements'
import classNames from '@oacore/design/lib/utils/class-names'

import Pagination from './pagination'
import Results from './results'
import styles from './styles.module.css'
import notFoundSvg from './images/notFound.svg'

import { useStore, observe } from 'store'
import Search from 'modules/search-layout'
import useWindowDimensions from 'hooks/use-window-dimensions'

const SearchTemplate = observe(({ data }) => {
  const { search } = useStore()
  const { width } = useWindowDimensions()

  React.useEffect(() => {
    search.setWorks(data.results)
    search.fetchDataProviders()
  }, [data])

  return (
    <Search className={classNames.use(styles.layout, styles.search)}>
      {search.isLoading && <LoadingBar fixed />}
      <Search.Main>
        {data.results.length === 0 && (
          <div className={styles.notFound}>
            <img src={notFoundSvg} alt="No results found" />
            <h2>Sorry, we couldn’t find any results for “{data.query}”.</h2>
            <p>
              Double check your search request for any spelling errors or try a
              different search term.
            </p>
          </div>
        )}
        {data.results.length > 0 && (
          <>
            <p>{data.totalHits} research outputs found</p>
            <Results works={search.works} />
            {data.currentPage === 1000 && (
              <div className={styles.more}>
                Our search interface allows you to see only the first 10.000
                articles, please consider restricting your search query or using
                the <Link href="https://core.ac.uk/services/api">API</Link>
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
    </Search>
  )
})

export default SearchTemplate
