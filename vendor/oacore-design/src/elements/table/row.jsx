import { forwardRef } from 'react'

/**
 * Empty component for the future purposes.
 */
const Row = forwardRef(({ children, tag: Tag = 'tr', ...restProps }, ref) => (
  <Tag ref={ref} {...restProps}>
    {children}
  </Tag>
))

export default Row
