import { forwardRef } from 'react'

const Form = forwardRef(({ children, ...restProps }, ref) => (
  <form ref={ref} {...restProps}>
    {children}
  </form>
))

export default Form
