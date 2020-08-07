import React from 'react'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const Results = ({ children, className, tag: Tag = 'div', ...restProps }) => (
  <Tag
    className={classNames.use(styles.searchResults, className)}
    {...restProps}
  >
    {children}
  </Tag>
)

export default Results
