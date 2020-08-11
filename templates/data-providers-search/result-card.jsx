import React from 'react'
import { Icon, Link } from '@oacore/design'

import styles from './styles.module.css'

import Search from 'modules/search-layout'

const ResultCard = ({
  repoId,
  title,
  homePage,
  country,
  icon = '#office-building',
  ...restProps
}) => (
  <Search.Result className={styles.resultCard} {...restProps}>
    <span className={styles.resultHeading}>
      <Icon src={icon} aria-hidden />
      <Link
        className={styles.resultTitle}
        target="_blank"
        href={`https://core.ac.uk/search?q=repositories.id:(${repoId})`}
      >
        {title}
      </Link>
    </span>

    <ul className={styles.resultMetadata}>
      <li>
        <Link href={homePage} external>
          {homePage}
        </Link>
      </li>
      <li>{country}</li>
    </ul>
  </Search.Result>
)

export default ResultCard
