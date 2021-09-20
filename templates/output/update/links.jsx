import React from 'react'
import { Link } from '@oacore/design/lib'

import styles from './styles.module.css'

const links = [
  {
    id: 1,
    label: 'A display page URL',
    link: 'https://core.ac.uk/display/82976757',
  },
  {
    id: 2,
    label: 'A fulltext URL',
    link: 'https://core.ac.uk/download/pdf/82976757.pdf ',
  },
  { id: 3, label: 'Directly to core ID', link: '82976757' },
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
