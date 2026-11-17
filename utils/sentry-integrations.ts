// The default integrations the app keeps, on the server (instrumentation.ts)
// and in the browser (instrumentation-client.ts): those of Sentry 7 less
// Dedupe, Undici, Context and Modules, which Sentry 5.30 did not have
// (EventFilters was InboundFilters, BrowserApiErrors was TryCatch).
// Everything newer stays out too: sessions, fetch breadcrumbs, child process
// and worker reports, and the integrations @sentry/nextjs adds (stack frame
// rewrites, browser tracing, `use cache`).
// RequestData is out as well: Sentry 7 only filled it through
// Handlers.requestHandler, which the app never used; Sentry 8+ fills it for
// every incoming request (URL, query, headers, cookies, client IP).
export const INTEGRATIONS_KEPT = [
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

export const keptIntegrations = (defaults: any[]) =>
  defaults.filter(({ name }) => INTEGRATIONS_KEPT.includes(name))
