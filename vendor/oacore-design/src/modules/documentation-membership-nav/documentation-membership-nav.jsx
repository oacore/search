import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'

import styles from './styles.css'
import { classNames } from '../../utils'
import Icon from '../../elements/icon'

const DocumentationMembershipNav = ({
  textData,
  setHighlight,
  activeIndex,
  setNavActiveIndex,
  mulltyDocs,
}) => {
  const [activeItem, setActiveItem] = useState(null)
  const headerHeight = 56
  const mobileHeaderHeight = 150

  const handleClick = (obj, item) => {
    window.location.href = obj.href
    setActiveItem(item)
    setHighlight(+item)
    setNavActiveIndex(null)
    const element = document.getElementById(obj.href.replace('#', ''))
    if (element) {
      const rect = element.getBoundingClientRect()
      const isMobile = window.matchMedia('(max-width: 768px)').matches
      const adjustedHeaderHeight = isMobile ? mobileHeaderHeight : headerHeight

      window.scrollTo({
        top: rect.top + window.scrollY - adjustedHeaderHeight,
        behavior: 'smooth',
        block: 'center',
      })
    }
  }

  return (
    <div
      className={classNames.use({
        [styles.siderWrapper]: mulltyDocs,
      })}
    >
      {mulltyDocs && <div className={styles.placeholder}>Outline</div>}
      <ul className={styles.sider}>
        {Object.values(textData.navItems).map((item, i) => (
          // eslint-disable-next-line max-len
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions,jsx-a11y/click-events-have-key-events
          <li
            className={classNames.use(styles.siderItem, {
              [styles.hiddenItem]: item.hidden,
              [styles.activeItem]: !activeIndex
                ? activeItem === i
                : activeIndex === i,
            })}
            key={item.item}
            onClick={() => handleClick(item, i)}
          >
            <ReactMarkdown className={styles.siderItemLink}>
              {item.item}
            </ReactMarkdown>
            {activeItem === i || activeIndex === i ? (
              <span className={styles.logo}>
                <Icon src="#active-arrow" />
              </span>
            ) : (
              ''
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default DocumentationMembershipNav
