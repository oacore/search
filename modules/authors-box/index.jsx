import React, { useState } from 'react'
import { Button, Link } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

const AuthorLink = ({ name }) => (
  <Link
    href={`https://core.ac.uk/search/author:(${name})`}
    className={styles.authorLink}
  >
    {name.replace(',', ' ')}
  </Link>
)

const Authors = ({ authors }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  if (authors.length <= 3) {
    return authors.map((author, index) => (
      <>
        <AuthorLink name={author.name} />
        {index < authors.length - 1 ? ', ' : ''}
      </>
    ))
  }

  return (
    <>
      <AuthorLink name={authors[0].name} />,{' '}
      <AuthorLink name={authors[1].name} />,{' '}
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
            <>
              <AuthorLink name={author.name} />,{' '}
            </>
          ))}
        </span>
      </span>
      <AuthorLink name={authors[authors.length - 1].name} />
    </>
  )
}

export default Authors
