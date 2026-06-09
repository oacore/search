import React from 'react'
import { Footer, LoadingBar } from '@oacore/design'

import Container from './container'
import AppBar from './app-bar'
import MaintenanceBanner from './maintenance-banner'
import styles from './styles.module.css'

const Layout = ({ children, loading, isSearchPage }) => (
  <Container>
    {loading && <LoadingBar fixed />}
    {/* TODO temp baner when we are doing some maintenance */}
    <div className={styles.stickyTop}>
      <AppBar className={isSearchPage ? styles.header : null} />
      <MaintenanceBanner />
    </div>
    <main className={styles.main}>{children}</main>
    <Footer />
  </Container>
)

export default Layout
