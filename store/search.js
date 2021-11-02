import { action, makeObservable, observable } from 'mobx'

import { downloadResultsInCSV } from '../api/search'

import { findDataProviders } from 'utils/helpers'
import invalidatePreviousRequests from 'utils/invalidatePreviousRequests'
import apiRequest from 'api'

class Search {
  works = []

  query = null

  isLoading = false

  activeLimit = 1000

  constructor() {
    makeObservable(this, {
      works: observable,
      isLoading: observable,
      activeLimit: observable,
      query: observable,
      setWorks: action,
      setIsLoading: action,
      setQuery: action,
      fetchDataProviders: action,
      downloadResults: action,
      reset: action,
    })
  }

  setWorks(works) {
    this.works = works
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

  @invalidatePreviousRequests
  async fetchDataProviders() {
    try {
      this.setIsLoading(true)

      const { data: allDataProviders } = await apiRequest(
        '/repositories/formap'
      )

      const works = findDataProviders(allDataProviders, this.works)

      this.setWorks(works)
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
        limit: 10,
      }
      downloadResultsInCSV(body)
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
