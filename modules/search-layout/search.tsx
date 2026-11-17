import React from 'react'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const Search: any = ({
  children,
  className,
  tag: Tag = 'div',
  ...restProps
}: any) => (
  <Tag className={classNames.use(styles.container, className)} {...restProps}>
    {children}
  </Tag>
)

export default Search
