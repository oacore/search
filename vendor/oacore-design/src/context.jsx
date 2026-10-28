import React, { useReducer, useContext } from 'react'

import { headerInitialState, headerReducer } from 'modules/header/context'

export const initialState = {
  header: headerInitialState,
}

export const DesignContext = React.createContext(null)

const reducer = ({ header }, action) => ({
  header: headerReducer(header, action),
})

export const useDesignContext = ({ skipUninitializedWarning = false } = {}) => {
  const context = useContext(DesignContext)
  if (
    context === null &&
    process.env.NODE_ENV !== 'production' &&
    !skipUninitializedWarning
  ) {
    console.warn(
      `DesignContext hasn't been initialized yet.
       Please wrap your application with <DesignProvider /> component.`
    )
  }

  return context ?? [initialState, () => {}]
}

export const DesignProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState)

  return (
    <DesignContext.Provider value={[state, dispatch]}>
      {children}
    </DesignContext.Provider>
  )
}

export default DesignProvider
