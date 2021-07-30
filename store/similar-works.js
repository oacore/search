import { action, makeObservable, observable } from 'mobx'

import invalidatePreviousRequests from '../utils/invalidatePreviousRequests'

import { fetchSimilarTo } from 'api/outputs'

class SimilarWorks {
  error = false

  similarOutputs = null

  isLoading = false

  constructor() {
    makeObservable(this, {
      error: observable,
      isLoading: observable,
      similarOutputs: observable,
      fetchSimilar: action,
    })
  }

  @invalidatePreviousRequests
  async fetchSimilar(id) {
    this.reset()
    this.isLoading = true
    try {
      const similarOutputs = await fetchSimilarTo(id)
      this.similarOutputs = similarOutputs
    } catch (error) {
      this.error = true
    } finally {
      this.isLoading = false
    }
  }

  reset() {
    this.similarOutputs = null
    this.isLoading = false
    this.error = false
  }
}

export default SimilarWorks
