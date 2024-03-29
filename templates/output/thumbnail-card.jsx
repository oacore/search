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
  doi,
  className,
  tag: Tag = 'a',
  useOtherVersions,
  providerId,
  metadata,
  ...passProps
}) => {
  const downloadPDF = () => {
    const pdfUrl = data.download
    const link = document.createElement('a')
    link.href = pdfUrl
    link.target = '_blank'
    link.rel = 'noopener noreferrer'

    link.addEventListener('click', () => {
      link.remove()
    })

    document.body.appendChild(link)
    link.click()
  }

  return (
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
      {href && (
        <div>
          <div className={styles.buttonContainer}>
            <Button variant="contained" href={href} tag="a">
              Open in the Core reader{' '}
              <Icon src="#open-in-new" className={styles.icon} />
            </Button>
          </div>
          <div className={styles.downloadContainer}>
            <Button
              className={styles.download}
              target="_blank"
              download
              variant="outlined"
              onClick={downloadPDF}
              tag="a"
            >
              Download PDF
            </Button>
          </div>
        </div>
      )}
      {!useOtherVersions && (
        <div className={styles.body} id={`${id}-body`}>
          <CardDropdown
            image={data.dataProviderLogo}
            activeArticle
            dataProviderId={providerId}
            makeVisible
            doi={doi}
            metadata={metadata}
            {...data}
            useExpandButton={false}
          />
        </div>
      )}
    </Card>
  )
}

FullTextThumbnail.displayName = 'Work.Thumbnail'

export default FullTextThumbnail
