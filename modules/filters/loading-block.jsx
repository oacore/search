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

const Facet = ({ label }) => {
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
    <li className={styles.barItemWrapper} ref={node}>
      <div
        className={classNames.use(styles.barItem)}
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
  <div className={classNames.use(styles.filterBox, styles.loadingBox)}>
    <ProgressSpinner />
    <span>Loading</span>
  </div>
)

const LoadingBlock = () => (
  <div className={styles.loadingBlock}>
    {FILTERS_LABELS.map((item) => (
      <Facet label={item} key={item} />
    ))}
  </div>
)

export default LoadingBlock
