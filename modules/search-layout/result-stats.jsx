import React from 'react'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const ResultStats = ({
  className,
  tag: Tag = 'span',
  from,
  to,
  total,
  ...restProps
}) => (
  <Tag className={classNames.use(styles.resultStats, className)} {...restProps}>
    Showing {from}-{to} of {total}
  </Tag>
)
export default ResultStats
