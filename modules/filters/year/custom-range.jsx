import React from 'react'
import { Icon } from '@oacore/design/lib/elements'
import classNames from '@oacore/design/lib/utils/class-names'

import styles from '../styles.module.css'

const CustomRange = ({ count }) => (
  <li className={classNames.use(styles.customRangeText, styles.label)}>
    {count && <Icon src="#check" className={styles.labelTextActive} />}
    <p
      className={classNames.use({
        [styles.labelTextActive]: count,
      })}
    >
      Custom range
    </p>
    <span>{count && count.toLocaleString('en-GB')}</span>
  </li>
)

export default CustomRange
