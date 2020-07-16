import React, { useRef } from 'react'

import { initStore, GlobalProvider } from 'store'

const Main = ({ children }) => {
  const store = useRef(initStore)
  // TODO: Create App Layout
  return <GlobalProvider store={store.current}>{children}</GlobalProvider>
}

export default Main
