import React from 'react'
import { classNames } from '@oacore/design/lib/utils'
import Link from 'next/link'

import styles from './styles.module.css'

const Page = ({ page, href, text = page, ...restProps }) => (
  <li className={classNames.use(styles.item, styles.active)}>
    <Link {...href} passHref>
      <a {...restProps}>{text}</a>
    </Link>
  </li>
)

export default Page
