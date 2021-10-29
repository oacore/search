import React from 'react'

import styles from './styles.module.css'
import notFoundSvg from './images/notFound.svg'

const QueryError = ({ query }) => (
  <div className={styles.notFound}>
    <img src={notFoundSvg} alt="No results found" />
    <h2>Sorry, we couldn’t find any results for “{query}”.</h2>
    <p>
      Double check your search request for any spelling errors or try a
      different search term.
    </p>
  </div>
)

export default QueryError
