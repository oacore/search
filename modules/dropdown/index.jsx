import React, { useState } from 'react'
import { Button, Card, Icon, Link } from '@oacore/design/lib/elements'
import classNames from '@oacore/design/lib/utils/class-names'

import styles from './styles.module.css'

const DropDown = ({
  title,
  subtitle,
  children,
  className,
  activeArticle = false,
  defaultDropdownState = false,
  href,
}) => {
  const [activeDropdown, setActiveDropdown] = useState(defaultDropdownState)

  const onToggleDropdown = () => {
    setActiveDropdown(!activeDropdown)
  }

  const Tag = href ? Link : 'div'

  return (
    <div className={classNames.use(styles.dropdown).join(className)}>
      <div className={styles.header}>
        <div
          className={classNames.use(styles.circle, {
            [styles.circleActive]: activeArticle,
          })}
        >
          <Icon src="#office-building" className={styles.iconMenuBuilding} />
        </div>
        <Tag className={styles.content} href={href}>
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
        </Tag>

        {!defaultDropdownState && (
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
  )
}

export default DropDown
