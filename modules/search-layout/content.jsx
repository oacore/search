import React from 'react'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const Content = ({ children, className, ...restProps }) => (
  <div className={classNames.use(styles.content, className)} {...restProps}>
    {children}
  </div>
)

export default Content
