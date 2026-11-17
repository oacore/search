import React from 'react'
import { Icon } from '@oacore/design/lib/elements'
import classNames from '@oacore/design/lib/utils/class-names'

import styles from '../styles.module.css'

const CustomRange = ({ count }: any) => (
  <li className={classNames.use(styles['custom-range-text'], styles.label)}>
    {count && <Icon src="#check" className={styles['label-text-active']} />}
    <p
      className={classNames.use({
        [styles['label-text-active']]: count,
      })}
    >
      Custom range
    </p>
    <span>{count && count.toLocaleString('en-GB')}</span>
  </li>
)

export default CustomRange
