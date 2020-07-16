import React, { createContext, useContext } from 'react'
import { useStaticRendering, observer } from 'mobx-react-lite'

import RootStore from './root'

const isServer = typeof window === 'undefined'
const GlobalContext = createContext({})
let globalStore = null

useStaticRendering(isServer)

export const initStore = () => {
  // on the server-side a new instance is created for each page request
  // as we don't wan't to mix between users/requests, etc.
  if (isServer) return new RootStore()

  if (!globalStore) {
    globalStore = new RootStore()
    return globalStore
  }

  return globalStore
}

export const withGlobalStore = (Component) => {
  const ObservableComponent = observer(Component)
  return (props) => {
    const context = useContext(GlobalContext)
    return <ObservableComponent store={context} {...props} />
  }
}

export const GlobalProvider = ({ children, store }) => (
  <GlobalContext.Provider value={store}>{children}</GlobalContext.Provider>
)

export default GlobalProvider
