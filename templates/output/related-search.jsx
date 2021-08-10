import React, { useEffect } from 'react'
import { Icon } from '@oacore/design'

import styles from './styles.module.css'

import { observe, useStore } from 'store'
import Loader from 'modules/loader'
import relatedWords from 'utils/related-words'

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

const RelatedSearches = observe(({ articleId, articleTitle }) => {
  const { similarWorks } = useStore()
  const { similarOutputs, isLoading, error } = similarWorks

  useEffect(() => {
    similarWorks.fetchSimilar(articleId)
  }, [])

  return (
    <>
      {similarOutputs && (
        <>
          <h2>Related searches</h2>
          <div className={styles.relatedSearchesResult}>
            <Icon src="#magnify" className={styles.relatedSearchesIcon} />
            {relatedWords(articleTitle, similarOutputs).map((item) => (
              <>
                {item === 0 ? (
                  <span>No results</span>
                ) : (
                  <>
                    <a
                      href={`//core.ac.uk/search?q=${item}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item}
                    </a>
                    <span className={styles.detachDot} />
                  </>
                )}
              </>
            ))}
          </div>
        </>
      )}
    </>
  )
})
export default RelatedSearches
