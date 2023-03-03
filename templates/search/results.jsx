import React from 'react'
import { SearchResult } from '@oacore/design'

import styles from './styles.module.css'
import { checkType } from '../../utils/data-providers-transform'

import { formatDate } from 'utils/helpers'

const Results = ({ works }) =>
  works.map(
    ({
      id,
      title,
      links,
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
      const memberType = checkType(dataProviders?.[0].id)
      const fullTextLink = links.find((l) => l.type === 'download')?.url
      const metadataLink = links.find((l) => l.type === 'display')?.url

      const publicationDate = publishedDate
        ? formatDate(new Date(publishedDate))
        : yearPublished !== null && toString(yearPublished)

      const checkBillingType = () =>
        memberType?.billing_type === 'supporting' ||
        memberType?.billing_type === 'sustaining'

      return (
        <SearchResult
          id={`search-output-${id}`}
          key={`search-result-${id}`}
          variant="outlined"
          className={styles.searchResults}
          useLogo={!!checkBillingType()}
          data={{
            id,
            title,
            author: authors,
            publicationVenue: publicationVenue || null,
            publicationDate: publicationDate || null,
            thumbnailUrl: thumbnailLink || `//core.ac.uk/image/${id}/medium`,
            metadataLink: metadataLink || displayLink,
            fullTextLink: fullTextLink || readerLink || downloadLink,
            dataProviders: dataProviders || [],
          }}
        >
          {abstract}
        </SearchResult>
      )
    }
  )
export default Results
