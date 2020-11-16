import React from 'react'
import { Header } from '@oacore/design'

const SearchAppBar = ({ children, className, ...restProps }) => (
  <Header id="header" {...restProps} />
)

export default SearchAppBar
