import React, { createContext, useMemo, useContext, useRef } from 'react'
import { enableStaticRendering, observer } from 'mobx-react-lite'

import RootStore from './root'

const isServer = typeof window === 'undefined'

let store = null

enableStaticRendering(isServer)

export const initStore = (initialData) => {
  // on the server-side a new instance is created for each page request
  // as we don't want to mix between users/requests, etc.
  if (isServer) return new RootStore(initialData)

  // Create the store once in the client
  if (!store) store = new RootStore(initialData)

  return store
}

const StoreContext = createContext({})
export const StoreProvider = ({ children, store: storeInner }) => (
  <StoreContext.Provider value={storeInner}>{children}</StoreContext.Provider>
)

export const useStore = (initialState) => {
  const isInitialized = useRef(false)
  const storeContext = useContext(StoreContext)

  if (isInitialized.current === false && initialState) {
    storeContext.extend(initialState)
    isInitialized.current = true
  }

  return storeContext
}

export const useInitStore = (initialState) =>
  useMemo(() => initStore(initialState), [])

export const observe = (Component) => {
  const ObservableComponent = observer(Component)
  return (props) => <ObservableComponent {...props} />
}

export default StoreProvider
