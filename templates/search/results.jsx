import React from 'react'
import { SearchResult } from '@oacore/design'

import styles from './styles.module.css'
import { checkType } from '../../utils/data-providers-transform'

import { formatDate } from 'utils/helpers'

const Results = ({ works, searchId }) =>
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

      const generateMetadataLink = (baseLink, propSearchId, propId) =>
        `${baseLink}/?t=${propSearchId}-${propId}`

      const modifiedReaderLink = readerLink
        ?.replace(/(https:\/\/)(core\.ac\.uk)/, '$1api.$2')
        .replace('/reader/', '/reader-ui/')

      const renderFullTextLink = ({
        fullTextLink,
        downloadLink,
        modifiedReaderLink,
        searchId,
        id,
      }) => {
        if (
          fullTextLink == null &&
          downloadLink == null &&
          modifiedReaderLink == null
        )
          return null
        if (
          (fullTextLink && fullTextLink.includes('core')) ||
          (downloadLink && downloadLink.includes('core')) ||
          (modifiedReaderLink && modifiedReaderLink.includes('api.core'))
        )
          return generateMetadataLink(modifiedReaderLink, searchId, id)
        if (downloadLink) return downloadLink
        return fullTextLink
      }

      return (
        <SearchResult
          id={`search-output-${id}`}
          key={`search-result-${id}`}
          variant="outlined"
          className={styles.searchResults}
          useLogo={!!checkBillingType()}
          searchId={searchId}
          data={{
            workId: id,
            title,
            author: authors,
            publicationVenue: publicationVenue || null,
            publicationDate: publicationDate || null,
            thumbnailUrl: thumbnailLink || `//core.ac.uk/image/${id}/medium`,
            metadataLink:
              generateMetadataLink(metadataLink, searchId, id) ||
              generateMetadataLink(displayLink, searchId, id),
            fullTextLink: renderFullTextLink({
              fullTextLink,
              downloadLink,
              modifiedReaderLink,
              searchId,
              id,
            }),
            dataProviders: dataProviders || [],
            isRecommended: memberType?.billing_type === 'sustaining',
          }}
        >
          {abstract}
        </SearchResult>
      )
    }
  )
export default Results
