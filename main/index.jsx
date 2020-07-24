import React, { useRef } from 'react'
import { MDXProvider } from '@mdx-js/react'

import Head from './head'

import Layout from 'modules/layout'
import { initStore, GlobalProvider } from 'store'

const Main = ({ children }) => {
  const store = useRef(initStore())

  return (
    <GlobalProvider store={store.current}>
      <MDXProvider>
        <Head />
        <Layout>{children}</Layout>
      </MDXProvider>
    </GlobalProvider>
  )
}

export default Main
