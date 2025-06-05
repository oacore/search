/*
 * Content-Security-Policy
 */
const SELF = "'self'"
const PRODUCTION = '*.core.ac.uk core.ac.uk'
const LOGROCKET = '*.logrocket.com *.lgrckt-in.com'

const config = {
  'default-src': [SELF, PRODUCTION],
  'script-src': [
    SELF,
    '*.google-analytics.com',
    '*.doubleclick.net',
    '*.googletagmanager.com',
    '*.cloudflareinsights.com',
    LOGROCKET,
    'blob:',
    'data:',
  ],
  'script-src-elem': [
    SELF,
    '*.google-analytics.com',
    '*.doubleclick.net',
    '*.googletagmanager.com',
    '*.cloudflareinsights.com',
    LOGROCKET,
    'blob:',
    'data:',
    "'unsafe-inline'",
    "'unsafe-eval'",
  ],
  'worker-src': [SELF, LOGROCKET, 'blob:', 'data:'],
  // TODO: Move 'unsafe-inline' to dev when the Next.js' bug is resolved
  // See more: https://github.com/vercel/next.js/issues/17445
  'style-src': [SELF, "'unsafe-inline'"],
  'img-src': [
    SELF,
    PRODUCTION,
    'data:',
    '*.openstreetmap.org',
    // Google Analytics may transport data via image:
    // https://developers.google.com/analytics/devguides/collection/analyticsjs/field-reference#transport
    '*.google-analytics.com',
    '*.doubleclick.net',
    '*.googletagmanager.com',
    '*.cloudflareinsights.com',
    LOGROCKET,
  ],
  'connect-src': [
    SELF,
    PRODUCTION,
    'sentry.io',
    '*.google-analytics.com',
    '*.doubleclick.net',
    '*.googletagmanager.com',
    '*.cloudflareinsights.com',
    LOGROCKET,
  ],
  'object-src': ["'none'"],
  'media-src': [SELF, 'data:', LOGROCKET],
  'child-src': [SELF, 'blob:', LOGROCKET],
}

if (process.env.NODE_ENV !== 'production') {
  // Allow hot module replacement using inlined scripts and styles
  config['script-src'].push("'unsafe-inline'", "'unsafe-eval'")
  config['script-src-elem'].push("'unsafe-inline'", "'unsafe-eval'")

  // Allow connection to the local hosts in development:
  // - local API is running on a different port
  // - `localhost` and `127.0.0.1` are not the same domain technically
  config['connect-src'].push('localhost:* 127.0.0.1:* api-dev.core.ac.uk')
}

const policy = Object.entries(config)
  .map(([directive, value]) => `${directive} ${value.join(' ')}`)
  .join(';')

module.exports = policy
