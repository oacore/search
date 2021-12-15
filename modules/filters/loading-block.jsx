import React from 'react'
import { ProgressSpinner } from '@oacore/design/lib/elements'
import classNames from '@oacore/design/lib/utils/class-names'

import styles from './styles.module.css'

const LoadingBlock = () => (
  <div className={classNames.use(styles.filterBoxItem, styles.loadingBox)}>
    <ProgressSpinner />
    <span>Loading</span>
  </div>
)

export default LoadingBlock
