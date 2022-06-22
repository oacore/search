import React from 'react'
import { Card } from '@oacore/design/lib/elements'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const MetaBox = ({ className }) => (
  <Card className={classNames.use(styles.meta).join(className)}>
    <div className={styles.boxes}>
      <div className={styles.boxItem}>
        <h1>9,266</h1>
        <span>full texts</span>
      </div>
      <div className={styles.boxItem}>
        <h1>11,266</h1>
        <span>metadata records</span>
      </div>
    </div>
    <div className={styles.updateDate}>Updated in last 30 days.</div>
  </Card>
)

export default MetaBox
