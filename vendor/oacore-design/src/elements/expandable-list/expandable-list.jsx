import React, { useState, useEffect, useRef, useCallback } from 'react'

import styles from './expandable-list.css'
// eslint-disable-next-line import/no-cycle
import { Button } from '..'
import { classNames } from '../../utils'

const ExpandableListItem = ({ children, ...htmlProps }) => (
  <li {...htmlProps}>{children}</li>
)

const ExpandableList = ({ children, className, ...htmlProps }) => {
  const showMoreRef = useRef(null)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (isExpanded) {
      try {
        showMoreRef.current.parentElement.nextElementSibling.firstChild.focus()
      } catch (e) {
        // ignore error when element is not focusable,
        // i.e. element is for example just text node
      }
    }
  }, [isExpanded])

  const childrenArray = React.Children.toArray(children)

  if (childrenArray.length <= 4) {
    return (
      <ol
        className={classNames.use(styles.list).join(className)}
        {...htmlProps}
      >
        {childrenArray}
      </ol>
    )
  }

  const handleButtonClick = useCallback(() => {
    if (!isExpanded) setIsExpanded(true)
  }, [isExpanded])

  return (
    <ol className={classNames.use(styles.list).join(className)} {...htmlProps}>
      {React.cloneElement(childrenArray[0], {
        'aria-setsize': childrenArray.length,
      })}
      {React.cloneElement(childrenArray[1], {
        'aria-setsize': childrenArray.length,
      })}
      <li
        aria-setsize={childrenArray.length}
        className={classNames.use(styles.showMore, isExpanded && styles.hide)}
      >
        <Button
          ref={showMoreRef}
          onFocus={handleButtonClick}
          /* onFocus doesn't work in Safari hence additional listener */
          onClick={handleButtonClick}
          title="Show more"
        >
          +{childrenArray.length - 2}&nbsp;more
        </Button>
      </li>
      {childrenArray.slice(2).map((el) =>
        React.cloneElement(el, {
          'aria-setsize': childrenArray.length,
          'className': classNames.use(
            !isExpanded && styles.hide,
            el.props.className
          ),
        })
      )}
    </ol>
  )
}

ExpandableList.displayName = 'ExpandableList'
ExpandableListItem.displayName = 'ExpandableList.Item'

ExpandableList.Item = ExpandableListItem

export default ExpandableList
