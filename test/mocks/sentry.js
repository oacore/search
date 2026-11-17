// @sentry/nextjs factory spy (40 §2.1; @sentry/node and @sentry/browser until
// CS-SEN-2); one fresh object per mocked module.
const create = () => {
  const scope = {
    setTag: jest.fn(),
    setTags: jest.fn(),
    setExtra: jest.fn(),
    setExtras: jest.fn(),
    setContext: jest.fn(),
    setUser: jest.fn(),
    setLevel: jest.fn(),
    setFingerprint: jest.fn(),
  }
  const Sentry = {
    init: jest.fn(),
    captureException: jest.fn(() => 'event-id'),
    captureMessage: jest.fn(() => 'event-id'),
    captureEvent: jest.fn(() => 'event-id'),
    withScope: jest.fn((callback) => callback(scope)),
    configureScope: jest.fn((callback) => callback(scope)),
    setTag: jest.fn(),
    setTags: jest.fn(),
    setExtra: jest.fn(),
    setExtras: jest.fn(),
    setContext: jest.fn(),
    setUser: jest.fn(),
    addBreadcrumb: jest.fn(),
    flush: jest.fn(() => Promise.resolve(true)),
    close: jest.fn(() => Promise.resolve(true)),
    Severity: {
      Fatal: 'fatal',
      Error: 'error',
      Warning: 'warning',
      Log: 'log',
      Info: 'info',
      Debug: 'debug',
    },
    Integrations: {},
    onUncaughtExceptionIntegration: jest.fn((options) => ({
      name: 'OnUncaughtException',
      options,
    })),
    httpIntegration: jest.fn((options) => ({ name: 'Http', options })),
    Handlers: {
      requestHandler: jest.fn(() => (req, res, next) => next()),
      errorHandler: jest.fn(() => (err, req, res, next) => next(err)),
    },
    __scope: scope,
  }
  return { __esModule: true, default: Sentry, ...Sentry }
}

module.exports = { create }
