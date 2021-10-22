import React from 'react'
import { SearchResult } from '@oacore/design'

import styles from './styles.module.css'

import formatDate from 'utils/format-date'

const Results = ({ works }) =>
  works.map(
    ({
      id,
      title,
      authors,
      abstract,
      publishedDate,
      yearPublished,
      publisher: publicationVenue,
      dataProviders,
      reader,
      // eslint-disable-next-line camelcase
      thumbnail_m,
      display,
    }) => {
      const publicationDate = publishedDate
        ? formatDate(new Date(publishedDate))
        : yearPublished !== null && toString(yearPublished)

      return (
        <SearchResult
          id={`search-output-${id}`}
          key={`search-result-${id}`}
          variant="outlined"
          className={styles.searchResults}
          data={{
            id,
            title,
            author: authors,
            publicationVenue: publicationVenue || null,
            publicationDate: publicationDate || null,
            thumbnailUrl: thumbnail_m,
            metadataLink: display,
            fullTextLink: reader,
            dataProviders,
          }}
        >
          {abstract}
        </SearchResult>
      )
    }
  )
export default Results
