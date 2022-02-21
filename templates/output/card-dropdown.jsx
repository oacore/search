import React from 'react'
import { Card, Icon, Link } from '@oacore/design/lib/elements'
import classNames from '@oacore/design/lib/utils/class-names'

import styles from './card-dropdown.module.css'

import { formatDate } from 'utils/helpers'
import useCopyToClipboard from 'hooks/use-copy-to-clipboard'
import Notification from 'modules/notification'
import DropDown from 'modules/dropdown'

const CardDropdown = ({
  id,
  title,
  oai,
  updatedDate,
  createdDate,
  sourceFulltextUrls,
  download: coreDownloadUrl,
  href,
  activeArticle = false,
  defaultDropdownState,
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
      title={title}
      subtitle={subtitleText}
      activeArticle={activeArticle}
      className={!activeArticle && styles.dropdown}
      href={href}
      defaultDropdownState={defaultDropdownState}
    >
      <div className={styles.dropdownContent}>
        {oai && (
          <Card.Description
            className={classNames.use(styles.identifier)}
            tag="span"
          >
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
              <Link href={sourceFulltextUrls} external icon={false}>
                View original full text link
              </Link>
            </Card.Description>
          )}
      </div>
    </DropDown>
  )
}

export default CardDropdown
