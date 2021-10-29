import React from 'react'

import Error404 from 'templates/error'

const Error = () => {
  const error = {
    status: 404,
    message: `The page you were looking for could not be found`,
  }

  return <Error404 error={error} />
}

export default Error
