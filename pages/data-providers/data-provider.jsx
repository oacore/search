import React, { useEffect, useContext, useRef } from 'react'
import { useRouter } from 'next/router'

import { withGlobalStore, GlobalContext } from 'store'
import DataProviderPageTemplate from 'templates/data-provider'
import useDebouncedEffect from 'hooks/use-debounced-effect'
import {
  DefaultHelperMessage,
  NewDataProviderHelperMessage,
  UnknownDataProviderHelperMessage,
  DuplicatedDataProviderHelperMessage,
} from 'texts/data-providers/helper-messages'

// TODO: Pages should be just a thin layer of NextJS.
//       Find a better place for it.
const useDataProviderController = () => {
  const formRef = useRef(null)
  const router = useRouter()
  const { dataProvider } = useContext(GlobalContext)

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

  return [formRef, dataProvider]
}

const getHelperMessage = ({ query, created, duplicated, error }) => {
  if (error) {
    return {
      message: <UnknownDataProviderHelperMessage />,
      variant: UnknownDataProviderHelperMessage.variant,
    }
  }

  if (created) {
    return {
      message: (
        <NewDataProviderHelperMessage oaiPmhEndpoint={created.oaiPmhEndpoint} />
      ),
      variant: NewDataProviderHelperMessage.variant,
    }
  }

  if (duplicated) {
    return {
      message: (
        <DuplicatedDataProviderHelperMessage
          query={query}
          existingDataProvidersCount={
            duplicated.existingDataProviders?.length || 0
          }
        />
      ),
      variant: DuplicatedDataProviderHelperMessage.variant,
    }
  }

  return {
    message: <DefaultHelperMessage />,
    variant: DefaultHelperMessage.variant,
  }
}

const DataProviderPage = () => {
  const router = useRouter()
  const handleSubmitForm = () => {
    router.push('/data-providers/finalisation')
  }

  const [formRef, dataProvider] = useDataProviderController()

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
    />
  )
}

export default withGlobalStore(DataProviderPage)
