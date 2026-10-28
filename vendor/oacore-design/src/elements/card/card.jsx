import PropTypes from 'prop-types'

import styles from './card.css'
import { classNames } from '../../utils'

const Card = ({
  children,
  className,
  variant = 'elevated',
  tag: Tag = 'div',
  ...restProps
}) => (
  <Tag
    className={classNames
      .use(styles.container, styles[variant])
      .join(className)}
    {...restProps}
  >
    {children}
  </Tag>
)

Card.propTypes = {
  variant: PropTypes.oneOf(['elevated', 'outlined', 'pure']),
}

const Title = ({ children, className, tag: Tag = 'h1', ...restProps }) => (
  <Tag className={classNames.use(styles.title).join(className)} {...restProps}>
    {children}
  </Tag>
)

const Description = ({ children, className, tag: Tag = 'p', ...restProps }) => (
  <Tag
    className={classNames.use(styles.description).join(className)}
    {...restProps}
  >
    {children}
  </Tag>
)

const Footer = ({ children, className, tag: Tag = 'div', ...restProps }) => (
  <Tag className={classNames.use(styles.footer).join(className)} {...restProps}>
    {children}
  </Tag>
)

Card.Title = Title
Card.Description = Description
Card.Footer = Footer

export default Card
