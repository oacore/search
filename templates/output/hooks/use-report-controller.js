import React from 'react'

import { useStore } from 'store'

const useReportController = () => {
  const { report } = useStore()

  const setActiveOperation = React.useCallback((updateOption) => {
    report.updateOption = updateOption
  })

  const setActiveReporter = React.useCallback((role) => {
    report.role = role
  })

  const handleSubmitForm = (data) => {
    report.submit(data)
  }

  const setIsModalReportTypeActive = React.useCallback((boolean) => {
    report.isModalReportTypeActive = boolean
  })

  const setIsModalReportFormActive = React.useCallback((boolean) => {
    report.isModalReportFormActive = boolean
  })

  const setIsModalReportSuccessActive = React.useCallback((boolean) => {
    report.isModalReportSuccessActive = boolean
  })

  const getMetadata = (id) => {
    report.fetchOutput(id)
  }

  const setErrorMessage = (message) => {
    report.error = message
  }

  const resetReport = React.useCallback(() => report.reset(), [])

  return {
    report,
    resetReport,
    setActiveOperation,
    setActiveReporter,
    handleSubmitForm,
    setIsModalReportTypeActive,
    setIsModalReportFormActive,
    setIsModalReportSuccessActive,
    setErrorMessage,
    getMetadata,
  }
}

export default useReportController
