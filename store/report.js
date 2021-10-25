import { action, makeObservable, observable } from 'mobx'

import invalidatePreviousRequests from '../utils/invalidatePreviousRequests'

import { createReport, fetchMetadata } from 'api/outputs'

const ERROR_MESSAGE =
  'We couldn’t perform the action. For any issue contact theteam@core.ac.uk'

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
      this.error = ERROR_MESSAGE
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
      this.output = output
      this.isModalReportTypeActive = true
    } catch (error) {
      this.error = ERROR_MESSAGE
    } finally {
      this.isLoading = false
    }
  }
}

export default Report
