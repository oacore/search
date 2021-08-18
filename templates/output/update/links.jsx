import React from 'react'

import styles from './styles.module.css'

const links = [
  {
    id: 1,
    label: 'A display page URL',
    link: 'https://core.ac.uk/display?/82976757',
  },
  {
    id: 2,
    label: 'A fulltext URL',
    link: 'https://core.ac.uk/download/pdf/82976757.pdf ',
  },
  { id: 3, label: 'The CORE ID Directly', link: '82976757' },
]

const Links = () => (
  <ul className={styles.links}>
    {links.map(({ id, label, link }) => (
      <li className={styles.link} key={id}>
        <span className={styles.label}> {label}</span>
        <span className={styles.linkHref}>{link}</span>
      </li>
    ))}
  </ul>
)

export default Links
