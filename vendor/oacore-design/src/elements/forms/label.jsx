import { forwardRef } from 'react'

import styles from './styles.css'
import { classNames } from '../../utils'

const FormLabel = forwardRef(
  ({ children, className, htmlFor, ...htmlProps }, ref) => (
    <label
      ref={ref}
      className={classNames.use(styles.label).join(className)}
      htmlFor={htmlFor}
      {...htmlProps}
    >
      {children}
    </label>
  )
)

export default FormLabel
