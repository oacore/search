import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

import { fetchMetadata as fetchOutputMetadata } from 'api/outputs'
import request from 'api'
import Error404 from 'templates/error'
import QueryError from 'templates/search/errors/query'

// pages/_error is only rendered in case there is an error
// so it can't use getServerSideProps as it has to be rendered
// immediately when an error happens.

const Error = () => {
  const [errorStatus, setErrorStatus] = useState()
  const [searchQuery, setSearchQuery] = useState()
  const router = useRouter()
  const { id } = router.query

  useEffect(async () => {
    if (router.asPath.includes('search')) {
      const query = router.asPath.match(/(?<=search\/).*/).join('')
      setSearchQuery(query)
      return
    }
    try {
      const { dataProvider } = await fetchOutputMetadata(id)

      if (dataProvider) await request(dataProvider)
    } catch (error) {
      setErrorStatus(error.status)
    }
  }, [])

  return searchQuery ? (
    <QueryError query={searchQuery} />
  ) : (
    <Error404 articleId={id} errorStatus={errorStatus} />
  )
}

export default Error
