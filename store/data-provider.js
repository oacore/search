import { observable, action } from 'mobx'

import invalidatePreviousRequests from '../utils/invalidatePreviousRequests'

import apiRequest from 'api'

class DataProvider {
  @observable query = ''

  @observable request = null

  @observable created = null

  @observable duplicated = null

  @observable error = null

  @observable isLoading = false

  @action
  @invalidatePreviousRequests
  async retrieve(signal) {
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

  @action reset() {
    this.request = null
    this.created = null
    this.duplicated = []
    this.error = null
  }
}

export default DataProvider
