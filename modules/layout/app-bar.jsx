import React from 'react'
import { Header } from '@oacore/design'

const SearchAppBar = ({ children, className, ...restProps }) => (
  <Header id="header" className={className} {...restProps} />
)

export default SearchAppBar
