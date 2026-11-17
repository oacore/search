import React from 'react'
import { Card } from '@oacore/design/lib/elements'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const numberWithCommas = (num) =>
  num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const MetaBox = ({ className, countMetadata, countFullText }) => (
  <Card className={classNames.use(styles.meta).join(className)}>
    <div className={styles.boxes}>
      <div className={styles.boxItem}>
        <Card.Title className={styles.count}>
          {countFullText ? numberWithCommas(countFullText) : 0}
        </Card.Title>
        <span className={styles.caption}>full texts</span>
      </div>
      <div className={styles.boxItem}>
        <Card.Title className={styles.count}>
          {countMetadata ? numberWithCommas(countMetadata) : 0}
        </Card.Title>
        <span className={styles.caption}>metadata records</span>
      </div>
    </div>
    <div className={styles.updateDate}>Updated in last 30 days.</div>
  </Card>
)

export default MetaBox
