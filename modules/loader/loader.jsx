import React from 'react'

import styles from './loader.module.css'

// TODO: If we will need to use loader circle component in different
// components - move it to Design library

const Loader = ({ text }) => (
  <div className={styles.loader}>
    <p className={styles.text}>{text}</p>
    <div className={styles.circle} />
  </div>
)

export default Loader
