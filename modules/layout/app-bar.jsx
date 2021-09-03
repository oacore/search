import React from 'react'
import { Header } from '@oacore/design'
import Filters from '../filters'

const SearchAppBar = ({ children, className, ...restProps }) => (
  <Header id="header" {...restProps}>
    <Filters />
  </Header>
)

export default SearchAppBar
