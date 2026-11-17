import React from 'react'
import { useStore as useStoreApi } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import { useStore } from 'store'

// `select` picks the report fields the component renders: it re-renders when
// one of them changes
const useReportController = (select) => {
  const { report: reportStore } = useStore()
  const report = useStoreApi(reportStore, useShallow(select))

  const setActiveOperation = React.useCallback((updateOption) => {
    reportStore.setState({ updateOption })
  })

  const setActiveReporter = React.useCallback((role) => {
    reportStore.setState({ role })
  })

  const handleSubmitForm = (data) => {
    reportStore.getState().submit(data)
  }

  const setIsModalReportTypeActive = React.useCallback((boolean) => {
    reportStore.setState({ isModalReportTypeActive: boolean })
  })

  const setIsModalReportFormActive = React.useCallback((boolean) => {
    reportStore.setState({ isModalReportFormActive: boolean })
  })

  const setIsModalReportSuccessActive = React.useCallback((boolean) => {
    reportStore.setState({ isModalReportSuccessActive: boolean })
  })

  const getMetadata = (id) => {
    reportStore.getState().fetchOutput(id)
  }

  const setErrorMessage = (message) => {
    reportStore.setState({ error: message })
  }

  const resetReport = React.useCallback(
    () => reportStore.getState().reset(),
    []
  )

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
