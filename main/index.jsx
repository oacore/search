import React, { useRef } from 'react'

import Head from './head'

import Layout from 'modules/layout'
import { initStore, GlobalProvider } from 'store'

const Main = ({ children }) => {
  const store = useRef(initStore())

  return (
    <GlobalProvider store={store.current}>
      <Head />
      <Layout>{children}</Layout>
    </GlobalProvider>
  )
}

export default Main
