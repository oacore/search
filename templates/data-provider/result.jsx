import React from 'react'
import { Link } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

import Authors from 'modules/authors-box'
import Search from 'modules/search-layout'

const Result = ({ id, title, author, publisher, year, abstract }) => (
  <Search.Result className={styles.result}>
    <div className={styles.resultImage}>
      <img alt="thumb" src={`//core.ac.uk/image/${id}/medium`} />
      <span className={styles.freePdf}>Free PDF</span>
    </div>

    <div className={styles.resultContent}>
      <span className={styles.resultTitle}>
        <Link href={`//core.ac.uk/display/${id}`}>{title}</Link>
      </span>
      <span className={styles.resultMetadata}>
        <span className={classNames.use(styles.resultMetadataItem)}>
          <Authors authors={author} />
        </span>
        {Boolean(publisher) && (
          <span className={styles.resultMetadataItem}>{publisher}</span>
        )}
        {Boolean(year) && (
          <span className={styles.resultMetadataItem}>{year}</span>
        )}
      </span>
      <p className={styles.resultAbstract}>{abstract}</p>
    </div>
  </Search.Result>
)

export default Result
