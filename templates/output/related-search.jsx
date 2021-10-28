import React, { useEffect } from 'react'
import { Icon } from '@oacore/design'

import styles from './styles.module.css'

import { observe, useStore } from 'store'
import relatedWords from 'utils/related-words'

const RelatedSearches = observe(({ articleId, articleTitle }) => {
  const { similarWorks } = useStore()
  const { similarOutputs } = similarWorks

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
              <div key={item} className={styles.detachDot}>
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
                    <span />
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
})
export default RelatedSearches
