import React from 'react'
import PropTypes from 'prop-types'

import styles from './metadata-list.css'
import MetaDataListItem from './metadata-list-item'
import { classNames } from '../../utils'

const MetadataList = ({ children, className, ...htmlProps }) => (
  <dl className={classNames.use(styles.list).join(className)} {...htmlProps}>
    {children}
  </dl>
)

MetadataList.Item = MetaDataListItem

MetadataList.propTypes = {
  /**
   *  Instance of `MetadataList.Item`
   */
  children: PropTypes.node.isRequired,
  className: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.instanceOf(classNames.default),
  ]),
}

export default MetadataList
