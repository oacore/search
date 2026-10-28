import React from 'react'
import PropTypes from 'prop-types'

import styles from './metadata-list.css'
import { classNames } from '../../utils'

const MetaDataListItem = ({
  children,
  label,
  id,
  className,
  itemProp = null,
  itemScope = null,
  itemType = null,
  ...htmlProps
}) => (
  <div
    className={classNames
      .use(styles.group, children == null && styles.empty)
      .join(className)}
    {...htmlProps}
  >
    <dt id={`${id}-title`}>{label}</dt>
    <dd aria-labelledby={`${id}-title`} {...{ itemProp, itemScope, itemType }}>
      {children}
    </dd>
  </div>
)

MetaDataListItem.displayName = 'MetaDataList.Item'

MetaDataListItem.propTypes = {
  /**
   * Unique identifier
   */
  id: PropTypes.string.isRequired,
  /**
   *  Description of the item
   */
  label: PropTypes.string.isRequired,
  /**
   * Microdata of the item
   */
  itemProp: PropTypes.string,
  /**
   *  Microdata of the item
   */
  itemScope: PropTypes.string,
  /**
   *  Microdata of the item
   */
  itemType: PropTypes.string,
}

export default MetaDataListItem
