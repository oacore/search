// The only RTL importer (40 §2.1). Queries, events and waits come from
// @testing-library/dom 10; RTL 16 (React 18) mounts. RTL 16 takes dom 10 as its
// peer and configures its event and async wrappers with React's act when it
// loads, so events and async utilities are act-wrapped without a shim here.
// `act` is RTL's, which uses React.act (the act of react-dom/test-utils is
// deprecated on React 18.3). Swapped from RTL 12 at W6a (CS-R18-5).
const React = require('react')
const dom = require('@testing-library/dom')
const rtl = require('@testing-library/react')
const userEventModule = require('@testing-library/user-event')
const { RouterContext } = require('next/dist/shared/lib/router-context')

const { router: mockRouter } = require('../mocks/next-router')

const userEvent = userEventModule.default || userEventModule

// compose wrapper components: wrap(A, B) renders <A><B>{children}</B></A>
const composeWrappers = (wrappers) => {
  const list = wrappers.filter(Boolean)
  if (!list.length) return undefined
  return ({ children }) =>
    list.reduceRight((acc, W) => React.createElement(W, null, acc), children)
}

const render = (ui, { wrapper, wrappers = [], ...options } = {}) => {
  const result = rtl.render(ui, {
    ...options,
    wrapper: composeWrappers([...wrappers, wrapper]),
  })
  return { ...result, ...dom.getQueriesForElement(result.baseElement) }
}

// RouterContext provider for components that read the router through next/link
// or next/dist internals
const withRouter = (router = mockRouter) => {
  const WithRouter = ({ children }) =>
    React.createElement(RouterContext.Provider, { value: router }, children)
  return WithRouter
}

// the app's StoreProvider around a given RootStore instance (store/index.jsx)
const withStore = (store) => {
  const { StoreProvider } = require('../../store')
  const WithStore = ({ children }) =>
    React.createElement(StoreProvider, { store }, children)
  return WithStore
}

// local renderHook: RTL 16 has one, but without result.all
const renderHook = (hook, { initialProps, wrapper, wrappers = [] } = {}) => {
  const result = { current: undefined, all: [] }
  const Probe = ({ hookProps }) => {
    const value = hook(hookProps)
    result.current = value
    result.all.push(value)
    return null
  }
  const view = render(React.createElement(Probe, { hookProps: initialProps }), {
    wrapper,
    wrappers,
  })
  return {
    result,
    rerender: (props) =>
      view.rerender(React.createElement(Probe, { hookProps: props })),
    unmount: view.unmount,
  }
}

module.exports = {
  render,
  renderHook,
  withRouter,
  withStore,
  act: rtl.act,
  cleanup: rtl.cleanup,
  screen: dom.screen,
  within: dom.within,
  waitFor: dom.waitFor,
  waitForElementToBeRemoved: dom.waitForElementToBeRemoved,
  fireEvent: dom.fireEvent,
  prettyDOM: dom.prettyDOM,
  userEvent,
}
