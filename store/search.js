import { action, makeObservable, observable } from 'mobx'

import { findDataProviders } from 'utils/helpers'
import invalidatePreviousRequests from 'utils/invalidatePreviousRequests'
import apiRequest from 'api'

class Search {
  works = []

  isLoading = true

  dataProviders = []

  constructor() {
    makeObservable(this, {
      works: observable,
      isLoading: observable,
      dataProviders: observable,
      setWorks: action,
      setIsLoading: action,
      fetchDataProviders: action,
      setDataProviders: action,
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

  reset() {
    this.works = []
    this.isLoading = false
  }
}

export default Search
