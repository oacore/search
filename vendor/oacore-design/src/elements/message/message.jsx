import { forwardRef } from 'react'
import PropTypes from 'prop-types'

import styles from './message.css'
import { classNames } from '../../utils'

const Message = forwardRef(
  (
    {
      children,
      className,
      variant,
      tag: Tag = 'p',
      fill = false,
      ...restProps
    },
    ref
  ) => (
    <Tag
      ref={ref}
      className={classNames
        .use('message', variant, fill && 'fill')
        .from(styles)
        .join(className)}
      {...restProps}
    >
      {children}
    </Tag>
  )
)

Message.propTypes = {
  /**
   * Defines color scheme of the message
   */
  variant: PropTypes.oneOf(['success', 'warning', 'danger']),

  /**
   * Indicates whether message should have colored or transparent background
   */
  fill: PropTypes.bool,
}

export default Message
