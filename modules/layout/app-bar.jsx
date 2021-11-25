import React from 'react'
import { Header } from '@oacore/design'

const SearchAppBar = ({ className, ...restProps }) => (
  <Header id="header" className={className} {...restProps} />
)

export default SearchAppBar
