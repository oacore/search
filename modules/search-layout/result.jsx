import React from 'react'
import { classNames } from '@oacore/design/lib/utils'
import { Card } from '@oacore/design'

import styles from './styles.module.css'

const Result = ({ children, className, tag = 'div', ...restProps }) => (
  <Card
    tag={tag}
    className={classNames.use(styles.result, className)}
    {...restProps}
  >
    {children}
  </Card>
)

export default Result
