import React from 'react'
import { Icon } from '@oacore/design'
import { useStore as useStoreApi } from 'zustand'

import styles from './styles.module.css'

import { observe, useStore } from 'store'
import relatedWords from 'utils/related-words'

const RelatedSearches = observe(({ articleTitle }: any) => {
  const { similarWorks } = useStore()
  const similarOutputs = useStoreApi(
    similarWorks,
    (state: any) => state.similarOutputs
  )

  return (
    <>
      {similarOutputs && (
        <>
          <h2>Related searches</h2>
          <div className={styles['related-searches-result']}>
            <Icon src="#magnify" className={styles['related-searches-icon']} />
            {relatedWords(articleTitle, similarOutputs).map((item: any) => (
              <div key={item} className={styles['detach-dot']}>
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
