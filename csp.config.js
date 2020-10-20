/*!
 * Content-Security-Policy
 */
const SELF = "'self'"
const PRODUCION = '*.core.ac.uk'

const config = {
  'default-src': [SELF, PRODUCION],
  'script-src': [SELF, '*.google-analytics.com'],
  'style-src': [SELF],
  // Google Analytics may transport data via image:
  // https://developers.google.com/analytics/devguides/collection/analyticsjs/field-reference#transport
  'img-src': [SELF, PRODUCION, 'data:', '*.google-analytics.com'],
  'connect-src': [SELF, PRODUCION, 'sentry.io', '*.google-analytics.com'],
}

if (process.env.NODE_ENV !== 'production') {
  // Allow hot module replacement using inlined scripts and styles
  //
  // Because styles are always built, it could be injected without inlining
  // See the bug report: https://github.com/oacore/design/pull/350
  config['script-src'].push("'unsafe-inline'", "'unsafe-eval'")
  config['style-src'].push("'unsafe-inline'")

  // Allow connection to the local hosts in development:
  // - local API is running on a different port
  // - `localhost` and `127.0.0.1` are not the same domain technically
  config['connect-src'].push('localhost:* 127.0.0.1:*')
}

const policy = Object.entries(config)
  .map(([directive, value]) => `${directive} ${value.join(' ')}`)
  .join(';')

module.exports = policy
