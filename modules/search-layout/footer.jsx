import React from 'react'

const Footer = ({ children, className, tag: Tag = 'div', ...restProps }) => (
  <Tag className={className} {...restProps}>
    {children}
  </Tag>
)

export default Footer
