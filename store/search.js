import { action, makeObservable, observable } from 'mobx'

import { downloadResultsInCSV } from '../api/search'

import { findDataProviders } from 'utils/helpers'
import invalidatePreviousRequests from 'utils/invalidatePreviousRequests'
import apiRequest from 'api'

class Search {
  works = []

  query = null

  isLoading = false

  dataProviders = []

  activeLimit = 1000

  activeDownloadModal = false

  constructor() {
    makeObservable(this, {
      works: observable,
      isLoading: observable,
      dataProviders: observable,
      activeLimit: observable,
      query: observable,
      activeDownloadModal: observable,
      setWorks: action,
      setIsLoading: action,
      setQuery: action,
      fetchDataProviders: action,
      setDataProviders: action,
      downloadResults: action,
      reset: action,
      setWorkDataProviders: action,
    })
  }

  setWorks(works) {
    this.works = works
    if (this.dataProviders.length > 0)
      this.setWorkDataProviders(works, this.dataProviders)
  }

  setDataProviders(dataProviders) {
    this.dataProviders = dataProviders
    this.setWorkDataProviders(this.works, dataProviders)
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

  @invalidatePreviousRequests
  async fetchDataProviders() {
    try {
      this.setIsLoading(true)
      const { data: allDataProviders } = await apiRequest(
        '/repositories/formap'
      )
      this.setDataProviders(allDataProviders)
    } catch (error) {
      console.error(error)
    } finally {
      this.setIsLoading(false)
    }
  }

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
