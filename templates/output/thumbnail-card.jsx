import React from 'react'
import { Card } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'
import filesize from 'filesize'

import styles from './thumbnail-card.module.css'

const DISABLED_STATUS = 'disabled'

const FullTextThumbnail = ({
  data: {
    title,
    size: fileSize,
    type: fileType,
    updatedDate,
    sourceFulltextUrls,
    fulltextStatus,
  },
  id,
  src,
  alt,
  href,
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

    <OutputCard
      tag={fulltextStatus === DISABLED_STATUS ? 'div' : 'a'}
      href={href}
      id={id}
      src={src}
      alt={alt}
      title={title}
      fileType={fileType}
      fileSize={fileSize}
      fulltextStatus={fulltextStatus}
    />

    {(updatedDate || sourceFulltextUrls) && (
      <p className={styles.body}>
        {updatedDate && (
          <Card.Description className={styles.description} tag="span">
            Last time updated on {updatedDate}
          </Card.Description>
        )}
        {sourceFulltextUrls && (
          <Card.Description className={styles.descriptionLink} tag="span">
            <a
              href={sourceFulltextUrls}
              aria-labelledby={`${id}-downloaded-from-title`}
              aria-describedby={`${id}-downloaded-from-body`}
            >
              View original full text link
            </a>
          </Card.Description>
        )}
      </p>
    )}
  </Card>
)

const OutputCard = ({
  tag: Tag = 'a',
  href,
  id,
  src,
  alt,
  title,
  fileType,
  fileSize,
  fulltextStatus,
}) => (
  <Tag
    className={styles.image}
    href={href}
    aria-labelledby={`${id}-title`}
    aria-describedby={`${id}-body`}
  >
    <img className={styles.image} src={src} alt={alt} />

    <p className={styles.body} id={`${id}-body`}>
      {fulltextStatus === DISABLED_STATUS ? (
        <Card.Title className={styles.disabled} tag="span">
          Full text removed upon author&apos;s request
        </Card.Title>
      ) : (
        <>
          <Card.Title className={styles.name} tag="span">
            {title}
          </Card.Title>
          <Card.Description className={styles.description} tag="span">
            Provided a free {fileType} ({filesize(fileSize)})
          </Card.Description>
        </>
      )}
    </p>
  </Tag>
)

FullTextThumbnail.displayName = 'Work.Thumbnail'

export default FullTextThumbnail
