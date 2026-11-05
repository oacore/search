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
  domainLocales: undefined,
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

const reset = () => {
  for (const k of Object.keys(router)) delete router[k]
  Object.assign(router, defaults())
  for (const k of Object.keys(events.all)) delete events.all[k]
  router.events = events
  router.router = router
  // Next 12's singleton also carries the module's exports (client/router.js:
  // Object.assign(exports.default, exports), then module.exports = it), and
  // on 12.3 the `__esModule` mark it defines on the singleton before that
  Object.assign(router, {
    __esModule: true,
    Router,
    withRouter,
    useRouter,
    createRouter,
    makePublicRouterInstance,
    default: router,
  })
  return router
}

const setRouter = (partial = {}) => Object.assign(router, partial)

reset()

module.exports = {
  __esModule: true,
  default: router,
  useRouter,
  withRouter,
  createRouter,
  makePublicRouterInstance,
  Router,
  NextRouter: undefined,
  // the singleton's members at the top level, as Next 12's module is the
  // singleton itself
  get readyCallbacks() {
    return router.readyCallbacks
  },
  get ready() {
    return router.ready
  },
  get push() {
    return router.push
  },
  get replace() {
    return router.replace
  },
  get reload() {
    return router.reload
  },
  get back() {
    return router.back
  },
  get prefetch() {
    return router.prefetch
  },
  get beforePopState() {
    return router.beforePopState
  },
  // test helpers
  router,
  setRouter,
  resetRouter: reset,
  // RouterContext of Next 13.5-16 (40 §2.1); 10.2.3:
  // next/dist/next-server/lib/router-context, 11-12:
  // next/dist/shared/lib/router-context
  ROUTER_CONTEXT_PATH: 'next/dist/shared/lib/router-context.shared-runtime',
}
