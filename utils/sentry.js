// NOTE: This require will be replaced with `@sentry/browser`
// client side thanks to the webpack config in next.config.js
const Sentry = require('@sentry/node')

// Default integrations of Sentry 7 that Sentry 5.30 did not have: Dedupe drops
// repeated events, Undici records every server-side fetch as a breadcrumb,
// Context and Modules attach host and package details to every event
const INTEGRATIONS_NOT_IN_5_30 = ['Dedupe', 'Undici', 'Context', 'Modules']

let sentryOptions
if (process.env.SENTRY_DSN) {
  sentryOptions = {
    dsn: process.env.SENTRY_DSN,
    // Sentry 7 would also send session and client-report envelopes and add
    // trace headers to every outgoing request; the app sends error events only
    autoSessionTracking: false,
    sendClientReports: false,
    tracePropagationTargets: [],
    integrations: (defaults) =>
      defaults.filter(({ name }) => !INTEGRATIONS_NOT_IN_5_30.includes(name)),
  }
}

if (sentryOptions) Sentry.init(sentryOptions)

module.exports = {
  Sentry,
}
