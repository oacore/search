import { forwardRef } from 'react'

const Table = forwardRef(
  ({ children, tag: Tag = 'table', ...restProps }, ref) => (
    <Tag ref={ref} {...restProps}>
      {children}
    </Tag>
  )
)

export default Table
