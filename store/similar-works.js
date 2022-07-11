import { action, makeObservable, observable } from 'mobx'

import { transformDataProviders } from 'utils/data-providers-transform'
import invalidatePreviousRequests from 'utils/invalidatePreviousRequests'
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
      const data = await fetchSimilarTo(id, { ...params })

      const similarOutputs = await Promise.all(
        data.map(async (output) => ({
          ...output,
          dataProviders: await transformDataProviders(
            output.dataProviders || [output.dataProvider]
          ),
        }))
      )

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
