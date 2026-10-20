// react-ga4 factory spy (40 §2.1). Tests that need the real module use jest.requireActual('react-ga4').
const ReactGA = {
  initialize: jest.fn(),
  send: jest.fn(),
  event: jest.fn(),
  gtag: jest.fn(),
  ga: jest.fn(),
  set: jest.fn(),
  reset: jest.fn(),
  isInitialized: false,
}

module.exports = { __esModule: true, default: ReactGA, ReactGAImplementation: function ReactGAImplementation() {} }
