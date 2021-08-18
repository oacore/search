import { action, makeObservable, observable } from 'mobx'

import invalidatePreviousRequests from '../utils/invalidatePreviousRequests'

import request from 'api'
import { createReport, fetchMetadata } from 'api/outputs'

class Report {
  output = {}

  updateOption = null

  role = null

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
      await createReport(data)
    } catch (error) {
      const { data: errorData } = error
      this.error = errorData
    } finally {
      this.isLoading = false
    }
  }

  @invalidatePreviousRequests
  async fetchOutput(id) {
    this.isLoading = true
    try {
      const rawOutput = await fetchMetadata(id)
      const { fullText: _, ...output } = rawOutput
      const { data: dataProvider } = await request(output.dataProvider)
      this.output = { ...output, dataProvider }
      this.isModalReportFormActive = true
    } catch (error) {
      this.error =
        'We couldn’t perform the action. For any issue contact theteam@core.ac.uk'
    } finally {
      this.isLoading = false
    }
  }
}

export default Report
