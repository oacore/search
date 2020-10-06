import React from 'react'

import Head from './head'

import Layout from 'modules/layout'
import { useInitStore, StoreProvider } from 'store'

const Main = ({ children, initialState }) => {
  const store = useInitStore(initialState)

  return (
    <StoreProvider store={store}>
      <Head />
      <Layout>{children}</Layout>
    </StoreProvider>
  )
}

export default Main
