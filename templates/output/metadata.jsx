import React from 'react'
import { MetadataList, ExpandableList } from '@oacore/design'

import styles from './styles.module.css'

import { formatDate } from 'utils/helpers'

const Metadata = ({ authors, publisher, publishedDate }) => (
  <MetadataList className={styles.metadata}>
    <MetadataList.Item id="metadata-authors" label="Authors">
      <ExpandableList>
        {authors.map(({ name }) => (
          <ExpandableList.Item
            key={name}
            id="author"
            itemProp="author"
            itemScope=""
            itemType="https://schema.org/Person"
          >
            <a
              href={`https://core.ac.uk/search/authors:(${name})`}
              className={styles.authorLink}
            >
              {(name || '').replace(/([^,]*),\s(.*)/, '$2 $1')}
            </a>
          </ExpandableList.Item>
        ))}
      </ExpandableList>
    </MetadataList.Item>
    <MetadataList.Item id="metadata-publication-date" label="Publication date">
      {formatDate(publishedDate, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}
    </MetadataList.Item>

    <MetadataList.Item id="metadata-publisher" label="Publisher">
      {publisher}
    </MetadataList.Item>
  </MetadataList>
)

export default Metadata
