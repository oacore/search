import PropTypes from 'prop-types'

import { classNames } from '../utils'

/**
 * Heading component is a simple wrapper around standard HTML headings.
 */
const Heading = ({
  children,
  className,
  level,
  display = false,
  tag: Tag = `h${level}`,
  ...restProps
}) => (
  <Tag className={classNames.use({ display }, className)} {...restProps}>
    {children}
  </Tag>
)

Heading.propTypes = {
  /**
   * An integer between 1 and 6 (including) to calculate the tag.
   * NOTE: If `tag` prop is passed, `level` will be ignored.
   */
  level: PropTypes.oneOf([1, 2, 3, 4, 5, 6, '1', '2', '3', '4', '5', '6']),
  /**
   * A toggle for display mode.
   */
  display: PropTypes.bool,
}

export default Heading
