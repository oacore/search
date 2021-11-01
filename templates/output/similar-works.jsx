import React, { useEffect } from 'react'
import { SearchResult, Icon } from '@oacore/design'

import styles from './styles.module.css'

import { observe, useStore } from 'store'
import { formatDate } from 'utils/helpers'
import Loader from 'modules/loader'

const LoadingError = () => (
  <div className={styles.error}>
    <p className={styles.errorText}>
      Sorry, we are unable to process this request at the moment
    </p>
    <Icon
      src="#emoticon-sad-outline"
      alt="emotion"
      className={styles.errorIcon}
    />
  </div>
)

const SimilarWorks = observe(({ articleId, useOtherVersions }) => {
  const { similarWorks } = useStore()
  const { similarOutputs, isLoading, error } = similarWorks
  const params = useOtherVersions && { resultType: 'work' }

  useEffect(() => {
    similarWorks.fetchSimilar(articleId, params)
  }, [])

  return (
    <section>
      <h2>Similar works</h2>
      {isLoading && <Loader text="Loading suggested articles..." />}
      {error && <LoadingError />}
      {similarOutputs &&
        similarOutputs.map(
          ({
            id,
            title,
            authors,
            abstract,
            publishedDate,
            yearPublished,
            links,
          }) => {
            const downloadLink = links.find((l) => l.type === 'download')?.url
            const readerLink = links.find((l) => l.type === 'reader')?.url
            const metadataLink = links.find((l) => l.type === 'similar')?.url

            const publicationDate = publishedDate
              ? formatDate(new Date(publishedDate))
              : yearPublished !== null && toString(yearPublished)

            return (
              <SearchResult
                key={id}
                variant="outlined"
                id={`similar-output-${id}`}
                className={styles.searchResult}
                data={{
                  id,
                  title,
                  author: authors,
                  publicationDate: publicationDate || null,
                  thumbnailUrl: `//core.ac.uk/image/${id}/medium`,
                  metadataLink,
                  fullTextLink: readerLink || downloadLink,
                  dataProviders: [],
                }}
              >
                {abstract}
              </SearchResult>
            )
          }
        )}
    </section>
  )
})
export default SimilarWorks
