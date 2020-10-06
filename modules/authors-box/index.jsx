import React, { useState } from 'react'
import { Button, Link } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const Authors = ({ authors }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  if (authors.length <= 3) {
    return authors.map((author, index) => (
      <>
        <Link
          href={`https://core.ac.uk/search?q=author:(${author.name})`}
          className={styles.authorLink}
        >
          {author.name}
        </Link>
        {index < authors.length - 1 ? ',' : ''}
      </>
    ))
  }

  return (
    <>
      <Link
        href={`https://core.ac.uk/search?q=author:(${authors[0].name})`}
        className={styles.authorLink}
      >
        {authors[0].name.replace(',', ' ')}
      </Link>
      <Link
        href={`https://core.ac.uk/search?q=author:(${authors[1].name})`}
        className={styles.authorLink}
      >
        {authors[1].name.replace(',', ' ')}
      </Link>
      ,
      <span
        className={classNames.use(
          styles.moreAuthorsBox,
          isExpanded && styles.moreAuthorsExpanded
        )}
      >
        <Button
          className={styles.showMore}
          aria-controls="more-authors"
          onClick={() => setIsExpanded(true)}
          aria-hidden={isExpanded}
          title="Show more authors"
        >
          + {authors.length - 3} MORE
        </Button>
        <span
          id="more-authors"
          aria-hidden={!isExpanded}
          className={styles.moreAuthors}
        >
          {authors.slice(2, -1).map((author) => (
            <Link
              href={`https://core.ac.uk/search?q=author:(${author.name})`}
              className={styles.authorLink}
            >
              {author.name.replace(',', ' ')}
            </Link>
          ))}
        </span>
      </span>
      <Link
        href={`https://core.ac.uk/search?q=author:(${
          authors[authors.length - 1].name
        })`}
        className={styles.authorLink}
      >
        {authors[authors.length - 1].name.replace(',', ' ')},
      </Link>
    </>
  )
}

export default Authors
