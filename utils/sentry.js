// NOTE: This import will be replaced with `@sentry/browser`
// client side thanks to the webpack config in next.config.js. The functions are
// imported by name so that the client bundle holds only what they need.
import {
  init,
  captureException,
  withScope,
  onUncaughtExceptionIntegration,
} from '@sentry/node'

// The default integrations the app keeps: those of Sentry 7 less Dedupe,
// Undici, Context and Modules, which Sentry 5.30 did not have (EventFilters
// was InboundFilters, BrowserApiErrors was TryCatch). Everything newer stays
// out too: sessions, fetch breadcrumbs, child process and worker reports.
const INTEGRATIONS_KEPT = [
  'EventFilters',
  'FunctionToString',
  'BrowserApiErrors',
  'Breadcrumbs',
  'GlobalHandlers',
  'HttpContext',
  'Console',
  'Http',
  'OnUncaughtException',
  'OnUnhandledRejection',
  'ContextLines',
  'LocalVariables',
  'RequestData',
  'LinkedErrors',
]

const keepIntegrations = (defaults) =>
  defaults
    .filter(({ name }) => INTEGRATIONS_KEPT.includes(name))
    .map((integration) =>
      // Sentry 7 exited after an uncaught exception even with other
      // handlers registered (the app's and Next's); Sentry 8+ does not by
      // default. Server only: the client bundle has no such integration.
      !process.browser && integration.name === 'OnUncaughtException'
        ? onUncaughtExceptionIntegration({
            exitEvenIfOtherHandlersAreRegistered: true,
          })
        : integration
    )

let sentryOptions
if (process.env.SENTRY_DSN) {
  sentryOptions = {
    dsn: process.env.SENTRY_DSN,
    // the app sends error events only: no client-report envelopes and no
    // trace headers on outgoing requests (sessions: see INTEGRATIONS_KEPT)
    sendClientReports: false,
    tracePropagationTargets: [],
    integrations: keepIntegrations,
  }
}

if (sentryOptions) init(sentryOptions)

// the SDK functions the app calls (pages/_app.jsx), also as the default export
export const Sentry = { captureException, withScope }

export default Sentry
