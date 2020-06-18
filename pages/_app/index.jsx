import React from 'react'
import NextApp from 'next/app'

import '@oacore/design/lib/index.css'

import './global.css'

import Layout from 'modules/layout'
import { Sentry } from 'utils/sentry'

process.on('unhandledRejection', (err) => {
  Sentry.captureException(err)
})

process.on('uncaughtException', (err) => {
  Sentry.captureException(err)
})

export async function getStaticProps({ res }) {
  res.setHeader(
    'Content-Security-Policy',
    [
      // consider everything from these two domains as a safe
      "default-src 'self' *.core.ac.uk core.ac.uk",
      // in development there are attached inline scripts
      // (probably from hot reload or some Next.JS magic)
      `script-src 'self' *.google-analytics.com ${
        process.env.NODE_ENV !== 'production' ? "'unsafe-inline'" : ''
      }`,
      `style-src 'self' ${
        process.env.NODE_ENV !== 'production' ? "'unsafe-inline'" : ''
      }`,
      // google analytics may transport info via image
      // https://developers.google.com/analytics/devguides/collection/analyticsjs/field-reference#transport
      "img-src 'self' *.core.ac.uk core.ac.uk data: 'self' *.google-analytics.com",
      `connect-src 'self' *.core.ac.uk core.ac.uk sentry.io *.google-analytics.com ${
        process.env.NODE_ENV !== 'production' ? 'localhost:* 127.0.0.1:*' : ''
      }`,
    ].join(';')
  )
}

class App extends NextApp {
  // eslint-disable-next-line class-methods-use-this
  componentDidCatch(error, errorInfo) {
    Sentry.withScope((scope) => {
      Object.keys(errorInfo).forEach((key) => {
        scope.setExtra(key, errorInfo[key])
        scope.setExtra('ssr', false)
      })
      Sentry.captureException(error)
    })
  }

  render() {
    const { Component, pageProps } = this.props

    return (
      <Layout>
        <Component {...pageProps} />
      </Layout>
    )
  }
}

export default App
