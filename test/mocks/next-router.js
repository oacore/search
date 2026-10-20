// next/router mock (40 §2.1): one mutable singleton, used as the default export
// (`Router`, store/filters.js:2, store/search.js:2) and as the useRouter()
// result. Its members are a superset of the installed next/router singleton
// (T-012 c3). Reset in beforeEach by test/setup/mocks.js; tests change it with
// `setRouter({...})` and read calls from the jest.fn members.
const React = require('react')

const mitt = () => {
  const all = Object.create(null)
  return {
    all,
    on(type, handler) {
      ;(all[type] || (all[type] = [])).push(handler)
    },
    off(type, handler) {
      if (all[type]) all[type].splice(all[type].indexOf(handler) >>> 0, 1)
    },
    emit(type, ...args) {
      ;(all[type] || []).slice().forEach((handler) => handler(...args))
    },
  }
}

const router = {}

const defaults = () => ({
  route: '/',
  pathname: '/',
  query: {},
  asPath: '/',
  basePath: '',
  components: {},
  isFallback: false,
  isReady: true,
  isPreview: false,
  isLocaleDomain: false,
  locale: undefined,
  locales: undefined,
  defaultLocale: undefined,
  readyCallbacks: [],
  push: jest.fn(() => Promise.resolve(true)),
  replace: jest.fn(() => Promise.resolve(true)),
  reload: jest.fn(),
  back: jest.fn(),
  prefetch: jest.fn(() => Promise.resolve()),
  beforePopState: jest.fn(),
  ready: jest.fn((cb) => cb()),
})

const events = mitt()

const reset = () => {
  for (const k of Object.keys(router)) delete router[k]
  Object.assign(router, defaults())
  for (const k of Object.keys(events.all)) delete events.all[k]
  router.events = events
  router.router = router
  return router
}

const setRouter = (partial = {}) => Object.assign(router, partial)

reset()

const useRouter = () => router
const withRouter = (Component) => {
  const WithRouter = (props) =>
    React.createElement(Component, { router, ...props })
  WithRouter.displayName = `withRouter(${
    Component.displayName || Component.name || 'Component'
  })`
  return WithRouter
}
const createRouter = () => router
const makePublicRouterInstance = () => router
class Router {}
Router.events = events

module.exports = {
  __esModule: true,
  default: router,
  useRouter,
  withRouter,
  createRouter,
  makePublicRouterInstance,
  Router,
  NextRouter: undefined,
  // test helpers
  router,
  setRouter,
  resetRouter: reset,
  // RouterContext of Next 10.2.3 (40 §2.1); 11-12:
  // next/dist/shared/lib/router-context, 13.5-16:
  // next/dist/shared/lib/router-context.shared-runtime
  ROUTER_CONTEXT_PATH: 'next/dist/next-server/lib/router-context',
}
