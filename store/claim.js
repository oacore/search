import { makeObservable, observable, action } from 'mobx'

import invalidatePreviousRequests from '../utils/invalidatePreviousRequests'

import apiRequest from 'api'

class Claim {
  query = ''

  request = null

  created = null

  duplicated = null

  error = null

  isLoading = false

  constructor() {
    makeObservable(this, {
      query: observable,
      request: observable,
      created: observable,
      error: observable,
      isLoading: observable,

      retrieve: action,
      reset: action,
    })
  }

  @invalidatePreviousRequests
  async retrieve(signal) {
    this.reset()
    this.isLoading = true
    try {
      const { data } = await apiRequest('/data-providers', {
        method: 'POST',
        body: JSON.stringify({
          uri: this.query,
        }),
        signal,
      })
      this.created = data
    } catch (error) {
      const { status, data } = error
      if (status === 409) this.duplicated = data
      else this.error = error
    } finally {
      this.isLoading = false
    }
  }

  reset({ query } = { query: false }) {
    this.request = null
    this.created = null
    this.duplicated = null
    this.error = null
    if (query) this.query = ''
  }
}

export default Claim
