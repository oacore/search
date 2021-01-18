import React from 'react'
import { LoadingBar } from '@oacore/design'

import Container from './container'
import AppBar from './app-bar'
import styles from './styles.module.css'
import Footer from './footer'

const Layout = ({ children, loading }) => (
  <Container>
    {loading && <LoadingBar fixed />}
    <AppBar />
    <main className={styles.main}>{children}</main>
    <Footer />
  </Container>
)

export default Layout
