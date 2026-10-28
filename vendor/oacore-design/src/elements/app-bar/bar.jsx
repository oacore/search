import PropTypes from 'prop-types'

import appBarStyles from './styles.css'
import { classNames } from '../../utils'

const AppBar = ({
  children,
  fixed = false,
  className,
  tag: Tag = 'div',
  ...restProps
}) => (
  <Tag
    className={classNames
      .use('container', { fixed })
      .from(appBarStyles)
      .join(className)}
    {...restProps}
  >
    {children}
  </Tag>
)

AppBar.propTypes = {
  fixed: PropTypes.bool,
}

export default AppBar
