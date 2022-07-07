import { action, makeObservable, observable } from 'mobx'

import invalidatePreviousRequests from 'utils/invalidatePreviousRequests'
import { fetchLogos } from 'api/data-provider'
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
  async fetchSimilar(id, params) {
    this.reset()
    this.isLoading = true
    try {
      const similarOutputs = await fetchSimilarTo(id, { ...params })
      await this.setDataProviderLogo(similarOutputs)
    } catch (error) {
      this.error = true
    } finally {
      this.isLoading = false
    }
  }

  @invalidatePreviousRequests
  async setDataProviderLogo(outputs) {
    this.isLoading = true
    try {
      const outputsWithLogos = await fetchLogos(outputs)
      this.similarOutputs = outputsWithLogos
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
