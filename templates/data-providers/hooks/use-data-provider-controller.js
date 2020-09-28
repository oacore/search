import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'

import { generateFormMessage } from '../utils'

import useDebouncedEffect from 'hooks/use-debounced-effect'
import { GlobalContext } from 'store'

const useDataProviderController = ({ action }) => {
  const formRef = useRef(null)
  const router = useRouter()
  const { dataProvider } = useContext(GlobalContext)
  const [showForm, setShowForm] = useState(Boolean(action === 'add'))

  const resetDataProvider = useCallback(
    () => dataProvider.reset({ query: true }),
    []
  )

  const getFormMessage = useCallback(() => generateFormMessage(dataProvider), [
    dataProvider,
  ])

  const handleSubmitForm = useCallback(() => {
    // Form most likely submitted by pressing Enter key in Safari
    if (!dataProvider.created) return

    // Resetting the query string after adding the data provider
    resetDataProvider()
  }, [dataProvider])

  useDebouncedEffect(
    () => {
      if (dataProvider.query === '' || !formRef.current) return

      if (!formRef.current.dataProviderUrl.checkValidity()) {
        formRef.current.dataProviderUrl.reportValidity()
        return
      }

      dataProvider.retrieve()
    },
    [dataProvider.query],
    500
  )

  useEffect(() => {
    if (router.query?.dataProviderUrl)
      dataProvider.query = router.query?.dataProviderUrl
  }, [router.query?.dataProviderUrl])

  return {
    formRef,
    showForm,
    setShowForm,
    dataProvider,
    handleSubmitForm,
    getFormMessage,
  }
}

export default useDataProviderController
