import { forwardRef } from 'react'
import PropTypes from 'prop-types'

import styles from './styles.css'
import Button from '../button'
import { classNames } from '../../utils'

/**
 * Simple table cell component for headings.
 */

const getSortOrder = (order) => {
  switch (order) {
    case 'asc':
      return ['ascending', 'Sorted ascending']
    case 'desc':
      return ['descending', 'Sorted descending']
    case null:
      return ['none', 'Not sortable']
    default:
      return ['none', 'Not sorted']
  }
}
const HeadCell = forwardRef(
  (
    {
      children,
      className,
      sticky = false,
      order = null,
      onClick,
      tag: Tag = 'th',
      ...restProps
    },
    ref
  ) => (
    <Tag
      className={classNames
        .use({
          sticky,
          headCell: true,
          sortable: order != null,
          asc: order === 'asc',
          desc: order === 'desc',
        })
        .from(styles)
        .join(className)}
      ref={ref}
      role="columnheader"
      aria-sort={getSortOrder(order)[0]}
      scope="col"
      {...restProps}
    >
      <Button
        type="button"
        tabIndex={0}
        aria-disabled={order === null}
        onClick={onClick}
      >
        {children}
        <span className="sr-only">{getSortOrder(order)[1]}</span>
      </Button>
    </Tag>
  )
)

HeadCell.propTypes = {
  sticky: PropTypes.bool,
  order: PropTypes.oneOf([null, 'any', 'asc', 'desc']),
  onClick: PropTypes.func,
}

export default HeadCell
