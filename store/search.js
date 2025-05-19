import { action, makeObservable, observable } from 'mobx'
import Router from 'next/router'

import { downloadResultsInCSV } from '../api/search'

import { findDataProviders } from 'utils/helpers'
import invalidatePreviousRequests from 'utils/invalidatePreviousRequests'

const sortFilterValues = [
  {
    value: 'recent',
    checked: false,
  },
  {
    value: 'relevance',
    checked: false,
  },
]

class Search {
  works = []

  query = null

  isLoading = false

  dataProviders = []

  sortOptions = []

  activeLimit = 10

  activeDownloadModal = false

  constructor() {
    makeObservable(this, {
      works: observable,
      isLoading: observable,
      dataProviders: observable,
      activeLimit: observable,
      query: observable,
      activeDownloadModal: observable,
      sortOptions: observable,
      setWorks: action,
      setIsLoading: action,
      setQuery: action,
      setSortOptions: action,
      downloadResults: action,
      setActiveSortOption: action,
      reset: action,
      setWorkDataProviders: action,
    })
  }

  setWorks(works) {
    this.works = works
    if (this.dataProviders.length > 0)
      this.setWorkDataProviders(works, this.dataProviders)
  }

  setWorkDataProviders(works, dataProviders) {
    const worksWithDataProviders = findDataProviders(dataProviders, works)
    this.works = worksWithDataProviders
  }

  setIsLoading(loading) {
    this.isLoading = loading
  }

  setActiveLimit(limit) {
    this.activeLimit = limit
  }

  setQuery(query) {
    this.query = query
  }

  setActiveDownloadModal(boolean) {
    this.activeDownloadModal = boolean
  }

  setSortOptions(activeSortValue) {
    const options = sortFilterValues.map((sortOption) => {
      sortOption.checked = false
      if (sortOption.value === activeSortValue) sortOption.checked = true
      return sortOption
    })

    this.sortOptions = options
  }

  setActiveSortOptionData(sortType, pathname) {
    if (pathname?.includes('data-providers')) delete Router.query.id

    this.setSortOptions(sortType.value)
    Router.push({
      pathname,
      query: {
        ...Router.query,
        sort: sortType.value === 'recent' ? 'relevance' : sortType.value,
        page: 1,
      },
    })
  }

  setActiveSortOption(sortType) {
    this.setSortOptions(sortType.value)
    Router.push({
      pathname: '/search',
      query: {
        ...Router.query,
        sort: sortType.value,
        page: 1,
      },
    })
  }

  @invalidatePreviousRequests
  async downloadResults() {
    try {
      this.setIsLoading(true)
      const body = {
        q: this.query,
        accept: 'text/csv',
        limit: this.activeLimit,
      }
      await downloadResultsInCSV(body)
      this.setActiveDownloadModal(false)
    } catch (error) {
      console.error(error)
    } finally {
      this.setIsLoading(false)
    }
  }

  reset() {
    this.works = []
    this.isLoading = false
    this.activeLimit = 1000
    this.query = null
  }
}

export default Search
