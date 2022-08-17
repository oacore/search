import React from 'react'
import { SearchResult } from '@oacore/design'

import styles from './styles.module.css'

import { formatDate } from 'utils/helpers'

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
      reader: readerLink,
      download: downloadLink,
      thumbnail_m: thumbnailLink,
      display: displayLink,
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
            thumbnailUrl: thumbnailLink || `//core.ac.uk/image/${id}/medium`,
            metadataLink: displayLink,
            fullTextLink: readerLink || downloadLink,
            dataProviders: dataProviders || [],
          }}
        >
          {abstract}
        </SearchResult>
      )
    }
  )
export default Results
