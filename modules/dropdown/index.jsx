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

const DropDown = ({
  title,
  subtitle,
  imageSrc,
  children,
  className,
  activeArticle = false,
  useExpandButton = true,
  href,
}) => {
  const [activeDropdown, setActiveDropdown] = useState(!useExpandButton)

  const onToggleDropdown = () => {
    setActiveDropdown(!activeDropdown)
  }

  const Tag = href ? Link : 'div'

  return (
    <div className={classNames.use(styles.dropdown).join(className)}>
      <div className={styles.header}>
        <DataProviderLogo imageSrc={imageSrc} useDefault alt={title} size='md' />
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
  )
}

export default DropDown
