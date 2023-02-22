import React, { useState } from 'react'
import {
  Button,
  Card,
  Icon,
  Link,
  DataProviderLogo,
} from '@oacore/design/lib/elements'
import classNames from '@oacore/design/lib/utils/class-names'

import styles from './styles.module.css'
import { capitalizeFirstLetter } from '../../utils/titleCase'

const DropDown = ({
  title,
  subtitle,
  renderOAI,
  imageSrc,
  children,
  className,
  memberType,
  checkBillingType,
  activeArticle = false,
  useExpandButton = true,
  href,
  makeVisible,
}) => {
  const [activeDropdown, setActiveDropdown] = useState(!useExpandButton)

  const onToggleDropdown = () => {
    setActiveDropdown(!activeDropdown)
  }

  const Tag = href ? Link : 'div'

  const redirectOnClick = () => {
    window.location.href = href
  }

  return (
    <>
      {checkBillingType && !makeVisible ? (
        <div className={styles.placement}>
          <span className={styles.memberType}>
            {capitalizeFirstLetter(memberType?.billing_type)} member
          </span>
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
          <DataProviderLogo
            imageSrc={checkBillingType ? imageSrc : ''}
            useDefault
            alt={title}
            size="md"
          />
          <Tag className={styles.content} onClick={redirectOnClick}>
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
            <Card.Description className={styles.subtitle} tag="span">
              {renderOAI}
            </Card.Description>
          </Tag>

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
        {activeDropdown && children}
      </div>
    </>
  )
}

export default DropDown
