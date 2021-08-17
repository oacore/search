import { action, makeObservable, observable } from 'mobx'

import invalidatePreviousRequests from '../utils/invalidatePreviousRequests'

import { createReport } from 'api/outputs'

class Report {
  updateOption = null

  role = null

  statusCode = null

  isLoading = false

  error = null

  constructor() {
    makeObservable(this, {
      updateOption: observable,
      role: observable,
      statusCode: observable,
      isLoading: observable,
      error: observable,
      reset: action,
    })
  }

  reset() {
    this.updateOption = null
    this.role = null
    this.statusCode = null
    this.isLoading = false
    this.error = null
  }

  @invalidatePreviousRequests
  async submit(data) {
    data.updateOption = this.updateOption
    data.role = this.role
    this.isLoading = true
    try {
      const { status } = await createReport(data)
      this.statusCode = status
    } catch (error) {
      const { status, data: errorData } = error
      this.error = errorData
      this.statusCode = status
    } finally {
      this.isLoading = false
    }
  }
}

export default Report
