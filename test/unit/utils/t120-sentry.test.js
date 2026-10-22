// T-120 (41 B, R-040, R-055): utils/sentry.js. The module reads SENTRY_DSN once
// at load: without a DSN it never calls `Sentry.init`; with a DSN it calls it
// exactly once, with `{ dsn }` and no other option. `@sentry/node` is the
// factory spy of test/setup/mocks.js (next.config.js aliases it to
// `@sentry/browser` for the client bundle: T-004). Every case loads a fresh
// copy with jest.isolateModules after setting the env, so each load gets its
// own spy.

// mixed case on purpose: any case folding of the value must show
const DSN = 'https://PubKey1A2b@O0.ingest.sentry.io/4504'

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
      expect(mod.Sentry).toBe(sentry)
      expect(sentry.init).toBeDefined()
      expect(sentry.init).not.toHaveBeenCalled()
    })
  })

  test('T-120 c1 @P1 the module still exports the SDK object, and only it, without a DSN', () => {
    const { mod, sentry } = loadWith(undefined)
    expect(Object.keys(mod)).toEqual(['Sentry'])
    expect(mod.Sentry).toBe(sentry)
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

  test('T-120 c2 @P1 with SENTRY_DSN Sentry.init is called once with exactly { dsn }', () => {
    const { mod, sentry } = loadWith(DSN)
    expect(mod.Sentry).toBe(sentry)
    expect(sentry.init).toHaveBeenCalledTimes(1)
    expect(sentry.init).toHaveBeenCalledWith({ dsn: DSN })
    expect(Object.keys(sentry.init.mock.calls[0][0])).toEqual(['dsn'])
    expect(Object.keys(mod)).toEqual(['Sentry'])
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
    expect(sentry.init).toHaveBeenCalledWith({ dsn: ' ' })
  })

  test('T-120 c2 @P1 each fresh load initialises its own SDK instance once (no shared state between loads)', () => {
    const a = loadWith(DSN)
    const b = loadWith(DSN)
    expect(a.sentry).not.toBe(b.sentry)
    expect(a.sentry.init).toHaveBeenCalledTimes(1)
    expect(b.sentry.init).toHaveBeenCalledTimes(1)
  })
})
