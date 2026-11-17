import React, { useState, useRef } from 'react'
import { Icon, ProgressSpinner } from '@oacore/design/lib/elements'
import classNames from '@oacore/design/lib/utils/class-names'

import styles from './styles.module.css'

import useOutsideClick from 'hooks/use-outside-click'

const FILTERS_LABELS = [
  'Field',
  'Year',
  'Type',
  'Author',
  'Language',
  'Publisher',
]

const Facet = ({ label }: any) => {
  const [isComponentVisible, setIsComponentVisible] = useState(false)

  const node = useRef()

  const toggleVisibleComponent = () => {
    setIsComponentVisible(!isComponentVisible)
  }

  const hideFilterBox = () => {
    setIsComponentVisible(false)
  }

  useOutsideClick(node, hideFilterBox)

  return (
    <li className={styles['bar-item-wrapper']} ref={node}>
      <div
        className={classNames.use(styles['bar-item'])}
        onClick={toggleVisibleComponent}
        role="presentation"
      >
        <p>{label}</p>
        <Icon className={styles.barItemIcon} src="#menu-down" />
      </div>
      {isComponentVisible && <Box />}
    </li>
  )
}

const Box = () => (
  <div className={classNames.use(styles['filter-box'], styles['loading-box'])}>
    <ProgressSpinner />
    <span>Loading</span>
  </div>
)

const LoadingBlock = () => (
  <div className={styles['loading-block']}>
    {FILTERS_LABELS.map((item: any) => (
      <Facet label={item} key={item} />
    ))}
  </div>
)

export default LoadingBlock
