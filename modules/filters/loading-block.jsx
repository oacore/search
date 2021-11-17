import { Icon } from '@oacore/design/lib/elements'
import classNames from '@oacore/design/lib/utils/class-names'
import React from 'react'

import styles from './styles.module.css'

const FILTERS_LABELS = [
  'Field',
  'Year',
  'Type',
  'Author',
  'Language',
  'Publisher',
]

const LoadingBlock = () => (
  <div className={styles.loadingBlock}>
    {FILTERS_LABELS.map((item) => (
      <li className={styles.barItemWrapper} key={item}>
        <div className={classNames.use(styles.barItem, styles.barItemLoading)}>
          <p>{item}</p>
          <Icon className={styles.barItemIcon} src="#menu-down" />
        </div>
      </li>
    ))}
  </div>
)

export default LoadingBlock
