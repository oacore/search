import React from 'react'
import { SearchResult } from '@oacore/design'

import styles from './styles.module.css'

const SimilarWorks = ({ data }) => (
  <>
    <h2>Similar works</h2>
    <div>
      {data.map(
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
          const metadataLink = links.find((l) => l.type === 'display')?.url

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
                publicationDate: publicationDate || yearPublished,
                dataProvider: {},
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
    </div>
  </>
)

export default SimilarWorks
