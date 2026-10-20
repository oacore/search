// setupFilesAfterEnv of the node and dom projects (40 §2.1): factory spies for
// the third-party SDKs, the map stub, and the router-mock reset. A test that
// needs a real module calls jest.requireActual, or jest.unmock('<name>') at the
// top of its file.
jest.mock('react-ga4', () => require('../mocks/react-ga4'))
jest.mock('logrocket', () => require('../mocks/logrocket'))
jest.mock('logrocket-react', () => require('../mocks/logrocket-react'))
jest.mock('@sentry/node', () => require('../mocks/sentry').create())
jest.mock('@sentry/browser', () => require('../mocks/sentry').create())
jest.mock('js-file-download', () => require('../mocks/js-file-download'))
jest.mock('../../modules/map/map', () => require('../mocks/map'))

beforeEach(() => {
  require('../mocks/next-router').resetRouter()
})
