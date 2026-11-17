import React from 'react'
import { useStore as useStoreApi } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import { useStore } from 'store'

// `select` picks the report fields the component renders: it re-renders when
// one of them changes
const useReportController = (select?: any) => {
  const { report: reportStore } = useStore()
  const report: any = useStoreApi(reportStore, useShallow(select))

  const setActiveOperation = React.useCallback((updateOption: any) => {
    reportStore.setState({ updateOption })
  })

  const setActiveReporter = React.useCallback((role: any) => {
    reportStore.setState({ role })
  })

  const handleSubmitForm = (data?: any) => {
    reportStore.getState().submit(data)
  }

  const setIsModalReportTypeActive = React.useCallback((boolean: any) => {
    reportStore.setState({ isModalReportTypeActive: boolean })
  })

  const setIsModalReportFormActive = React.useCallback((boolean: any) => {
    reportStore.setState({ isModalReportFormActive: boolean })
  })

  const setIsModalReportSuccessActive = React.useCallback((boolean: any) => {
    reportStore.setState({ isModalReportSuccessActive: boolean })
  })

  const getMetadata = (id?: any) => {
    reportStore.getState().fetchOutput(id)
  }

  const setErrorMessage = (message?: any) => {
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
