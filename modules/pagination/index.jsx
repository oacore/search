import React, { useCallback } from 'react'

import styles from './styles.module.css'
import Page from './page'

const Pagination = ({
  activePage = 1,
  pageCount,
  pageRangeDisplayed = 2,
  marginPagesDisplayed = 3,
  hrefBuilder,
}) => {
  const getPageElement = useCallback(
    (index) => (
      <Page
        key={index}
        aria-current={activePage === index}
        href={hrefBuilder(index)}
        aria-label={`Go to page ${index}`}
        page={index}
        title={`Go to page ${index}`}
      />
    ),
    []
  )

  const getForwardJump = () => {
    const forwardJump = activePage + pageRangeDisplayed
    return forwardJump >= pageCount ? pageCount - 1 : forwardJump
  }

  const getBackwardJump = () => {
    const backwardJump = activePage - pageRangeDisplayed
    return backwardJump < 0 ? 0 : backwardJump
  }

  const pagination = () => {
    const items = []

    // no need for ellipsis
    if (pageCount <= pageRangeDisplayed) {
      for (let index = 1; index <= pageCount; index++)
        items.push(getPageElement(index))
    } else {
      let leftSide = pageRangeDisplayed / 2
      let rightSide = pageRangeDisplayed - leftSide

      // If the activePage page index is on the default right side
      // of the pagination, we consider that the new right side
      // is made up of it (= only one break element).
      // If the activePage page index is on the default left side
      // of the pagination, we consider that the new left side is made up
      // of it (= only one break element).
      if (activePage > pageCount - pageRangeDisplayed / 2) {
        rightSide = pageCount - activePage
        leftSide = pageRangeDisplayed - rightSide
      } else if (activePage < pageRangeDisplayed / 2) {
        leftSide = activePage
        rightSide = pageRangeDisplayed - leftSide
      }

      let index
      let page
      let breakView

      for (index = 1; index <= pageCount; index++) {
        page = index

        // If the page index is lower than the margin defined,
        // the page has to be displayed on the left side of
        // the pagination.
        if (page <= marginPagesDisplayed) items.push(getPageElement(index))
        // If the page index is greater than the page count
        // minus the margin defined, the page has to be
        // displayed on the right side of the pagination.
        else if (page > pageCount - marginPagesDisplayed)
          items.push(getPageElement(index))
        // If the page index is near the activePage page index
        // and inside the defined range (pageRangeDisplayed)
        // we have to display it (it will create the center
        // part of the pagination).
        else if (
          index >= activePage - leftSide &&
          index <= activePage + rightSide
        )
          items.push(getPageElement(index))
        // If the page index doesn't meet any of the conditions above,
        // we check if the last item of the current "items" array
        // is a break element. If not, we add a break element, else,
        // we do nothing (because we don't want to display the page).
        else if (items[items.length - 1] !== breakView) {
          const pageNumber =
            activePage < index ? getForwardJump() : getBackwardJump()

          breakView = (
            <Page
              href={hrefBuilder(pageNumber)}
              aria-label={`Go to page ${pageNumber}`}
              title={`Go to page ${pageNumber}`}
              text="..."
            />
          )

          items.push(breakView)
        }
      }
    }

    return items
  }

  return (
    <nav role="navigation" aria-label="Pagination Navigation">
      <ul className={styles.pagination}>
        <Page
          href={hrefBuilder(activePage - 1)}
          aria-disabled={activePage === 0 ? 'true' : 'false'}
          aria-label="Go to previous page"
          title="Previous page"
          rel="prev"
          text="❮"
        />
        {pagination()}
        <Page
          href={hrefBuilder(activePage - 1)}
          aria-disabled={activePage === 0 ? 'true' : 'false'}
          aria-label="Go to next page"
          title="Next page"
          rel="next"
          text="❯"
        />
      </ul>
    </nav>
  )
}

export default Pagination
