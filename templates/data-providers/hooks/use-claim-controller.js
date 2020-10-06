import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'

import { generateFormMessage } from '../utils'

import { useStore } from 'store'
import useDebouncedEffect from 'hooks/use-debounced-effect'

const useClaimController = ({ action }) => {
  const formRef = useRef(null)
  const router = useRouter()
  const { claim } = useStore()
  const [showForm, setShowForm] = useState(Boolean(action === 'add'))

  const resetClaim = useCallback(() => claim.reset({ query: true }), [])

  const getFormMessage = useCallback(() => generateFormMessage(claim), [claim])

  const handleSubmitForm = useCallback(() => {
    // Form most likely submitted by pressing Enter key in Safari
    if (!claim.created) return

    // Resetting the query string after adding the data provider
    resetClaim()
  }, [claim])

  useDebouncedEffect(
    () => {
      if (claim.query === '' || !formRef.current) return

      if (!formRef.current.dataProviderUrl.checkValidity()) {
        formRef.current.dataProviderUrl.reportValidity()
        return
      }

      claim.retrieve()
    },
    [claim.query],
    500
  )

  useEffect(() => {
    if (router.query?.dataProviderUrl)
      claim.query = router.query?.dataProviderUrl
  }, [router.query?.dataProviderUrl])

  return {
    formRef,
    showForm,
    setShowForm,
    claim,
    handleSubmitForm,
    getFormMessage,
  }
}

export default useClaimController
