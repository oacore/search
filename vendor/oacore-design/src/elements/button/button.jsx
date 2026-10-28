import { forwardRef } from 'react'
import PropTypes from 'prop-types'

import buttonClassNames from './button.css'
import { classNames } from '../../utils'

const Button = forwardRef(
  (
    {
      children,
      className,
      variant = 'text',
      href,
      tag: Tag = href ? 'a' : 'button',
      ...restProps
    },
    ref
  ) => (
    <Tag
      ref={ref}
      className={classNames
        .use('button', variant)
        .from(buttonClassNames)
        .join(className)}
      href={href}
      {...restProps}
    >
      {children}
    </Tag>
  )
)

Button.propTypes = {
  variant: PropTypes.oneOf(['text', 'outlined', 'contained']),
  href: PropTypes.string,
}

export default Button
