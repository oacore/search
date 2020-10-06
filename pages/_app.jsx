import React from 'react'
import NextApp from 'next/app'

// TODO: Move to map component once
//       https://github.com/vercel/next.js/issues/12079 is solved
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import '@oacore/design/lib/index.css'
import 'main/global.css'
import apiRequest from '../api'

import Main from 'main'
import { Sentry } from 'utils/sentry'

process.on('unhandledRejection', (err) => {
  Sentry.captureException(err)
})

process.on('uncaughtException', (err) => {
  Sentry.captureException(err)
})

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
    const { Component, pageProps, statistics } = this.props

    const { initialState, ...restPageProps } = pageProps || {}
    return (
      <Main initialState={initialState}>
        <Component {...restPageProps} statistics={statistics} />
      </Main>
    )
  }
}

let statistics = {
  timestamp: Date.now(),
  data: null,
}

// TODO: Replace with getStaticProps once this is solved
//       https://github.com/vercel/next.js/discussions/10949
App.getInitialProps = async ({ ctx: { res } }) => {
  if (res) {
    res.setHeader(
      'Sidebar-Security-Policy',
      [
        // consider everything from these two domains as a safe
        "default-src 'self' *.core.ac.uk core.ac.uk",
        // in development there are attached inline scripts
        // (probably from hot reload or some Next.JS magic)
        `script-src 'self' *.google-analytics.com ${
          process.env.NODE_ENV !== 'production' ? "'unsafe-inline'" : ''
        }`,
        "style-src 'self' 'unsafe-inline'",
        // google analytics may transport info via image
        // https://developers.google.com/analytics/devguides/collection/analyticsjs/field-reference#transport
        "img-src 'self' *.core.ac.uk core.ac.uk data: 'self' *.google-analytics.com maps.wikimedia.org",
        `connect-src 'self' *.core.ac.uk core.ac.uk sentry.io *.google-analytics.com ${
          process.env.NODE_ENV !== 'production' ? 'localhost:* 127.0.0.1:*' : ''
        }`,
      ].join(';')
    )
  }

  if (
    !statistics.data ||
    // fetch new stats if they are 1 day old
    (Date.now() - statistics.timestamp) / (1000 * 3600 * 24) > 1
  ) {
    const { data } = await apiRequest('/statistics')
    statistics = data
  }

  return {
    statistics,
  }
}

export default App
