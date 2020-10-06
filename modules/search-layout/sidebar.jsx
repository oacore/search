import React from 'react'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const Sidebar = ({ children, className, ...restProps }) => (
  <div
    className={classNames.use(styles.sidebar, className)}
    {...restProps}
  >
    {children}
  </div>
)

export default Sidebar
