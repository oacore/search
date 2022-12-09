import React from 'react'
import { Card, Icon, Link } from '@oacore/design/lib/elements'
import classNames from '@oacore/design/lib/utils/class-names'

import styles from './card-dropdown.module.css'
import { checkType } from '../../utils/data-providers-transform'

import { formatDate, getAssetsPath } from 'utils/helpers'
import useCopyToClipboard from 'hooks/use-copy-to-clipboard'
import Notification from 'modules/notification'
import DropDown from 'modules/dropdown'

const httpsValidate = (sourceFulltextUrls) => {
  let url = sourceFulltextUrls
  if (url === null) return sourceFulltextUrls
  if (typeof url === 'object') url = url.join('')
  if (url.match(/http:/gm)) url = url.replace(/http:/, 'https:')
  return url
}

const CardDropdown = ({
  id,
  title,
  oai,
  image,
  updatedDate,
  createdDate,
  sourceFulltextUrls,
  download: coreDownloadUrl,
  href,
  activeArticle = false,
  useExpandButton,
  dataProviderId,
  makeVisible,
}) => {
  const [copyUrlStatus, copyUrl] = useCopyToClipboard(oai)

  const setSubtitleLinkText = () => {
    let text = ''
    if (coreDownloadUrl && coreDownloadUrl.match(/core.ac.uk/gm))
      text = 'Provided a free PDF'
    else if (sourceFulltextUrls) text = 'Provided original full text link'
    else text = 'Full text is not available'
    return text
  }

  const Tag = activeArticle ? Link : 'div'
  const subtitleLinkText = setSubtitleLinkText()
  const sourceFulltextUrlsUpd = httpsValidate(sourceFulltextUrls)
  const ourType = !!checkType(dataProviderId)

  const subtitleText = (
    <Tag
      href={coreDownloadUrl || sourceFulltextUrls}
      className={classNames.use(styles.link, {
        [styles.linkDisabled]: !coreDownloadUrl && !sourceFulltextUrls,
      })}
    >
      {subtitleLinkText}
    </Tag>
  )

  return (
    <DropDown
      imageSrc={image}
      title={title}
      subtitle={subtitleText}
      activeArticle={activeArticle}
      className={!activeArticle && styles.dropdown}
      href={href}
      useExpandButton={useExpandButton}
      ourType={ourType}
      makeVisible={makeVisible}
    >
      <div className={styles.dropdownContent}>
        {oai && (
          <Card.Description
            className={classNames.use(styles.identifier)}
            tag="span"
          >
            <img
              src={getAssetsPath('/static/images/oai.svg')}
              alt="oai"
              className={styles.oaiLogo}
            />
            {oai}
            <Icon
              src="#content-copy"
              className={styles.iconCopy}
              onClick={copyUrl}
            />
            {copyUrlStatus === 'copied' && <Notification text="Copied" />}
          </Card.Description>
        )}
        {(updatedDate || createdDate) && (
          <Card.Description tag="span" className={styles.date}>
            Last time updated on {formatDate(updatedDate || createdDate)}
          </Card.Description>
        )}
        {coreDownloadUrl &&
          coreDownloadUrl.match(/core.ac.uk/gm) &&
          sourceFulltextUrls && (
            <Card.Description className={styles.descriptionLink} tag="span">
              <a
                href={sourceFulltextUrlsUpd}
                aria-labelledby={`${id}-downloaded-from-title`}
                aria-describedby={`${id}-downloaded-from-body`}
                target="_blank"
                rel="noreferrer"
              >
                View original full text link
              </a>
            </Card.Description>
          )}
        {ourType && makeVisible ? (
          <span className={styles.memberHighlight}>
            Provided by our Sustaining member
          </span>
        ) : (
          <></>
        )}
      </div>
    </DropDown>
  )
}

export default CardDropdown
