import React, { createContext, useMemo, useContext } from 'react'
import { useStaticRendering, observer } from 'mobx-react-lite'

import RootStore from './root'

const isServer = typeof window === 'undefined'

let store = null

useStaticRendering(isServer)

export const initStore = (initialData) => {
  const storeInner = store ?? new RootStore()
  storeInner.init(initialData)

  // on the server-side a new instance is created for each page request
  // as we don't want to mix between users/requests, etc.
  if (isServer) return storeInner

  // Create the store once in the client
  if (!store) store = storeInner

  return storeInner
}

const StoreContext = createContext({})
export const StoreProvider = ({ children, store: storeInner }) => (
  <StoreContext.Provider value={storeInner}>{children}</StoreContext.Provider>
)

export const useStore = () => useContext(StoreContext)

export const useInitStore = (initialState) =>
  useMemo(() => initStore(initialState), [])

export const observe = (Component) => {
  const ObservableComponent = observer(Component)
  return (props) => <ObservableComponent {...props} />
}

export default StoreProvider
