import { action, makeObservable, observable } from 'mobx'

import invalidatePreviousRequests from '../utils/invalidatePreviousRequests'

class Report {
  operation = null

  reporterType = null

  statusCode = null

  isLoading = false

  error = null

  constructor() {
    makeObservable(this, {
      operation: observable,
      reporterType: observable,
      statusCode: observable,
      isLoading: observable,
      error: observable,
      reset: action,
    })
  }

  reset() {
    this.operation = null
    this.reporterType = null
    this.statusCode = null
    this.isLoading = false
    this.error = null
  }

  @invalidatePreviousRequests
  async fakeRequest(requestBody) {
    this.isLoading = true
    try {
      if (requestBody) this.statusCode = 200
    } catch (error) {
      if (!requestBody) {
        this.error = error
        this.statusCode = 400
      }
    } finally {
      this.isLoading = false
    }
  }
}

export default Report
