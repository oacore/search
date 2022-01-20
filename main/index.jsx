import React from 'react'
import {
  DesignProvider,
  CookiesProvider,
  Cookies as CookiesPopup,
} from '@oacore/design'

import Head from './head'

import Layout from 'modules/layout'
import { useInitStore, StoreProvider } from 'store'

const Main = ({ children, initialState, loading, isSearchPage }) => {
  const store = useInitStore(initialState)

  return (
    <StoreProvider store={store}>
      <DesignProvider>
        <CookiesProvider>
          <Head />
          <Layout isSearchPage={isSearchPage} loading={loading}>
            {children}
          </Layout>
          <CookiesPopup />
        </CookiesProvider>
      </DesignProvider>
    </StoreProvider>
  )
}

export default Main
