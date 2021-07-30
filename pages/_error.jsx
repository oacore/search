import React from 'react'

import Error404 from 'templates/error'
import { fetchMetadata } from 'api/outputs'

export async function getServerSideProps(context) {
  const { id } = context.query

  try {
    const res = await fetchMetadata(id)
    return {
      props: { res },
    }
  } catch (error) {
    const { status } = error
    return {
      props: { status },
    }
  }
}

const Error = ({ status }) => <Error404 status={status} />

export default Error
