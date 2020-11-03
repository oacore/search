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

    return (
      <Main initialState={{ statistics }}>
        <Component {...pageProps} />
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
App.getInitialProps = async () => {
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
