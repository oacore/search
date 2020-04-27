// NOTE: This require will be replaced with `@sentry/browser`
// client side thanks to the webpack config in next.config.js
const Sentry = require('@sentry/node')

let sentryOptions
if (process.env.SENTRY_DSN) {
  sentryOptions = {
    dsn: process.env.SENTRY_DSN,
  }
}

if (sentryOptions) Sentry.init(sentryOptions)

module.exports = {
  Sentry,
}
