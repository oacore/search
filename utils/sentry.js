// NOTE: This import will be replaced with `@sentry/browser`
// client side thanks to the webpack config in next.config.js. The functions are
// imported by name so that the client bundle holds only what they need.
import {
  init,
  captureException,
  withScope,
  onUncaughtExceptionIntegration,
  httpIntegration,
} from '@sentry/node'

// The default integrations the app keeps: those of Sentry 7 less Dedupe,
// Undici, Context and Modules, which Sentry 5.30 did not have (EventFilters
// was InboundFilters, BrowserApiErrors was TryCatch). Everything newer stays
// out too: sessions, fetch breadcrumbs, child process and worker reports.
// RequestData is out as well: Sentry 7 only filled it through
// Handlers.requestHandler, which the app never used; Sentry 8+ fills it for
// every incoming request (URL, query, headers, cookies, client IP).
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
  'LinkedErrors',
]

const keepIntegrations = (defaults) =>
  defaults
    .filter(({ name }) => INTEGRATIONS_KEPT.includes(name))
    .map((integration) => {
      // Server only: the client bundle has neither integration.
      if (process.browser) return integration
      // Sentry 7 exited after an uncaught exception even with other
      // handlers registered (the app's and Next's); Sentry 8+ does not by
      // default.
      if (integration.name === 'OnUncaughtException') {
        return onUncaughtExceptionIntegration({
          exitEvenIfOtherHandlersAreRegistered: true,
        })
      }
      // no request sessions (Sentry 7 had none without requestHandler)
      if (integration.name === 'Http')
        return httpIntegration({ sessions: false })
      return integration
    })

// Sentry 8+ names the event after the incoming request ('GET /search/') and
// adds its response status; Sentry 7 set neither without requestHandler.
const dropRequestFields = (event) => {
  delete event.transaction
  if (event.contexts) delete event.contexts.response
  return event
}

let sentryOptions
if (process.env.SENTRY_DSN) {
  sentryOptions = {
    dsn: process.env.SENTRY_DSN,
    // the app sends error events only: no client-report envelopes and no
    // trace headers on outgoing requests (sessions: see INTEGRATIONS_KEPT)
    sendClientReports: false,
    tracePropagationTargets: [],
    integrations: keepIntegrations,
    ...(process.browser ? {} : { beforeSend: dropRequestFields }),
  }
}

if (sentryOptions) init(sentryOptions)

// the SDK functions the app calls (pages/_app.jsx), also as the default export
export const Sentry = { captureException, withScope }

export default Sentry
