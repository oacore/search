import React from 'react'
import { DesignProvider } from '@oacore/design'

import Head from './head'

import Layout from 'modules/layout'
import { useInitStore, StoreProvider } from 'store'

const Main = ({ children, initialState, loading, isSearchPage }) => {
  const store = useInitStore(initialState)

  return (
    <StoreProvider store={store}>
      <DesignProvider>
        <Head />
        <Layout isSearchPage={isSearchPage} loading={loading}>
          {children}
        </Layout>
      </DesignProvider>
    </StoreProvider>
  )
}

export default Main
