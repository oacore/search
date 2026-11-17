import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { useStore as useStoreApi } from 'zustand'
import { useShallow } from 'zustand/react/shallow'

import { generateFormMessage } from '../utils'

import { useStore } from 'store'
import useDebouncedEffect from 'hooks/use-debounced-effect'

// the claim fields the page renders: the page re-renders when one of them
// changes (`duplicated` is not among them, it is read with the message)
const selectClaim = (state?: any) => ({
  query: state.query,
  created: state.created,
  error: state.error,
  isLoading: state.isLoading,
})

const useClaimController = () => {
  const formRef = useRef<any>(null)
  const router = useRouter()
  const { claim: claimStore } = useStore()
  const claim = useStoreApi(claimStore, useShallow(selectClaim))

  const resetClaim = useCallback(
    () => claimStore.getState().reset({ query: true }),
    []
  )

  const getFormMessage = useCallback(
    () =>
      generateFormMessage({
        created: claimStore.getState().created,
        duplicated: claimStore.duplicated,
        error: claimStore.getState().error,
      }),
    [claimStore]
  )

  const handleSubmitForm = useCallback(() => {
    // Form most likely submitted by pressing Enter key in Safari
    if (!claimStore.getState().created) return

    // Resetting the query string after adding the data provider
    resetClaim()
  }, [claimStore])

  useDebouncedEffect(
    () => {
      if (claimStore.getState().query === '' || !formRef.current) return

      if (!formRef.current.dataProviderUrl.checkValidity()) {
        formRef.current.dataProviderUrl.reportValidity()
        return
      }

      claimStore.getState().retrieve()
    },
    [claim.query],
    500
  )

  useEffect(() => {
    if (router.query?.dataProviderUrl)
      claimStore.setState({ query: router.query?.dataProviderUrl })
  }, [router.query?.dataProviderUrl])

  return {
    formRef,
    claim,
    claimStore,
    handleSubmitForm,
    getFormMessage,
  }
}

export default useClaimController
