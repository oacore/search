import React from 'react'
import { AppBar, Logo } from '@oacore/design'

import styles from './styles.module.css'

const SearchAppBar = ({ children, className, ...restProps }) => (
  <AppBar className={styles.appBar} fixed {...restProps}>
    <AppBar.Brand href="/">
      <Logo />
    </AppBar.Brand>
    {children}
  </AppBar>
)

export default SearchAppBar
