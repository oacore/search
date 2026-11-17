// T-120 (41 B, R-040, R-055): the Sentry setup, instrumentation.ts (server,
// `register()`) and instrumentation-client.ts (browser) on @sentry/nextjs
// (CS-SEN-2; utils/sentry.js on @sentry/node and @sentry/browser before).
// Without SENTRY_DSN neither calls `Sentry.init`; with a DSN each calls it
// exactly once, with `{ dsn }` and the options of CS-SEN-3 (AD-013), the same
// integration filter in both, and on the server the beforeSend of
// SENTRY-REQDATA-1 and @sentry/node's enableOpenTelemetrySetup default. The
// build inlines SENTRY_DSN (next.config.js `env`); here the env is read when
// the client module loads and when `register()` runs. `@sentry/nextjs` is the
// factory spy of test/setup/mocks.js. Every case loads fresh copies with
// jest.isolateModules after setting the env, so each load gets its own spy.
// c3 runs `register()` on the real SDK in a child process and checks what a
// server event during an incoming request carries (SENTRY-REQDATA-1).
const { execFileSync } = require('node:child_process')
const path = require('node:path')

// mixed case on purpose: any case folding of the value must show
const DSN = 'https://PubKey1A2b@O0.ingest.sentry.io/4504'

// the options of the browser `Sentry.init` for a DSN (CS-SEN-3, AD-013): no
// client-report envelopes, no trace headers, the integrations function
const clientOptionsFor = (dsn) => ({
  dsn,
  sendClientReports: false,
  tracePropagationTargets: [],
  integrations: expect.any(Function),
})
// the server adds the request-data filter and keeps OpenTelemetry off
const serverOptionsFor = (dsn) => ({
  ...clientOptionsFor(dsn),
  beforeSend: expect.any(Function),
  enableOpenTelemetrySetup: false,
})
// Sentry 11 default integrations the app drops: those Sentry 5.30 did not
// have (CS-SEN-3), those newer than Sentry 7 and those @sentry/nextjs adds
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
  'RequestData',
  'DistDirRewriteFrames',
  'NextjsUseCache',
  'BrowserTracing',
  'NextjsClientStackFrameNormalization',
]
const NAMES = [
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
  'DistDirRewriteFrames',
  'NextjsUseCache',
  'BrowserApiErrors',
  'Breadcrumbs',
  'GlobalHandlers',
  'HttpContext',
  'CultureContext',
  'BrowserSession',
  'BrowserTracing',
  'NextjsClientStackFrameNormalization',
]

const withEnv = (vars, fn) => {
  const saved = Object.fromEntries(
    Object.keys(vars).map((k) => [k, process.env[k]])
  )
  const set = (values) =>
    Object.entries(values).forEach(([k, v]) => {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    })
  set(vars)
  let result
  try {
    result = fn()
  } catch (error) {
    set(saved)
    throw error
  }
  if (result && typeof result.then === 'function')
    return result.finally(() => set(saved))
  set(saved)
  return result
}

// undefined = variable absent
const loadClient = (dsn) =>
  withEnv({ SENTRY_DSN: dsn }, () => {
    let sentry
    jest.isolateModules(() => {
      require('../../../instrumentation-client')
      sentry = require('@sentry/nextjs')
    })
    return sentry
  })

const loadServer = () => {
  let mod
  let sentry
  jest.isolateModules(() => {
    mod = require('../../../instrumentation')
    sentry = require('@sentry/nextjs')
  })
  return { mod, sentry }
}

// register() imports the SDK when it runs: the whole call stays inside one
// isolated registry
const registerWith = (dsn, runtime = 'nodejs') =>
  withEnv({ SENTRY_DSN: dsn, NEXT_RUNTIME: runtime }, async () => {
    let mod
    let sentry
    await jest.isolateModulesAsync(async () => {
      mod = require('../../../instrumentation')
      await mod.register()
      sentry = require('@sentry/nextjs')
    })
    return { mod, sentry }
  })

describe('T-120 @P1 instrumentation.ts and instrumentation-client.ts', () => {
  test('T-120 c1 @P1 without SENTRY_DSN (absent or empty) Sentry.init is not called, on the server or in the browser', async () => {
    const servers = [await registerWith(undefined), await registerWith('')]
    servers.forEach(({ sentry }) => {
      expect(sentry.init).toBeDefined()
      expect(sentry.init).not.toHaveBeenCalled()
    })
    ;[undefined, ''].forEach((dsn) =>
      expect(loadClient(dsn).init).not.toHaveBeenCalled()
    )
  })

  test('T-120 c1 @P1 the browser reads the DSN at load: setting it after the import does not initialise the SDK', () => {
    const sentry = loadClient(undefined)
    withEnv({ SENTRY_DSN: DSN }, () => {
      expect(sentry.init).not.toHaveBeenCalled()
    })
  })

  test('T-120 c1 @P1 the server module exports register and the request-data filter only, and initialises nothing when loaded', () => {
    const { mod, sentry } = withEnv(
      { SENTRY_DSN: DSN, NEXT_RUNTIME: 'nodejs' },
      loadServer
    )
    expect(Object.keys(mod).sort()).toEqual(['dropRequestFields', 'register'])
    expect(sentry.init).not.toHaveBeenCalled()
  })

  test('T-120 c1 @P1 register() outside the Node.js runtime does not initialise the SDK', async () => {
    const { sentry } = await registerWith(DSN, 'edge')
    expect(sentry.init).not.toHaveBeenCalled()
  })

  test('T-120 c2 @P1 with SENTRY_DSN the browser calls Sentry.init once with exactly { dsn } and the three options of CS-SEN-3', () => {
    const sentry = loadClient(DSN)
    expect(sentry.init).toHaveBeenCalledTimes(1)
    expect(sentry.init).toHaveBeenCalledWith(clientOptionsFor(DSN))
    const options = sentry.init.mock.calls[0][0]
    expect(Object.keys(options)).toEqual([
      'dsn',
      'environment',
      'sendClientReports',
      'tracePropagationTargets',
      'integrations',
    ])
    // present and undefined: the SDK default 'production', as @sentry/browser
    // had, not @sentry/nextjs's NODE_ENV fallback
    expect(options.environment).toBeUndefined()
    // the kept defaults, as they are
    const defaults = NAMES.map((name) => ({ name }))
    const kept = options.integrations(defaults)
    expect(kept.map(({ name }) => name)).toEqual(
      NAMES.filter((n) => !DROPPED.includes(n))
    )
    kept.forEach((i) => expect(defaults).toContain(i))
    expect(sentry.onUncaughtExceptionIntegration).not.toHaveBeenCalled()
    expect(sentry.httpIntegration).not.toHaveBeenCalled()
  })

  test('T-120 c2 @P1 with SENTRY_DSN register() calls Sentry.init once with { dsn }, the options of CS-SEN-3, the request-data filter and OpenTelemetry off', async () => {
    const { mod, sentry } = await registerWith(DSN)
    expect(sentry.init).toHaveBeenCalledTimes(1)
    expect(sentry.init).toHaveBeenCalledWith(serverOptionsFor(DSN))
    const options = sentry.init.mock.calls[0][0]
    expect(Object.keys(options)).toEqual([
      'dsn',
      'environment',
      'sendClientReports',
      'tracePropagationTargets',
      'integrations',
      'beforeSend',
      'enableOpenTelemetrySetup',
    ])
    expect(options.beforeSend).toBe(mod.dropRequestFields)
    // @sentry/node's environment: SENTRY_ENVIRONMENT, else the SDK default
    expect(options.environment).toBe(process.env.SENTRY_ENVIRONMENT)
    // the integrations function keeps those of Sentry 7 less the four Sentry
    // 5.30 did not have and RequestData, as they are, except
    // OnUncaughtException, made anew so that it exits even with other handlers
    // registered, and Http, made anew without request sessions
    const defaults = NAMES.map((name) => ({ name }))
    const kept = options.integrations(defaults)
    expect(kept.map(({ name }) => name)).toEqual(
      NAMES.filter((n) => !DROPPED.includes(n))
    )
    kept
      .filter(({ name }) => !['OnUncaughtException', 'Http'].includes(name))
      .forEach((i) => expect(defaults).toContain(i))
    expect(sentry.onUncaughtExceptionIntegration).toHaveBeenCalledWith({
      exitEvenIfOtherHandlersAreRegistered: true,
    })
    expect(sentry.httpIntegration).toHaveBeenCalledWith({ sessions: false })
    // beforeSend drops the request-derived transaction name and response
    // context and leaves the rest of the event as it is
    const event = {
      transaction: 'GET /search/',
      contexts: { response: { status_code: 200 }, runtime: { name: 'node' } },
      extra: { a: 1 },
    }
    expect(options.beforeSend(event)).toEqual({
      contexts: { runtime: { name: 'node' } },
      extra: { a: 1 },
    })
  })

  test('T-120 c2 @P1 requiring the browser module again in the same registry does not initialise twice', () => {
    withEnv({ SENTRY_DSN: DSN }, () => {
      let sentry
      jest.isolateModules(() => {
        require('../../../instrumentation-client')
        require('../../../instrumentation-client')
        sentry = require('@sentry/nextjs')
      })
      expect(sentry.init).toHaveBeenCalledTimes(1)
    })
  })

  test('T-120 c2 @P1 a whitespace-only DSN is truthy and is passed on as it is', async () => {
    expect(loadClient(' ').init).toHaveBeenCalledWith(clientOptionsFor(' '))
    const { sentry } = await registerWith(' ')
    expect(sentry.init).toHaveBeenCalledWith(serverOptionsFor(' '))
  })

  test('T-120 c2 @P1 each fresh load initialises its own SDK instance once (no shared state between loads)', () => {
    const a = loadClient(DSN)
    const b = loadClient(DSN)
    expect(a).not.toBe(b)
    expect(a.init).toHaveBeenCalledTimes(1)
    expect(b.init).toHaveBeenCalledTimes(1)
  })

  test('T-120 c3 @P1 a server event during an incoming request carries no request data, client IP, request transaction name or response context, as with Sentry 7 (SENTRY-REQDATA-1)', () => {
    const out = execFileSync(
      process.execPath,
      [path.join(__dirname, '../lib/T-120/request-event.cjs')],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 }
    )
    const events = JSON.parse(out)
    const byValue = (v) => events.find((e) => e.exception.values[0].value === v)
    // the handler's capture, and the rejection reported once (the
    // integration's; the app handler's second capture is dropped)
    expect(events).toHaveLength(2)
    ;[byValue('T-120 c3 capture'), byValue('T-120 c3 rejection')].forEach(
      (e) => {
        expect(e).toBeDefined()
        expect(e.request).toBeUndefined()
        expect(e.user).toBeUndefined()
        expect(e.transaction).toBeUndefined()
        expect(Object.keys(e.contexts).sort()).toEqual(['runtime', 'trace'])
        expect(JSON.stringify(e)).not.toMatch(
          /203\.0\.113\.7|T-120\/1|referer\.test|essential_cookies_allowed|q=climate/
        )
      }
    )
  })
})
