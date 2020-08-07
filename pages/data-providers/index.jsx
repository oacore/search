import React, { useEffect, useContext, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { Link } from '@oacore/design'

import { withGlobalStore, GlobalContext } from 'store'
import DataProviderPageTemplate from 'templates/data-providers'
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

const searchUrlFor = (id) => `https://core.ac.uk/search?q=repositories.id:${id}`

const SUPPORT_EMAIL_URL = 'mailto:t%68%65t%65am%40core%2e%61c%2eu%6b'
const SUPPORT_EMAIL = decodeURIComponent(
  SUPPORT_EMAIL_URL.slice('mailto:'.length)
)

const getHelperMessage = ({ created, duplicated, error }) => {
  if (error) {
    return {
      message: (
        <>
          We cannot detect a repository or a journal at this address. Please,
          provide the exact OAI-PMH endpoint. If you are having trouble contact
          us at <Link href={SUPPORT_EMAIL_URL}>{SUPPORT_EMAIL}</Link>.
        </>
      ),
      variant: 'error',
    }
  }

  if (created) {
    return {
      message: (
        <>
          We found {created.name} under the provided address and added it to our
          data provider collection. We will start harvesting as soon as we are
          able to approve it.
        </>
      ),
      variant: 'success',
    }
  }

  if (duplicated) {
    return {
      message: (
        <>
          <a href={searchUrlFor(duplicated.existingDataProviders[0].id)}>
            {duplicated.existingDataProviders[0].name}
          </a>{' '}
          {duplicated.existingDataProviders.length > 1
            ? `and ${
                duplicated.existingDataProviders.length - 1
              } more are our data providers`
            : 'is our data provider'}{' '}
          already. If you host multiple repositories or journals on the same
          domain please specify exact OAI-PMH endpoint or contact us at{' '}
          <Link href={SUPPORT_EMAIL_URL}>{SUPPORT_EMAIL}</Link>.
        </>
      ),
      variant: 'error',
    }
  }

  return {
    message: 'It can be any resource, home page or an OAI-PMH endpoint',
    variant: 'normal',
  }
}

const DataProviderPage = ({ store }) => {
  const [formRef, dataProvider, resetDataProvider] = useDataProviderController()

  const handleSubmitForm = () => {
    // Form most likely submitted by pressing Enter key in Safari
    if (!dataProvider.created) return

    // Resetting the query string after adding the data provider
    resetDataProvider()
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
      oaiPmhUrl={store.created?.oaiPmhUrl}
    />
  )
}

export default withGlobalStore(DataProviderPage)
