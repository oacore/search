import { action, makeObservable, observable } from 'mobx'

import { findDataProviders } from 'utils/helpers'
import invalidatePreviousRequests from 'utils/invalidatePreviousRequests'
import apiRequest from 'api'

class Search {
  works = []

  isLoading = false

  constructor() {
    makeObservable(this, {
      works: observable,
      isLoading: observable,
      setWorks: action,
      setIsLoading: action,
      fetchDataProviders: action,
      reset: action,
    })
  }

  setWorks(works) {
    this.works = works
  }

  setIsLoading(loading) {
    this.isLoading = loading
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

  reset() {
    this.works = []
    this.isLoading = false
  }
}

export default Search
