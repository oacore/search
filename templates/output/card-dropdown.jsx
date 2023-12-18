import React, { useMemo, useState } from 'react'
import { Card, Icon, Link } from '@oacore/design/lib/elements'
import classNames from '@oacore/design/lib/utils/class-names'

import styles from './card-dropdown.module.css'
import { checkType } from '../../utils/data-providers-transform'
import { capitalizeFirstLetter } from '../../utils/titleCase'

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
  worksOai,
  outputRedirect,
  metadata,
  doi,
  useOtherVersions,
}) => {
  const [copyUrlStatus, copyUrl] = useCopyToClipboard(oai)
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)

  const handleMouseEnter = () => {
    setIsTooltipVisible(true)
  }

  const handleMouseLeave = () => {
    setIsTooltipVisible(false)
  }

  const setSubtitleLinkText = () => {
    let text = ''
    if (coreDownloadUrl && coreDownloadUrl.match(/core.ac.uk/gm))
      text = 'Provided a free PDF'
    else if (sourceFulltextUrls && sourceFulltextUrls.length > 0)
      text = 'Provided original full text link'
    else text = 'Full text is not available'
    return text
  }

  const Tag = activeArticle ? Link : 'div'
  const subtitleLinkText = setSubtitleLinkText()
  const sourceFulltextUrlsUpd = httpsValidate(sourceFulltextUrls)
  const memberType = checkType(dataProviderId)

  const checkBillingType = useMemo(
    () =>
      memberType?.billing_type === 'supporting' ||
      memberType?.billing_type === 'sustaining',
    []
  )

  const subtitleText =
    coreDownloadUrl?.length > 0 || sourceFulltextUrls.length > 0 ? (
      <Tag
        href={coreDownloadUrl || sourceFulltextUrls || '#'}
        className={classNames.use(styles.link, {
          [styles.linkDisabled]: !coreDownloadUrl && !sourceFulltextUrls,
        })}
      >
        {subtitleLinkText}
      </Tag>
    ) : (
      subtitleLinkText
    )

  const EllipsisText = (text) =>
    text?.length > 22 ? `${text.substring(0, 22)}...` : text

  const renderOAI = (
    <Card.Description className={classNames.use(styles.identifier)} tag="span">
      <img
        src={getAssetsPath('/static/images/oai.svg')}
        alt="oai"
        className={styles.logo}
      />
      <a
        className={styles.ellipsis}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        href={`https://api.core.ac.uk/oai/${oai}`}
      >
        {EllipsisText(oai)}
      </a>
      {isTooltipVisible && <div className={styles.tooltip}>{oai}</div>}
      <Icon
        src="#content-copy"
        className={styles.iconCopy}
        onClick={(e) => {
          e.stopPropagation()
          copyUrl()
        }}
      />
      {copyUrlStatus === 'copied' && <Notification text="Copied" />}
    </Card.Description>
  )

  return (
    <DropDown
      disableRedirect
      imageSrc={image}
      dataProviderId={dataProviderId}
      title={title}
      subtitle={subtitleText}
      renderOAI={worksOai && oai && renderOAI}
      activeArticle={activeArticle}
      className={!activeArticle && !makeVisible && styles.dropdown}
      href={href}
      useExpandButton={useExpandButton}
      memberType={memberType}
      checkBillingType={checkBillingType}
      makeVisible={makeVisible}
      outputRedirect={outputRedirect}
      metadata={metadata}
      coreDownloadUrl={coreDownloadUrl}
      sourceFulltextUrls={sourceFulltextUrls}
      sourceFulltextUrlsUpd={sourceFulltextUrlsUpd}
      id={id}
      oai={oai}
      doi={doi}
      useOtherVersions={useOtherVersions}
    >
      <div className={styles.dropdownContent}>
        {!worksOai && oai && (
          <Card.Description
            className={classNames.use(styles.identifier)}
            tag="span"
          >
            <img
              src={getAssetsPath('/static/images/oai.svg')}
              alt="oai"
              className={styles.oaiLogo}
            />
            <a
              className={styles.ellipsis}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              href={`https://api.core.ac.uk/oai/${oai}`}
            >
              {EllipsisText(oai)}
            </a>
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
        {checkBillingType && makeVisible ? (
          <a
            href="https://core.ac.uk/membership"
            className={styles.memberHighlight}
          >
            Provided by our {capitalizeFirstLetter(memberType?.billing_type)}{' '}
            member
          </a>
        ) : (
          <></>
        )}
      </div>
    </DropDown>
  )
}

export default CardDropdown
