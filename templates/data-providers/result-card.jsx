import React from 'react'
import { Icon, Link as UILink, MetadataList } from '@oacore/design'
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
      <Link href={`/data-providers/${repoId}`} passHref>
        <UILink className={styles.resultTitle}>{title}</UILink>
      </Link>
    </span>

    <MetadataList className={styles.resultMetadata}>
      <MetadataList.Item id="data-provider-webpage" label="webpage">
        <UILink href={homePage} external icon={false}>
          {homePage}
        </UILink>
      </MetadataList.Item>
      {country && (
        <MetadataList.Item id="data-provider-country" label="country">
          {country}
        </MetadataList.Item>
      )}
    </MetadataList>
  </Search.Result>
)

export default ResultCard
