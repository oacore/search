import React from 'react'

import styles from './styles.module.css'

const Container = ({ children }: any) => (
  <div className={styles.container}>{children}</div>
)

export default Container
