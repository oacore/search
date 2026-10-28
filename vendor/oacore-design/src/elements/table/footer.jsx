import { forwardRef } from 'react'

/**
 * Empty component for the future purposes.
 */

const Footer = forwardRef(
  ({ children, tag: Tag = 'tfoot', ...restProps }, ref) => (
    <Tag ref={ref} {...restProps}>
      {children}
    </Tag>
  )
)

export default Footer
