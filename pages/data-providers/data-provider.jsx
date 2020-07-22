import React, { useEffect, useContext, useRef } from 'react'
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

  useDebouncedEffect(
    () => {
      if (dataProvider.query === '') return
      if (!formRef.current?.dataProviderUrl.checkValidity()) {
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
      message:
        'We could not find any OAI-PMH endpoint.' +
        ' Please try it with another URL.',
      variant: 'error',
    }
  }

  if (created) {
    return {
      message: `We found OAI-PMH endpoint at ${created.url}`,
      variant: 'success',
    }
  }

  if (duplicated.length) {
    return {
      message:
        `${query} ${
          duplicated.length > 1 ? `and ${duplicated.length - 1} more are` : 'is'
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
