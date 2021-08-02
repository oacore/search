import React, { useEffect } from 'react'
import { useRouter } from 'next/router'

import Error404 from 'templates/error'
import { fetchMetadata } from 'api/outputs'

// pages/_error is only rendered in case there is an error
// so it can't use getServerSideProps as it has to be rendered
// immediately when an error happens.

const Error = () => {
  const router = useRouter()
  const { id } = router.query

  useEffect(async () => {
    try {
      await fetchMetadata(id)
    } catch (error) {
      /* eslint-disable no-console */
      console.log(error)
      throw error
    }
  }, [])

  return <Error404 articleId={id} />
}

export default Error
