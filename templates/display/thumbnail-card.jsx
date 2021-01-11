import React from 'react'
import { Card } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'
import filesize from 'filesize'

import styles from './thumbnail-card.module.css'

// import ShowMore from 'modules/show-more'

const FullTextThumbnail = ({
  data: { title, size: fileSize, type: fileType, id: documentId },
  id,
  src = `//core.ac.uk/image/${documentId}/large`,
  alt = 'Document thumbnail',
  href = `//core.ac.uk/reader/${documentId}`,
  className,
  ...passProps
}) => (
  <Card
    id={id}
    className={classNames.use(styles.container).join(className)}
    {...passProps}
  >
    <a className={styles.imageContainer} href={href} title="Open in full text">
      <img className={styles.image} src={src} alt={alt} />
    </a>

    <a className={styles.captionContainer} href={href}>
      <span className={styles.title}>{title}</span>
      <span className={styles.body}>
        Provided a free {fileType} ({filesize(fileSize)})
      </span>
    </a>
  </Card>
)

//     <ShowMore
//       id={`${id}-repository-detail`}
//       className={styles.thumbnailCardMetadata}
//     >
//
//       <ShowMore.More className={styles.thumbnailCardMetadataShowMore}>
//         <span>oai:link here</span>
//         <span>Downloaded on 30 June 2016</span>
//       </ShowMore.More>
//     </ShowMore>

FullTextThumbnail.displayName = 'Work.Thumbnail'

export default FullTextThumbnail
