// T-120 (41 B, R-040, R-055): utils/sentry.js. The module reads SENTRY_DSN once
// at load: without a DSN it never calls `Sentry.init`; with a DSN it calls it
// exactly once, with `{ dsn }` and the three options of CS-SEN-3 (AD-013; only
// `{ dsn }` with Sentry 5.30). It exports the SDK functions the app calls,
// imported by name, as `Sentry` and as the default export (AD-012; the whole
// SDK object with Sentry 5.30). `@sentry/node` is the factory spy of
// test/setup/mocks.js (next.config.js aliases it to `@sentry/browser` for the
// client bundle: T-004). Every case loads a fresh copy with
// jest.isolateModules after setting the env, so each load gets its own spy.

// mixed case on purpose: any case folding of the value must show
const DSN = 'https://PubKey1A2b@O0.ingest.sentry.io/4504'

// the options of `Sentry.init` for a DSN (CS-SEN-3, AD-013): no session or
// client-report envelopes, no trace headers, the integrations function
const optionsFor = (dsn) => ({
  dsn,
  sendClientReports: false,
  tracePropagationTargets: [],
  integrations: expect.any(Function),
})
// Sentry 11 default integrations the app drops: those Sentry 5.30 did not
// have (CS-SEN-3) and those newer than Sentry 7
const DROPPED = [
  'Dedupe',
  'NodeFetch',
  'Context',
  'Modules',
  'ProcessSession',
  'BrowserSession',
  'ConversationId',
  'NodeSystemError',
  'AwsLambdaWeb',
  'ChildProcess',
  'WorkerThreads',
  'CultureContext',
  'Express',
]

// the SDK functions the app calls are this load's spy functions (AD-012)
const expectSdkFunctions = (mod, sentry) => {
  expect(mod.Sentry.captureException).toBe(sentry.captureException)
  expect(mod.Sentry.withScope).toBe(sentry.withScope)
  expect(Object.keys(mod.Sentry)).toEqual(['captureException', 'withScope'])
}

// undefined = variable absent
const loadWith = (dsn) => {
  const saved = process.env.SENTRY_DSN
  if (dsn === undefined) delete process.env.SENTRY_DSN
  else process.env.SENTRY_DSN = dsn
  try {
    let mod
    let sentry
    jest.isolateModules(() => {
      mod = require('../../../utils/sentry')
      // the @sentry/node instance of this isolated registry
      sentry = require('@sentry/node')
    })
    return { mod, sentry }
  } finally {
    if (saved === undefined) delete process.env.SENTRY_DSN
    else process.env.SENTRY_DSN = saved
  }
}

describe('T-120 @P1 utils/sentry.js', () => {
  test('T-120 c1 @P1 without SENTRY_DSN (absent or empty) Sentry.init is not called', () => {
    ;[undefined, ''].forEach((dsn) => {
      const { mod, sentry } = loadWith(dsn)
      expectSdkFunctions(mod, sentry)
      expect(sentry.init).toBeDefined()
      expect(sentry.init).not.toHaveBeenCalled()
    })
  })

  test('T-120 c1 @P1 without a DSN the module exports only Sentry, the two SDK functions the app calls, and the same object as default', () => {
    const { mod, sentry } = loadWith(undefined)
    // the named export and the default export are the same object (AD-012)
    expect(Object.keys(mod)).toEqual(['Sentry', 'default'])
    expect(mod.default).toBe(mod.Sentry)
    expectSdkFunctions(mod, sentry)
    expect(typeof mod.Sentry.captureException).toBe('function')
  })

  test('T-120 c1 @P1 the DSN is read at load: setting it after the import does not initialise the SDK', () => {
    const { sentry } = loadWith(undefined)
    process.env.SENTRY_DSN = DSN
    try {
      expect(sentry.init).not.toHaveBeenCalled()
    } finally {
      delete process.env.SENTRY_DSN
    }
  })

  test('T-120 c2 @P1 with SENTRY_DSN Sentry.init is called once with exactly { dsn } and the three options of CS-SEN-3', () => {
    const { mod, sentry } = loadWith(DSN)
    expectSdkFunctions(mod, sentry)
    expect(sentry.init).toHaveBeenCalledTimes(1)
    // `{ dsn }` plus the three options of CS-SEN-3 (AD-013)
    expect(sentry.init).toHaveBeenCalledWith(optionsFor(DSN))
    const options = sentry.init.mock.calls[0][0]
    expect(Object.keys(options)).toEqual([
      'dsn',
      'sendClientReports',
      'tracePropagationTargets',
      'integrations',
    ])
    // the integrations function keeps those of Sentry 7 less the four Sentry
    // 5.30 did not have, as they are, except OnUncaughtException, which is
    // made anew so that it exits even with other handlers registered
    const names = [
      'EventFilters',
      'FunctionToString',
      'LinkedErrors',
      'Dedupe',
      'RequestData',
      'NodeSystemError',
      'ConversationId',
      'Console',
      'Http',
      'NodeFetch',
      'OnUncaughtException',
      'OnUnhandledRejection',
      'ContextLines',
      'LocalVariables',
      'AwsLambdaWeb',
      'Context',
      'ChildProcess',
      'WorkerThreads',
      'ProcessSession',
      'Modules',
      'Express',
      'BrowserApiErrors',
      'Breadcrumbs',
      'GlobalHandlers',
      'HttpContext',
      'CultureContext',
      'BrowserSession',
    ]
    const defaults = names.map((name) => ({ name }))
    const kept = options.integrations(defaults)
    expect(kept.map(({ name }) => name)).toEqual(
      names.filter((n) => !DROPPED.includes(n))
    )
    kept
      .filter(({ name }) => name !== 'OnUncaughtException')
      .forEach((i) => expect(defaults).toContain(i))
    expect(sentry.onUncaughtExceptionIntegration).toHaveBeenCalledWith({
      exitEvenIfOtherHandlersAreRegistered: true,
    })
    expect(Object.keys(mod)).toEqual(['Sentry', 'default'])
  })

  test('T-120 c2 @P1 requiring the module again in the same registry does not initialise twice', () => {
    const saved = process.env.SENTRY_DSN
    process.env.SENTRY_DSN = DSN
    try {
      let first
      let second
      let sentry
      jest.isolateModules(() => {
        first = require('../../../utils/sentry')
        second = require('../../../utils/sentry')
        sentry = require('@sentry/node')
      })
      expect(second).toBe(first)
      expect(sentry.init).toHaveBeenCalledTimes(1)
    } finally {
      if (saved === undefined) delete process.env.SENTRY_DSN
      else process.env.SENTRY_DSN = saved
    }
  })

  test('T-120 c2 @P1 a whitespace-only DSN is truthy and is passed on as it is', () => {
    const { sentry } = loadWith(' ')
    expect(sentry.init).toHaveBeenCalledTimes(1)
    expect(sentry.init).toHaveBeenCalledWith(optionsFor(' '))
  })

  test('T-120 c2 @P1 each fresh load initialises its own SDK instance once (no shared state between loads)', () => {
    const a = loadWith(DSN)
    const b = loadWith(DSN)
    expect(a.sentry).not.toBe(b.sentry)
    expect(a.sentry.init).toHaveBeenCalledTimes(1)
    expect(b.sentry.init).toHaveBeenCalledTimes(1)
  })
})
