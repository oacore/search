import React from 'react'

import { useStore } from 'store'

const useReportController = () => {
  const { report } = useStore()

  const setActiveOperation = (updateOption) => {
    report.updateOption = updateOption
  }

  const setActiveReporter = (role) => {
    report.role = role
  }

  const handleSubmitForm = (data) => {
    report.submit(data)
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
