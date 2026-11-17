import React, { useEffect, useState } from 'react'
import { Button, Card, DataProviderLogo } from '@oacore/design/lib/elements'
import classNames from '@oacore/design/lib/utils/class-names'
import { Popover } from '@oacore/design/lib/modules'
import LogRocket from 'logrocket'

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
}: any) => {
  const [logoFetched, setLogoFetched] = useState('')

  // eslint-disable-next-line consistent-return
  const redirectOnClick = () => {
    if (disableRedirect && activeArticle) return null

    window.location.href = href
  }

  const redirectToProviders = () => {
    window.location.href = `//core.ac.uk/data-providers/${dataProviderId}`
  }

  const getLogoLink = () => {
    useEffect(() => {
      async function fetchData() {
        try {
          const link = `https://api.core.ac.uk/data-providers/${dataProviderId}/logo`
          const response = await fetch(link)
          if (response.ok) setLogoFetched(link)
          else {
            LogRocket.captureMessage(
              `Failed to fetch logo. Status: ${response.status}`
            )
          }
        } catch (err: any) {
          console.error(err)
          LogRocket.captureException(err)
        }
      }

      if (dataProviderId) fetchData()
    }, [])

    return logoFetched
  }

  return (
    <>
      <div
        className={classNames
          .use({
            [styles.activeClass]: checkBillingType && !makeVisible,
            [styles['card-item']]: useOtherVersions,
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
          <div className={styles.content}>
            <div
              className={classNames.use(styles['header-wrapper'], {
                [styles['header-wrapper-clickable']]: useExpandButton,
              })}
            >
              {/* eslint-disable-next-line max-len */}
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
              <div
                className={styles['item-wrapper']}
                onClick={redirectToProviders}
              >
                <DataProviderLogo
                  imageSrc={checkBillingType ? getLogoLink() : ''}
                  useDefault
                  alt={title}
                  size="md"
                />
                <div className={styles['inner-wrapper']}>
                  <Card.Title
                    className={classNames.use(styles.title, {
                      [styles['title-colored']]: !activeArticle,
                    })}
                    tag="h3"
                  >
                    {title}
                  </Card.Title>
                </div>
                <img
                  className={styles['redirect-img']}
                  src={redirect}
                  alt="redirect"
                />
              </div>
            </div>
            <Card.Description
              className={classNames.use(styles.subtitle, {
                [styles['oai-title']]: renderOAI,
              })}
              tag="span"
            >
              {outputRedirect && (
                <Button
                  onClick={redirectOnClick}
                  className={styles['action-button']}
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
                  <Button
                    className={styles['action-button']}
                    variant="outlined"
                  >
                    Go to the repository landing page
                  </Button>
                </a>
              ) : (
                <a className={styles.ellipsis} href={`https://doi.org/${doi}`}>
                  <Button
                    className={styles['action-button']}
                    variant="outlined"
                  >
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
                  <Button
                    className={styles['action-button']}
                    variant="outlined"
                  >
                    Download from data provider
                  </Button>
                </a>
              ) : (
                <Popover
                  placement="right"
                  content="We don't have a full text link from this data provider"
                  className={styles.popover}
                >
                  <Button
                    className={styles['disabled-button']}
                    variant="outlined"
                  >
                    Download from data provider
                  </Button>
                </Popover>
              )}
              {renderOAI}
            </Card.Description>
          </div>
        </div>
        {children}
      </div>
    </>
  )
}

export default DropDown
