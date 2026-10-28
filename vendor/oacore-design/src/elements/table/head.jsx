import PropTypes from 'prop-types'
import { forwardRef } from 'react'

import styles from './styles.css'
import { classNames } from '../../utils'

/**
 * Empty component for the future purposes.
 */
const Head = forwardRef(
  (
    { children, className, sticky = false, tag: Tag = 'thead', ...restProps },
    ref
  ) => (
    <Tag
      className={classNames.use({ sticky }).from(styles).join(className)}
      {...restProps}
      ref={ref}
    >
      {children}
    </Tag>
  )
)

Head.propTypes = {
  sticky: PropTypes.bool,
}

export default Head
