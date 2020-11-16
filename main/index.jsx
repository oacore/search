import React from 'react'

import Head from './head'

import SearchBarProvider from 'modules/search-bar/context'
import Layout from 'modules/layout'
import { useInitStore, StoreProvider } from 'store'

const Main = ({ children, initialState }) => {
  const store = useInitStore(initialState)

  return (
    <StoreProvider store={store}>
      <SearchBarProvider>
        <Head />
        <Layout>{children}</Layout>
      </SearchBarProvider>
    </StoreProvider>
  )
}

export default Main
