import React, { useMemo, useState } from 'react'
import { Card, Icon, Link } from '@oacore/design/lib/elements'
import classNames from '@oacore/design/lib/utils/class-names'

import styles from './card-dropdown.module.css'
import { checkType } from '../../utils/data-providers-transform'
import { capitalizeFirstLetter } from '../../utils/titleCase'
import fetchOaiResolver from '../../api/oai-resolver'

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

const validateIdentifier = (string) => {
  const regexp = RegExp('(^oai:).+', 'g')

  if (regexp.exec('oai_resolver') !== null) return true

  return regexp.exec(string) !== null
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
}) => {
  const [copyUrlStatus, copyUrl] = useCopyToClipboard(oai)
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)

  const handleMouseEnter = () => {
    setIsTooltipVisible(true)
  }

  const handleMouseLeave = () => {
    setIsTooltipVisible(false)
  }

  async function handleSubmit(e) {
    e.stopPropagation()
    const valueInput = oai
    if (validateIdentifier(valueInput)) {
      try {
        const result = await fetchOaiResolver(valueInput)
        console.log(result, 'resultresult')
        window.location.href = result
      } catch (error) {
        console.error(error)
        alert('erori')
      }
    } else alert('Invalidi.')
  }

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
  const memberType = checkType(dataProviderId)

  const checkBillingType = useMemo(
    () =>
      memberType?.billing_type === 'supporting' ||
      memberType?.billing_type === 'sustaining',
    []
  )

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

  const EllipsisText = (text) =>
    text?.length > 12 ? `${text.substring(0, 12)}...` : text

  const renderOAI = (
    <Card.Description className={classNames.use(styles.identifier)} tag="span">
      <img
        src={getAssetsPath('/static/images/oai.svg')}
        alt="oai"
        className={styles.oaiLogo}
      />
      {/* eslint-disable-next-line max-len */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
      <span
        className={styles.ellipsis}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleSubmit}
      >
        {EllipsisText(oai)}
      </span>
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
      imageSrc={image}
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
            {/* eslint-disable-next-line max-len */}
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events */}
            <span
              className={styles.ellipsis}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onClick={handleSubmit}
            >
              {EllipsisText(oai)}
            </span>
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
        {checkBillingType && makeVisible ? (
          <span className={styles.memberHighlight}>
            Provided by our {capitalizeFirstLetter(memberType?.billing_type)}{' '}
            member
          </span>
        ) : (
          <></>
        )}
      </div>
    </DropDown>
  )
}

export default CardDropdown
