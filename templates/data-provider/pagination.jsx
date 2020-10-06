import React from 'react'
import { useRouter } from 'next/router'
import { Button, Icon } from '@oacore/design'
import Link from 'next/link'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

import Search from 'modules/search-layout'

const getEnabledActions = ({ offset, limit, total }) => ({
  loadMore: limit < total,
  previous: offset > 0,
  next: offset + limit < total,
  first: offset > 0,
  last: offset + limit < total,
})

const Pagination = ({ shallow, total, ...restProps }) => {
  const router = useRouter()
  const base = router.asPath
  const url = new URL(base, 'http://unused.host')
  const limit = Number.parseInt(url.searchParams.get('limit') ?? 10, 10)
  const offset = Number.parseInt(url.searchParams.get('offset') ?? 0, 10)

  const urlTo = (action) => {
    const targetUrl = new URL(url)
    let targetOffset = offset

    switch (action) {
      case 'MORE':
        // url.searchParams.set('offset', )
        break
      case 'NEXT':
        targetOffset = Math.min(offset + limit, total - (total % limit))
        break
      case 'PREV':
        targetOffset = Math.max(offset - limit, 0)
        break
      case 'LAST':
        targetOffset = total - (total % limit)
        break
      case 'FIRST':
        targetOffset = 0
        break
      default:
    }

    targetUrl.searchParams.set('offset', targetOffset)
    return targetUrl.href.slice(url.origin.length)
  }

  const actionEnabled = getEnabledActions({ offset, limit, total })

  return (
    <nav
      className={styles.pagination}
      role="navigation"
      aria-label="Pagination Navigation"
      {...restProps}
    >
      <div>
        <Search.ResultStats
          from={offset + 1}
          to={offset + limit}
          total={total}
          className={styles.resultStats}
        />
      </div>
      <div className={styles.arrowPagination}>
        <div>
          <Link href={urlTo('FIRST')} passHref shallow={shallow}>
            <Button
              tag="a"
              className={classNames.use(
                styles.arrow,
                !actionEnabled.first && styles.disabled
              )}
              aria-label="First"
              aria-disabled={!actionEnabled.first}
              title="Navigate to the first page"
            >
              <Icon src="#chevron-double-left" />
            </Button>
          </Link>

          <Link href={urlTo('PREVIOUS')} passHref shallow={shallow}>
            <Button
              tag="a"
              className={classNames.use(
                styles.arrow,
                !actionEnabled.previous && styles.disabled
              )}
              aria-label="Previous"
              aria-disabled={!actionEnabled.previous}
              title="Navigate to the previous page"
            >
              <Icon src="#chevron-left" />
            </Button>
          </Link>
          <Link href={urlTo('NEXT')} passHref shallow={shallow}>
            <Button
              tag="a"
              className={classNames.use(
                styles.arrow,
                !actionEnabled.next && styles.disabled
              )}
              aria-label="Next"
              aria-disabled={!actionEnabled.next}
              title="Navigate to the next page"
            >
              <Icon src="#chevron-right" />
            </Button>
          </Link>
          <Link href={urlTo('LAST')} passHref shallow={shallow}>
            <Button
              tag="a"
              className={classNames.use(
                styles.arrow,
                !actionEnabled.last && styles.disabled
              )}
              aria-label="Last"
              aria-disabled={!actionEnabled.last}
              title="Navigate to the last page"
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
