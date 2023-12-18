import React, { useEffect, useState } from 'react'
import {
  Button,
  Card,
  DataProviderLogo,
  Link,
} from '@oacore/design/lib/elements'
import classNames from '@oacore/design/lib/utils/class-names'
import { Popover } from '@oacore/design/lib/modules'

import redirect from '../../public/static/images/redirect.svg'
import styles from './styles.module.css'
import { capitalizeFirstLetter } from '../../utils/titleCase'

const DropDown = ({
  title,
  renderOAI,
  children,
  className,
  memberType,
  checkBillingType,
  activeArticle = false,
  useExpandButton = true,
  href,
  makeVisible,
  dataProviderId,
  disableRedirect,
  outputRedirect,
  metadata,
  coreDownloadUrl,
  sourceFulltextUrls,
  sourceFulltextUrlsUpd,
  id,
  oai,
  doi,
  useOtherVersions,
}) => {
  const [logoFetched, setLogoFetched] = useState('')

  const Tag = href ? Link : 'div'

  // eslint-disable-next-line consistent-return
  const redirectOnClick = () => {
    if (disableRedirect && activeArticle) return null

    window.location.href = href
  }

  const redirectToProviders = () => {
    window.location.href = metadata.hrefDataProvider
  }

  const getLogoLink = () => {
    useEffect(() => {
      async function fetchData() {
        try {
          const link = `https://api.core.ac.uk/data-providers/${dataProviderId}/logo`
          const response = await fetch(link)
          if (response.ok) setLogoFetched(link)
        } catch (err) {
          // eslint-disable-next-line no-console
          console.log(err)
        }
      }

      fetchData()
    }, [])

    return logoFetched
  }

  return (
    <>
      <div
        className={classNames
          .use({
            [styles.activeClass]: checkBillingType && !makeVisible,
            [styles.cardItem]: useOtherVersions,
          })
          .join(className)}
      >
        {checkBillingType && !makeVisible ? (
          <div className={styles.placement}>
            <a
              href="https://core.ac.uk/membership"
              className={styles.memberType}
            >
              {capitalizeFirstLetter(memberType?.billing_type)} member
            </a>
          </div>
        ) : (
          <></>
        )}
        <div className={styles.header}>
          <Tag className={styles.content}>
            <div
              className={classNames.use(styles.headerWrapper, {
                [styles.headerWrapperClickable]: useExpandButton,
              })}
            >
              {/* eslint-disable-next-line max-len */}
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
              <div className={styles.itemWrapper} onClick={redirectToProviders}>
                <DataProviderLogo
                  imageSrc={checkBillingType ? getLogoLink() : ''}
                  useDefault
                  alt={title}
                  size="md"
                />
                <div className={styles.innerWrapper}>
                  <Card.Title
                    className={classNames.use(styles.title, {
                      [styles.titleColored]: !activeArticle,
                    })}
                    tag="h3"
                  >
                    {title}
                  </Card.Title>
                </div>
                <img
                  className={styles.redirectImg}
                  src={redirect}
                  alt="redirect"
                />
              </div>
            </div>
            <Card.Description
              className={classNames.use(styles.subtitle, {
                [styles.oaiTitle]: renderOAI,
              })}
              tag="span"
            >
              {outputRedirect && (
                <Button
                  onClick={redirectOnClick}
                  className={styles.actionButton}
                  variant="outlined"
                >
                  See this paper in CORE
                </Button>
              )}
              {oai ? (
                <a
                  className={styles.ellipsis}
                  href={`https://api.core.ac.uk/oai/${oai}`}
                >
                  <Button className={styles.actionButton} variant="outlined">
                    Go to the repository landing page
                  </Button>
                </a>
              ) : (
                <a className={styles.ellipsis} href={`https://doi.org/${doi}`}>
                  <Button className={styles.actionButton} variant="outlined">
                    Go to the repository landing page
                  </Button>
                </a>
              )}
              {coreDownloadUrl &&
              coreDownloadUrl.match(/core.ac.uk/gm) &&
              sourceFulltextUrls ? (
                <a
                  href={sourceFulltextUrlsUpd}
                  aria-labelledby={`${id}-downloaded-from-title`}
                  aria-describedby={`${id}-downloaded-from-body`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button className={styles.actionButton} variant="outlined">
                    Download from data provider
                  </Button>
                </a>
              ) : (
                <Popover
                  placement="right"
                  content="We don't have a full text link from this data provider"
                  className={styles.popover}
                >
                  <Button className={styles.disabledButton} variant="outlined">
                    Download from data provider
                  </Button>
                </Popover>
              )}
              {renderOAI}
            </Card.Description>
          </Tag>
        </div>
        {children}
      </div>
    </>
  )
}

export default DropDown
