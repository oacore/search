import React from 'react'
import { LoadingBar, Footer } from '@oacore/design'

import Container from './container'
import AppBar from './app-bar'
import styles from './styles.module.css'

const Layout = ({ children, loading, isSearchPage }) => (
  <Container>
    {loading && <LoadingBar fixed />}
    <AppBar className={isSearchPage ? styles.header : null} />
    <main className={styles.main}>{children}</main>
    <Footer />
  </Container>
)

export default Layout
