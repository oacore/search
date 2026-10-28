import PropTypes from 'prop-types'

import labelStyles from './label.css'
import { classNames } from '../utils'

const Label = ({
  children,
  color = 'default',
  className,
  tag: Tag = 'mark',
  ...restProps
}) => (
  <Tag
    className={classNames
      .use('label', color !== 'default' && color, className)
      .from(labelStyles)}
    {...restProps}
  >
    {children}
  </Tag>
)

Label.propTypes = {
  color: PropTypes.oneOf(['default', 'primary', 'success', 'danger']),
}

export default Label
