import React, { createContext, memo, useMemo, useContext, useRef } from 'react'

import RootStore from './root'

const isServer = typeof window === 'undefined'

let store = null

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

// The render boundary MobX's observer gave a component (React.memo, inside a
// wrapper component) stays, so the components render as often as before;
// what a component subscribes to is its zustand selectors.
export const observe = (Component) => {
  const ObservableComponent = memo(Component)
  return (props) => <ObservableComponent {...props} />
}

export default StoreProvider
