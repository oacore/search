import React, { useRef } from 'react'

import Head from './head'

import { initStore, GlobalProvider } from 'store'

const Main = ({ children }) => {
  const store = useRef(initStore())
  // TODO: Create App Layout
  return (
    <GlobalProvider store={store.current}>
      <Head />
      {children}
    </GlobalProvider>
  )
}

export default Main
