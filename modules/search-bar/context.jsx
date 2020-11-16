import React, { useState, useContext, useEffect, useCallback } from 'react'

const defaultSearchBarConfig = {
  onQueryChanged: () => {},
  search: () => {},
  initQuery: '',
  searchBarProps: {},
}
export const SearchContext = React.createContext(defaultSearchBarConfig)

const SearchBarProvider = ({ children }) => {
  const [isSearchBarEnabled, setIsSearchBarEnabled] = useState(false)
  const [searchBarConfig, setSearchBarConfigInner] = useState(
    defaultSearchBarConfig
  )
  const disabledSearchBar = useCallback(() => {
    setSearchBarConfigInner(defaultSearchBarConfig)
    setIsSearchBarEnabled(false)
  }, [])

  const setSearchBarConfig = useCallback((config) => {
    setSearchBarConfigInner(config)
    setIsSearchBarEnabled(true)
  }, [])
  return (
    <SearchContext.Provider
      value={{
        isSearchBarEnabled,
        searchBarConfig,
        setSearchBarConfig,
        disabledSearchBar,
      }}
    >
      {children}
    </SearchContext.Provider>
  )
}

export const useSearchBar = (config) => {
  const searchContext = useContext(SearchContext)

  useEffect(() => {
    const isConfig = Boolean(config)
    if (isConfig) searchContext.setSearchBarConfig(config)

    return () => {
      if (isConfig) searchContext.disabledSearchBar()
    }
  }, [])

  return searchContext
}

export default SearchBarProvider
