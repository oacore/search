import React from 'react'

import Container from './container'
import AppBar from './app-bar'
import styles from './styles.module.css'

const Layout = ({ children }) => (
  <Container>
    <AppBar />
    <main className={styles.main}>{children}</main>
  </Container>
)

export default Layout
