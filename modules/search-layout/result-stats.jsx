import React from 'react'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

import { formatNumber } from 'utils/format-number'

const ResultStats = ({
  className,
  tag: Tag = 'span',
  from,
  to,
  total,
  ...restProps
}) => (
  <Tag className={classNames.use(styles.resultStats, className)} {...restProps}>
    Showing {formatNumber(from)}-{formatNumber(to)} of {formatNumber(total)}
  </Tag>
)
export default ResultStats
