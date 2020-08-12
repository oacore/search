import React from 'react'
import { Card } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const Footer = ({ children, className, tag: Tag = Card, ...restProps }) => (
  <Tag className={classNames.use(styles.footer, className)} {...restProps}>
    {children}
  </Tag>
)

export default Footer
