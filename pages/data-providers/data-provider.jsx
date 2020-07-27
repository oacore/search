import React, {
  useEffect,
  useContext,
  useRef,
  useState,
  useCallback,
} from 'react'
import { useRouter } from 'next/router'

import { withGlobalStore, GlobalContext } from 'store'
import DataProviderPageTemplate from 'templates/data-provider'
import useDebouncedEffect from 'hooks/use-debounced-effect'

// TODO: Pages should be just a thin layer of NextJS.
//       Find a better place for it.
const useDataProviderController = () => {
  const formRef = useRef(null)
  const router = useRouter()
  const { dataProvider } = useContext(GlobalContext)

  const resetDataProvider = useCallback(
    () => dataProvider.reset({ query: true }),
    []
  )

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

  return [formRef, dataProvider, resetDataProvider]
}

const getHelperMessage = ({ created, duplicated, error }) => {
  if (error) {
    return {
      message:
        'We could not find any OAI-PMH endpoint.' +
        ' Please try it with another URL.',
      variant: 'error',
    }
  }

  if (created) {
    return {
      message: `We found OAI-PMH endpoint at ${created.oaiPmhEndpoint}`,
      variant: 'success',
    }
  }

  if (duplicated) {
    return {
      message:
        `${duplicated.existingDataProviders[0].oaiPmhEndpoint} ${
          duplicated.existingDataProviders.length > 1
            ? `and ${duplicated.existingDataProviders.length - 1} more are`
            : 'is'
        } already` +
        ' in our system. If you host more than one repository on the same domain,' +
        ' please specify exact OAI-PMH endpoint',
      variant: 'error',
    }
  }

  return {
    message:
      'It can be any URL: homepage address, any data resource address,' +
      ' OAI-PMH endpoint or RIOXX endpoint',
    variant: 'normal',
  }
}

const DataProviderPage = ({ store }) => {
  const router = useRouter()
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [formRef, dataProvider, resetDataProvider] = useDataProviderController()

  useEffect(() => {
    const handleRouteChange = (url) => {
      if (url.startsWith('/data-providers')) {
        const newUrl = new URL(url, window.location)
        const urlParams = new URLSearchParams(newUrl.search)
        if (urlParams.get('success') && store.dataProvider.created)
          setShowSuccessMessage(true)
        else {
          setShowSuccessMessage(false)
          resetDataProvider()
        }
      }
    }

    router.events.on('routeChangeStart', handleRouteChange)

    return () => {
      router.events.off('routeChangeStart', handleRouteChange)
    }
  }, [])

  const handleSubmitForm = () => {
    router.push({
      pathname: router.pathname,
      query: { success: true },
    })
  }

  const { message, variant } = getHelperMessage(dataProvider)

  return (
    <DataProviderPageTemplate
      ref={formRef}
      url={dataProvider.query}
      onUrlChange={(event) => {
        dataProvider.query = event.target.value
      }}
      isFormValid={dataProvider.created}
      onSubmit={handleSubmitForm}
      helperMessage={dataProvider.isLoading ? '' : message}
      variant={dataProvider.isLoading ? 'progress' : variant}
      isLoading={dataProvider.isLoading}
      showSuccessMessage={showSuccessMessage}
      oaiPmhUrl={store.created?.oaiPmhUrl}
    />
  )
}

export default withGlobalStore(DataProviderPage)
