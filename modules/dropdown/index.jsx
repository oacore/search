import React, { useEffect, useState } from 'react'
import {
  Button,
  Card,
  DataProviderLogo,
  Icon,
  Link,
} from '@oacore/design/lib/elements'
import classNames from '@oacore/design/lib/utils/class-names'

import styles from './styles.module.css'
import { capitalizeFirstLetter } from '../../utils/titleCase'

const DropDown = ({
  title,
  subtitle,
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
}) => {
  const [activeDropdown, setActiveDropdown] = useState(!useExpandButton)
  const [logoFetched, setLogoFetched] = useState('')

  const onToggleDropdown = (e) => {
    e.stopPropagation()
    setActiveDropdown(!activeDropdown)
  }

  const Tag = href ? Link : 'div'

  // eslint-disable-next-line consistent-return
  const redirectOnClick = () => {
    if (disableRedirect && activeArticle) return null

    window.location.href = href
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
      {checkBillingType && !makeVisible ? (
        <div className={styles.placement}>
          <a href="/membership" className={styles.memberType}>
            {capitalizeFirstLetter(memberType?.billing_type)} member
          </a>
        </div>
      ) : (
        <></>
      )}
      <div
        className={classNames
          .use(styles.dropdown, {
            [styles.activeClass]: checkBillingType && !makeVisible,
          })
          .join(className)}
      >
        <div className={styles.header}>
          <Tag className={styles.content} onClick={redirectOnClick}>
            <div
              className={classNames.use(styles.headerWrapper, {
                [styles.headerWrapperClickable]: useExpandButton,
              })}
            >
              <div className={styles.itemWrapper}>
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
                  <Card.Description className={styles.subtitle} tag="span">
                    {subtitle}
                  </Card.Description>
                </div>
              </div>
              {useExpandButton && (
                <Button type="button" onClick={onToggleDropdown}>
                  <Icon
                    src="#menu-down"
                    className={classNames.use(styles.iconMenu, {
                      [styles.iconMenuActive]: activeDropdown,
                    })}
                  />
                </Button>
              )}
            </div>
            <Card.Description
              className={classNames.use(styles.subtitle, {
                [styles.oaiTitle]: renderOAI,
              })}
              tag="span"
            >
              {renderOAI}
            </Card.Description>
          </Tag>
        </div>
        {activeDropdown && children}
      </div>
    </>
  )
}

export default DropDown
