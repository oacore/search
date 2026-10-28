import React from 'react'
import PropTypes from 'prop-types'

import Icon from '../icon/icon'
import styles from './data-provider.css'
import { classNames } from '../../utils'

const DataProviderLogo = ({
  alt,
  imageSrc,
  size = 'md',
  useDefault = true,
  tag: Tag = 'div',
  className,
}) => (
  <Tag
    className={classNames
      .use(styles[size], {
        [styles.hidden]: !useDefault,
        [styles.circle]: useDefault,
      })
      .join(className)}
  >
    {imageSrc ? (
      <img src={imageSrc} alt={alt} className={styles.image} />
    ) : (
      <Icon src="#office-building" className={classNames.use(styles.image)} />
    )}
  </Tag>
)

DataProviderLogo.propTypes = {
  alt: PropTypes.string.isRequired,
  imageSrc: PropTypes.string,
  size: PropTypes.oneOf(['md', 'sm', 'ml', 'lg']),
  /* Pass true if you want to use default icon */
  useDefault: PropTypes.bool,
}
export default DataProviderLogo
