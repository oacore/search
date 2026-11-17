import React from 'react'
import { SearchResult } from '@oacore/design'
import { useRouter } from 'next/router'

import styles from './styles.module.css'
import { checkType } from '../../utils/data-providers-transform'

import { formatDate } from 'utils/helpers'
import useDateTimeZone from 'hooks/use-date-time-zone'

const Results = ({ works, searchId }: any) => {
  const timeZone = useDateTimeZone(
    works.map(
      ({ publishedDate }: any) => publishedDate && new Date(publishedDate)
    )
  )

  return works.map(
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
    }: any) => {
      const memberType = checkType(dataProviders?.[0]?.id)
      const fullTextLink = links.find((l: any) => l.type === 'download')?.url
      const metadataLink = links.find((l: any) => l.type === 'display')?.url
      const router = useRouter()

      // eslint-disable-next-line no-nested-ternary
      const publicationDate = publishedDate
        ? formatDate(new Date(publishedDate), { timeZone })
        : yearPublished != null
          ? String(yearPublished)
          : null

      const checkBillingType = () =>
        memberType?.billing_type === 'supporting' ||
        memberType?.billing_type === 'sustaining'

      const generateMetadataLink = (
        baseLink?: any,
        propSearchId?: any,
        propId?: any
      ) => {
        if (!propSearchId) return baseLink

        const pos = router.asPath.indexOf('?')
        const result = router.asPath.slice(pos + 1)

        return `${baseLink}/?t=${propSearchId}-${propId}&search=${result}`
      }

      const modifiedReaderLink = readerLink
        ?.replace(/(https:\/\/)(core\.ac\.uk)/, '$1api.$2')
        .replace('/reader/', '/reader-ui/')

      const renderFullTextLink = ({
        fullTextLink: innerFullTextLink,
        downloadLink: innerDownloadLink,
        modifiedReaderLink: innerModifiedReaderLink,
        searchId: innerSearchId,
        id: innerId,
      }: any) => {
        if (innerFullTextLink) return innerFullTextLink
        if (
          (innerFullTextLink && innerFullTextLink.includes('core')) ||
          (innerDownloadLink && innerDownloadLink.includes('core')) ||
          (innerModifiedReaderLink &&
            innerModifiedReaderLink.includes('api.core'))
        ) {
          return generateMetadataLink(
            innerModifiedReaderLink,
            innerSearchId,
            innerId
          )
        }
        if (innerDownloadLink) return innerDownloadLink
        if (
          innerFullTextLink == null &&
          innerDownloadLink == null &&
          innerModifiedReaderLink == null
        )
          return null
        return null
      }

      const fullTextLinkResolved = renderFullTextLink({
        fullTextLink,
        downloadLink,
        modifiedReaderLink,
        searchId,
        id,
      })

      return (
        <SearchResult
          id={`search-output-${id}`}
          key={`search-result-${id}`}
          variant="outlined"
          className={styles.searchResults}
          useLogo={!!checkBillingType()}
          searchId={searchId}
          renderRedirectLink
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
            fullTextLink: fullTextLinkResolved,
            dataProviders: dataProviders || [],
            isRecommended: memberType?.billing_type === 'sustaining',
          }}
        >
          {abstract}
        </SearchResult>
      )
    }
  )
}

export default Results
