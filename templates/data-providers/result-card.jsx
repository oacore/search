import React from 'react'
import { Icon, Link as UILink } from '@oacore/design'
import Link from 'next/link'

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
        as={`/data-providers/${repoId}`}
        href="/data-providers/[data-provider-id]"
        passHref
      >
        <UILink className={styles.resultTitle}>{title}</UILink>
      </Link>
    </span>

    <ul className={styles.resultMetadata}>
      <li>
        <UILink href={homePage} external icon={false}>
          {homePage}
        </UILink>
      </li>
      <li>{country}</li>
    </ul>
  </Search.Result>
)

export default ResultCard
