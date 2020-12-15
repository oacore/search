import React from 'react'
import { Icon, Link, MetadataList } from '@oacore/design'

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

    <MetadataList className={styles.resultMetadata}>
      <MetadataList.Item id="data-provider-webpage" label="webpage">
        <Link href={homePage} external icon={false}>
          {homePage}
        </Link>
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
