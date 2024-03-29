import React from 'react'
import { Link } from '@oacore/design/lib'

import styles from './styles.module.css'

const links = [
  {
    id: 1,
    label: 'A outputs page URL',
    link: 'https://core.ac.uk/outputs/82976757',
  },
  {
    id: 2,
    label: 'A fulltext URL',
    link: 'https://core.ac.uk/download/82976757.pdf ',
  },
]

const Links = () => (
  <ul className={styles.links}>
    {links.map(({ id, label, link }) => (
      <li className={styles.link} key={id}>
        <span className={styles.label}> {label}</span>
        <Link href={link} target="blank" className={styles.linkHref}>
          {link}
        </Link>
      </li>
    ))}
  </ul>
)

export default Links
