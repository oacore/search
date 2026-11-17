// P1-05: the console signature of a render error on a mounted page (T-716 c3, T-727; Q-047, Q-010, Q-100).
// React 17 reports the error through console.error (the ErrorBoundary of pages/_app.jsx catches it: no
// `pageerror`, no window `error`), and the one Sentry report it triggers is blocked by the CSP (`connect-src ...
// sentry.io` does not cover the test DSN host o0.ingest.sentry.io; Q-096): two more console errors and one
// securitypolicyviolation; no Sentry request leaves the page.
import { expect } from '../../fixtures/guard.mjs'
import { firstLine, pageConsole } from './page.mjs'

// Sentry 7 reports to the envelope endpoint (AD-023 for T-716 c3, AD-024 for T-727; Sentry 5.30:
// .../api/0/store/?sentry_key=public&sentry_version=7)
export const STORE =
  'https://o0.ingest.sentry.io/api/0/envelope/?sentry_version=7&sentry_key=public&sentry_client=sentry.javascript.nextjs%2F11.14.0'
// the connect-src directive as Chromium quotes it, with the LogRocket host of CS-LR-2 (AD-035 for T-716 c3, AD-052 for T-727)
export const CSP_CONNECT =
  "connect-src 'self' *.core.ac.uk core.ac.uk sentry.io *.google-analytics.com *.doubleclick.net *.googletagmanager.com *.cloudflareinsights.com *.logrocket.com *.lgrckt-in.com *.logr-in.com"
export const CSP_LINES = [
  `Connecting to '${STORE}' violates the following Content Security Policy directive: "${CSP_CONNECT}". The action has been blocked.`,
  `Fetch API cannot load ${STORE}. Refused to connect because it violates the document's Content Security Policy.`,
]
// "Rendered fewer hooks than expected" (the hooks of a mounted design search bar change with the page's search
// bar config)
export const REACT_300 =
  'Error: Minified React error #300; visit https://react.dev/errors/300 for the full message or use the non-minified dev environment for full errors and additional helpful warnings.'

// the guard fails on console.error and securitypolicyviolation: a test that pins the crash declares both
export const declareCrash = (test) =>
  test
    .info()
    .annotations.push(
      { type: 'guard-expect', description: 'console' },
      { type: 'guard-expect', description: 'csp' }
    )

// the signature of one crash since console index `from`: exactly the React error, the two CSP lines and one
// securitypolicyviolation for the Sentry store; no pageerror, no window error, no Sentry request
export function expectCrash(guardLog, from = 0) {
  expect(guardLog.pageErrors.map((e) => e.message)).toEqual([])
  expect(guardLog.windowErrors.map((e) => e.message)).toEqual([])
  const errors = pageConsole(guardLog, from)
    .filter((c) => c.type === 'error')
    .map((c) => firstLine(c.text))
    .sort()
  expect(errors).toEqual([REACT_300, ...CSP_LINES].sort())
  expect(guardLog.csp.map((v) => [v.effectiveDirective, v.blockedURI])).toEqual(
    [['connect-src', STORE]]
  )
  expect(guardLog.sentry).toEqual([])
}

// no console error and no policy violation (the page did not crash)
export function expectClean(guardLog, from = 0) {
  expect(guardLog.pageErrors.map((e) => e.message)).toEqual([])
  expect(guardLog.windowErrors.map((e) => e.message)).toEqual([])
  expect(
    pageConsole(guardLog, from)
      .filter((c) => c.type === 'error')
      .map((c) => firstLine(c.text))
  ).toEqual([])
  expect(guardLog.csp).toEqual([])
}
