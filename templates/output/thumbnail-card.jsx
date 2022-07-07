import React from 'react'
import { Card } from '@oacore/design'
import { classNames } from '@oacore/design/lib/utils'
import { Button, Icon } from '@oacore/design/lib/elements'

import styles from './thumbnail-card.module.css'
import CardDropdown from './card-dropdown'

const DISABLED_STATUS = 'disabled'

const FullTextThumbnail = ({
  data,
  id,
  src,
  alt,
  href,
  className,
  tag: Tag = 'a',
  useOtherVersions,
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
    <Tag
      className={styles.image}
      href={href}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
    >
      <img className={styles.image} src={src} alt={alt} />
    </Tag>

    {data.fulltextStatus === DISABLED_STATUS && (
      <Card.Title className={styles.disabled} tag="span">
        Full text removed upon author&apos;s request
      </Card.Title>
    )}
    {useOtherVersions && (
      <div className={styles.buttonContainer}>
        <Button variant="contained" href={href} tag="a">
          Open in the Core reader{' '}
          <Icon src="#open-in-new" className={styles.icon} />
        </Button>
      </div>
    )}
    {!useOtherVersions && (
      <div className={styles.body} id={`${id}-body`}>
        <CardDropdown
          image={data.dataProviderLogo}
          activeArticle
          {...data}
          useExpandButton={false}
        />
      </div>
    )}
  </Card>
)

FullTextThumbnail.displayName = 'Work.Thumbnail'

export default FullTextThumbnail
