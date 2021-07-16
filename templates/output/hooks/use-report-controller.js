import React from 'react'

import { useStore } from 'store'

const useReportController = () => {
  const { report } = useStore()

  const setActiveOperation = (operation) => {
    report.operation = operation
  }

  const setActiveReporter = (reporterType) => {
    report.reporterType = reporterType
  }

  const handleSubmitForm = (id, name, email, comment) => {
    const requestBody = {
      id,
      name,
      email,
      comment,
    }
    report.fakeRequest(requestBody)
  }

  const resetReport = React.useCallback(() => report.reset(), [])

  return {
    report,
    resetReport,
    setActiveOperation,
    setActiveReporter,
    handleSubmitForm,
  }
}

export default useReportController
