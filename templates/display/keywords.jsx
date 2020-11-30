import React from 'react'
import { Icon } from '@oacore/design'

import styles from './styles.module.css'

const Keywords = ({ keywords }) => (
  <div>
    <Icon src="#tag" alt="" className={styles.keywordsIcon} />
    <ul className={styles.keywordsList}>
      {keywords.map((k) => (
        <li key={k}>{k}</li>
      ))}
    </ul>
  </div>
)

export default Keywords
