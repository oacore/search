import React from 'react'
import { Button, Icon } from '@oacore/design'
import Link from 'next/link'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

import Search from 'modules/search-layout'

const getPaginationState = ({ from, size, total }) => ({
  loadMore: size < total,
  previous: from > 0,
  next: from + size < total,
  first: from > 0,
  last: from + size < total,
})

const Pagination = ({ basePath, from, size, total, ...restParams }) => {
  const hrefBuilder = ({ next, previous, first, last, loadMore }) => {
    const params = {
      from,
      size,
      ...restParams,
    }

    if (!loadMore) params.size = 10
    if (next) params.from = from + size
    if (previous) params.from = Math.max(from - 10, 0)
    if (first) params.from = 0
    if (last) params.from = total - 10
    if (loadMore) params.size = Math.min(size + 10, total)

    const urlParams = new URLSearchParams(params)
    urlParams.sort()

    return `${basePath}?${urlParams.toString()}`
  }

  const paginationState = getPaginationState({ from, size, total })

  return (
    <nav
      className={styles.pagination}
      role="navigation"
      aria-label="Pagination Navigation"
    >
      <div>
        <Link
          href={hrefBuilder({ loadMore: true })}
          shallow
          passHref
          scroll={false}
        >
          <Button
            tag="a"
            aria-label="Load more results"
            disabled={!paginationState.loadMore}
            aria-disabled={!paginationState.loadMore}
          >
            Load more
          </Button>
        </Link>
      </div>
      <div className={styles.arrowPagination}>
        <Search.ResultStats
          from={from + 1}
          to={from + size}
          total={total}
          className={styles.resultStats}
        />
        <div>
          <Link
            href={hrefBuilder({ first: true })}
            shallow
            passHref
            scroll={false}
          >
            <Button
              tag="a"
              className={classNames.use(
                styles.arrow,
                !paginationState.first && styles.disabled
              )}
              aria-label="Goto page 1"
              aria-disabled={!paginationState.first}
            >
              <Icon src="#chevron-double-left" />
            </Button>
          </Link>

          <Link href={hrefBuilder({ previous: true })} shallow passHref>
            <Button
              tag="a"
              className={classNames.use(
                styles.arrow,
                !paginationState.previous && styles.disabled
              )}
              aria-label="Goto previous page"
              aria-disabled={!paginationState.previous}
            >
              <Icon src="#chevron-left" />
            </Button>
          </Link>
          <Link href={hrefBuilder({ next: true })} shallow passHref>
            <Button
              tag="a"
              className={classNames.use(
                styles.arrow,
                !paginationState.next && styles.disabled
              )}
              aria-label="Goto next page"
              aria-disabled={!paginationState.next}
            >
              <Icon src="#chevron-right" />
            </Button>
          </Link>
          <Link href={hrefBuilder({ last: true })} shallow passHref>
            <Button
              tag="a"
              className={classNames.use(
                styles.arrow,
                !paginationState.last && styles.disabled
              )}
              aria-label="Goto last page"
              aria-disabled={!paginationState.last}
            >
              <Icon src="#chevron-double-right" />
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  )
}

export default Pagination
