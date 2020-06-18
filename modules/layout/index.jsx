import React from 'react'

import styles from './styles.module.css'

const Layout = ({ children }) => (
  <main className={styles.layout}>
    <div className={styles.content}>{children}</div>
  </main>
)

export default Layout
