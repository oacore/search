import { forwardRef } from 'react'

import styles from './styles.css'
import { classNames } from '../../utils'

const FormGroup = forwardRef(
  ({ children, className, tag: Tag = 'p', ...htmlProps }, ref) => (
    <Tag
      ref={ref}
      className={classNames.use(styles.group).join(className)}
      {...htmlProps}
    >
      {children}
    </Tag>
  )
)

export default FormGroup
