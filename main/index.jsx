import React from 'react'
import { DesignProvider, Cookies as CookiesPopup } from '@oacore/design'

import Head from './head'

import Layout from 'modules/layout'
import { useInitStore, StoreProvider } from 'store'
import useAnalytics from 'hooks/use-analytics'

const Main = ({ children, initialState, loading, isSearchPage }) => {
  const store = useInitStore(initialState)

  useAnalytics()

  return (
    <StoreProvider store={store}>
      <DesignProvider>
        <Head />
        <Layout isSearchPage={isSearchPage} loading={loading}>
          {children}
        </Layout>
        <CookiesPopup />
      </DesignProvider>
    </StoreProvider>
  )
}

export default Main
