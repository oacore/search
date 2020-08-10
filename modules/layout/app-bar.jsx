import React from 'react'
import { AppBar, Logo } from '@oacore/design'

import styles from './styles.module.css'

const SearchAppBar = ({ children, className, ...restProps }) => (
  <AppBar id="app-bar" className={styles.appBar} fixed {...restProps}>
    <AppBar.Brand href="/" className={styles.brand}>
      <Logo />
    </AppBar.Brand>
    {children}
  </AppBar>
)

export default SearchAppBar
