import React, { useRef, useState, useReducer } from 'react'
import { classNames } from '@oacore/design/lib/utils'
import filesize from 'filesize'
import { Icon, Button, Card, Popover } from '@oacore/design'

import styles from './thumbnail-card.module.css'

import formatDate from 'utils/format-date'

const DISABLED_STATUS = 'disabled'

const initialTooltipState = {
  isTooltipShown: false,
  tooltipText: 'Copy OAI to your clipboard',
}

const tooltipReducer = (state, action) => {
  switch (action) {
    case 'hide':
      return initialTooltipState
    case 'copied':
      return { ...state, tooltipText: 'Copied!' }
    case 'show':
      return { ...initialTooltipState, isTooltipShown: true }
    default:
      throw new Error('Received unknown action in tooltipReducer')
  }
}

const FullTextThumbnail = ({
  data: {
    title,
    size: fileSize,
    type: fileType,
    identifiers,
    createdDate,
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
}) => {
  const textRef = useRef(null)
  const [copySuccess, setCopySuccess] = useState('')

  // const value = useContext(MyContext)

  const [{ tooltipText, isTooltipShown }, dispatchTooltip] = useReducer(
    tooltipReducer,
    initialTooltipState
  )

  const copyToClipboard = () => {
    if (
      !document.queryCommandSupported &&
      !document.queryCommandSupported('copy')
    )
      return

    const copyText = textRef.current.textContent

    navigator.clipboard.writeText(copyText).then(
      () => {
        // eslint-disable-next-line no-console
        console.log(`Copying to clipboard: ${copyText}`)
        setCopySuccess(true)
      },
      (err) => {
        console.error('Async: Could not copy text: ', err)
      }
    )
  }

  let lastTimeUpdated = null
  if (createdDate) lastTimeUpdated = createdDate
  if (updatedDate) lastTimeUpdated = updatedDate

  let oaiArray = []
  if (identifiers && identifiers.oai) oaiArray = identifiers.oai.split(':')

  return (
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

      {(identifiers || lastTimeUpdated || sourceFulltextUrls) && (
        <div className={styles.body}>
          {oaiArray.length === 3 && (
            <Card.Description className={styles.descriptionLink} tag="span">
              <span ref={textRef} className={styles.hidden}>
                {oaiArray[2]}
              </span>
              {oaiArray[0]}
              <span className={styles.detach}>:</span>
              {oaiArray[1]}
              <span className={styles.detach}>:</span>
              {oaiArray[2]}
              <Popover
                placement="top"
                content={tooltipText}
                visible={isTooltipShown}
                className={styles.popover}
              >
                <Button
                  type="button"
                  className={
                    copySuccess ? styles.copyButtonSuccess : styles.copyButton
                  }
                  onClick={copyToClipboard}
                  onMouseEnter={() => dispatchTooltip('show')}
                  onMouseLeave={() => dispatchTooltip('hide')}
                >
                  <Icon src="#content-copy" />
                </Button>
              </Popover>
            </Card.Description>
          )}

          {lastTimeUpdated && (
            <Card.Description className={styles.descriptionDate} tag="span">
              Last time updated on{' '}
              {formatDate(new Date(lastTimeUpdated), {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Card.Description>
          )}

          {sourceFulltextUrls && (
            <Card.Description className={styles.description} tag="span">
              <a
                href={sourceFulltextUrls}
                aria-labelledby={`${id}-downloaded-from-title`}
                aria-describedby={`${id}-downloaded-from-body`}
              >
                View original full text link
              </a>
            </Card.Description>
          )}
        </div>
      )}
    </Card>
  )
}

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
