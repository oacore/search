import React, { useEffect } from 'react'
import { SearchResult, Icon } from '@oacore/design'

import styles from './styles.module.css'

import { observe, useStore } from 'store'
import formatDate from 'utils/format-date'
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

const SimilarWorks = observe(({ articleId }) => {
  const { similarWorks } = useStore()

  const { similarOutputs, isLoading, error } = similarWorks

  useEffect(() => {
    similarWorks.fetchSimilar(articleId)
  }, [])

  return (
    <>
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
            publishedDate: publicationDate,
            yearPublished,
            links,
          }) => {
            const fullTextLink = links.find((l) => l.type === 'download')?.url
            const metadataLink = links.find((l) => l.type === 'similar')?.url

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
                  publicationDate: publicationDate
                    ? formatDate(new Date(publicationDate))
                    : `${yearPublished}`,
                  dataProvider: [],
                  thumbnailUrl: `//core.ac.uk/image/${id}/medium`,
                  metadataLink,
                  fullTextLink,
                }}
              >
                {abstract}
              </SearchResult>
            )
          }
        )}
    </>
  )
})
export default SimilarWorks
