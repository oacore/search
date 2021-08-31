import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

import Error404 from 'templates/error'
import request from 'api'
import { fetchMetadata as fetchOutputMetadata } from 'api/outputs'

// pages/_error is only rendered in case there is an error
// so it can't use getServerSideProps as it has to be rendered
// immediately when an error happens.

const Error = () => {
  const [errorStatus, setErrorStatus] = useState()
  const router = useRouter()
  const { id } = router.query

  useEffect(async () => {
    try {
      const { dataProvider } = await fetchOutputMetadata(id)

      if (dataProvider) await request(dataProvider)
    } catch (error) {
      setErrorStatus(error.status)
    }
  }, [])

  return <Error404 articleId={id} errorStatus={errorStatus} />
}

export default Error
