import React from 'react'
import classNames from '@oacore/design/lib/utils/class-names'

import styles from './loader.module.css'

// TODO: If we will need to use loader circle component in different
// components - move it to Design library

const Loader = ({ text = '', className = '' }) => (
  <div className={classNames.use(styles.loader).join(className)}>
    <p className={styles.text}>{text}</p>
    <div className={styles.circle} />
  </div>
)

export default Loader
