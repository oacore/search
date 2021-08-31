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
      publishedDate: publicationDate,
      yearPublished,
      publisher: publicationVenue,
      dataProviders,
      outputs,
    }) => {
      const outputId = outputs[0].match(/(?<=outputs\/).[0-9]+/).join('')

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
            publicationVenue,
            publicationDate: publicationDate
              ? formatDate(new Date(publicationDate))
              : toString(yearPublished),
            thumbnailUrl: `//core.ac.uk/image/${outputId}/medium`,
            metadataLink: `//core.ac.uk/display/${outputId}`,
            fullTextLink: `//core.ac.uk/reader/${outputId}`,
            dataProviders,
          }}
        >
          {abstract}
        </SearchResult>
      )
    }
  )
export default Results
