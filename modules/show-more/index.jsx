import React, { useState } from 'react'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const More = ({ children, className, tag: Tag = 'div', ...htmlProps }) => (
  <Tag
    className={classNames.use(styles.more, className)}
    role="region"
    tabIndex="-1"
    {...htmlProps}
  >
    {children}
  </Tag>
)

const ShowMore = ({ id, children, className, defaultVisibility = false }) => {
  const [isVisible, setIsVisible] = useState(defaultVisibility)
  const childrenArray = React.Children.toArray(children)

  return (
    <div className={classNames.use(isVisible && styles.visible, className)}>
      <button
        type="button"
        className={classNames.use(styles.showMore)}
        onClick={() => setIsVisible(!isVisible)}
        aria-expanded={isVisible}
        aria-controls={`${id}-more`}
      >
        {childrenArray.slice(0, -1)}
      </button>
      {React.cloneElement(childrenArray[childrenArray.length - 1], {
        id: `${id}-more`,
      })}
    </div>
  )
}

More.displayName = 'ShowMore.More'

ShowMore.More = More

export default ShowMore
