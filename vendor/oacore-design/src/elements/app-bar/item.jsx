import { forwardRef } from 'react'

import styles from './styles.css'
import { classNames } from '../../utils'

const Item = forwardRef(
  ({ children, className, tag: Tag = 'div', ...restProps }, ref) => (
    <Tag
      className={classNames.use('item').from(styles).join(className)}
      ref={ref}
      {...restProps}
    >
      {children}
    </Tag>
  )
)

export default Item
