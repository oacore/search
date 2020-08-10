import React from 'react'
import Head from 'next/head'
import { classNames } from '@oacore/design/lib/utils'

const Title = ({ children, hidden = false, tag: Tag = 'h1' }) => {
  if (!(typeof children === 'string'))
    throw new Error('Unsupported children for Title component')

  return (
    <>
      <Head>
        <title>{children} - CORE</title>
      </Head>
      <Tag className={classNames.use(hidden && 'sr-only')}>{children}</Tag>
    </>
  )
}

export default Title
