import React from 'react'
import { Card } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'
import filesize from 'filesize'

import styles from './thumbnail-card.module.css'

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
    <h2 className={styles.title} id={`${id}-title`}>
      Full text
    </h2>

    <a
      className={styles.image}
      href={href}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
    >
      <img className={styles.image} src={src} alt={alt} />
    </a>

    <p className={styles.body} id={`${id}-body`}>
      <Card.Title className={styles.name} tag="span">
        {title}
      </Card.Title>
      <Card.Description className={styles.description} tag="span">
        Provided a free {fileType} ({filesize(fileSize)})
      </Card.Description>
    </p>
  </Card>
)

FullTextThumbnail.displayName = 'Work.Thumbnail'

export default FullTextThumbnail
