import React from 'react'
import { AppBar, Logo, Button } from '@oacore/design'

import styles from './styles.module.css'

const SearchAppBar = ({ children, className, ...restProps }) => (
  <AppBar id="app-bar" className={styles.appBar} fixed {...restProps}>
    <AppBar.Brand href="/" className={styles.brand}>
      <Logo />
    </AppBar.Brand>
    {children}
    <AppBar.Item tag="nav" className={styles.navigation}>
      <ul className={styles.navigationList}>
        <li>
          <Button
            tag="a"
            href="//core.ac.uk/data/providers"
            className={styles.link}
          >
            Data providers
          </Button>
        </li>
        <li>
          <Button tag="a" href="//core.ac.uk/services" className={styles.link}>
            Services
          </Button>
        </li>
        <li>
          <Button tag="a" href="//core.ac.uk/about" className={styles.link}>
            About
          </Button>
        </li>
      </ul>
    </AppBar.Item>
  </AppBar>
)

export default SearchAppBar
