import React from 'react'
import { SearchResult } from '@oacore/design'

import styles from './styles.module.css'

const SimilarWorks = () => {
  const placeholders = Array.from(Array(5).keys())

  return (
    <>
      <h2>Similar works</h2>
      <div>
        {placeholders.map((key) => (
          <SearchResult
            id={`example-${key}`}
            key={key}
            className={styles.searchResult}
            data={{
              title:
                'Towards effective research recommender systems for repositories',
              author: [
                { name: 'Petr Knoth' },
                { name: 'Lucas Anastasiou' },
                { name: 'Aristotelis Charalampous' },
                { name: 'Matteo Cancellieri' },
                { name: 'Samuel Pearce' },
                { name: 'Nancy Pontika' },
                { name: 'Vaclav Bayer' },
              ],
              publicationDate: '2017',
              fieldOfStudy: 'Computer science',
              thumbnailUrl: '//core.ac.uk/image/82984538/medium',
              metadataLink: '//core.ac.uk/display/82984538',
              fullTextLink: '//core.ac.uk/reader/82984538',
            }}
          >
            In this paper, we argue why and how the integration of recommender
            systems for research can enhance the functionality and user
            experience in repositories. We present the latest technical
            innovations in the CORE Recommender, which provides research article
            recommendations across the global network of repositories and
            journals. The CORE Recommender has been recently redeveloped and
            released into production in the CORE system and has also been
            deployed in several third-party repositories. We explain the design
            choices of this unique system and the evaluation processes we have
            in place to continue raising the quality of the provided
            recommendations. By drawing on our experience, we discuss the main
            challenges in offering a state-of-the-art recommender solution for
            repositories. We highlight two of the key limitations of the current
            repository infrastructure with respect to developing research
            recommender systems: 1) the lack of a standardised protocol and
            capabilities for exposing anonymised user-interaction logs, which
            represent critically important input data for recommender systems
            based on collaborative filtering and 2) the lack of a voluntary
            global sign-on capability in repositories, which would enable the
            creation of personalised recommendation and notification solutions
            based on past user interactions
          </SearchResult>
        ))}
      </div>
    </>
  )
}

export default SimilarWorks
