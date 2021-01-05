import React from 'react'
import { Card } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'

import styles from './styles.module.css'

import ShowMore from 'modules/show-more'

const FullTextThumbnail = ({
  data: { id, repository, repositoryDocument },
  ...passProps
}) => (
  <Card
    className={classNames.use(styles.card, styles.thumbnailCard)}
    {...passProps}
  >
    <a href={`//core.ac.uk/reader/${id}`} title="Open in CORE Reader">
      <img src={`//core.ac.uk/image/${id}/large`} alt="" />
    </a>
    <ShowMore id="repository-detail" className={styles.thumbnailCardMetadata}>
      <span className={styles.repositoryName}>{repository.name}</span>
      {repositoryDocument.pdfSize && (
        <span>
          Provided a free PDF (
          {(repositoryDocument.pdfSize / 1000000).toFixed(3)} MB)
        </span>
      )}
      <ShowMore.More className={styles.thumbnailCardMetadataShowMore}>
        <span>oai:link here</span>
        <span>Downloaded on 30 June 2016</span>
      </ShowMore.More>
    </ShowMore>
  </Card>
)

FullTextThumbnail.displayName = 'Work.Thumbnail'

export default FullTextThumbnail
