import React from 'react'
import { Button, Icon } from '@oacore/design/lib'
import classNames from '@oacore/design/lib/utils/class-names'
import { useRouter } from 'next/router'

import styles from './styles.module.css'

import { usePagination, DOTS } from 'hooks/use-pagination'

const Pagination = ({ totalCount, pageSize, siblingCount, urlPage }) => {
  const [currentPage, setCurrentPage] = React.useState(urlPage)

  const router = useRouter()

  const routerParams = router.query

  const baseURL = `/search/${routerParams.query}?page=`

  const onPageChange = (number) => {
    router.push(`${baseURL}${number}`)
    setCurrentPage(number)
  }

  const paginationRange = usePagination({
    currentPage,
    totalCount,
    siblingCount,
    pageSize,
  })

  // If there are less than 2 times in pagination range
  // We shall not render the component
  if (currentPage === 0 || paginationRange.length < 2) return null

  const onNext = () => {
    onPageChange(currentPage + 1)
  }

  const onPrevious = () => {
    onPageChange(currentPage - 1)
  }

  const lastPage = paginationRange[paginationRange.length - 1]

  return (
    <ul className={styles.pagination}>
      <li>
        <Button
          onClick={onPrevious}
          className={classNames.use(styles.paginationItem, {
            [styles.paginationItemDisabled]: currentPage === 1,
          })}
          disabled={currentPage === 1}
        >
          <Icon src="#chevron-left" />
        </Button>
      </li>
      {paginationRange.map((pageNumber) => {
        // If the pageItem is a DOT, render the DOTS unicode character
        if (pageNumber === DOTS) return <li className={styles.dots}>&#8229;</li>

        return (
          <li key={pageNumber}>
            <Button
              className={classNames.use(styles.paginationItem, {
                [styles.paginationItemActive]: pageNumber === currentPage,
              })}
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </Button>
          </li>
        )
      })}
      <li>
        <Button
          className={classNames.use(styles.paginationItem, {
            [styles.paginationItemDisabled]: currentPage === lastPage,
          })}
          onClick={onNext}
        >
          <Icon src="#chevron-right" />
        </Button>
      </li>
    </ul>
  )
}

export default Pagination
