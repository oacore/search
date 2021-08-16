import { action, makeObservable, observable } from 'mobx'

import invalidatePreviousRequests from '../utils/invalidatePreviousRequests'

import request from 'api'
import { createReport, fetchMetadata } from 'api/outputs'

class Report {
  output = {}

  updateOption = null

  role = null

  statusCode = null

  isLoading = false

  error = null

  isModalReportTypeActive = false

  isModalReportFormActive = false

  isModalReportSuccessActive = false

  constructor() {
    makeObservable(this, {
      output: observable,
      updateOption: observable,
      role: observable,
      statusCode: observable,
      isLoading: observable,
      error: observable,
      isModalReportTypeActive: observable,
      isModalReportFormActive: observable,
      isModalReportSuccessActive: observable,
      reset: action,
    })
  }

  reset() {
    this.output = {}
    this.updateOption = null
    this.role = null
    this.statusCode = null
    this.isLoading = false
    this.error = null
    this.isModalReportTypeActive = false
    this.isModalReportFormActive = false
    this.isModalReportSuccessActive = false
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

  @invalidatePreviousRequests
  async fetchOutput(id) {
    try {
      const rawOutput = await fetchMetadata(id)
      const { fullText: _, ...output } = rawOutput

      const { data: dataProvider } = await request(output.dataProvider)
      this.output = { ...output, dataProvider }
    } catch (error) {
      throw Error(error)
    }
  }
}

export default Report
