import React from 'react'

import Container from './container'
import AppBar from './app-bar'
import styles from './styles.module.css'
import Footer from './footer'

const Layout = ({ children }) => (
  <Container>
    <AppBar />
    <main className={styles.main}>{children}</main>
    <Footer />
  </Container>
)

export default Layout
