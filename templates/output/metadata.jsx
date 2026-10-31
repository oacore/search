import React from 'react'
import { ExpandableList, MetadataList } from '@oacore/design'

import styles from './styles.module.css'

import { formatDate } from 'utils/helpers'
import useDateTimeZone from 'hooks/use-date-time-zone'

const PUBLICATION_DATE = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}

const Metadata = ({
  authors,
  publisher,
  publishedDate,
  doi,
  uniqueDoiArray,
}) => {
  const timeZone = useDateTimeZone([publishedDate], PUBLICATION_DATE)

  return (
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
                href={`https://core.ac.uk/search?q=authors:(${name})`}
                className={styles.authorLink}
              >
                {(name || '').replace(/([^,]*),\s(.*)/, '$2 $1')}
              </a>
            </ExpandableList.Item>
          ))}
        </ExpandableList>
      </MetadataList.Item>
      <MetadataList.Item
        id="metadata-publication-date"
        label="Publication date"
      >
        {formatDate(publishedDate, { ...PUBLICATION_DATE, timeZone })}
      </MetadataList.Item>

      <MetadataList.Item id="metadata-publisher" label="Publisher">
        {publisher}
      </MetadataList.Item>
      {doi && (
        <MetadataList.Item id="doi" label="Doi">
          <ExpandableList>
            {uniqueDoiArray.map((doiItem) => (
              <ExpandableList.Item
                key={doiItem}
                id="doi"
                itemProp="doi"
                itemScope=""
                itemType="doi"
              >
                {doiItem && `DOI: ${doiItem.toUpperCase()}`}
              </ExpandableList.Item>
            ))}
          </ExpandableList>
        </MetadataList.Item>
      )}
    </MetadataList>
  )
}

export default Metadata
