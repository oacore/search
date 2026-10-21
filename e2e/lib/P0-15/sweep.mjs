// P0-15 assertions shared by the T-720 sweep and its in-page states: the settled page raised no
// securitypolicyviolation, and the third-party traffic is the one a healthy policy gives (LogRocket's script
// requested once and aborted by the guard AFTER the CSP check, GA loaded only with consent, no Sentry request).
import { expect } from '../../fixtures/guard.mjs'
import { LOGROCKET_HOST, census } from './analytics.mjs'

export const expectNoViolation = (guardLog, { consented }) => {
  expect(guardLog.csp, 'securitypolicyviolation events').toEqual([])
  const c = census(guardLog)
  expect(c.logrocket).toEqual(['GET https://cdn.lgrckt-in.com/logger-1.min.js'])
  expect(guardLog.aborted).toEqual({ [LOGROCKET_HOST]: 1 })
  expect(c.gtag).toHaveLength(consented ? 1 : 0)
  expect(c.google).toEqual([])
  expect(c.sentry).toEqual([])
  expect(guardLog.sentry).toEqual([])
}
