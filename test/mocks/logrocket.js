// logrocket factory spy (40 §2.1): the real SDK would reach the real project (review:00 X10.15).
const LogRocket = {
  init: jest.fn(),
  identify: jest.fn(),
  track: jest.fn(),
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  getSessionURL: jest.fn(),
  startNewSession: jest.fn(),
  reduxMiddleware: jest.fn(() => () => (next) => (action) => next(action)),
}

module.exports = { __esModule: true, default: LogRocket, ...LogRocket }
