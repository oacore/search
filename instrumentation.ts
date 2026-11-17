import { keptIntegrations } from './utils/sentry-integrations'

// Sentry on the server: initialised only when the build had a SENTRY_DSN
// (next.config.js `env` inlines it), and the app sends error events only.

// Sentry 8+ names the event after the incoming request ('GET /search/') and
// adds its response status; Sentry 7 set neither without requestHandler.
export const dropRequestFields = (event: any) => {
  delete event.transaction
  if (event.contexts) delete event.contexts.response
  return event
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.SENTRY_DSN) return
  const { init, onUncaughtExceptionIntegration, httpIntegration } =
    await import('@sentry/nextjs')
  const client = init({
    dsn: process.env.SENTRY_DSN,
    // @sentry/node's environment: SENTRY_ENVIRONMENT, else the SDK default
    // 'production' (@sentry/nextjs would fall back to Vercel's env and
    // NODE_ENV)
    environment: process.env.SENTRY_ENVIRONMENT,
    // no client-report envelopes and no trace headers on outgoing requests
    // (sessions: see below)
    sendClientReports: false,
    tracePropagationTargets: [],
    integrations: (defaults: any[]) =>
      keptIntegrations(defaults).map((integration: any) => {
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
      }),
    beforeSend: dropRequestFields,
    // @sentry/node's default, which @sentry/nextjs turns on: no OpenTelemetry
    // tracer for Next's spans
    enableOpenTelemetrySetup: false,
  })
  // @sentry/nextjs's init puts the request's trace into a Server-Timing header
  // of uncached HTML responses (addServerTimingTraceHeader, no option to turn
  // it off); @sentry/node 7 sent no such header. This hook runs after the
  // SDK's for each request and ignores the SDK's setHeader call for it.
  client?.on('httpServerRequest', (_request: unknown, response: any) => {
    const writeHead = response?.writeHead
    if (typeof writeHead !== 'function') return
    response.writeHead = function writeHeadWithoutTrace(...args: any[]) {
      const own = Object.prototype.hasOwnProperty.call(response, 'setHeader')
      const { setHeader } = response
      response.setHeader = function setHeaderWithoutTrace(
        name: string,
        value: unknown
      ) {
        if (
          String(name).toLowerCase() === 'server-timing' &&
          String(value).includes('sentry-trace')
        )
          return this
        return setHeader.call(this, name, value)
      }
      try {
        return writeHead.apply(this, args)
      } finally {
        if (own) response.setHeader = setHeader
        else delete response.setHeader
      }
    }
  })
}
