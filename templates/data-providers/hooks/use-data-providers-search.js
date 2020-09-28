import { useCallback, useEffect, useMemo, useState } from 'react'

import { normalizeDataProviders } from '../utils'

const useResults = ({ dataProviders, size, queryParam }) => {
  const dataProvidersSearch = useMemo(
    () => normalizeDataProviders(dataProviders),
    [dataProviders]
  )

  const searchDataProviders = useCallback(
    (searchTerm) =>
      dataProvidersSearch.filter(
        (el) =>
          el.name?.toLowerCase().search(searchTerm.toLowerCase()) !== -1 ||
          el.normalizedName.toLowerCase().search(searchTerm.toLowerCase()) !==
            -1
      ),
    [dataProvidersSearch]
  )

  const [query, setQuery] = useState(queryParam || '')
  const [results, setResults] = useState(searchDataProviders(query))
  const [dataProvidersOffset, setDataProvidersOffset] = useState(size || 10)

  useEffect(() => {
    setDataProvidersOffset(10)
    if (query === '') setResults(normalizeDataProviders(dataProviders))
    else setResults(searchDataProviders(query))
  }, [query])

  return {
    query,
    setQuery,
    results,
    dataProvidersOffset,
    setDataProvidersOffset,
    searchDataProviders,
  }
}

export default useResults
