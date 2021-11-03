import React from 'react'

import styles from './styles.module.css'

const LoadingBlock = ({ items }) =>
  items.map((item) => (
    <li className={styles.barItemWrapper} key={item}>
      <div aria-busy="true" title="Loading" className={styles.barItem} />
    </li>
  ))

export default LoadingBlock
