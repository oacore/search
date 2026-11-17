import { init } from '@sentry/nextjs'

import { keptIntegrations } from './utils/sentry-integrations'

// Sentry in the browser: initialised only when the build had a SENTRY_DSN
// (next.config.js `env` inlines it). The app sends error events only: no
// client-report envelopes and no trace headers on outgoing requests.
if (process.env.SENTRY_DSN) {
  init({
    dsn: process.env.SENTRY_DSN,
    // @sentry/browser's environment: the SDK default 'production'
    // (@sentry/nextjs would fall back to NODE_ENV and Vercel's env)
    environment: undefined,
    sendClientReports: false,
    tracePropagationTargets: [],
    integrations: keptIntegrations,
  })
}
